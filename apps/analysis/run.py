"""Local entry point; deployment supplies environment directly."""
import os
from pathlib import Path

file = Path(__file__).with_name(".env")
if file.exists():
    for line in file.read_text().splitlines():
        if line.strip() and not line.startswith("#"):
            key, value = line.split("=", 1)
            if not key.startswith("ANALYSIS_"):
                raise ValueError("Unexpected local analysis configuration")
            os.environ.setdefault(key, value)

from server import main

main()
