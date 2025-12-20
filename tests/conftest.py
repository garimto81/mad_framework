"""Pytest configuration and fixtures for MAD Framework tests."""

import pytest


@pytest.fixture
def sample_topic() -> str:
    """Sample debate topic."""
    return "Should software developers use AI coding assistants?"


@pytest.fixture
def sample_context() -> str:
    """Sample context for debates."""
    return """
    Consider:
    - Productivity impact
    - Code quality implications
    - Learning and skill development
    """


@pytest.fixture
def sample_code() -> str:
    """Sample code for code review tests."""
    return """
def process_user(data):
    query = f"SELECT * FROM users WHERE id = {data['id']}"
    return db.execute(query)
"""
