"""Read the SNBP workbook using Python's standard library; no macros or formulas run."""
import json
import posixpath
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REQUIRED = {"UF", "NOME MUNICIPIO", "NOME DA BIBLIOTECA", "ENDEREÇO", "CEP", "TIPO BIBLIOTECA"}


def read_workbook(filename):
    with zipfile.ZipFile(filename) as archive:
        if sum(i.file_size for i in archive.infolist()) > 64 * 1024 * 1024:
            raise ValueError("Workbook exceeds 64 MiB uncompressed")
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(x.itertext()) for x in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        relationships = {r.attrib["Id"]: r.attrib["Target"] for r in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        matches = []
        for sheet in workbook.findall("s:sheets/s:sheet", NS):
            key = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = relationships[key]
            member = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
            root = ET.fromstring(archive.read(member))
            rows = []
            for row in root.findall("s:sheetData/s:row", NS):
                values = {}
                for cell in row.findall("s:c", NS):
                    if cell.find("s:f", NS) is not None:
                        raise ValueError("Formula cell in source workbook")
                    column = "".join(c for c in cell.attrib["r"] if c.isalpha())
                    value = cell.find("s:v", NS)
                    value = value.text if value is not None else ""
                    if cell.attrib.get("t") == "s":
                        value = strings[int(value)]
                    elif cell.attrib.get("t") == "inlineStr":
                        value = "".join(t.text or "" for t in cell.findall("s:is//s:t", NS))
                    values[column] = (value or "").strip()
                if any(values.values()):
                    rows.append(values)
            headers = [i for i, row in enumerate(rows) if REQUIRED.issubset(row.values())]
            if not headers:
                continue
            if len(headers) != 1:
                raise ValueError("Multiple SNBP header rows")
            start = headers[0]
            header = rows[start]
            if len(set(header.values())) != len(header):
                raise ValueError("Duplicate SNBP columns")
            result = []
            for row in rows[start + 1:]:
                if any(v for k, v in row.items() if k not in header):
                    raise ValueError("Unexpected populated column")
                result.append({name: row.get(column, "") for column, name in header.items()})
            matches.append(result)
        if len(matches) != 1:
            raise ValueError("Expected exactly one SNBP library worksheet")
        return matches[0]


if __name__ == "__main__":
    print(json.dumps(read_workbook(sys.argv[1]), ensure_ascii=False))
