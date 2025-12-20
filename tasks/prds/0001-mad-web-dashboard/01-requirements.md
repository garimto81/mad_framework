# 01. Requirements Specification

**PRD**: 0001-mad-web-dashboard
**Version**: 2.0 (Browser Automation)
**Last Updated**: 2025-12-18

---

## 1. Functional Requirements

### 1.1 LLM 사이트 통합 (FR-100)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-101 | ChatGPT 연동 | P0 | BrowserView로 chat.openai.com 로그인/제어 |
| FR-102 | Claude 연동 | P0 | BrowserView로 claude.ai 로그인/제어 |
| FR-103 | Gemini 연동 | P0 | BrowserView로 gemini.google.com 로그인/제어 |
| FR-104 | 세션 격리 | P0 | 각 LLM별 독립 세션 파티션 |
| FR-105 | 로그인 상태 유지 | P0 | 앱 재시작 시 로그인 유지 |
| FR-106 | 로그인 상태 표시 | P0 | 각 LLM 연결 상태 시각화 |
| FR-107 | 수동 로그인 지원 | P0 | 사용자가 직접 브라우저에서 로그인 |

### 1.2 토론 실행 (FR-200)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-201 | 토론 주제 입력 | P0 | 텍스트 입력 필드, 최대 500자 |
| FR-202 | 컨텍스트 입력 | P0 | 멀티라인 텍스트, 최대 10,000자 |
| FR-203 | 프리셋 선택 | P0 | Code Review, Q&A, Decision 선택 가능 |
| FR-204 | 무한 반복 토론 | P0 | 모든 요소 완성 시 자동 종료 |
| FR-205 | 토론자 선택 | P0 | ChatGPT, Claude, Gemini 중 선택 |
| FR-206 | 토론자 추가/제거 | P1 | 2-3개 LLM 조합 |
| FR-207 | 커스텀 프롬프트 | P2 | 고급 사용자용 직접 프롬프트 입력 |
| FR-208 | Judge 모델 선택 | P0 | 순환 감지용 심판 LLM 지정 |

### 1.3 브라우저 자동화 (FR-300)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-301 | 프롬프트 자동 입력 | P0 | 각 LLM 사이트 텍스트박스에 자동 입력 |
| FR-302 | 응답 대기 | P0 | LLM 응답 완료 감지 |
| FR-303 | 응답 수집 | P0 | 응답 텍스트 파싱 및 추출 |
| FR-304 | 순차적 비평 실행 | P0 | LLM A 출력 → LLM B 비평 + 개선 → LLM C 비평 + 개선 |
| FR-305 | 최신 버전 전달 | P0 | 다음 모델은 가장 마지막 버전만 수신 |
| FR-306 | 토론 취소 | P1 | 진행 중 취소 가능 |
| FR-307 | 일시정지/재개 | P2 | 반복 간 일시정지 |

### 1.4 요소별 점수 시스템 (FR-350)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-351 | 요소 분류 | P0 | 비평 시 각 요소별로 분류하여 평가 |
| FR-352 | 점수 부여 | P0 | 각 요소별 0-100점 점수 산정 |
| FR-353 | 완성 기준 | P0 | 90점 이상 = 해당 요소 완성 처리 |
| FR-354 | 진행 표시 | P0 | 요소별 점수 및 완성 상태 실시간 표시 |
| FR-355 | 요소 잠금 | P0 | 완성된 요소는 더 이상 평가하지 않음 |

### 1.5 Judge 모델 (FR-360)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-361 | 순환 감지 | P0 | 마지막 3개 버전 비교하여 순환 오류 판단 |
| FR-362 | 순환 완료 처리 | P0 | 순환 감지 시 해당 요소 완성 처리 |
| FR-363 | 전체 완료 판정 | P0 | 모든 요소 완성 시 토론 종료 |
| FR-364 | Judge 선택 | P1 | 사용자가 Judge용 LLM 지정 가능 |

### 1.6 진행 상황 로그 모니터링 (FR-400)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-401 | 5초 간격 상태 폴링 | P0 | 각 LLM 작성 중 여부 체크 |
| FR-402 | 로그 기반 진행 표시 | P0 | `gpt...진행중...토큰수` 형식 로그 |
| FR-403 | 요소 점수 로그 | P0 | `요소[보안] 점수: 85점` 형식 로그 |
| FR-404 | 반복 구분 로그 | P1 | `=== 반복 #N (provider) ===` |
| FR-405 | 에러 로그 | P0 | 사이트 오류, 타임아웃 등 로그 |

### 1.7 결과 표시 (FR-500)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-501 | Three-Way 매트릭스 | P0 | 3개 LLM 응답 비교 테이블 |
| FR-502 | 반복별 응답 뷰 | P0 | 각 반복의 비평/개선 이력 표시 |
| FR-507 | 요소별 점수 표시 | P0 | 요소별 점수 진행 차트 |
| FR-508 | 버전 히스토리 | P0 | 요소별 마지막 3개 버전 비교 |
| FR-503 | 합의 포인트 하이라이트 | P1 | 공통 의견 강조 표시 |
| FR-504 | 차이점 분석 | P1 | 의견 차이 시각화 |
| FR-505 | 결과 복사 | P0 | Markdown 형식 복사 |
| FR-506 | 결과 Export | P1 | JSON, Markdown 다운로드 |

### 1.8 이력 관리 (FR-600)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-601 | 토론 자동 저장 | P0 | 완료 시 SQLite/LocalStorage 저장 |
| FR-602 | 이력 목록 | P0 | 날짜, 주제, 결과 미리보기 |
| FR-603 | 이력 검색 | P1 | 주제, 날짜 필터 |
| FR-604 | 이력 상세 보기 | P0 | 전체 토론 내용 재현 |
| FR-605 | 이력 삭제 | P0 | 개별/전체 삭제 |
| FR-606 | 이력 비교 | P2 | 2개 토론 나란히 비교 |

### 1.9 설정 관리 (FR-700)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-701 | LLM 로그인 관리 | P0 | 각 LLM 로그인/로그아웃 UI |
| FR-702 | 세션 초기화 | P0 | 브라우저 세션 쿠키 삭제 |
| FR-703 | 기본 프리셋 설정 | P1 | 앱 시작 시 기본값 |
| FR-704 | 요소 완성 기준점 | P1 | 기본값 90점 (조정 가능) |
| FR-705 | 테마 선택 | P1 | Light/Dark/System |
| FR-706 | 자동화 속도 설정 | P1 | 입력 딜레이, 대기 시간 |
| FR-707 | 설정 초기화 | P0 | 공장 초기화 |

---

## 2. Non-Functional Requirements

### 2.1 Performance (NFR-100)

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-101 | 앱 시작 시간 | < 5초 | Electron 시작 |
| NFR-102 | BrowserView 로딩 | < 10초 | 각 LLM 사이트 |
| NFR-103 | UI 응답성 | < 100ms | User interaction |
| NFR-104 | 메모리 사용 | < 1GB | 3개 BrowserView 포함 |
| NFR-105 | CPU 사용률 | < 30% | 유휴 시 |

### 2.2 Security (NFR-200)

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-201 | 세션 격리 | 각 LLM별 독립 세션 파티션 |
| NFR-202 | 데이터 로컬 저장 | 모든 데이터 로컬에만 저장 |
| NFR-203 | 입력 검증 | 자동화 스크립트 인젝션 방지 |
| NFR-204 | 안전한 IPC | Main/Renderer 간 보안 통신 |
| NFR-205 | 설정 암호화 | 민감 설정 암호화 저장 |

### 2.3 Usability (NFR-300)

| ID | Requirement | Description |
|----|-------------|-------------|
| NFR-301 | 첫 사용 가이드 | 온보딩 튜토리얼 |
| NFR-302 | 로그인 가이드 | 각 LLM 로그인 방법 안내 |
| NFR-303 | 에러 메시지 | 사용자 친화적 한글 메시지 |
| NFR-304 | 로딩 상태 | 스피너/스켈레톤 UI |
| NFR-305 | 키보드 단축키 | Ctrl+Enter 실행 등 |

### 2.4 Reliability (NFR-400)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-401 | 자동화 재시도 | 실패 시 3회 재시도 |
| NFR-402 | 세션 복구 | 앱 재시작 시 세션 유지 |
| NFR-403 | 에러 처리 | Graceful degradation |
| NFR-404 | 사이트 변경 대응 | 어댑터 패턴으로 분리 |

### 2.5 Compatibility (NFR-500)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-501 | Windows | 10, 11 |
| NFR-502 | macOS | 12+ (Monterey 이상) |
| NFR-503 | Linux | Ubuntu 20.04+ |
| NFR-504 | Electron | 28+ |
| NFR-505 | Node.js | 20.x LTS |

---

## 3. User Stories

### Epic 1: LLM 로그인

```gherkin
Feature: LLM Site Login

  Scenario: ChatGPT 로그인
    Given 앱이 실행되었다
    When ChatGPT 탭을 클릭한다
    Then ChatGPT 로그인 페이지가 BrowserView에 표시된다
    And 사용자가 로그인하면 상태가 "연결됨"으로 변경된다

  Scenario: 여러 LLM 로그인
    Given ChatGPT에 로그인했다
    When Claude 탭으로 이동한다
    And Claude에 로그인한다
    Then ChatGPT와 Claude 모두 "연결됨" 상태이다
    And 각 세션은 독립적으로 유지된다
```

### Epic 2: 토론 실행

```gherkin
Feature: Debate Execution

  Scenario: 기본 토론 실행 (무한 반복)
    Given 3개 LLM에 모두 로그인했다
    And 토론 주제를 입력했다
    When "Start Debate" 버튼을 클릭한다
    Then ChatGPT에 주제가 입력되어 완전한 결과를 출력한다
    And Claude가 ChatGPT 출력을 받아 비평 및 개선안을 제시한다
    And 각 요소별로 점수(0-100)가 부여된다
    And 90점 이상인 요소는 완성 처리된다
    And 모든 요소가 완성될 때까지 무한 반복한다

  Scenario: 순환 오류 감지
    Given 토론이 진행 중이다
    And 특정 요소가 3번 반복되었다
    When Judge 모델이 마지막 3개 버전을 비교한다
    Then 순환 오류가 감지된다
    And 해당 요소는 완성된 것으로 처리된다
    And 더 이상 개선이 불가능한 상태로 판정된다

  Scenario: 코드 리뷰 토론
    Given "Code Review" 프리셋을 선택했다
    And 코드를 Context에 붙여넣었다
    When 토론을 시작한다
    Then 각 LLM이 코드 리뷰 관점에서 비평/개선한다
    And 보안, 성능, 가독성 등 요소별 점수가 표시된다

  Scenario: 토론 중 취소
    Given 토론이 진행 중이다
    When "Cancel" 버튼을 클릭한다
    Then 자동화가 중단된다
    And 수집된 부분 결과가 저장된다
```

### Epic 3: 결과 관리

```gherkin
Feature: Result Management

  Scenario: Three-Way 비교
    Given 토론이 완료되었다
    Then ChatGPT, Claude, Gemini 응답이 3열 테이블에 표시된다
    And 공통 의견이 하이라이트된다

  Scenario: 결과 복사
    Given 토론이 완료되었다
    When "Copy Result" 버튼을 클릭한다
    Then Markdown 형식으로 클립보드에 복사된다
```

### Epic 4: 설정 관리

```gherkin
Feature: Settings Management

  Scenario: 세션 초기화
    Given 사용자가 Settings를 열었다
    When "Reset Sessions" 버튼을 클릭한다
    Then 모든 LLM 로그인이 해제된다
    And 브라우저 쿠키가 삭제된다

  Scenario: 자동화 속도 조절
    Given 사용자가 Settings를 열었다
    When 입력 딜레이를 500ms로 설정한다
    Then 다음 토론부터 적용된다
```

---

## 4. UI/UX Requirements

### 4.1 Main Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo | [New Debate] [History] [Settings]    [Theme]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐│
│  │  LLM Status Panel    │  │                                  ││
│  │                      │  │      Main Content Area           ││
│  │  [●] ChatGPT  ✓     │  │                                  ││
│  │  [●] Claude   ✓     │  │  - Debate Form (when idle)       ││
│  │  [○] Gemini   ✗     │  │  - Debate Progress (running)     ││
│  │                      │  │  - Three-Way Matrix (complete)   ││
│  │  [Login to Gemini]   │  │  - History List                  ││
│  │                      │  │                                  ││
│  └──────────────────────┘  └──────────────────────────────────┘│
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Browser Preview Panel (minimized, expandable)           │  │
│  │  [ChatGPT] [Claude] [Gemini] - Click to expand           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Footer: Version | Status: Ready                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Three-Way Matrix View (요소별 점수 포함)

```
┌─────────────────────────────────────────────────────────────────┐
│  Element Scores                              [Iteration #15]    │
├─────────────────────┬─────────────────────┬─────────────────────┤
│      보안 (92/100)   │   성능 (88/100)      │   가독성 (95/100)   │
│      ✅ 완성         │   🔄 진행중          │   ✅ 완성          │
├─────────────────────┴─────────────────────┴─────────────────────┤
│  Current Version (by Claude)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Latest critique and improvement...                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Version History: [v13] [v14] [v15]  (순환 감지용)              │
│  Progress: 2/3 elements completed                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Color Scheme

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | #FFFFFF | #1a1a2e |
| Surface | #F5F5F5 | #16213e |
| Primary | #6366F1 | #818CF8 |
| ChatGPT | #10A37F | #10A37F |
| Claude | #D97706 | #F59E0B |
| Gemini | #4285F4 | #60A5FA |
| Text | #1F2937 | #F3F4F6 |
| Error | #EF4444 | #F87171 |
| Success | #22C55E | #4ADE80 |

### 4.4 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Heading 1 | Inter | 24px | 700 |
| Heading 2 | Inter | 20px | 600 |
| Body | Inter | 14px | 400 |
| Code | JetBrains Mono | 13px | 400 |
| Caption | Inter | 12px | 400 |
| LLM Response | System Default | 14px | 400 |

---

## 5. Data Models

### 5.1 LLM Session

```typescript
interface LLMSession {
  provider: 'chatgpt' | 'claude' | 'gemini';
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastActive?: string;           // ISO 8601
  sessionPartition: string;      // Electron partition ID
  errorMessage?: string;
}
```

### 5.2 Debate Session

```typescript
interface DebateSession {
  id: string;                    // UUID
  createdAt: string;             // ISO 8601
  completedAt?: string;
  status: 'pending' | 'running' | 'completed' | 'cancelled';

  // Input
  topic: string;
  context?: string;
  preset: string;
  participants: LLMProvider[];   // ['chatgpt', 'claude', 'gemini']
  judgeProvider: LLMProvider;    // Judge용 LLM

  // Progress
  currentIteration: number;
  currentSpeaker?: LLMProvider;
  iterations: DebateIteration[];

  // Element Tracking
  elements: DebateElement[];
  completionThreshold: number;   // 기본값 90

  // Metadata
  automationLog: AutomationEvent[];
}

interface DebateElement {
  id: string;
  name: string;                  // 요소 이름 (보안, 성능 등)
  status: 'pending' | 'in_progress' | 'completed' | 'cycle_detected';
  currentScore: number;          // 0-100
  scoreHistory: number[];        // 점수 이력
  versionHistory: ElementVersion[]; // 마지막 3개 버전 (순환 감지용)
  completedAt?: string;
  completionReason?: 'threshold' | 'cycle';
}

interface ElementVersion {
  iteration: number;
  content: string;
  score: number;
  timestamp: string;
  provider: LLMProvider;
}

interface DebateIteration {
  iterationNumber: number;
  responses: {
    provider: LLMProvider;
    content: string;
    timestamp: string;
    inputPrompt: string;
    elementScores: { elementId: string; score: number; critique: string }[];
  }[];
}

interface AutomationEvent {
  timestamp: string;
  type: 'input' | 'wait' | 'extract' | 'score' | 'cycle_check' | 'error';
  provider: LLMProvider;
  details: string;
}
```

### 5.3 App Settings

```typescript
interface AppSettings {
  // LLM Sessions
  sessions: {
    chatgpt: LLMSession;
    claude: LLMSession;
    gemini: LLMSession;
  };

  // Automation
  automation: {
    inputDelay: number;          // ms between keystrokes
    waitTimeout: number;         // max wait for response
    retryAttempts: number;       // retry on failure
  };

  // Defaults
  defaults: {
    preset: string;
    completionThreshold: number;  // 기본값 90
    judgeProvider: LLMProvider;
    participants: LLMProvider[];
  };

  // UI
  ui: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    showBrowserPreview: boolean;
  };
}
```

---

## 6. IPC Contract (Electron Main ↔ Renderer)

### 6.1 LLM Control

```typescript
// Renderer → Main
interface LLMControlRequest {
  channel: 'llm:login' | 'llm:logout' | 'llm:status' | 'llm:input' | 'llm:extract';
  payload: {
    provider: LLMProvider;
    text?: string;               // for input
    selector?: string;           // for extract
  };
}

// Main → Renderer
interface LLMControlResponse {
  channel: 'llm:result';
  payload: {
    provider: LLMProvider;
    success: boolean;
    data?: string;
    error?: string;
  };
}
```

### 6.2 Debate Control

```typescript
// Renderer → Main
interface DebateControlRequest {
  channel: 'debate:start' | 'debate:cancel' | 'debate:pause' | 'debate:resume';
  payload: {
    sessionId: string;
    config?: DebateConfig;
  };
}

// Main → Renderer (Events)
interface DebateEvent {
  channel: 'debate:progress' | 'debate:response' | 'debate:complete' | 'debate:error';
  payload: {
    sessionId: string;
    round?: number;
    provider?: LLMProvider;
    content?: string;
    status?: string;
  };
}
```

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| MAD | Multi-Agent Debate |
| BrowserView | Electron의 내장 브라우저 뷰 컴포넌트 |
| Session Partition | Electron의 세션 격리 단위 |
| Three-Way Matrix | 3개 LLM 응답 비교 뷰 |
| Iteration | 하나의 LLM이 비평 및 개선안을 제시하는 단위 |
| Element | 평가 대상 요소 (보안, 성능, 가독성 등) |
| Element Score | 요소별 점수 (0-100, 90+ = 완성) |
| Cycle Detection | Judge 모델이 마지막 3개 버전을 비교하여 순환 오류 판단 |
| Completion Threshold | 요소 완성 기준점 (기본값 90점) |
| Judge Model | 순환 오류 감지를 담당하는 LLM |
| Adapter | 각 LLM 사이트별 자동화 로직 모듈 |

---

## Appendix B: References

- [Electron BrowserView](https://www.electronjs.org/docs/latest/api/browser-view)
- [Electron Session](https://www.electronjs.org/docs/latest/api/session)
- [Playwright](https://playwright.dev/)
- [MAD Framework SDK](../../../src/mad/)
