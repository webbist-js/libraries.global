"""Stage licensed IE/IT context observations and a readiness report, never activate layers.

Downloads are bounded and hash-checked through sources.py. This command does not
write CMS content, start services, build routing graphs or modify active catalogues.
"""
import argparse
import csv
import fcntl
import io
import json
import math
import re
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from sources import download, write_json

SAPS = "https://www.cso.ie/en/media/csoie/census/census2022/SAPS_2022_CSOED3270923.csv"
POBAL = "https://www.pobal.ie/wp-content/uploads/2024/01/hp-deprivation-index-scores-2022.csv"
ED_SERVICE = "https://services-eu1.arcgis.com/BuS9rtTsYEV5C0xh/arcgis/rest/services/CSO_Electoral_Divisions_National_Statistical_Boundaries_2022_Ungeneralised_view/FeatureServer/1"
ED_ITEM = "https://www.arcgis.com/sharing/rest/content/items/deba50580cc24e4eb9cf50eb3cfebf69?f=json"
ISTAT = "https://esploradati.istat.it/databrowser/DWL/PERMPOP/SUBCOM/Dati_regionali_2023.zip"
CAR_FIELDS = ["T15_1_NC", "T15_1_1C", "T15_1_2C", "T15_1_3C", "T15_1_GE4C", "T15_1_NSC"]


def count(value):
    if not re.fullmatch(r"\d+", str(value)):
        raise ValueError(f"Missing, suppressed or invalid count: {value!r}")
    return int(value)


def irish_observation(row):
    total = count(row["T15_1_TC"])
    parts = [count(row[field]) for field in CAR_FIELDS]
    if sum(parts) != total:
        raise ValueError("Car-availability categories do not reconcile to households")
    return {"code": row["GUID"].lower(), "name": row["GEOGDESC"],
            "population": count(row["T1_1AGETT"]), "households": total,
            "withoutCar": parts[0], "notStated": parts[-1],
            "withoutCarPercent": parts[0] * 100 / total if total else None,
            "notStatedPercent": parts[-1] * 100 / total if total else None}


def parse_irish_census(text, expected=3420):
    rows = list(csv.DictReader(io.StringIO(text)))
    national = [r for r in rows if r["GUID"] == "IE0"]
    areas = [irish_observation(r) for r in rows if r["GUID"] != "IE0"]
    if len(national) != 1 or len(areas) != expected or len({r["code"] for r in areas}) != expected:
        raise ValueError("Incomplete census ED coverage or duplicate GUIDs")
    total = irish_observation(national[0])
    for field in ["population", "households", "withoutCar", "notStated"]:
        if sum(r[field] for r in areas) != total[field]:
            raise ValueError(f"Electoral divisions do not reconcile to national {field}")
    return areas, total


def parse_pobal(text, expected=3417):
    rows = list(csv.DictReader(io.StringIO(text)))
    result = {}
    for row in rows:
        code = normalize_ed_code(row["ED_ID_STR"])
        score = float(row["Index22_ED_std_rel_wt"])
        if not code or code in result or not math.isfinite(score):
            raise ValueError("Invalid Pobal code or score")
        # Publisher mixes plain counts with thousands separators and .00.
        population = row["TOTPOP22"].strip()
        if not re.fullmatch(r"(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?", population):
            raise ValueError("Invalid Pobal population")
        result[code] = {"sourceCode": code, "name": row["ED_ENGLISH"],
                        "population": int(float(population.replace(",", ""))), "relativeScore": score,
                        "category": row["Index22_ED_rel_wt_lab"]}
    if len(result) != expected:
        raise ValueError("Unexpected Pobal coverage")
    return result


def normalize_ed_code(value):
    parts = str(value).strip().split("/")
    if any(not re.fullmatch(r"\d{1,8}", part) for part in parts):
        raise ValueError("Invalid electoral division source code")
    # Cork boundary changes carry a 2019 suffix; retain it, including its zero.
    return "/".join(part.zfill(8 if len(part) > 6 else 6) for part in parts)


def reconcile_irish_codes(areas, pobal, crosswalk):
    by_guid = {}
    for row in crosswalk:
        guid, code = row["ED_GUID"].lower(), normalize_ed_code(row["ED_ID_STR"])
        if guid in by_guid:
            raise ValueError("Ambiguous official electoral-division crosswalk")
        by_guid[guid] = code
    if set(by_guid) != {a["code"] for a in areas}:
        raise ValueError("Boundary crosswalk does not match census GUIDs")
    missing, mismatched, joined, groups = [], [], [], {}
    for area in areas:
        code = by_guid[area["code"]]
        group = groups.setdefault(code, {"sourceCode": code, "memberGuids": [], "population": 0})
        group["memberGuids"].append(area["code"])
        group["population"] += area["population"]
        joined.append({**area, "sourceCode": code})
    for code, group in groups.items():
        deprivation = pobal.get(code)
        if deprivation is None:
            missing.append(code)
        elif deprivation["population"] != group["population"]:
            mismatched.append({"sourceCode": code, "censusPopulation": group["population"],
                               "pobalPopulation": deprivation["population"]})
        group["deprivation"] = deprivation
    return joined, {"missingDeprivation": missing, "populationMismatches": mismatched,
                    "unmatchedPobalCodes": sorted(set(pobal) - set(groups)),
                    "splitDivisions": [g for g in groups.values() if len(g["memberGuids"]) > 1],
                    "deprivationGroups": list(groups.values())}


class Acquisition:
    def __init__(self, root, refresh=False, offline=False):
        if refresh and offline:
            raise ValueError("Choose refresh or offline")
        self.root, self.refresh, self.offline, self.inputs = root, refresh, offline, []

    def get(self, name, url, max_mb=32, licence="CC BY 4.0", publisher=""):
        target = self.root / "sources" / name
        if self.offline and (not target.exists() or not target.with_suffix(target.suffix + ".source.json").exists()):
            raise ValueError(f"Offline source missing: {name}")
        metadata = download(url, target, max_mb * 1024 ** 2, refresh=self.refresh)
        self.inputs.append({**metadata, "file": str(target), "licence": licence,
                            "licenceUrl": "https://creativecommons.org/licenses/by/4.0/", "publisher": publisher})
        return target


def prepare_ireland(acquire):
    census = acquire.get("saps-2022-ed.csv", SAPS, publisher="Central Statistics Office")
    pobal = acquire.get("pobal-2022-ed.csv", POBAL, publisher="Pobal; Trutz Haase and Jonathan Pratschke")
    item = json.loads(acquire.get("ed-boundary-licence.json", ED_ITEM, publisher="Tailte Éireann").read_text())
    if "https://creativecommons.org/licenses/by/4.0/" not in item.get("licenseInfo", ""):
        raise ValueError("Boundary licence changed; review required")
    crosswalk = []
    for offset in range(0, 4000, 1000):
        query = urllib.parse.urlencode({"where": "1=1", "outFields": "ED_GUID,ED_ID_STR,ED_ENGLISH",
                                      "returnGeometry": "false", "orderByFields": "OBJECTID",
                                      "resultOffset": offset, "resultRecordCount": 1000, "f": "json"})
        page = json.loads(acquire.get(f"ed-crosswalk-{offset}.json", ED_SERVICE + "/query?" + query,
                                     publisher="Tailte Éireann").read_text())
        if "features" not in page:
            raise ValueError("Invalid boundary crosswalk response")
        crosswalk.extend(f["attributes"] for f in page["features"])
    areas, national = parse_irish_census(census.read_text(encoding="cp1252"))
    joined, gaps = reconcile_irish_codes(areas, parse_pobal(pobal.read_text(encoding="cp1252")), crosswalk)
    write_json(acquire.root / "observations.json", {"country": "IE", "year": 2022,
               "boundary": "CSO statistical electoral divisions 2022", "areas": joined,
               "deprivationGroups": gaps.pop("deprivationGroups")})
    return {"country": "IE", "year": 2022, "areaCount": len(areas), "national": national, **gaps,
            "carDefinition": "Households with no motor car / all responding and nonresponding households. Not stated is retained separately; it is not known car ownership.",
            "deprivationDefinition": "Pobal HP relative score; lower is more deprived. No invented UK-equivalent rank or decile.",
            "readyForActivation": False,
            "remaining": ["Prepare and validate full boundary geometries and administrative population ownership",
                          "Union split census areas into their official deprivation reporting divisions",
                          "Build buffered routing/population assets and pass walking/cycling canaries",
                          "Prepare analytical deprivation index separately from display geometry"]}


def spreadsheet_rows(data, selected=None):
    """Stream the first worksheet instead of loading a regional workbook DOM."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        if sum(info.file_size for info in book.infolist()) > 1024 ** 3:
            raise ValueError("Workbook exceeds uncompressed size budget")
        strings = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = ["".join(n.itertext()) for n in
                       ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", ns)]
        positions, selected_indexes = {}, None
        with book.open("xl/worksheets/sheet1.xml") as sheet:
            for _, element in ET.iterparse(sheet, events=("end",)):
                if element.tag != "{" + ns["m"] + "}row":
                    continue
                values = []
                for cell in element.findall("m:c", ns):
                    letters = cell.attrib["r"].rstrip("0123456789")
                    index = positions.get(letters)
                    if index is None:
                        index = 0
                        for letter in letters:
                            index = index * 26 + ord(letter) - 64
                        positions[letters] = index
                    while len(values) < index:
                        values.append("")
                    if selected_indexes is not None and index not in selected_indexes:
                        continue
                    value = cell.find("m:v", ns)
                    inline = cell.find("m:is", ns)
                    text = value.text if value is not None else "".join(inline.itertext()) if inline is not None else ""
                    values[index - 1] = strings[int(text)] if cell.attrib.get("t") == "s" else text
                if selected is not None and selected_indexes is None:
                    selected_indexes = {i + 1 for i, name in enumerate(values) if name in selected}
                yield values
                element.clear()


def italian_observation(row):
    code = str(row["SEZ21_ID"]).zfill(13)
    municipality = str(row["PROCOM"]).zfill(6)
    if not re.fullmatch(r"\d{13}", code) or not re.fullmatch(r"\d{6}", municipality):
        raise ValueError("Invalid Italian section/municipality code")
    def optional_count(value):
        return None if value in {None, "", "-", "..", "...", "…"} else count(value)
    population = optional_count(row["P1"])
    male, female = optional_count(row["P2"]), optional_count(row["P3"])
    if None not in (population, male, female) and male + female != population:
        raise ValueError("Italian population sex totals disagree")
    return {"code": code, "municipalityCode": municipality,
            "boundaryMunicipalityCode": code[:6], "municipalityCodeChanged": code[:6] != municipality,
            "regionCode": str(row["CODREG"]).zfill(2), "municipalityName": row["COMUNE"],
            "population": population, "households": optional_count(row["PF1"]),
            "ownedCars": optional_count(row["NA1"]),
            "nonSpatial": code[-7:].startswith(("888888", "999999"))}


def prepare_italy(acquire, region="02"):
    archive = acquire.get("istat-sections-2023.zip", ISTAT, max_mb=256, publisher="Istat")
    summaries = []
    with zipfile.ZipFile(archive) as zipped:
        names = [n for n in zipped.namelist() if re.search(r"/R\d{2}_.+_2023_sezioni.xlsx$", n)]
        if len(names) != 20 or {re.search(r"/R(\d{2})_", n)[1] for n in names} != {f"{i:02}" for i in range(1, 21)}:
            raise ValueError("Incomplete Italian regional archive")
        dictionary = list(spreadsheet_rows(zipped.read("Dati_regionali_2023/TRACCIATO FILE REGIONALI.xlsx")))
        definitions = {r[0]: r[1] for r in dictionary[1:] if len(r) > 1}
        if definitions.get("NA1") != "Automobili di proprietà" or definitions.get("P1") != "Popolazione residente - totale":
            raise ValueError("Italian measure definitions changed")
        write_json(acquire.root / "variable-definitions.json", definitions)
        for name in sorted(names):
            code = re.search(r"/R(\d{2})_", name)[1]
            if region != "all" and region != code:
                continue
            if zipped.getinfo(name).file_size > 64 * 1024 ** 2:
                raise ValueError("Regional workbook exceeds size budget")
            fields = {"CODREG", "COMUNE", "PROCOM", "SEZ21_ID", "P1", "P2", "P3", "PF1", "NA1"}
            rows = iter(spreadsheet_rows(zipped.read(name), selected=fields))
            header = next(rows)
            if len(header) != len(set(header)) or not fields.issubset(header):
                raise ValueError("Italian census schema changed")
            ids, municipalities = set(), set()
            summary = {"regionCode": code, "sections": 0, "population": 0, "nonSpatialSections": 0,
                       "nonSpatialPopulation": 0, "missingPopulation": 0, "municipalityCodeChanges": 0}
            target = acquire.root / f"population-{code}.ndjson"
            temporary = target.with_suffix(".tmp")
            with temporary.open("w") as output:
                for cells in rows:
                    observation = italian_observation(dict(zip(header, cells)))
                    if observation["regionCode"] != code or observation["code"] in ids:
                        raise ValueError("Duplicate or misplaced Italian section")
                    ids.add(observation["code"])
                    municipalities.add(observation["municipalityCode"])
                    summary["sections"] += 1
                    summary["population"] += observation["population"] or 0
                    summary["missingPopulation"] += observation["population"] is None
                    summary["municipalityCodeChanges"] += observation["municipalityCodeChanged"]
                    if observation["nonSpatial"]:
                        summary["nonSpatialSections"] += 1
                        summary["nonSpatialPopulation"] += observation["population"] or 0
                    output.write(json.dumps(observation, ensure_ascii=False) + "\n")
            if not ids:
                raise ValueError("Empty regional workbook")
            temporary.replace(target)
            summary["municipalities"] = len(municipalities)
            summaries.append(summary)
            print(json.dumps({"stage": "regional-population", **summary}), flush=True)
    return {"country": "IT", "year": 2023, "boundaryYear": 2021, "regions": summaries,
            "nationalCoverage": region == "all", "readyForActivation": False,
            "carAccessSupported": False, "carDefinition": "NA1 counts owned automobiles, not households without a car. No car-availability percentage is derived.",
            "remaining": ["Join 2021 boundary codes and reconcile independent regional/municipal population totals",
                          "Resolve nonspatial sections; do not assign their population to a fabricated polygon",
                          "Find a licensed household no-car numerator and denominator",
                          "Select and validate a nationwide deprivation release; city-only IDISE is not national coverage",
                          "Prepare buffered routing/population assets and pass walking/cycling canaries"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("country", choices=["ireland", "italy"])
    parser.add_argument("--root", type=Path, default=Path("data/europe-staging"))
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--region", default="02", choices=["all"] + [f"{i:02}" for i in range(1, 21)],
                        help="Italy pilot region, default Aosta Valley (02); all processes regions sequentially")
    args = parser.parse_args()
    root = args.root.resolve() / args.country
    root.mkdir(parents=True, exist_ok=True)
    with (root / "prepare.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        acquire = Acquisition(root, args.refresh, args.offline)
        report = prepare_ireland(acquire) if args.country == "ireland" else prepare_italy(acquire, args.region)
        report["inputs"] = acquire.inputs
        write_json(root / "readiness.json", report)
    print(json.dumps({k: len(v) if isinstance(v, list) and k != "remaining" else v
                      for k, v in report.items() if k != "inputs"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
