# PRD: Error Handling Improvement

**Version**: 1.0
**Date**: 2025-12-31
**Status**: Completed

---

## 1. Purpose

MAD Framework Desktop 앱의 JavaScript 에러 처리를 개선하여 앱 안정성 향상 및 사용자 경험 개선.

### Background

Electron 앱 실행 중 "Error" 타이틀의 다이얼로그 창이 다수(13개) 발생하는 문제 발견. 원인 분석 결과:

| 문제 | 위치 | 심각도 |
|------|------|--------|
| Renderer 전역 에러 핸들러 부재 | `src/main.tsx` | High |
| React Error Boundary 미구현 | `src/App.tsx` | High |
| debateController.start() 에러 미전파 | `handlers.ts:139` | Medium |
| IPC 에러 처리 불완전 | `handlers.ts` | Medium |

---

## 2. Target Users

- **Primary**: MAD Framework Desktop 사용자
- **Use Case**: 에러 발생 시 명확한 피드백 수신, 앱 크래시 방지

---

## 3. Core Features

### 3.1 Renderer 전역 에러 핸들러
**Priority**: P0

```typescript
// src/main.tsx
window.addEventListener('error', (event) => {
  console.error('[Renderer] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer] Unhandled rejection:', event.reason);
});
```

### 3.2 React Error Boundary
**Priority**: P0

**새 파일**: `src/components/ErrorBoundary.tsx`

- React Error Boundary 패턴 구현
- 폴백 UI (에러 메시지 + "다시 시도" 버튼)
- 개발 모드에서 스택 트레이스 표시

### 3.3 debate:start 초기 검증
**Priority**: P1

**파일**: `electron/ipc/handlers.ts` (Line 98-146)

```typescript
// 토론 시작 전 로그인 상태 확인
const loginStatus = await browserManager!.checkLoginStatus();
for (const participant of config.participants) {
  if (!loginStatus[participant]?.isLoggedIn) {
    return { success: false, error: `Not logged in: ${participant}` };
  }
}
```

### 3.4 debate-store 에러 처리 개선
**Priority**: P1

**파일**: `src/stores/debate-store.ts`

```typescript
const result = await ipc.debate.start(config);
if (result && !result.success) {
  set({ error: result.error || 'Debate start failed', isRunning: false });
  return;
}
```

---

## 4. Implementation

### 4.1 Modified Files

| 파일 | 변경 내용 |
|------|-----------|
| `desktop/src/main.tsx` | 전역 에러 핸들러 추가 |
| `desktop/src/components/ErrorBoundary.tsx` | **신규 생성** |
| `desktop/src/App.tsx` | ErrorBoundary 적용 |
| `desktop/electron/ipc/handlers.ts` | debate:start 초기 검증 추가 |
| `desktop/src/stores/debate-store.ts` | 에러 응답 처리 개선 |

### 4.2 Implementation Order

```
Phase 1 (Renderer):
├── 1. main.tsx 전역 에러 핸들러 추가
├── 2. ErrorBoundary.tsx 생성
└── 3. App.tsx에 ErrorBoundary 적용

Phase 2 (IPC):
├── 4. handlers.ts debate:start 수정
└── 5. debate-store.ts 에러 처리 개선

Phase 3 (Test):
└── 6. 에러 처리 동작 검증
```

---

## 5. Test Plan

### 5.1 수동 테스트

| 테스트 | 예상 결과 |
|--------|-----------|
| 의도적 JS 에러 발생 | DevTools에 로그, 앱 크래시 없음 |
| 컴포넌트 에러 발생 | ErrorBoundary 폴백 UI 표시 |
| 로그아웃 상태에서 토론 시작 | `{ success: false }` 반환, UI에 에러 표시 |

### 5.2 자동 테스트

```typescript
// tests/unit/components/ErrorBoundary.test.tsx
- 정상 렌더링 테스트
- 에러 시 폴백 UI 테스트
- 재시도 버튼 동작 테스트
```

---

## 6. Checklist

- [x] main.tsx 전역 에러 핸들러 추가
- [x] ErrorBoundary.tsx 생성
- [x] App.tsx에 ErrorBoundary 적용
- [x] handlers.ts debate:start 초기 검증 추가
- [x] debate-store.ts 에러 처리 개선
- [x] 테스트 실행 및 검증

---

## 7. References

- React Error Boundary: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- Electron Error Handling: https://www.electronjs.org/docs/latest/tutorial/process-model
