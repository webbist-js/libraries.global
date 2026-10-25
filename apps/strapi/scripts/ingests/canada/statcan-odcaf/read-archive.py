"""Read the two known ODCAF v1.0 CSV members without extracting paths."""
import io
import json
import sys
import zipfile

with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
    result = {}
    for key, member in [("csv", "ODCAF_V1.0/ODCAF_v1.0.csv"),
                        ("dataSourcesCsv", "ODCAF_V1.0/Data_Sources.csv")]:
        if archive.namelist().count(member) != 1:
            raise ValueError(f"Missing or duplicate archive member: {member}")
        if archive.getinfo(member).file_size > 8 * 1024 * 1024:
            raise ValueError(f"Oversized archive member: {member}")
        # The official release uses Windows-1252, including French accents.
        result[key] = archive.read(member).decode("cp1252")
    json.dump(result, sys.stdout)
