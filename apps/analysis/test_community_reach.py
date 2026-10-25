import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box, GeometryCollection, LineString
from community_reach import aggregate, partition, calculate, polygonal
from prepare_community import publish


class CommunityReachTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.file = self.root / 'population.tif'
        self.area = box(0,0,200,100)
        self.times = {5:box(0,0,25,100),10:box(0,0,50,100),15:box(0,0,100,100),30:box(0,0,175,100)}
        self.expected = {5:25,10:50,15:100,30:775}
        self.write([100,900])
    def tearDown(self):
        self.temp.cleanup()
    def write(self, values):
        with rasterio.open(self.file,'w',driver='GTiff',height=1,width=2,count=1,dtype='float32',crs='EPSG:6933',transform=from_origin(0,100,100,100),nodata=-200) as source:
            source.write(np.array([values],dtype='float32'),1)
    def test_weighted_partial_cells_unknown_denominator_and_deduplication(self):
        regions = partition(self.area, [(box(0,0,50,100),1), (box(0,0,50,100),2), (box(50,0,175,100),10), (box(175,0,200,100),None)])
        groups = aggregate(self.area,self.times,regions,[self.file],'EPSG:6933',1000,self.expected)
        self.assertEqual([g['totalResidents'] for g in groups],[50,0,0,0,725,225])
        self.assertEqual(groups[0]['contours'][2]['percent'],100)
        self.assertAlmostEqual(groups[4]['contours'][2]['percent'],50/725*100)
        self.assertAlmostEqual(groups[5]['contours'][2]['shareOfOutside'],225/900*100)
        self.assertIsNone(groups[1]['contours'][0]['percent'])
        self.assertEqual(sum(g['totalResidents'] for g in groups),1000)
        for i,total in enumerate(self.expected.values()):
            self.assertEqual(sum(g['contours'][i]['residents'] for g in groups),total)
    def test_conflicting_classes_become_unknown_instead_of_double_counted(self):
        regions = partition(self.area, [(box(0,0,120,100),1),(box(100,0,200,100),9)])
        groups = aggregate(self.area,self.times,regions,[self.file],'EPSG:6933',1000,self.expected)
        self.assertAlmostEqual(groups[5]['totalResidents'],180)
        self.assertEqual(sum(g['totalResidents'] for g in groups),1000)
    def test_nodata_and_wrong_denominator_do_not_produce_rates(self):
        regions = partition(self.area,[(self.area,1)])
        with self.assertRaisesRegex(ValueError,'denominator'):
            aggregate(self.area,self.times,regions,[self.file],'EPSG:6933',999,self.expected)
        self.write([100,-200])
        with self.assertRaisesRegex(ValueError,'Incomplete'):
            aggregate(self.area,self.times,regions,[self.file],'EPSG:6933',100,self.expected)
    def test_shared_border_lines_do_not_invalidate_an_area_intersection(self):
        geometry = GeometryCollection([box(0,0,1,1),LineString([(2,0),(2,1)])])
        self.assertEqual(polygonal(geometry).area,1)
        self.assertEqual(polygonal(geometry).geom_type,"Polygon")

    def test_absent_release_is_unavailable_not_zero(self):
        self.assertEqual(calculate(self.root,None,None,{},[],None,{},False)['state'],'unavailable')
    def test_failed_join_preserves_existing_release(self):
        meta={'country':'GB-WLS','areaCount':2}
        directory = self.root / 'community'
        directory.mkdir()
        existing = '[{"id":"previous-edition"}]'
        (directory / 'catalogue.json').write_text(existing)
        with self.assertRaisesRegex(ValueError,'Incomplete'):
            publish(self.root,meta,[])
        self.assertEqual((self.root/'community/catalogue.json').read_text(),existing)

if __name__ == '__main__': unittest.main()
