"""Bounded local reading of rendered artwork. Output is evidence, not truth."""
import csv
import io
import os
import shutil
import subprocess


def parse_tsv(tsv, width, height, page):
    if not width or not height or len(tsv) > 2_000_000:
        return []
    groups = {}
    for row in csv.DictReader(io.StringIO(tsv), delimiter='\t', quoting=csv.QUOTE_NONE):
        try:
            text = (row.get('text') or '').strip()
            if row.get('level') != '5' or not text:
                continue
            left, top, w, h = (int(row[key]) for key in ('left', 'top', 'width', 'height'))
            confidence = float(row['conf'])
            if w <= 0 or h <= 0 or left < 0 or top < 0 or left+w > width or top+h > height:
                continue
            key = tuple(row[key] for key in ('block_num', 'par_num', 'line_num'))
            groups.setdefault(key, []).append((text if confidence >= 60 else '[unreadable]', confidence >= 60, left, top, left+w, top+h))
        except (KeyError, ValueError, TypeError):
            continue
    lines = []
    for words in groups.values():
        if not any(word[1] for word in words):
            continue
        text = ' '.join(word[0] for word in words)
        if not any(ch.isalnum() for ch in text.replace('[unreadable]', '')):
            continue
        lines.append(dict(text=text, page=page, box=[
            min(word[2] for word in words)/width, min(word[3] for word in words)/height,
            max(word[4] for word in words)/width, max(word[5] for word in words)/height,
        ]))
    return lines[:500]


def read_artwork(image_path, width, height, page):
    executable = shutil.which('tesseract')
    if not executable:
        return [], 'Local image reading is unavailable; use visual reading or inspect the original.'
    # Only a locally rendered raster is sent to the executable. No shell, URLs,
    # uploaded options, provider credentials, or unbounded parallel workers.
    env = {key: os.environ[key] for key in ('PATH', 'LANG', 'TMPDIR') if key in os.environ}
    env['OMP_THREAD_LIMIT'] = '1'
    try:
        result = subprocess.run(
            [executable, str(image_path), 'stdout', '-l', 'eng', '--psm', '11', 'tsv'],
            capture_output=True, text=True, timeout=4, check=True, env=env,
        )
        lines = parse_tsv(result.stdout, width, height, page)
        return lines, None if lines else 'Local image reading found no reliable text; inspect the original.'
    except (OSError, subprocess.SubprocessError, UnicodeError):
        return [], 'Local image reading could not finish; the original image remains available.'
