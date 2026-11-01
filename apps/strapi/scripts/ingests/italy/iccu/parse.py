"""Read only the expected JSON member; never extract archive paths to disk."""
import io
import json
import sys
import zipfile

with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
    if archive.namelist() != ["biblioteche.json"]:
        raise ValueError("Unexpected ICCU archive members")
    if archive.getinfo("biblioteche.json").file_size > 80 * 1024 * 1024:
        raise ValueError("ICCU JSON exceeds size budget")
    data = json.loads(archive.read("biblioteche.json"))
    json.dump(data, sys.stdout, ensure_ascii=False)
