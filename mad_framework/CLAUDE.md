# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MAD Framework (Multi-Agent Debate) is a Python/TypeScript hybrid project for conducting structured debates between multiple LLM agents. It has two main components:

1. **Python Core** (`src/mad/`): LangGraph-based debate orchestration library
2. **Electron Desktop App** (`desktop/`): React + Electron UI for browser-based LLM automation

## Build & Development Commands

### Python Core

```bash
# Setup (uses uv)
uv sync --all-extras

# Run single test (recommended)
pytest tests/unit/test_config.py -v

# Run all tests
pytest tests/ -v

# Lint
ruff check src/

# Type check
mypy src/
```

### Desktop App (Electron + React)

```powershell
cd D:\AI\claude01\mad_framework\desktop

# Install dependencies
npm install

# Development (Vite dev server only)
npm run dev

# Development with Electron
npm run dev:electron

# Run tests
npm run test:run

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Build for Windows
npm run build:win
```

## Architecture

### Python Core (`src/mad/`)

```
LangGraph StateGraph Flow:
  initialize → debate → moderate → (loop) → judge → END
```

Key components:
- **`core/orchestrator.py`**: `MAD` class - main entry point. Creates agents and builds StateGraph
- **`core/graph.py`**: LangGraph StateGraph definition with nodes (initialize, debate, moderate, judge)
- **`core/state.py`**: Pydantic state models for debate flow
- **`agents/`**: Debater, Judge, Moderator agents
- **`providers/`**: Anthropic, OpenAI provider adapters with registry pattern
- **`presets/`**: Pre-configured debate types (code_review, qa_accuracy, decision)

### Desktop App (`desktop/`)

**Process Architecture:**
- **Main process** (`electron/main.ts`): Window management, IPC handlers
- **Renderer** (`src/`): React UI with Zustand stores
- **Browser adapters** (`electron/browser/adapters/`): Automate ChatGPT, Claude, Gemini web interfaces

**Key Files:**
- `electron/debate/debate-controller.ts`: Infinite loop debate execution with cycle detection and circuit breaker (MAX_ITERATIONS=100)
- `electron/browser/browser-view-manager.ts`: Manages BrowserViews for each LLM provider
- `src/stores/debate-store.ts`: Zustand store for UI state
- `shared/types.ts`: Shared TypeScript types between main/renderer

**IPC Communication:**
- Renderer calls main via `window.api.*` (exposed in preload.ts)
- Main emits events: `debate:progress`, `debate:response`, `debate:element-score`, `debate:complete`

## Key Patterns

### Python
- Async-first (`async def debate()`)
- Provider registry pattern (`get_provider("anthropic")`)
- Pydantic for config/state validation
- pytest-asyncio for async tests

### TypeScript/Electron
- Path aliases: `@/*` (src), `@electron/*` (electron), `@shared/*` (shared)
- Context isolation with preload bridge
- Vitest for testing with jsdom

## Environment Variables

```bash
# Required for Python core
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx

# Optional
MAD_DEFAULT_PROVIDER=anthropic
MAD_MAX_ROUNDS=3
```

## Testing

Python tests use fixtures in `tests/conftest.py`:
- `sample_topic`: Debate topic string
- `sample_context`: Context string
- `sample_code`: Code for review tests

Desktop tests use `@testing-library/react` and Vitest globals.
