"""Dissolve bounded reporting-unit geometry; never import this in the browser."""
import json
import sys

from shapely import union_all, make_valid
from shapely.geometry import mapping, shape


def prepare(input_file, output_file):
    with open(input_file) as source:
        data = json.load(source)
    areas = {}
    for feature in data["features"]:
        geometry = shape(feature["geometry"])
        if not geometry.is_valid:
            repaired = make_valid(geometry)
            if abs(repaired.area - geometry.area) > max(geometry.area * .001, 1e-10):
                raise ValueError("Display geometry repair exceeds area tolerance")
            geometry = repaired
        areas[feature["properties"]["code"]] = geometry
    if len(areas) > 2048 or len(data["regions"]) > 512:
        raise ValueError("Reporting geography exceeds preparation budget")
    output = []
    for region in data["regions"]:
        geometry = union_all([areas[code] for code in region["members"]])
        if not geometry.is_valid or geometry.is_empty:
            raise ValueError("Invalid dissolved reporting region")
        # Display geometry only. Area denominators are calculated from originals.
        output.append({"type": "Feature", "id": region["id"],
                       "properties": {"code": region["id"], "name": region["name"]},
                       "geometry": mapping(geometry.simplify(.001, preserve_topology=True))})
    with open(output_file, "w") as out:
        json.dump({"type": "FeatureCollection", "features": output}, out, separators=(",", ":"))


if __name__ == "__main__":
    prepare(sys.argv[1], sys.argv[2])
