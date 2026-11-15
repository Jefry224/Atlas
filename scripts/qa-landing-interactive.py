#!/usr/bin/env python3
"""Compatibility entrypoint for the current target-first mission browser regression.
The paired-legacy controller remains tested by the Node suite; product QA uses one target landing.
"""
import runpy,sys
from pathlib import Path
if not any(arg.endswith('-only') for arg in sys.argv):sys.argv.append('--desktop-only')
runpy.run_path(str(Path(__file__).with_name('qa-target-mission.py')),run_name='__main__')
