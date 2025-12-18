# Session State: 2025-12-12 21:50

## 현재 작업
- **Project**: Archive Converter Dashboard
- **Branch**: main
- **진행률**: 95%

## 완료된 항목
- [x] Pattern API 백엔드 구현 (`/api/pattern/*` 6개 엔드포인트)
- [x] UDM Viewer 상단 스크롤바 구현 (듀얼 스크롤바 동기화)
- [x] Pattern Analysis 페이지 구현 (`/pattern`)
- [x] NAS 실시간 연동 (1,374개 파일, 94.1% 매칭률)
- [x] 외부 네트워크 접속 설정 (0.0.0.0 바인딩)
- [x] API URL 동적 설정 (호스트 기반)
- [x] PokerGO 스크래퍼 개발 (206개 비디오 수집)
- [x] PokerGO 비디오 상세 스크래퍼 (`pokergo_detail_scraper.py`)
- [x] 206개 비디오 상세 메타데이터 수집 (제목, 설명, 시즌, 에피소드)
- [x] PokerGO 데이터 UDM 변환 (`pokergo_to_udm.py`)

## 미완료 항목
- [ ] Dashboard에서 PokerGO UDM 데이터 표시
- [ ] PokerGO/NAS 데이터 매칭 기능

## 핵심 컨텍스트

### 파일 구조
```
Archive_Converter/
├── dashboard/
│   ├── backend/app/routers/pattern.py  # Pattern API
│   └── frontend/src/
│       ├── pages/PatternAnalysis.tsx   # Pattern 페이지
│       └── api/
│           ├── client.ts               # 동적 API URL
│           └── pattern.ts              # Pattern API 클라이언트
├── scripts/
│   ├── pokergo_scraper.py              # 기본 스크래퍼
│   ├── pokergo_api_scraper.py          # API 스크래퍼
│   ├── pokergo_full_scraper.py         # 전체 스크래퍼
│   ├── pokergo_detail_scraper.py       # 상세 메타데이터 스크래퍼 (신규)
│   ├── merge_pokergo_batches.py        # 배치 파일 병합 (신규)
│   └── pokergo_to_udm.py               # UDM 변환기 (신규)
└── data/pokergo/
    ├── pokergo_full_20251212_190804.json       # 206개 비디오 URL
    ├── pokergo_merged_20251212_215037.json     # 병합된 상세 데이터
    └── pokergo_udm_20251212_215045.json        # UDM 형식 데이터
```

### 서버 정보
- **Frontend**: http://localhost:4000 / http://10.10.100.126:4000
- **Backend**: http://localhost:8000 / http://10.10.100.126:8000
- **NAS 경로**: Z:\ARCHIVE (1,374개 파일)

### 주요 결정
1. Pattern API를 NAS 서비스와 연동하여 실제 데이터 사용
2. API URL을 `window.location.hostname` 기반으로 동적 설정
3. PokerGO는 Playwright로 DOM 스크래핑 (API가 제한적)

## 커밋 내역
```
8b483c3 feat(frontend): Pattern Analysis 페이지 추가
6f12dab feat(dashboard): Pattern API 및 UDM 상단 스크롤바 구현
```

## 다음 단계
1. Dashboard에서 PokerGO UDM 데이터 표시
2. PokerGO/NAS 데이터 매칭 기능 구현
3. 매칭 결과를 기반으로 메타데이터 동기화

## 환경 변수
```
POKERGO_ID=ggp.group@ggproduction.net
POKERGO_PASSWORD=qwer1234!@
```

## 메모
- PokerGO 사이트는 React/Next.js 기반, API보다 DOM 스크래핑이 효과적
- 홈페이지에서 416개 링크 발견, 중복 제거 후 206개 고유 비디오
- 백엔드 서버는 background에서 실행 중 (task ID: be4eb6f, b432433)
