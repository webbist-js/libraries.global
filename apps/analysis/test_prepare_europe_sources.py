import csv
import io
import unittest

from prepare_europe_sources import (
    CAR_FIELDS, irish_observation, italian_observation, normalize_ed_code,
    parse_irish_census, parse_pobal, reconcile_irish_codes,
)


class EuropeSourceTests(unittest.TestCase):
    def census_row(self, guid="a", population="10"):
        return {"GUID": guid, "GEOGDESC": "Area", "T1_1AGETT": population,
                "T15_1_TC": "5", **dict(zip(CAR_FIELDS, ["1", "2", "1", "0", "0", "1"]))}

    def test_car_nonresponse_is_preserved(self):
        row = irish_observation(self.census_row())
        self.assertEqual(row["withoutCarPercent"], 20)
        self.assertEqual(row["notStatedPercent"], 20)
        self.assertEqual(row["households"], 5)

    def test_car_counts_must_reconcile_and_missing_is_not_zero(self):
        with self.assertRaisesRegex(ValueError, "reconcile"):
            irish_observation({**self.census_row(), "T15_1_TC": "6"})
        with self.assertRaisesRegex(ValueError, "invalid count"):
            irish_observation({**self.census_row(), "T15_1_NC": ""})
        row = self.census_row()
        row.update({field: "0" for field in ["T15_1_TC", *CAR_FIELDS]})
        self.assertIsNone(irish_observation(row)["withoutCarPercent"])

    def test_national_reconciliation(self):
        text = io.StringIO()
        writer = csv.DictWriter(text, fieldnames=self.census_row().keys())
        writer.writeheader()
        writer.writerows([self.census_row("IE0"), self.census_row()])
        areas, total = parse_irish_census(text.getvalue(), expected=1)
        self.assertEqual(total["population"], areas[0]["population"])
        with self.assertRaisesRegex(ValueError, "national population"):
            parse_irish_census(text.getvalue().replace("IE0,Area,10", "IE0,Area,11"), expected=1)

    def test_official_splits_aggregate_before_comparing_pobal(self):
        areas = [{"code": "north", "population": 4}, {"code": "south", "population": 6}]
        crosswalk = [{"ED_GUID": guid, "ED_ID_STR": "047298"} for guid in ["north", "south"]]
        joined, report = reconcile_irish_codes(areas, {"047298": {"population": 10}}, crosswalk)
        self.assertEqual(len(joined), 2)
        self.assertEqual(report["populationMismatches"], [])
        self.assertEqual(len(report["deprivationGroups"]), 1)
        self.assertEqual(report["splitDivisions"][0]["population"], 10)
        self.assertNotIn("deprivation", joined[0])

    def test_incomplete_crosswalk_and_population_mismatch_stay_visible(self):
        areas = [{"code": "a", "population": 10}]
        with self.assertRaisesRegex(ValueError, "GUIDs"):
            reconcile_irish_codes(areas, {}, [])
        _, report = reconcile_irish_codes(areas, {"017001": {"population": 11}},
                                          [{"ED_GUID": "a", "ED_ID_STR": "017001"}])
        self.assertEqual(len(report["populationMismatches"]), 1)

    def test_ed_code_zeroes_and_cork_suffixes(self):
        self.assertEqual(normalize_ed_code("17001"), "017001")
        self.assertEqual(normalize_ed_code("4727719"), "04727719")
        self.assertEqual(normalize_ed_code("047235/04702719"), "047235/04702719")
        with self.assertRaises(ValueError):
            normalize_ed_code("123.5")

    def test_pobal_formatted_counts_and_duplicate_normalised_ids(self):
        header = "ED_ID_STR,ED_ENGLISH,TOTPOP22,Index22_ED_std_rel_wt,Index22_ED_rel_wt_lab\n"
        row = '17001,Area,"1,455.00",-2.4,Category\n'
        self.assertEqual(parse_pobal(header + row, expected=1)["017001"]["population"], 1455)
        with self.assertRaisesRegex(ValueError, "code or score"):
            parse_pobal(header + row + row.replace("17001", "017001"), expected=2)

    def italy_row(self):
        return {"SEZ21_ID": "70018888881", "PROCOM": "007001", "CODREG": "2",
                "COMUNE": "Allein", "P1": "10", "P2": "4", "P3": "6", "PF1": "5", "NA1": "8"}

    def test_italian_nonspatial_counts_do_not_become_no_car_households(self):
        row = italian_observation(self.italy_row())
        self.assertTrue(row["nonSpatial"])
        self.assertEqual(row["code"], "0070018888881")
        self.assertEqual(row["ownedCars"], 8)
        self.assertNotIn("withoutCar", row)
        self.assertEqual(row["population"], 10)

    def test_italian_invalid_totals_and_missing_values(self):
        with self.assertRaisesRegex(ValueError, "sex totals"):
            italian_observation({**self.italy_row(), "P1": "11"})
        changed = italian_observation({**self.italy_row(), "PROCOM": "007002"})
        self.assertTrue(changed["municipalityCodeChanged"])
        self.assertEqual(changed["boundaryMunicipalityCode"], "007001")
        with self.assertRaisesRegex(ValueError, "municipality"):
            italian_observation({**self.italy_row(), "PROCOM": "INVALID"})
        self.assertIsNone(italian_observation({**self.italy_row(), "P1": "..."})["population"])


if __name__ == "__main__":
    unittest.main()
