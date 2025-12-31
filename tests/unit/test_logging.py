"""Tests for logging configuration."""

import logging

import pytest
import structlog

from mad.utils.logging import get_logger, setup_logging


class TestSetupLogging:
    """Tests for setup_logging function."""

    def test_setup_does_not_raise(self):
        """setup_logging should not raise with default parameters."""
        # This should not raise any exceptions
        setup_logging()

    def test_setup_with_debug_level_does_not_raise(self):
        """setup_logging should not raise with DEBUG level."""
        setup_logging(level="DEBUG")

    def test_setup_with_warning_level_does_not_raise(self):
        """setup_logging should not raise with WARNING level."""
        setup_logging(level="WARNING")

    def test_setup_with_error_level_does_not_raise(self):
        """setup_logging should not raise with ERROR level."""
        setup_logging(level="ERROR")

    def test_setup_with_json_format(self):
        """setup_logging should work with JSON format enabled."""
        # This should not raise
        setup_logging(json_format=True)

    def test_setup_with_console_format(self):
        """setup_logging should work with console format (default)."""
        # This should not raise
        setup_logging(json_format=False)

    def test_setup_case_insensitive_level(self):
        """setup_logging should accept lowercase level names."""
        # This should not raise
        setup_logging(level="debug")


class TestGetLogger:
    """Tests for get_logger function."""

    def test_returns_bound_logger(self):
        """get_logger should return a structlog BoundLogger."""
        setup_logging()  # Ensure structlog is configured
        logger = get_logger("test_module")

        # Check it's a structlog logger (has bind method)
        assert hasattr(logger, "bind")
        assert hasattr(logger, "info")
        assert hasattr(logger, "debug")
        assert hasattr(logger, "warning")
        assert hasattr(logger, "error")

    def test_logger_with_different_names(self):
        """get_logger should work with different module names."""
        setup_logging()

        logger1 = get_logger("module1")
        logger2 = get_logger("module2")
        logger3 = get_logger("mad.core.graph")

        # All should be valid loggers
        assert hasattr(logger1, "info")
        assert hasattr(logger2, "info")
        assert hasattr(logger3, "info")
