"""Read the publisher's complete MARC XML, retaining only institutional facts."""
import json
import sys
import xml.etree.ElementTree as ET

NS = "{http://www.loc.gov/MARC21/slim}"
FIELDS = {"SGL", "NAZ", "ADR", "KRJ", "TYP", "STT", "URL", "MES", "TEL"}

root = ET.parse(sys.stdin.buffer).getroot()
if root.tag != NS + "collection":
    raise ValueError("Expected a complete MARC collection")
records = []
for record in root.findall(NS + "record"):
    fields = {}
    for field in record.findall(NS + "datafield"):
        tag = field.get("tag")
        if tag not in FIELDS:
            continue
        if tag == "TEL":
            fields.setdefault(tag, []).extend(
                {"a": phone.text or ""}
                for phone in field.findall(NS + "subfield")
                if phone.get("code") == "a"
            )
            continue
        subfields = {}
        for subfield in field.findall(NS + "subfield"):
            code = subfield.get("code")
            if code in subfields:
                raise ValueError("Repeated subfield requires adapter review: " + tag)
            subfields[code] = subfield.text or ""
        fields.setdefault(tag, []).append(subfields)
    records.append(fields)
json.dump(records, sys.stdout, ensure_ascii=False)
