"""Shared test setup."""

import pytest

from mindly import asr, llm


@pytest.fixture(autouse=True)
def no_retry_delays(monkeypatch):
    """Retries are real, but tests shouldn't wait for the backoff."""
    monkeypatch.setattr(llm, "BACKOFF", (0, 0))
    monkeypatch.setattr(asr, "BACKOFF", (0, 0))
