# PRD: Session Recording & Export

**Version**: 1.0
**Date**: 2025-12-23
**Status**: Draft
**Issue**: #25

---

## 1. Purpose

MAD Framework Desktop 앱에서 LLM 토론 세션의 전체 기록을 저장하고 JSON/Markdown 형식으로 내보내는 기능 추가.

### Background

웹 리서치 결과, Browser-Use, llm-provider, Skyvern 등의 최신 솔루션은 LLM 웹 인터페이스와의 대화를 자동으로 기록하고 내보내는 기능을 제공합니다. MAD Framework에도 이러한 기능을 추가하여 토론 세션의 전체 기록을 저장하고 분석할 수 있게 합니다.

**참고한 솔루션**:
| 솔루션 | GitHub Stars | 특징 |
|--------|--------------|------|
| Browser-Use | 63k+ | DOM+Vision 하이브리드, 세션 기록 지원 |
| llm-provider | - | ChatGPT/Claude 전용, 대화 저장 |
| Skyvern | - | Computer Vision 기반, 로깅 시스템 |

---

## 2. Target Users

- **Primary**: MAD Framework Desktop 사용자 (개발자, 연구자)
- **Use Case**: 토론 완료 후 전체 대화 기록 분석, 보고서 작성, 데이터 백업

---

## 3. Core Features

### 3.1 세션 기록 (SessionRecorder)
**Priority**: P0

모든 프롬프트/응답을 **5초 간격 폴링**으로 기록 (실시간 아님):

```typescript
interface MessageRecord {
  id: string;
  timestamp: Date;
  provider: LLMProvider;
  role: 'user' | 'assistant';
  content: string;
  tokenCount?: number;
  iteration: number;
  elementId?: string;
}
```

**구현 필요**:
- DebateController에서 메시지 입력/출력 시 자동 기록
- 타임스탬프, Provider, iteration 정보 포함
- 5초 간격으로 isWriting 상태 확인 후 응답 완료 시 기록
- 메모리 기반 1차 저장

### 3.2 JSON 내보내기
**Priority**: P0

구조화된 JSON 형식으로 전체 세션 데이터 내보내기:

```json
{
  "session": {
    "id": "session-123",
    "debateId": "debate-456",
    "startedAt": "2025-12-23T10:00:00Z",
    "endedAt": "2025-12-23T10:15:00Z",
    "status": "completed"
  },
  "config": {
    "preset": "code_review",
    "topic": "코드 리뷰 요청",
    "participants": ["chatgpt", "claude"]
  },
  "messages": [...],
  "elements": [...],
  "metadata": {
    "totalTokens": 5420,
    "totalIterations": 5,
    "completionReason": "consensus"
  }
}
```

### 3.3 Markdown 내보내기
**Priority**: P0

사람이 읽기 쉬운 Markdown 형식으로 내보내기:

```markdown
# MAD 토론 세션 기록

**Session ID**: session-123
**Preset**: code_review
**시작**: 2025-12-23 10:00:00
**종료**: 2025-12-23 10:15:00

## 대화 기록

### Iteration 1

#### ChatGPT (User) - 10:00:05
다음 코드를 리뷰해주세요...

#### ChatGPT (Assistant) - 10:00:30
코드를 분석했습니다...
```

### 3.4 세션 저장소 (SQLite)
**Priority**: P1

영구 저장을 위한 SQLite 데이터베이스:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  debate_id TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  status TEXT,
  config_json TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  timestamp DATETIME,
  provider TEXT,
  role TEXT,
  content TEXT,
  token_count INTEGER,
  iteration INTEGER,
  element_id TEXT
);
```

### 3.5 세션 목록 UI
**Priority**: P1

React 컴포넌트로 세션 목록 및 내보내기 버튼:

```tsx
<SessionPanel>
  <SessionList sessions={sessions} />
  <ExportButton format="json" />
  <ExportButton format="markdown" />
</SessionPanel>
```

### 3.6 진행 상태 확인 (5초 간격 폴링)
**Priority**: P1

실시간 모니터링 대신 **5초 간격 폴링** 방식으로 작업 진행 여부 확인:

```typescript
class ProgressChecker {
  private intervalId?: NodeJS.Timeout;

  start(sessionId: string): void {
    this.intervalId = setInterval(() => {
      this.checkProgress(sessionId);
    }, 5000);  // 5초 간격
  }

  private async checkProgress(sessionId: string): Promise<void> {
    const isWriting = await adapter.isWriting();
    if (!isWriting) {
      // 작업 완료 - 응답 기록
      const response = await adapter.getResponse();
      sessionRecorder.recordMessage(provider, 'assistant', response);
    }
  }
}
```

**장점**:
- 리소스 효율적 (실시간 모니터링보다 부하 적음)
- 기존 StatusPoller 패턴과 일관성 유지
- 작업 진행 여부만 확인 (단순한 로직)

---

## 4. Technical Design

### 4.1 데이터 모델

```typescript
// 세션 기록 타입
interface SessionRecord {
  id: string;
  debateId: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  config: DebateConfig;
  messages: MessageRecord[];
  elements: ElementRecord[];
  metadata: SessionMetadata;
}

interface SessionMetadata {
  totalTokens: number;
  totalIterations: number;
  providersUsed: LLMProvider[];
  completionReason?: 'consensus' | 'cycle' | 'maxIterations' | 'cancelled';
}
```

### 4.2 아키텍처

```
┌─────────────────────────────────────────────────┐
│              React UI (Renderer)                │
│  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ SessionList │  │ ExportButton (JSON/MD)  │   │
│  └─────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────┘
                        ↓ IPC
┌─────────────────────────────────────────────────┐
│              Electron Main Process              │
│  ┌─────────────────────────────────────────┐    │
│  │         SessionRecorder (NEW)            │    │
│  │  - recordMessage(provider, content)     │    │
│  │  - exportToJSON(sessionId)              │    │
│  │  - exportToMarkdown(sessionId)          │    │
│  └─────────────────────────────────────────┘    │
│                     ↓                           │
│  ┌─────────────────────────────────────────┐    │
│  │       SessionRepository (NEW)            │    │
│  │  - SQLite 기반 영구 저장                 │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 4.3 IPC 인터페이스

```typescript
// Main → Renderer
session:started(sessionId)
session:message-recorded(message)
session:completed(sessionId)

// Renderer → Main
ipcMain.handle('session:list') → SessionRecord[]
ipcMain.handle('session:get', sessionId) → SessionRecord
ipcMain.handle('session:export-json', sessionId, path) → void
ipcMain.handle('session:export-markdown', sessionId, path) → void
ipcMain.handle('session:delete', sessionId) → void
```

---

## 5. Implementation Files

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `desktop/electron/session/session-recorder.ts` | 신규 | 메시지 기록 클래스 |
| `desktop/electron/session/session-repository.ts` | 신규 | SQLite 저장소 |
| `desktop/electron/session/types.ts` | 신규 | 타입 정의 |
| `desktop/electron/session/exporters/json-exporter.ts` | 신규 | JSON 내보내기 |
| `desktop/electron/session/exporters/markdown-exporter.ts` | 신규 | Markdown 내보내기 |
| `desktop/electron/ipc/handlers.ts` | 수정 | 세션 IPC 핸들러 추가 |
| `desktop/electron/debate/debate-controller.ts` | 수정 | SessionRecorder 연동 |
| `desktop/src/stores/session-store.ts` | 신규 | Zustand 스토어 |
| `desktop/src/components/SessionPanel.tsx` | 신규 | 세션 목록 UI |

---

## 6. Implementation Plan

### Phase 1: 기본 기록 (P0)
- [ ] `desktop/electron/session/session-recorder.ts` 생성
- [ ] `desktop/electron/session/types.ts` 타입 정의
- [ ] `desktop/electron/debate/debate-controller.ts` SessionRecorder 연동
- [ ] `desktop/electron/session/exporters/json-exporter.ts` 생성
- [ ] 단위 테스트 작성

### Phase 2: UI 및 저장 (P1)
- [ ] `desktop/electron/session/session-repository.ts` SQLite 저장소
- [ ] `desktop/electron/session/exporters/markdown-exporter.ts` 생성
- [ ] `desktop/electron/ipc/handlers.ts` 세션 IPC 핸들러 추가
- [ ] `desktop/src/stores/session-store.ts` Zustand 스토어
- [ ] `desktop/src/components/SessionPanel.tsx` UI 컴포넌트
- [ ] E2E 테스트 작성

### Phase 3: 고급 기능 (P2)
- [ ] 자동 저장 옵션
- [ ] 세션 검색 기능
- [ ] 부분 내보내기 (특정 요소만)

---

## 7. Success Metrics

| 지표 | 목표 |
|------|------|
| 세션 기록 성공률 | 100% (모든 메시지 기록) |
| 내보내기 형식 | JSON + Markdown 둘 다 지원 |
| UI 응답 시간 | < 100ms (세션 목록 로드) |
| 저장소 용량 | 세션당 < 1MB |

---

## 8. Reference Links

- [Browser-Use GitHub](https://github.com/browser-use/browser-use)
- [llm-provider GitHub](https://github.com/wctsai20002/llm-provider)
- [Skyvern GitHub](https://github.com/Skyvern-AI/skyvern)

---

## 9. Mockup

![Session Recording UI](../images/session-recording.png)

**HTML 목업**: `docs/mockups/session-recording.html`
