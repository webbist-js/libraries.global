"""Isolated workbook fixtures; no publisher files or CMS access."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from xml.sax.saxutils import escape
import zipfile

READER = Path(__file__).resolve().parents[2] / "scripts/ingests/_shared/read-expansion-xlsx.py"
spec = importlib.util.spec_from_file_location("snbp_reader", READER)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
HEADERS = ["UF", "NOME MUNICIPIO", "NOME DA BIBLIOTECA", "ENDEREÇO", "CEP", "TIPO BIBLIOTECA"]


def row(number, values):
    return '<row>' + ''.join(
        f'<c r="{chr(65 + i)}{number}" t="inlineStr"><is><t>{escape(v)}</t></is></c>'
        for i, v in enumerate(values)
    ) + '</row>'


class WorkbookTests(unittest.TestCase):
    def read(self, rows, copies=1):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "fixture.xlsx"
            with zipfile.ZipFile(file, "w") as archive:
                archive.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + ''.join(f'<sheet name="Sheet{i}" r:id="rId{i}"/>' for i in range(copies)) + '</sheets></workbook>')
                archive.writestr("xl/_rels/workbook.xml.rels", '<Relationships>' + ''.join(f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml"/>' for i in range(copies)) + '</Relationships>')
                for i in range(copies):
                    archive.writestr(f"xl/worksheets/sheet{i}.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows + '</sheetData></worksheet>')
            return reader.read_workbook(file)

    def test_title_unicode_and_leading_zero(self):
        result = self.read(row(1, ["SNBP 2025–2026"]) + row(2, HEADERS) + row(3, ["SÃO PAULO", "São Paulo", "Biblioteca & Cultura", "Rua 1", "01234567", "PÚBLICA"]))
        self.assertEqual(result[0]["NOME DA BIBLIOTECA"], "Biblioteca & Cultura")
        self.assertEqual(result[0]["CEP"], "01234567")

    def test_rejects_formula(self):
        with self.assertRaisesRegex(ValueError, "Formula"):
            self.read(row(1, HEADERS) + '<row><c r="A2"><f>1+1</f><v>2</v></c></row>')

    def test_rejects_ambiguous_sheets(self):
        with self.assertRaisesRegex(ValueError, "exactly one"):
            self.read(row(1, HEADERS), copies=2)

    def test_rejects_duplicate_headers(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.read(row(1, HEADERS + ["UF"]))

    def test_rejects_unknown_columns_and_missing_schema(self):
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            self.read(row(1, HEADERS) + row(2, ["x"] * 7))
        with self.assertRaisesRegex(ValueError, "exactly one"):
            self.read(row(1, ["Not a library workbook"]))


if __name__ == "__main__":
    unittest.main()
