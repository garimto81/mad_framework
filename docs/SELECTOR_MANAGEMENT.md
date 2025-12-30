# 셀렉터 관리 가이드

MAD Framework Desktop 앱의 DOM 셀렉터 관리 및 유지보수 가이드.

## 배경

외부 LLM 서비스(ChatGPT, Claude, Gemini)의 UI 변경은 예고 없이 발생하며, 셀렉터 실패로 이어집니다.

### 최근 사례

| 이슈 | 서비스 | 문제 | 영향 |
|------|--------|------|------|
| #28 | Claude | UI v2 변경 | 응답 추출 100% 실패 |
| #26 | ChatGPT | 마크업 변경 | 응답 추출 80% 실패 |
| #9 | ChatGPT | 코드블록 구조 변경 | "코드 복사" 텍스트 혼입 |

## 셀렉터 구조

```
desktop/electron/browser/adapters/
├── selector-config.ts      # 모든 셀렉터 정의 (Single Source of Truth)
├── base-adapter.ts         # fallback 로직 + 공통 추출
├── chatgpt-adapter.ts      # ChatGPT 특화 로직
├── claude-adapter.ts       # Claude 특화 로직
└── gemini-adapter.ts       # Gemini 특화 로직
```

### selector-config.ts 구조

```typescript
// Provider별 Fallback 체인
export function getSelectorSets(provider: LLMProvider): ProviderSelectors {
  return {
    inputTextarea: {
      primary: 'textarea[data-testid="chat-input-ssr"]',
      fallbacks: [
        'div.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"]',
      ],
    },
    sendButton: { ... },
    stopButton: { ... },
    responseContainer: { ... },
    typingIndicator: { ... },
    loginCheck: { ... },
  };
}
```

### 셀렉터 유형

| 유형 | 용도 | 실패 시 영향 |
|------|------|-------------|
| `inputTextarea` | 프롬프트 입력 | 메시지 전송 불가 |
| `sendButton` | 전송 버튼 클릭 | Enter 키 폴백 시도 |
| `responseContainer` | 응답 추출 | 토론 결과 없음 |
| `typingIndicator` | 응답 대기 감지 | 타임아웃 발생 |
| `loginCheck` | 로그인 상태 확인 | 토론 시작 불가 |

## 셀렉터 업데이트 절차

```
1. 문제 감지
   ├─ 테스트 실패
   └─ 사용자 보고
        ↓
2. DevTools로 DOM 분석
   ├─ F12 → Elements 탭
   └─ 현재 셀렉터 검색 → 새 구조 파악
        ↓
3. selector-config.ts 수정
   └─ 새 셀렉터를 primary 또는 fallbacks 앞에 추가
        ↓
4. 테스트 실행
   ├─ npm run test:run (Unit)
   └─ npm run test:e2e (E2E)
        ↓
5. PR 생성 → 머지
```

## DOM 분석 방법

### 1. DevTools에서 현재 셀렉터 확인

```javascript
// Console에서 실행
document.querySelector('div.standard-markdown')  // Claude 응답
document.querySelector('[data-message-author-role="assistant"]')  // ChatGPT 응답
```

### 2. 새 셀렉터 발견

```javascript
// 응답 컨테이너 후보 찾기
document.querySelectorAll('[class*="response"]')
document.querySelectorAll('[class*="message"]')
document.querySelectorAll('[class*="markdown"]')
document.querySelectorAll('article')
```

### 3. 셀렉터 안정성 평가

| 우선순위 | 유형 | 예시 | 안정성 |
|----------|------|------|--------|
| 1 | data-testid | `[data-testid="chat-input"]` | 높음 |
| 2 | aria-label | `[aria-label="Send message"]` | 높음 |
| 3 | 의미적 클래스 | `.markdown`, `.prose` | 중간 |
| 4 | 구조적 셀렉터 | `article > div > p` | 낮음 |
| 5 | 동적 클래스 | `.css-1a2b3c4` | 매우 낮음 |

## 히스토리 추적

selector-config.ts에 주석으로 버전 정보 기록:

```typescript
responseContainer: {
  // Issue #28: 2025-12 Claude UI v2 대응
  primary: 'div.standard-markdown',
  fallbacks: [
    // 2025-12: 보조 셀렉터
    'p.font-claude-response-body',
    // 2024-11: 기존 셀렉터 (fallback)
    '[data-testid="conversation-turn-assistant"]',
  ],
},
```

## 긴급 대응 체크리스트

셀렉터 실패 발생 시:

- [ ] 어떤 어댑터(ChatGPT/Claude/Gemini)가 실패했는지 확인
- [ ] 어떤 셀렉터 유형(input/send/response 등)이 실패했는지 확인
- [ ] DevTools로 현재 DOM 구조 캡처 (스크린샷)
- [ ] 새 셀렉터를 `selector-config.ts`에 추가
  - 가능하면 primary로, 아니면 fallbacks 맨 앞에
- [ ] `npm run test:run` 통과 확인
- [ ] hotfix PR 생성 → 빠른 리뷰 → 머지

## 모니터링 권장사항

### 정기 점검

- **주간**: 각 Provider 로그인 및 기본 메시지 테스트
- **UI 업데이트 공지 시**: 즉시 수동 테스트

### 자동화 (향후)

```yaml
# .github/workflows/selector-check.yml
name: Selector Health Check
on:
  schedule:
    - cron: '0 9 * * 1'  # 매주 월요일 09:00
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:e2e -- tests/e2e/app.spec.ts
```

## 관련 이슈

- Issue #18: 셀렉터 Fallback 시스템 구현
- Issue #27: 어댑터 파일 분할 리팩토링
- Issue #31: 응답 추출 로직 BaseAdapter로 통합

## 참조

- `desktop/electron/browser/adapters/selector-config.ts` - 셀렉터 정의
- `desktop/electron/browser/adapters/base-adapter.ts` - Fallback 로직
- `desktop/electron/constants.ts` - 타임아웃 상수
