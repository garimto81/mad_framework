# MAD Framework

**Multi-Agent Debate Framework** - LLM 에이전트 간 토론을 통한 결과 품질 향상

## Overview

MAD Framework는 여러 LLM 에이전트가 토론하여 더 정확하고 균형 잡힌 답변을 도출하는 Python 프레임워크입니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    MAD Framework                             │
├─────────────────────────────────────────────────────────────┤
│  Topic ──▶ Debaters (Round 1, 2, 3...) ──▶ Judge ──▶ Verdict│
│                                                               │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                │
│  │ Claude  │ ←→  │  GPT-4  │ ←→  │ Gemini  │                │
│  │(Security)│    │(Perform)│     │(Maintain)│                │
│  └─────────┘     └─────────┘     └─────────┘                │
│                       ↓                                      │
│                  ┌─────────┐                                 │
│                  │  Judge  │ → Final Verdict + Confidence    │
│                  └─────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-Provider Support**: Anthropic (Claude), OpenAI (GPT), Google (Gemini)
- **LangGraph Integration**: 상태 기반 토론 흐름 제어
- **Presets**: 코드 리뷰, Q&A 정확도, 의사결정 지원
- **Judge Agent**: 최종 판정 및 합의 도출
- **Cost Tracking**: 토큰 사용량 및 비용 추적

## Installation

```bash
# uv 사용 (권장)
uv add mad-framework

# pip 사용
pip install mad-framework
```

## Quick Start

```python
import asyncio
from mad import MAD, DebateConfig
from mad.core.config import DebaterConfig, JudgeConfig

async def main():
    config = DebateConfig(
        debaters=[
            DebaterConfig(provider="anthropic", perspective="security"),
            DebaterConfig(provider="openai", model="gpt-4o", perspective="performance"),
        ],
        judge=JudgeConfig(provider="anthropic"),
        max_rounds=3,
    )

    mad = MAD(config)
    result = await mad.debate(
        topic="Should we use eval() in Python?",
        context="def process(data): eval(data['cmd'])"
    )

    print(f"Verdict: {result.verdict}")
    print(f"Confidence: {result.confidence:.0%}")
    print(f"Cost: ${result.total_cost:.4f}")

asyncio.run(main())
```

## Presets

### Code Review

```python
from mad import MAD
from mad.presets import CodeReviewPreset

preset = CodeReviewPreset()
mad = MAD(preset.to_config())

result = await mad.debate(
    topic="Review this function",
    context=code_string
)
```

### Q&A Accuracy

```python
from mad.presets import QAAccuracyPreset

preset = QAAccuracyPreset()
mad = MAD(preset.to_config())

result = await mad.debate(
    topic="What causes the seasons on Earth?"
)
```

### Decision Support

```python
from mad.presets import DecisionPreset

preset = DecisionPreset()
mad = MAD(preset.to_config())

result = await mad.debate(
    topic="Should we migrate to microservices?",
    context="500k LOC monolith, 50 developers..."
)
```

## Configuration

### Desktop App

```bash
# Electron 앱 실행 (API 키 불필요)
cd desktop
npm install
npm run dev:electron
```

BrowserView를 통해 ChatGPT, Claude, Gemini 웹 UI와 자동 연동됩니다.
웹 로그인만 하면 토론이 가능합니다.

### Debate Config

```python
from mad import DebateConfig
from mad.core.config import DebaterConfig, JudgeConfig

config = DebateConfig(
    # 토론자 설정
    debaters=[
        DebaterConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            perspective="security",
            temperature=0.7,
        ),
        DebaterConfig(
            provider="openai",
            model="gpt-4o",
            perspective="performance",
            temperature=0.8,
        ),
    ],

    # 판사 설정
    judge=JudgeConfig(
        provider="anthropic",
        model="claude-sonnet-4-20250514",
        temperature=0.3,
    ),

    # 토론 파라미터
    max_rounds=3,
    early_stop_on_consensus=True,
    consensus_threshold=0.8,
)
```

## Result Structure

```python
result = await mad.debate(topic="...")

# 핵심 결과
result.verdict          # 최종 판정
result.confidence       # 신뢰도 (0.0 - 1.0)
result.reasoning        # 판정 근거

# 합의 정보
result.consensus_points     # 합의된 포인트들
result.dissenting_opinions  # 반대 의견들
result.recommendations      # 추가 권장사항

# 메타데이터
result.total_rounds         # 실제 진행된 라운드 수
result.early_consensus      # 조기 합의 여부
result.total_tokens         # 총 토큰 사용량
result.total_cost           # 총 비용 (USD)
result.cost_summary         # 비용 요약 문자열
```

## Architecture

```
src/mad/
├── core/           # 핵심 엔진
│   ├── config.py   # 설정 관리
│   ├── state.py    # LangGraph 상태
│   ├── graph.py    # StateGraph 정의
│   └── orchestrator.py  # 토론 오케스트레이터
│
├── agents/         # 에이전트
│   ├── debater.py  # 토론자
│   ├── judge.py    # 판사
│   └── moderator.py # 중재자
│
├── providers/      # LLM 프로바이더
│   ├── anthropic.py
│   ├── openai.py
│   └── registry.py
│
├── presets/        # 사전 설정
│   ├── code_review.py
│   ├── qa_accuracy.py
│   └── decision.py
│
└── utils/          # 유틸리티
    ├── logging.py
    └── cost.py
```

## Development

```bash
# 개발 환경 설정
uv sync --all-extras

# 테스트 실행
pytest tests/ -v

# 린트
ruff check src/

# 타입 체크
mypy src/
```

## License

MIT License
