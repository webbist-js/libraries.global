import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from sources import download, sha256


class RangeDownloadTests(unittest.TestCase):
    content = b"0123456789abcdef" * 1000

    def response(self, request, **kwargs):
        if request.get_method() == "HEAD":
            data, status = b"", 200
            headers = {"Content-Length": str(len(self.content)), "Accept-Ranges": "bytes", "ETag": '"edition1"'}
        else:
            self.assertEqual(request.get_header("If-match"), '"edition1"')
            start, end = map(int, request.get_header("Range").removeprefix("bytes=").split("-"))
            data, status = self.content[start:end + 1], 206
            headers = {"Content-Range": f"bytes {start}-{end}/{len(self.content)}", "ETag": '"edition1"'}
        result = io.BytesIO(data)
        result.status, result.headers = status, headers
        return result

    def test_ranges_are_exact_and_replay_verifies_the_combined_hash(self):
        with tempfile.TemporaryDirectory() as directory, patch("urllib.request.urlopen", side_effect=self.response) as fetch:
            path = Path(directory) / "source.pbf"
            result = download("https://example.test/source.pbf", path, 100000, reserve_bytes=0, workers=4)
            self.assertEqual(path.read_bytes(), self.content)
            self.assertEqual(result["sha256"], sha256(path))
            self.assertEqual(fetch.call_count, 5)
            self.assertEqual(download("https://example.test/source.pbf", path, 100000, workers=4), result)
            self.assertEqual(fetch.call_count, 5)

    def test_changed_etag_or_ignored_range_cannot_publish_a_snapshot(self):
        for field, value in [("ETag", '"edition2"'), ("Content-Range", "bytes 0-1/2")]:
            def changed(request, **kwargs):
                response = self.response(request, **kwargs)
                if request.get_method() != "HEAD":
                    response.headers[field] = value
                return response
            with tempfile.TemporaryDirectory() as directory, patch("urllib.request.urlopen", side_effect=changed):
                path = Path(directory) / "source.pbf"
                with self.assertRaisesRegex(ValueError, "edition or ignored"):
                    download("https://example.test/source.pbf", path, 100000, reserve_bytes=0, workers=4)
                self.assertFalse(path.exists())
                self.assertFalse(path.with_suffix(".pbf.source.json").exists())


if __name__ == "__main__":
    unittest.main()
