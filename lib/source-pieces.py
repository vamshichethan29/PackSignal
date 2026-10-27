#!/usr/bin/env python3
"""
Compatibility shim for lib/source-pieces.py.
Redirects to canonical implementation in lib/source_piece.py.
"""
import sys
from pathlib import Path
_lib_dir = str(Path(__file__).resolve().parent)
if _lib_dir not in sys.path:
    sys.path.insert(0, _lib_dir)

from source_piece import *

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: source-pieces.py <file_path> [--plain-pdf]"}), file=sys.stderr)
        sys.exit(1)
    try:
        is_plain = '--plain-pdf' in sys.argv
        res = parse_source_file(sys.argv[1], options={'is_plain_pdf': is_plain})
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
