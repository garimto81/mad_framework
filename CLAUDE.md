# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**GitHub**: https://github.com/garimto81/mad_framework

## Project Overview

MAD Framework (Multi-Agent Debate) - LLM 에이전트 간 토론을 통한 결과 품질 향상 프레임워크.

두 가지 모드 지원:
1. **Python Library**: LangGraph 기반 API 호출 방식
2. **Desktop App**: Electron + 웹 브라우저 자동화 (API 키 불필요)

## Build & Development Commands

### Python (src/mad/)

```bash
# Setup
uv sync --all-extras

# 개별 테스트 (권장)
pytest tests/unit/test_config.py -v

# 전체 테스트
pytest tests/ -v

# Lint + Format
ruff check src/ --fix && ruff format src/

# Type check
mypy src/
```

### Desktop (desktop/)

```bash
cd D:\AI\claude01\mad_framework\desktop

# 개발 실행
npm run dev:electron

# 테스트
npm run test:run           # Unit (Vitest)
npm run test:e2e           # E2E (Playwright)
npm run test:e2e:headed    # E2E with browser visible
npm run test:e2e:ui        # E2E Playwright UI mode

# 빌드
npm run build              # Full build
npm run build:win          # Windows build

# Lint
npm run lint
```

## Architecture

### Python - LangGraph Flow

```
initialize → debate → moderate → (loop if not consensus) → judge → END
```

| Component | 역할 |
|-----------|------|
| `core/orchestrator.py` | `MAD` class - entry point |
| `core/graph.py` | StateGraph (4 nodes) |
| `core/state.py` | `DebateState` TypedDict |
| `agents/` | Debater, Judge, Moderator |
| `providers/registry.py` | Singleton cache by `{name}:{api_key}` |
| `presets/` | CodeReviewPreset, QAAccuracyPreset, DecisionPreset |

**Data Flow:**
```python
MAD(config) → _create_debaters() → create_debate_graph() → graph.ainvoke() → DebateResult
```

### Desktop - Electron + React

```
electron/
├── main.ts                 # Electron main process (graceful shutdown)
├── preload.ts              # Context bridge
├── ipc/handlers.ts         # IPC handlers + cleanup
├── utils/
│   └── logger.ts           # electron-log 래퍼
├── browser/
│   ├── browser-view-manager.ts   # BrowserView 관리
│   ├── session-manager.ts        # 세션/쿠키 관리
│   └── adapters/
│       ├── base-adapter.ts       # 공통 인터페이스
│       ├── chatgpt-adapter.ts    # ChatGPT DOM 자동화
│       ├── claude-adapter.ts     # Claude DOM 자동화
│       └── gemini-adapter.ts     # Gemini DOM 자동화
└── debate/
    ├── debate-controller.ts      # 토론 진행 컨트롤러
    ├── progress-logger.ts        # 토론 로그 (JSONL)
    └── status-poller.ts          # 응답 상태 폴링

src/
├── App.tsx                 # React 앱 진입점
├── stores/                 # Zustand 상태 관리
└── components/             # UI 컴포넌트
```

**로그 파일 위치:**
- 앱 로그: `%APPDATA%\mad-desktop\logs\mad-desktop.log`
- 토론 로그: `desktop/logs/debate-latest.jsonl`

**Adapter 공통 인터페이스:**
```typescript
checkLogin() → isLoggedIn
prepareInput() → waitForInputReady
enterPrompt() → submitMessage() → awaitResponse() → getResponse()
```

## Key Patterns

- **Async-first**: Python 모든 메서드 `async def`
- **AdapterResult**: Desktop 어댑터 표준 응답 `{ success, data?, error? }`
- **Selector Fallback**: DOM 셀렉터 실패 시 fallback 체인 (`selector-config.ts`)
- **State accumulation**: LangGraph `add_messages` reducer
- **Early stopping**: Moderator `consensus_threshold` 체크
- **Graceful shutdown**: `before-quit` → cleanup → `app.quit()` (10초 타임아웃)
- **Circuit Breaker**: `MAX_ITERATIONS=100`, `MAX_CONSECUTIVE_EMPTY_RESPONSES=3`
- **Cost Tracking**: 토큰 사용량 및 비용 추적 (`utils/cost.py`)

## Desktop State Management

| Store | 파일 | 역할 |
|-------|------|------|
| `useDebateStore` | `stores/debate-store.ts` | 토론 상태, 진행률, 결과 |
| `useLoginStore` | `stores/login-store.ts` | Provider별 로그인 상태 |

**IPC 이벤트:**
- `debate:start` - 토론 시작
- `login:status-changed` - 로그인 상태 변경
- `status-update`, `progress`, `complete`, `error` - 토론 진행 이벤트

## 필수 규칙

**앱 실행 전 반드시 사용자 승인 필요**
- `npm run dev:electron` 실행 전 사용자에게 승인 요청
- 승인 없이 앱 실행 금지

**한 번에 하나의 앱만 실행**
- 새 앱 실행 전 기존 앱 종료 확인
- 중복 실행 시 세션 충돌 및 로그인 상태 불안정

## Testing

### Python

```bash
pytest tests/unit/test_config.py -v  # 개별 (권장)
pytest tests/ -v                      # 전체
```

Fixtures (`conftest.py`): `sample_topic`, `sample_context`, `sample_code`

### Desktop

```bash
npm run test:run                      # Unit
npm run test:e2e -- tests/e2e/x.spec.ts  # 개별 E2E
```

**테스트 구조:**
- `tests/unit/` - Adapter 단위 테스트 (Vitest)
- `tests/integration/` - Provider별 메시지 진행 테스트
- `tests/e2e/` - Playwright E2E 테스트
- `tests/e2e/stress/` - 연속 메시지 스트레스 테스트

## Environment Variables

Python (`MADConfig` 환경 변수):
- `MAD_DEFAULT_PROVIDER` - 기본 provider (default: "anthropic")
- `MAD_DEFAULT_MODEL` - 기본 모델 (default: "claude-sonnet-4-20250514")
- `MAD_MAX_ROUNDS` - 최대 라운드 (default: 3)
- `MAD_LOG_LEVEL` - 로그 레벨 (default: "INFO")

## References

- `docs/ARCHITECTURE.md`: 상세 아키텍처
- `examples/`: 사용법 예제
- `README.md`: API 문서
