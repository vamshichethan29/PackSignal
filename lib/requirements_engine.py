"""
Python module wrapper for requirements-engine.
Allows standard `import requirements_engine` syntax across test suites and scripts.
"""

import importlib.util
from pathlib import Path

_target = Path(__file__).parent / "requirements-engine.py"
_spec = importlib.util.spec_from_file_location("requirements_engine_impl", _target)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

for _name in dir(_mod):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_mod, _name)
