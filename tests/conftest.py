# tests/conftest.py
"""
Pytest configuration and fixtures.
"""

# Ignore test files with missing dependencies
collect_ignore = [
    "test_parallel_workflow.py",
    "test_phase_detection.py",
]
