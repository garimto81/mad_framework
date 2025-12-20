# PRD-0001: MAD Framework Desktop App (Browser Automation)

**Version**: 2.0
**Date**: 2025-12-18
**Status**: Draft
**Author**: Claude Code

---

## Executive Summary

MAD Framework Desktop App은 **Electron 기반 데스크톱 앱**으로, 내장 브라우저를 통해 ChatGPT, Claude, Gemini 웹사이트에 직접 로그인하여 Multi-Agent Debate를 수행합니다.

### 핵심 가치
- **API 키 불필요** - 사용자의 기존 구독(ChatGPT Plus, Claude Pro 등) 활용
- **비용 절감** - API 호출 비용 없음
- **최신 기능** - 각 서비스의 웹 UI 최신 기능 그대로 사용
- **간편한 사용** - 웹사이트 로그인만 하면 바로 토론 시작

---

## 1. Problem Statement

### 현재 상황
- LLM API는 비용이 발생 (GPT-4: $30+/1M tokens)
- 대부분의 사용자는 이미 ChatGPT Plus, Claude Pro 등 구독 중
- 구독 중인 서비스를 여러 개 동시에 활용하기 어려움
- 수동으로 복사/붙여넣기하며 토론 진행은 번거로움

### 해결할 문제
1. **비용**: 기존 구독을 활용하여 추가 API 비용 없이 MAD 수행
2. **자동화**: 여러 LLM 간 토론을 자동으로 순차 진행
3. **통합 뷰**: 분산된 대화를 하나의 화면에서 통합 관리
4. **접근성**: 비개발자도 쉽게 사용

---

## 2. Goals & Success Metrics

### Primary Goals

| Goal | Metric | Target |
|------|--------|--------|
| 사용 편의성 | 첫 토론 시작까지 시간 | < 3분 (로그인 후) |
| 자동화 정확도 | 메시지 전달 성공률 | > 99% |
| 응답 수집 | 전체 응답 캡처율 | 100% |
| 안정성 | 토론 완료율 | > 95% |

### Non-Goals (Out of Scope)
- API 키 기반 호출 (별도 모드로 추후 고려)
- 모바일 지원
- 클라우드 동기화
- 동시 다중 토론

---

## 3. Target Users

### Primary: AI 서비스 구독자
- **특징**: ChatGPT Plus, Claude Pro 등 유료 구독 중
- **니즈**: 여러 AI를 비교하고 싶지만 API 비용 부담
- **기술 수준**: 웹 브라우저 사용 가능

### Secondary: 연구자/분석가
- **특징**: 다양한 LLM 응답 비교 연구
- **니즈**: 동일 질문에 대한 다양한 관점 수집
- **기술 수준**: 기본적인 앱 사용 가능

---

## 4. Core Features

### 4.1 Multi-Browser Login Panel
**Priority**: P0 (Must Have)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MAD Desktop                                              [─] [□] [×]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LLM Sessions                                                           │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐        │
│  │ ┌──────────────┐ │ │ ┌──────────────┐ │ │ ┌──────────────┐ │        │
│  │ │   ChatGPT    │ │ │ │    Claude    │ │ │ │   Gemini     │ │        │
│  │ │              │ │ │ │              │ │ │ │              │ │        │
│  │ │  ✓ Logged in │ │ │ │  ✓ Logged in │ │ │ │  ⚠ Login     │ │        │
│  │ │              │ │ │ │              │ │ │ │   Required   │ │        │
│  │ └──────────────┘ │ │ └──────────────┘ │ │ └──────────────┘ │        │
│  │   [Open Tab]     │ │   [Open Tab]     │ │   [Login]        │        │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘        │
│                                                                         │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Debate Setup                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Topic: [What are the pros and cons of microservices?      ]   │   │
│  │                                                                 │   │
│  │  Context (optional):                                            │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │ We have a 500k LOC monolith with 50 developers...        │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  │                                                                 │   │
│  │  Participants: [✓ ChatGPT] [✓ Claude] [  Gemini]               │   │
│  │  Rounds: [3 ▼]    Preset: [Decision Support ▼]                 │   │
│  │                                                                 │   │
│  │                     [ ▶ Start Debate ]                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Live Debate View (3-Way Split)
**Priority**: P0 (Must Have)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Debate in Progress                              Round 2/3   [Cancel]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────┐   │
│  │ ChatGPT (GPT-4)     │ │ Claude (Sonnet)     │ │ Unified View    │   │
│  │ ▶ Speaking...       │ │ ⏳ Waiting          │ │                 │   │
│  ├─────────────────────┤ ├─────────────────────┤ │ Timeline:       │   │
│  │                     │ │                     │ │                 │   │
│  │ I believe micro-    │ │ [Previous response  │ │ R1: ChatGPT ✓   │   │
│  │ services offer      │ │  displayed here]    │ │ R1: Claude ✓    │   │
│  │ better scalability  │ │                     │ │ R2: ChatGPT ▶   │   │
│  │ but introduce       │ │                     │ │ R2: Claude ⏳    │   │
│  │ complexity in...█   │ │                     │ │                 │   │
│  │                     │ │                     │ │ ───────────────│   │
│  │                     │ │                     │ │ Consensus: 45% │   │
│  │                     │ │                     │ │                 │   │
│  └─────────────────────┘ └─────────────────────┘ └─────────────────┘   │
│                                                                         │
│  Status: ChatGPT is responding... (Round 2/3)                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Automated Debate Flow
**Priority**: P0 (Must Have)

```
순차적 자동화 흐름:

Round 1:
┌──────────┐      ┌──────────┐      ┌──────────┐
│ ChatGPT  │ ───► │  Claude  │ ───► │  Gemini  │
│ 질문 입력 │      │ 질문 입력 │      │ 질문 입력 │
│ 응답 수집 │      │ 응답 수집 │      │ 응답 수집 │
└──────────┘      └──────────┘      └──────────┘

Round 2:
┌──────────────────────────────────────────────────┐
│ ChatGPT에게 전달:                                 │
│ "Claude said: [Claude R1 응답]"                  │
│ "Gemini said: [Gemini R1 응답]"                  │
│ "Please respond to these points..."              │
└──────────────────────────────────────────────────┘
         │
         ▼
    (반복...)
```

### 4.4 Result Synthesis
**Priority**: P1 (Should Have)

- 모든 라운드 응답 통합 뷰
- 주요 합의점 하이라이트
- 이견 포인트 정리
- 최종 요약 생성 (선택한 LLM이 수행)
- Markdown/PDF Export

### 4.5 Session Management
**Priority**: P1 (Should Have)

- 로그인 상태 유지 (세션 쿠키 저장)
- 토론 이력 저장
- 중단된 토론 재개
- 토론 템플릿 저장

---

## 5. Technical Architecture

### 5.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Electron Desktop App                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Main Process (Node.js)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   Session   │  │   Debate    │  │   Storage   │              │   │
│  │  │   Manager   │  │ Orchestrator│  │   Manager   │              │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────┘              │   │
│  │         │                │                                       │   │
│  │         │    IPC Bridge  │                                       │   │
│  │         └────────┬───────┘                                       │   │
│  └──────────────────┼───────────────────────────────────────────────┘   │
│                     │                                                   │
│  ┌──────────────────┼───────────────────────────────────────────────┐   │
│  │                  │    Renderer Process (React UI)                │   │
│  │                  ▼                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │                    Control Panel                            ││   │
│  │  │   [Debate Setup]  [Live View]  [History]  [Settings]       ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   BrowserView Instances (Hidden/Visible)          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │  ChatGPT     │  │   Claude     │  │   Gemini     │            │   │
│  │  │ BrowserView  │  │ BrowserView  │  │ BrowserView  │            │   │
│  │  │              │  │              │  │              │            │   │
│  │  │ chat.openai  │  │ claude.ai    │  │ gemini.google│            │   │
│  │  │    .com      │  │              │  │    .com      │            │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Electron 28+ | 크로스 플랫폼, 내장 Chromium |
| UI | React + TypeScript | 타입 안전성, 컴포넌트 재사용 |
| Styling | Tailwind CSS | 빠른 개발, 다크 모드 |
| State | Zustand | 경량, IPC 친화적 |
| Browser Automation | Playwright (Electron) | 안정적인 자동화, 대기 처리 |
| Storage | electron-store | 암호화된 로컬 저장 |
| Build | electron-builder | 크로스 플랫폼 빌드 |

### 5.3 Browser Automation Flow

```typescript
// 각 LLM 사이트별 자동화 어댑터
interface LLMSiteAdapter {
  // 사이트 정보
  name: string;
  url: string;

  // 상태 확인
  isLoggedIn(): Promise<boolean>;

  // 메시지 전송
  sendMessage(prompt: string): Promise<void>;

  // 응답 대기 및 수집
  waitForResponse(): Promise<string>;

  // 새 대화 시작
  startNewChat(): Promise<void>;
}

// ChatGPT 어댑터 예시
class ChatGPTAdapter implements LLMSiteAdapter {
  async sendMessage(prompt: string) {
    await page.fill('textarea[data-id="root"]', prompt);
    await page.click('button[data-testid="send-button"]');
  }

  async waitForResponse() {
    // 응답 완료 대기 (스트리밍 종료)
    await page.waitForSelector('[data-message-author-role="assistant"]');
    await page.waitForFunction(() => {
      // 스트리밍 완료 감지 로직
    });
    return await page.textContent('.agent-turn:last-child');
  }
}
```

### 5.4 Data Flow

```
1. 사용자가 토론 주제 입력
         │
         ▼
2. Orchestrator가 첫 번째 LLM 선택
         │
         ▼
3. BrowserView에 프롬프트 자동 입력
         │
         ▼
4. 응답 완료 대기 (스트리밍 감지)
         │
         ▼
5. 응답 텍스트 추출
         │
         ▼
6. 다음 LLM에게 컨텍스트와 함께 전달
         │
         ▼
7. 모든 라운드 완료까지 반복
         │
         ▼
8. 결과 통합 및 저장
```

---

## 6. Security Considerations

### 6.1 No API Keys Required

| Aspect | Approach |
|--------|----------|
| 인증 | 사용자가 직접 각 사이트에 로그인 |
| 세션 | Electron의 세션 파티션으로 격리 |
| 저장 | 쿠키는 로컬에만 (암호화) |
| 전송 | 모든 통신은 각 사이트의 HTTPS 사용 |

### 6.2 Privacy

```javascript
// 세션 격리
const chatgptSession = session.fromPartition('persist:chatgpt');
const claudeSession = session.fromPartition('persist:claude');

// 각 세션은 독립적인 쿠키/스토리지
```

---

## 7. File Structure

```
mad_framework/
├── src/mad/                       # 기존 MAD SDK (optional)
│
├── desktop/                       # Electron 앱
│   ├── src/
│   │   ├── main/                  # Main Process
│   │   │   ├── index.ts           # Electron 진입점
│   │   │   ├── window.ts          # 윈도우 관리
│   │   │   ├── ipc.ts             # IPC 핸들러
│   │   │   │
│   │   │   ├── orchestrator/      # 토론 오케스트레이터
│   │   │   │   ├── index.ts
│   │   │   │   ├── debate-runner.ts
│   │   │   │   └── round-manager.ts
│   │   │   │
│   │   │   ├── adapters/          # LLM 사이트 어댑터
│   │   │   │   ├── base.ts
│   │   │   │   ├── chatgpt.ts
│   │   │   │   ├── claude.ts
│   │   │   │   └── gemini.ts
│   │   │   │
│   │   │   └── storage/           # 데이터 저장
│   │   │       ├── sessions.ts
│   │   │       └── history.ts
│   │   │
│   │   └── renderer/              # Renderer Process (React)
│   │       ├── components/
│   │       │   ├── LoginPanel.tsx
│   │       │   ├── DebateSetup.tsx
│   │       │   ├── LiveDebate.tsx
│   │       │   ├── ResultView.tsx
│   │       │   └── Settings.tsx
│   │       ├── stores/
│   │       │   ├── debate.ts
│   │       │   └── sessions.ts
│   │       ├── App.tsx
│   │       └── main.tsx
│   │
│   ├── package.json
│   ├── electron-builder.yml
│   └── tsconfig.json
│
└── tasks/prds/0001-mad-web-dashboard/
    ├── README.md                  # This file
    ├── 01-requirements.md
    ├── 02-architecture.md
    ├── 03-implementation.md
    ├── 04-testing.md
    └── 05-deployment.md
```

---

## 8. Timeline & Phases

### Phase 1: Electron Foundation (Week 1-2)
- Electron 프로젝트 설정
- BrowserView 기본 구현
- 로그인 상태 관리

### Phase 2: LLM Adapters (Week 3-4)
- ChatGPT 어댑터
- Claude 어댑터
- Gemini 어댑터
- 응답 감지 로직

### Phase 3: Debate Orchestration (Week 5-6)
- 순차 토론 실행
- 라운드 관리
- 결과 수집

### Phase 4: UI & Polish (Week 7-8)
- 통합 뷰 UI
- 이력 관리
- 빌드 및 배포

---

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 웹사이트 UI 변경 | High | High | CSS 선택자 추상화, 빠른 업데이트 |
| 로그인 캡챠 | Medium | Medium | 사용자 수동 로그인, 세션 유지 |
| Rate Limiting | Medium | Low | 요청 간 딜레이, 재시도 |
| TOS 위반 가능성 | High | Medium | 개인 사용 한정, 면책 고지 |

---

## 10. Comparison: API vs Browser Automation

| 항목 | API 방식 | 브라우저 자동화 |
|------|----------|----------------|
| **비용** | API 사용료 발생 | 기존 구독 활용 (무료) |
| **속도** | 빠름 | 상대적으로 느림 |
| **안정성** | 높음 (공식 API) | UI 변경에 취약 |
| **기능** | API 제공 범위 | 웹 UI 전체 기능 |
| **설정** | API 키 필요 | 로그인만 필요 |

---

## 11. Open Questions

1. **TOS 준수**: 각 서비스의 자동화 허용 범위 확인 필요
2. **세션 만료**: 로그인 세션 유지 기간 및 재인증 처리
3. **다국어**: ChatGPT는 언어 설정에 따라 UI 변경
4. **Pro 기능**: Plus/Pro 구독자만 접근 가능한 기능 감지

---

## Related Documents

- [01-requirements.md](./01-requirements.md) - 상세 요구사항
- [02-architecture.md](./02-architecture.md) - 기술 아키텍처
- [03-implementation.md](./03-implementation.md) - 구현 계획
- [04-testing.md](./04-testing.md) - 테스트 전략
- [05-deployment.md](./05-deployment.md) - 배포 가이드

---

**Next Steps**:
1. Review & approve this PRD
2. 각 LLM 사이트의 DOM 구조 분석
3. Electron 프로젝트 초기화
4. 첫 번째 어댑터 (ChatGPT) 구현
