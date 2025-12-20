# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**GitHub**: https://github.com/garimto81/mad_framework

## Project Overview

MAD Framework (Multi-Agent Debate) is a Python library for conducting structured debates between multiple LLM agents using LangGraph.

## Build & Development Commands

```bash
# Setup (uses uv)
uv sync --all-extras

# Run single test (recommended)
pytest tests/unit/test_config.py -v

# Lint with auto-fix
ruff check src/ --fix

# Format
ruff format src/

# Type check
mypy src/
```

## Architecture

### LangGraph Flow

```
initialize → debate → moderate → (loop if not consensus) → judge → END
```

### Core Components (`src/mad/`)

- **`core/orchestrator.py`**: `MAD` class - entry point, creates agents and StateGraph
- **`core/graph.py`**: StateGraph with nodes (initialize, debate, moderate, judge)
- **`core/state.py`**: `DebateState` TypedDict with `Annotated[list[DebateMessage], add_messages]`
- **`agents/`**: Debater, Judge, Moderator - each has `act(state)` method
- **`providers/registry.py`**: `get_provider("anthropic"|"openai")` - singleton cache pattern
- **`strategies/round_robin.py`**: Debate turn strategy (extensible)
- **`presets/`**: CodeReviewPreset, QAAccuracyPreset, DecisionPreset

### Data Flow

```python
MAD(config) → _create_debaters() → create_debate_graph() → graph.ainvoke() → DebateResult
```

## Key Patterns

- **Async-first**: All debate methods are `async def`
- **Provider registry**: `ProviderRegistry.get()` caches instances by `{name}:{api_key}`
- **State accumulation**: `add_messages` reducer appends to `messages` list
- **Early stopping**: Moderator checks `consensus_threshold` to short-circuit rounds

## Desktop App 실행

```bash
cd D:\AI\claude01\mad_framework\desktop
npm install
npm run dev:electron
```

API 키 불필요. 웹 브라우저 자동화로 ChatGPT/Claude/Gemini 연동.

## Testing

```bash
pytest tests/unit/test_config.py -v  # 개별 테스트
pytest tests/ -v                      # 전체 테스트
```

Fixtures (`tests/conftest.py`): `sample_topic`, `sample_context`, `sample_code`

## References

- **상세 아키텍처**: `docs/ARCHITECTURE.md`
- **사용법 예제**: `examples/`
- **API 문서**: `README.md`
