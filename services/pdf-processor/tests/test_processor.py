import io
import pathlib
import sys
import unittest

from pypdf import PdfReader, PdfWriter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from app import rotate_pdf  # noqa: E402


class RotatePdfTests(unittest.TestCase):
    @staticmethod
    def make_pdf():
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=300)
        output = io.BytesIO()
        writer.write(output)
        return output.getvalue()

    def test_rotates_real_pdf(self):
        result = rotate_pdf(self.make_pdf(), 90)
        reader = PdfReader(io.BytesIO(result))
        self.assertEqual(len(reader.pages), 1)
        self.assertEqual(reader.pages[0].get("/Rotate"), 90)

    def test_rejects_bad_angle(self):
        with self.assertRaisesRegex(ValueError, "invalid_angle"):
            rotate_pdf(self.make_pdf(), 45)

    def test_rejects_non_pdf(self):
        with self.assertRaisesRegex(ValueError, "invalid_pdf"):
            rotate_pdf(b"not a pdf", 90)


if __name__ == "__main__":
    unittest.main()
