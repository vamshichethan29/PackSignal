import sys
import subprocess
import unittest
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from local_ocr import parse_tsv, read_artwork
from extract import extract

HEADER = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
SAMPLE = HEADER + (
    '5\t1\t1\t1\t1\t1\t10\t10\t30\t10\t95\tMORI\n'
    '5\t1\t1\t1\t1\t2\t45\t10\t50\t10\t94\tMEADOW\n'
    '5\t1\t2\t1\t1\t1\t10\t50\t10\t15\t92\t1\n'
    '5\t1\t2\t1\t1\t2\t25\t50\t10\t15\t91\tL\n'
)


class LocalOcrTests(unittest.TestCase):
    def test_lines_keep_page_and_normalized_locations(self):
        lines = parse_tsv(SAMPLE, 100, 100, 3)
        self.assertEqual([line['text'] for line in lines], ['MORI MEADOW', '1 L'])
        self.assertEqual(lines[0]['box'], [.1, .1, .95, .2])
        self.assertTrue(all(line['page'] == 3 for line in lines))

    def test_low_quality_words_cannot_silently_become_exact_copy(self):
        partial = SAMPLE.replace('94\tMEADOW', '25\tMEADOW')
        self.assertEqual(parse_tsv(partial, 100, 100, 1)[0]['text'], 'MORI [unreadable]')
        self.assertEqual(parse_tsv(partial.replace('95\tMORI', '20\tMORI'), 100, 100, 1)[0]['text'], '1 L')

    def test_invalid_coordinates_and_large_output_are_rejected(self):
        self.assertEqual(parse_tsv(SAMPLE, 0, 100, 1), [])
        self.assertEqual(parse_tsv('x' * 2_000_001, 100, 100, 1), [])
        invalid = HEADER + '5\t1\t1\t1\t1\t1\t-10\t10\t30\t10\t95\tFAKE\n'
        self.assertEqual(parse_tsv(invalid, 100, 100, 1), [])

    def test_reader_is_bounded_and_does_not_pass_provider_credentials(self):
        with patch('local_ocr.shutil.which', return_value='/usr/bin/tesseract'), \
             patch('local_ocr.os.environ', {'PATH':'/usr/bin', 'GEMINI_API_KEY':'do-not-send'}), \
             patch('local_ocr.subprocess.run', return_value=SimpleNamespace(stdout=SAMPLE)) as run:
            lines, warning = read_artwork('/tmp/rendered.png', 100, 100, 1)
        self.assertEqual(lines[0]['text'], 'MORI MEADOW')
        self.assertIsNone(warning)
        self.assertEqual(run.call_args.kwargs['timeout'], 4)
        self.assertEqual(run.call_args.kwargs['env'], {'PATH':'/usr/bin', 'OMP_THREAD_LIMIT':'1'})
        self.assertNotIn('shell', run.call_args.kwargs)
        self.assertIn('eng', run.call_args.args[0])

    def test_missing_binary_or_timeout_keeps_original_available(self):
        with patch('local_ocr.shutil.which', return_value=None):
            self.assertEqual(read_artwork('/tmp/image.png', 100, 100, 1)[0], [])
        with patch('local_ocr.shutil.which', return_value='/usr/bin/tesseract'), \
             patch('local_ocr.subprocess.run', side_effect=subprocess.TimeoutExpired('tesseract', 4)):
            lines, warning = read_artwork('/tmp/image.png', 100, 100, 1)
        self.assertEqual(lines, [])
        self.assertIn('original image remains available', warning)

    def test_photo_and_raster_pdf_receive_ocr_lines_but_native_pdf_is_untouched(self):
        from PIL import Image
        from reportlab.pdfgen import canvas
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            image=Image.new('RGB',(100,100),'white')
            image.save(root/'photo.png')
            image.save(root/'scan.pdf','PDF')
            pdf=canvas.Canvas(str(root/'native.pdf'))
            pdf.drawString(40,700,'Native packaging copy has more than forty characters and stays untouched.')
            pdf.save()
            lines=parse_tsv(SAMPLE,100,100,1)
            with patch('extract.read_artwork', return_value=(lines,None)) as read:
                photo=extract(root/'photo.png','artwork',root/'rendered','photo','photo.png')
                scan=extract(root/'scan.pdf','artwork',root/'rendered','scan','scan.pdf')
                native=extract(root/'native.pdf','artwork',root/'rendered','native','native.pdf')
            self.assertEqual(read.call_count,2)
            for doc in [photo,scan]:
                self.assertEqual(doc['pages'][0]['method'],'ocr_transcription')
                self.assertEqual(doc['text'],'MORI MEADOW\n1 L')
                self.assertEqual(doc['lines'][0]['page'],1)
                self.assertEqual(doc['lines'][0]['box'],[.1,.1,.95,.2])
            self.assertEqual(native['pages'][0]['method'],'pdf_text')
            self.assertIn('Native packaging copy',native['text'])


if __name__ == '__main__':
    unittest.main()
