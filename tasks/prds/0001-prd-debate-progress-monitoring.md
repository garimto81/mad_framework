# PRD: Debate Progress Monitoring

**Version**: 1.0
**Date**: 2025-12-21
**Status**: Draft
**Issue**: N/A

---

## 1. Purpose

MAD Framework Desktop 앱에서 토론 진행 상태를 실시간으로 모니터링하고 사용자에게 시각적으로 표시하는 기능 완성.

### Background

현재 부분 구현된 컴포넌트들:
| 컴포넌트 | 현재 상태 | 구현율 |
|----------|-----------|--------|
| StatusPoller | 기본 구조만 존재 | 40% |
| ProgressLogger | 콘솔 출력만 | 30% |
| debate:progress IPC | 이벤트 발송만 | 60% |
| 진행 상태 UI | store 연동만 | 40% |

---

## 2. Target Users

- **Primary**: MAD Framework Desktop 사용자 (개발자, 연구자)
- **Use Case**: 토론 진행 중 현재 상태, 라운드, 점수 변화를 실시간 확인

---

## 3. Core Features

### 3.1 StatusPoller 완성 (Interval-based)
**Priority**: High
**현재**: 5초 간격 폴링, isWriting/tokenCount만 체크

**구현 필요**:
```typescript
interface PollingConfig {
  interval: number;        // 기본 500ms (사용자 선택)
  activeOnly: boolean;     // 현재 턴인 provider만 체크
}

interface DetailedStatus {
  provider: LLMProvider;
  isWriting: boolean;
  tokenCount: number;
  responseProgress: number;  // 0-100% (추정치)
  timestamp: string;
}
```

**Tasks**:
1. 폴링 간격 500ms로 변경 (현재 5000ms)
2. `responseProgress` 추정 로직 추가 (토큰 증가율 기반)
3. IPC 이벤트로 상태 전송: `debate:status-update`

### 3.2 ProgressLogger In-Memory Storage
**Priority**: High
**현재**: console.log만 출력

**구현 필요**:
```typescript
interface ProgressLog {
  id: string;
  timestamp: string;
  type: 'status' | 'score' | 'cycle' | 'iteration' | 'complete';
  provider?: LLMProvider;
  data: Record<string, unknown>;
}

class ProgressLogger {
  private logs: ProgressLog[] = [];
  private maxLogs: number = 1000;  // 메모리 제한

  log(entry: ProgressLog): void;
  getLogs(limit?: number): ProgressLog[];
  clear(): void;
}
```

**Tasks**:
1. 로그 배열 저장 구조 추가
2. maxLogs 초과 시 FIFO 삭제
3. `getLogs()` 메서드로 UI에서 조회 가능

### 3.3 debate:progress IPC 확장
**Priority**: Medium
**현재**: iteration, currentProvider, phase만 전송

**구현 필요**:
```typescript
interface DebateProgressExtended extends DebateProgress {
  totalElements: number;
  completedElements: number;
  currentElementName?: string;
  estimatedProgress: number;  // 0-100%
}
```

**Tasks**:
1. DebateController에서 확장 데이터 수집
2. 기존 `debate:progress` 이벤트 payload 확장
3. Renderer에서 확장 데이터 수신 처리

### 3.4 Progress Bar UI
**Priority**: High
**현재**: debate-store에 currentProgress 저장만

**구현 필요**:
```
┌─────────────────────────────────────────────┐
│  토론 진행 중 - 라운드 3/10                 │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  45%               │
│                                             │
│  현재: Claude (응답 생성 중...)             │
│  완료된 요소: 2/4                          │
└─────────────────────────────────────────────┘
```

**Tasks**:
1. `DebateProgressBar` 컴포넌트 생성
2. Progress bar 애니메이션 (CSS transitions)
3. 현재 provider, phase 표시
4. 요소 완료 카운터 표시

---

## 4. Technical Architecture

### 4.1 Data Flow

```
BrowserViewManager
       │
       ▼
 ┌─────────────┐     ┌─────────────┐
 │ StatusPoller│────▶│ProgressLogger│ (in-memory)
 └─────────────┘     └─────────────┘
       │                    │
       ▼                    ▼
 ┌─────────────┐     ┌─────────────┐
 │   IPC Event │────▶│ debate-store│
 │ (Main→Render)│    │  (Zustand)  │
 └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ProgressBar │
                    │     UI     │
                    └─────────────┘
```

### 4.2 File Structure

```
desktop/
├── electron/
│   └── debate/
│       ├── status-poller.ts      # 수정
│       └── progress-logger.ts    # 수정
├── src/
│   ├── components/
│   │   └── DebateProgressBar.tsx # 신규
│   └── stores/
│       └── debate-store.ts       # 수정
└── shared/
    └── types.ts                  # 타입 확장
```

### 4.3 IPC Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `debate:progress` | Main→Render | DebateProgressExtended |
| `debate:status-update` | Main→Render | DetailedStatus |
| `debate:element-score` | Main→Render | ElementScoreUpdate (기존) |

---

## 5. Implementation Plan

### Phase 1: StatusPoller 개선
1. 폴링 간격 500ms 적용
2. responseProgress 추정 로직
3. `debate:status-update` IPC 이벤트

### Phase 2: ProgressLogger 메모리 저장
1. ProgressLog 인터페이스 정의
2. 로그 배열 저장
3. FIFO 정리 로직

### Phase 3: IPC 확장
1. DebateProgressExtended 타입
2. DebateController 수정
3. preload.ts 채널 등록

### Phase 4: UI 구현
1. DebateProgressBar 컴포넌트
2. debate-store 연동
3. 스타일링 및 애니메이션

---

## 6. Success Criteria

| Metric | Target |
|--------|--------|
| 폴링 지연 | < 600ms |
| UI 업데이트 | < 100ms |
| 메모리 사용 | < 10MB (로그 1000개) |
| Progress 정확도 | 90% 이내 |

---

## 7. Dependencies

- 기존 BrowserViewManager 정상 동작
- Adapter별 isWriting() 정확성 (Issue #11 해결 전제)
- Zustand store 구조 유지

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| 잦은 폴링으로 성능 저하 | activeOnly 모드로 현재 턴만 체크 |
| 메모리 누수 | maxLogs 제한 + clear() 호출 |
| Progress 추정 부정확 | 토큰 기반 추정 + 최소 진행률 보장 |

---

## 9. Testing Strategy

### Unit Tests
- StatusPoller: 폴링 간격, 상태 변경 감지
- ProgressLogger: 로그 저장, FIFO 삭제, 메모리 제한

### Integration Tests
- IPC 이벤트 전달 검증
- Store 업데이트 검증

### E2E Tests
- 토론 시작 → Progress Bar 표시 → 완료 흐름

---

## Next Steps

1. `/todo` 실행하여 Task 목록 생성
2. Issue 생성 (`gh issue create`)
3. 브랜치 생성 및 TDD 시작

---

**Created by**: Claude Code
**Template**: Standard
