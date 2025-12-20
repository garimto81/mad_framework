# MAD Framework Architecture

상세 아키텍처 문서입니다. 핵심 개요는 `CLAUDE.md`를 참조하세요.

## LangGraph State Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    MAD Framework Flow                         │
└──────────────────────────────────────────────────────────────┘

Input: topic, context
       ↓
[initialize]  → current_round=1, phase="debate"
       ↓
[debate]      → All debaters generate arguments sequentially
       ↓
[moderate]    → Check consensus_score >= threshold
       ↓
   ┌───┴───┐
   │       │
  YES     NO
   ↓       ↓
[judge]  [debate] → loop (current_round++)
   ↓
Result: DebateResult (verdict, confidence, reasoning, etc.)
```

## Module Responsibilities

### 1. core/orchestrator.py - MAD Class

진입점. 에이전트 생성 및 그래프 구성.

```python
MAD(config: DebateConfig)
├─ _create_debaters() → list[DebaterAgent]
├─ _create_judge() → JudgeAgent
├─ _create_moderator() → ModeratorAgent | None
└─ create_debate_graph() → CompiledGraph

async def debate(topic, context) → DebateResult
async def stream_debate(topic, context) → AsyncIterator
```

**DebateResult 주요 필드:**
- `verdict`: 최종 판정
- `confidence`: 신뢰도 (0.0-1.0)
- `reasoning`: 판단 근거
- `consensus_points`: 합의 포인트
- `dissenting_opinions`: 반대 의견
- `total_tokens`, `total_cost`: 사용량

### 2. core/state.py - DebateState

LangGraph 상태 스키마.

```python
class DebateState(TypedDict):
    topic: str
    context: str | None
    messages: Annotated[list[DebateMessage], add_messages]  # 누적
    current_round: int
    phase: Literal["init", "debate", "moderate", "judge", "complete"]
    should_continue: bool
    consensus_score: float
    judge_verdict: dict | None
    total_tokens: int
    total_cost: float
```

**핵심**: `add_messages` reducer가 자동으로 메시지 누적

### 3. core/graph.py - StateGraph

4개 노드:
- `initialize_node`: 초기화
- `debate_node`: 토론자 순차 실행
- `moderate_node`: 합의도 체크, 라우팅 결정
- `judge_node`: 최종 판정

### 4. agents/

| Agent | 역할 | temperature |
|-------|------|-------------|
| DebaterAgent | 관점별 주장 생성 | 0.7 |
| JudgeAgent | 최종 판정, JSON 출력 | 0.3 |
| ModeratorAgent | 합의도 평가, early stop | 0.3 |

**공통 인터페이스:**
```python
async def act(state: DebateState) → DebateMessage
```

### 5. providers/ → Desktop App 연동

**BrowserView 방식:**
- API 키 불필요
- 웹 브라우저 자동화로 LLM과 통신
- ChatGPT, Claude, Gemini 어댑터 지원

**Desktop App 구조:**
```
desktop/electron/browser/adapters/
├─ base-adapter.ts      # 공통 인터페이스
├─ chatgpt-adapter.ts   # ChatGPT 웹 자동화
├─ claude-adapter.ts    # Claude 웹 자동화
└─ gemini-adapter.ts    # Gemini 웹 자동화
```

### 6. presets/

| Preset | Debaters | max_rounds | consensus_threshold |
|--------|----------|------------|---------------------|
| CodeReviewPreset | security, performance, maintainability | 2 | 0.7 |
| QAAccuracyPreset | analytical, creative, critical | 3 | 0.85 |
| DecisionPreset | pragmatist, strategist, risk_analyst | 3 | 0.75 |

## Extension Points

### 새 Provider 추가

```python
# providers/google.py
class GoogleProvider(LLMProvider):
    @property
    def name(self) -> str:
        return "google"

    async def generate(self, messages, model, ...) -> ProviderResponse:
        # 구현
```

### 새 Preset 추가

```python
class CustomPreset(Preset):
    def get_debater_configs(self) -> list[DebaterConfig]:
        return [...]

    def get_judge_config(self) -> JudgeConfig:
        return JudgeConfig(provider="anthropic")
```

### 새 Strategy 추가

```python
class ParallelStrategy(DebateStrategy):
    async def execute_round(self, debaters, state):
        # asyncio.gather로 동시 실행
        tasks = [d.act(state) for d in debaters]
        return await asyncio.gather(*tasks)
```

## Cost Tracking

토큰/비용이 각 메시지 metadata에 포함:
```python
DebateMessage["metadata"] = {
    "input_tokens": 1234,
    "output_tokens": 567,
    "cost": 0.0123,
    "latency_ms": 450.5
}
```

`utils/cost.py`의 `CostTracker`가 집계 담당.
