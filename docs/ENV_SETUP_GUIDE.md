# 환경 변수 설정 가이드

## 개요

이 문서는 프로젝트의 환경 변수를 안전하게 설정하는 방법을 안내합니다.

---

## 1. 로컬 개발 환경

### Step 1: 템플릿 복사

```powershell
# 프로젝트 루트에서 실행
copy .env.template .env.local
```

### Step 2: 값 입력

`.env.local` 파일을 열어 필요한 값을 입력합니다.

```
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# AI API (선택)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Step 3: Git 상태 확인

```powershell
git status
# .env.local이 표시되지 않으면 OK
```

---

## 2. API 키 발급 위치

| 서비스 | 발급 위치 |
|--------|----------|
| **Supabase** | Dashboard > Settings > API |
| **OpenAI** | https://platform.openai.com/api-keys |
| **Anthropic** | https://console.anthropic.com/settings/keys |
| **Google AI** | https://aistudio.google.com/apikey |
| **GitHub** | Settings > Developer settings > Personal access tokens |

---

## 3. 배포 환경 설정

### Vercel

```
1. Vercel Dashboard > Project 선택
2. Settings > Environment Variables
3. 환경변수 추가:
   - Name: NEXT_PUBLIC_SUPABASE_URL
   - Value: (실제 값)
   - Environment: Production, Preview, Development

4. 민감한 키는 "Sensitive" 체크
   - SUPABASE_SERVICE_ROLE_KEY (서버 전용)
```

### Netlify

```
1. Site settings > Environment variables
2. Add variable
3. Key/Value 입력
4. Scopes: All (또는 Production만)
```

### Vercel CLI

```bash
# Vercel CLI로 환경변수 추가
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# 환경변수 확인
vercel env ls
```

---

## 4. 환경별 파일 구조

```
프로젝트/
├── .env.template      ✅ Git 포함 (키만, 값 없음)
├── .env.local         ❌ Git 제외 (로컬 개발용)
├── .env.development   ❌ Git 제외 (개발 환경)
├── .env.production    ❌ Git 제외 (프로덕션 - 로컬 테스트용)
└── .gitignore         ✅ Git 포함 (위 파일들 제외 설정)
```

---

## 5. 보안 체크리스트

### 커밋 전 확인

- [ ] `.env.local`이 `git status`에 표시 안 됨
- [ ] `service_role` 키가 클라이언트 코드에 없음
- [ ] `NEXT_PUBLIC_` 접두사는 공개 가능한 키만 사용

### 코드 리뷰 시 확인

- [ ] 하드코딩된 API 키 없음
- [ ] 환경변수 참조 시 `process.env.` 사용
- [ ] 서버 전용 키는 API Route/Server Component에서만 사용

---

## 6. 키 유출 시 대응

### 즉시 조치

```
1. 해당 서비스 대시보드 접속
2. 기존 키 비활성화 또는 삭제
3. 새 키 발급
4. 환경변수 업데이트
5. 재배포
```

### 서비스별 키 재발급

| 서비스 | 재발급 위치 |
|--------|------------|
| Supabase | Settings > API > Generate new key |
| OpenAI | API keys > Create new secret key |
| GitHub | Personal access tokens > Regenerate |

---

## 7. 팀 공유 (선택)

### 1Password 사용 시

```bash
# 1Password CLI 설치 후
op inject -i .env.template -o .env.local
```

### 수동 공유 시

```
1. .env.local 내용을 암호화된 채널로 공유
   - Slack DM (주의: 검색 가능)
   - 1Password Secure Note (권장)
   - 암호화된 이메일

2. 절대 금지:
   - 일반 채팅
   - 이메일 본문
   - 공개 채널
```

---

## 8. 문제 해결

### 환경변수가 인식 안 될 때

```powershell
# 1. 파일명 확인
ls .env*

# 2. 파일 내용 확인 (값 노출 주의)
cat .env.local | Select-String "SUPABASE_URL"

# 3. 개발 서버 재시작
npm run dev
```

### Vercel 배포 시 환경변수 누락

```bash
# 로컬에서 Vercel 환경변수 확인
vercel env pull .env.local

# 환경변수 동기화 상태 확인
vercel env ls
```

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2025-12-16 | 초안 작성 |
