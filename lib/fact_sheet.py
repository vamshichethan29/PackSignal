"""
Python module wrapper for fact-sheet.
Allows standard `import fact_sheet` syntax across test suites and scripts.
"""

import importlib.util
from pathlib import Path

_target = Path(__file__).parent / "fact-sheet.py"
_spec = importlib.util.spec_from_file_location("fact_sheet_impl", _target)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

# Re-export public functions and variables
for _name in dir(_mod):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_mod, _name)
