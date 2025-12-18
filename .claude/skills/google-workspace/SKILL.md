---
name: google-workspace
description: >
  Google Workspace 통합 스킬. Docs, Sheets, Drive, Gmail, Calendar API 연동.
  OAuth 2.0 인증, 서비스 계정 설정, 데이터 읽기/쓰기 자동화 지원.
version: 2.1.0

triggers:
  keywords:
    - "google workspace"
    - "google docs"
    - "google sheets"
    - "google drive"
    - "gmail api"
    - "google calendar"
    - "스프레드시트"
    - "구글 문서"
    - "구글 드라이브"
  file_patterns:
    - "**/credentials.json"
    - "**/token.json"
    - "**/google*.py"
    - "**/sheets*.py"
    - "**/drive*.py"
  context:
    - "Google API 연동"
    - "스프레드시트 데이터 처리"
    - "문서 자동화"
    - "이메일 발송 자동화"

capabilities:
  - setup_google_api
  - oauth_authentication
  - sheets_read_write
  - drive_file_management
  - gmail_send_receive
  - calendar_integration
  - service_account_setup

model_preference: sonnet

auto_trigger: true
---

# Google Workspace Integration Skill

Google Workspace API 통합을 위한 전문 스킬입니다.

## Quick Start

```bash
# Python 클라이언트 라이브러리 설치
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib

# 또는 uv 사용
uv add google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

## API 설정 흐름

```
┌─────────────────────────────────────────────────────────────┐
│  Google Cloud Console 설정 흐름                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 프로젝트 생성                                            │
│     └── console.cloud.google.com                            │
│                                                              │
│  2. API 활성화                                               │
│     ├── Google Sheets API                                   │
│     ├── Google Drive API                                    │
│     ├── Gmail API                                           │
│     └── Google Calendar API                                 │
│                                                              │
│  3. 인증 정보 생성                                           │
│     ├── OAuth 2.0 클라이언트 ID (사용자 인증용)              │
│     └── 서비스 계정 (서버 간 통신용)                        │
│                                                              │
│  4. credentials.json 다운로드                                │
│     └── 프로젝트 루트에 저장                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 환경 변수 설정

### 이 프로젝트의 인증 파일 위치 (중요!)

```
D:\AI\claude01\json\
├── desktop_credentials.json   # OAuth 2.0 클라이언트 (업로드용) ⭐
├── token.json                 # OAuth 토큰 (자동 생성)
└── service_account_key.json   # 서비스 계정 (읽기 전용)
```

**서브 레포에서 작업 시 반드시 절대 경로 사용!**

### 인증 방식 선택 가이드

| 작업 | 인증 방식 | 파일 |
|------|----------|------|
| **파일 업로드** | OAuth 2.0 | `desktop_credentials.json` |
| **파일 읽기** | 서비스 계정 또는 OAuth | 둘 다 가능 |
| **스프레드시트 쓰기** | OAuth 2.0 | `desktop_credentials.json` |
| **자동화 (읽기만)** | 서비스 계정 | `service_account_key.json` |

⚠️ **주의**: 서비스 계정은 저장 용량 할당량이 없어 **Drive 업로드 불가**!

### 필수 환경 변수

```bash
# OAuth 2.0 (업로드 필요시 - 권장)
GOOGLE_OAUTH_CREDENTIALS=D:\AI\claude01\json\desktop_credentials.json
GOOGLE_OAUTH_TOKEN=D:\AI\claude01\json\token.json

# 서비스 계정 (읽기 전용 자동화)
GOOGLE_SERVICE_ACCOUNT_FILE=D:\AI\claude01\json\service_account_key.json
GOOGLE_APPLICATION_CREDENTIALS=D:\AI\claude01\json\service_account_key.json
```

### 파일 구조

```
D:\AI\claude01\
├── json/
│   ├── desktop_credentials.json   # OAuth 클라이언트 ID (업로드용)
│   ├── token.json                 # OAuth 토큰 (자동 생성)
│   └── service_account_key.json   # 서비스 계정 (읽기 전용)
├── wsoptv/                        # 서브 레포
├── db_architecture/               # 서브 레포
└── ...
```

### 공유된 Google Drive 리소스

| 리소스 | 폴더/문서 ID | URL | 용도 |
|--------|-------------|-----|------|
| Google AI Studio | `1JwdlUe_v4Ug-yQ0veXTldFl6C24GH8hW` | [폴더](https://drive.google.com/drive/folders/1JwdlUe_v4Ug-yQ0veXTldFl6C24GH8hW) | 공유 문서/자료 저장소 |
| WSOPTV 와이어프레임 | `1kHuCfqD7PPkybWXRL3pqeNISTPT7LUTB` | [폴더](https://drive.google.com/drive/folders/1kHuCfqD7PPkybWXRL3pqeNISTPT7LUTB) | 홈페이지 와이어프레임 PNG |
| WSOPTV UX 기획서 | `1tghlhpQiWttpB-0CP5c1DiL5BJa4ttWj-2R77xaoVI8` | [문서](https://docs.google.com/document/d/1tghlhpQiWttpB-0CP5c1DiL5BJa4ttWj-2R77xaoVI8/edit) | 사용자 경험 설계 문서 |

**서비스 계정 이메일**: `archive-sync@ggp-academy.iam.gserviceaccount.com`

⚠️ **중요**: 서비스 계정은 스토리지 할당량이 없어 **파일 업로드 불가**!
- 읽기/폴더 생성: 가능
- 파일 업로드: **OAuth 2.0 필요**

## 인증 방식

### 1. OAuth 2.0 (사용자 대신 작업)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  앱     │────▶│ Google  │────▶│  사용자 │────▶│ 토큰    │
│         │     │ 로그인  │     │  동의   │     │ 발급    │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

**용도**: 사용자의 개인 데이터 접근 (내 드라이브, 내 이메일), **파일 업로드**

```python
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import os

SCOPES = ['https://www.googleapis.com/auth/drive']  # 전체 Drive 접근

# 절대 경로 사용 (서브 레포에서도 동작)
CREDENTIALS_FILE = r'D:\AI\claude01\json\desktop_credentials.json'
TOKEN_FILE = r'D:\AI\claude01\json\token.json'

def get_credentials():
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    return creds
```

### 2. 서비스 계정 (서버 간 통신)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  서버   │────▶│ Google  │────▶│ API     │
│         │     │ 인증    │     │ 호출    │
└─────────┘     └─────────┘     └─────────┘
```

**용도**: 자동화 작업, 공유된 리소스 **읽기**

⚠️ **제한 사항**: 서비스 계정은 저장 용량이 없어 **Drive 업로드 불가!**

```python
from google.oauth2 import service_account

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# 절대 경로 사용 (서브 레포에서도 동작)
SERVICE_ACCOUNT_FILE = r'D:\AI\claude01\json\service_account_key.json'

def get_service_credentials():
    return service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=SCOPES
    )
```

## Google Sheets 연동

### 스프레드시트 읽기

```python
from googleapiclient.discovery import build

def read_sheet(spreadsheet_id: str, range_name: str):
    """스프레드시트 데이터 읽기"""
    creds = get_credentials()
    service = build('sheets', 'v4', credentials=creds)

    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()

    return result.get('values', [])

# 사용 예시
# spreadsheet_id: URL에서 /d/ 뒤의 값
# https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit
data = read_sheet('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'Sheet1!A:E')
```

### 스프레드시트 쓰기

```python
def write_sheet(spreadsheet_id: str, range_name: str, values: list):
    """스프레드시트에 데이터 쓰기"""
    creds = get_credentials()
    service = build('sheets', 'v4', credentials=creds)

    body = {'values': values}

    result = service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption='USER_ENTERED',
        body=body
    ).execute()

    return result.get('updatedCells')

# 사용 예시
write_sheet(
    spreadsheet_id='your-spreadsheet-id',
    range_name='Sheet1!A1:C3',
    values=[
        ['이름', '나이', '도시'],
        ['홍길동', 30, '서울'],
        ['김철수', 25, '부산']
    ]
)
```

### 스프레드시트 추가 (Append)

```python
def append_sheet(spreadsheet_id: str, range_name: str, values: list):
    """스프레드시트 끝에 데이터 추가"""
    creds = get_credentials()
    service = build('sheets', 'v4', credentials=creds)

    body = {'values': values}

    result = service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption='USER_ENTERED',
        insertDataOption='INSERT_ROWS',
        body=body
    ).execute()

    return result.get('updates').get('updatedRows')
```

## Google Drive 연동

### 파일 목록 조회

```python
def list_files(folder_id: str = None, mime_type: str = None):
    """드라이브 파일 목록 조회"""
    creds = get_credentials()
    service = build('drive', 'v3', credentials=creds)

    query_parts = []
    if folder_id:
        query_parts.append(f"'{folder_id}' in parents")
    if mime_type:
        query_parts.append(f"mimeType='{mime_type}'")
    query_parts.append("trashed=false")

    query = " and ".join(query_parts)

    results = service.files().list(
        q=query,
        pageSize=100,
        fields="files(id, name, mimeType, modifiedTime)"
    ).execute()

    return results.get('files', [])

# 특정 폴더의 스프레드시트만 조회
sheets = list_files(
    folder_id='folder-id',
    mime_type='application/vnd.google-apps.spreadsheet'
)
```

### 파일 업로드

```python
from googleapiclient.http import MediaFileUpload

def upload_file(file_path: str, folder_id: str = None, mime_type: str = None):
    """파일 업로드"""
    creds = get_credentials()
    service = build('drive', 'v3', credentials=creds)

    file_metadata = {'name': os.path.basename(file_path)}
    if folder_id:
        file_metadata['parents'] = [folder_id]

    media = MediaFileUpload(file_path, mimetype=mime_type)

    file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, name, webViewLink'
    ).execute()

    return file

# 사용 예시
result = upload_file('report.pdf', folder_id='target-folder-id')
print(f"업로드 완료: {result['webViewLink']}")
```

### 파일 다운로드

```python
from googleapiclient.http import MediaIoBaseDownload
import io

def download_file(file_id: str, output_path: str):
    """파일 다운로드"""
    creds = get_credentials()
    service = build('drive', 'v3', credentials=creds)

    request = service.files().get_media(fileId=file_id)

    with io.FileIO(output_path, 'wb') as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            print(f"다운로드 진행: {int(status.progress() * 100)}%")
```

## Gmail 연동

### 이메일 발송

```python
import base64
from email.mime.text import MIMEText

def send_email(to: str, subject: str, body: str):
    """이메일 발송"""
    creds = get_credentials()  # SCOPES에 gmail.send 포함 필요
    service = build('gmail', 'v1', credentials=creds)

    message = MIMEText(body)
    message['to'] = to
    message['subject'] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    result = service.users().messages().send(
        userId='me',
        body={'raw': raw}
    ).execute()

    return result

# 사용 예시
send_email(
    to='recipient@example.com',
    subject='자동화 알림',
    body='처리가 완료되었습니다.'
)
```

### 이메일 조회

```python
def list_emails(query: str = '', max_results: int = 10):
    """이메일 목록 조회"""
    creds = get_credentials()
    service = build('gmail', 'v1', credentials=creds)

    results = service.users().messages().list(
        userId='me',
        q=query,
        maxResults=max_results
    ).execute()

    messages = results.get('messages', [])

    emails = []
    for msg in messages:
        detail = service.users().messages().get(
            userId='me',
            id=msg['id'],
            format='metadata',
            metadataHeaders=['From', 'Subject', 'Date']
        ).execute()
        emails.append(detail)

    return emails

# 최근 안 읽은 메일 조회
unread = list_emails(query='is:unread', max_results=5)
```

## Google Calendar 연동

### 일정 조회

```python
from datetime import datetime, timedelta

def list_events(calendar_id: str = 'primary', days: int = 7):
    """일정 목록 조회"""
    creds = get_credentials()
    service = build('calendar', 'v3', credentials=creds)

    now = datetime.utcnow().isoformat() + 'Z'
    end = (datetime.utcnow() + timedelta(days=days)).isoformat() + 'Z'

    events_result = service.events().list(
        calendarId=calendar_id,
        timeMin=now,
        timeMax=end,
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    return events_result.get('items', [])
```

### 일정 생성

```python
def create_event(summary: str, start: datetime, end: datetime,
                 description: str = None, calendar_id: str = 'primary'):
    """일정 생성"""
    creds = get_credentials()
    service = build('calendar', 'v3', credentials=creds)

    event = {
        'summary': summary,
        'start': {'dateTime': start.isoformat(), 'timeZone': 'Asia/Seoul'},
        'end': {'dateTime': end.isoformat(), 'timeZone': 'Asia/Seoul'},
    }

    if description:
        event['description'] = description

    result = service.events().insert(
        calendarId=calendar_id,
        body=event
    ).execute()

    return result

# 사용 예시
from datetime import datetime, timedelta

start = datetime(2025, 1, 15, 14, 0)
end = start + timedelta(hours=1)
create_event('팀 미팅', start, end, description='주간 진행 상황 공유')
```

## 권한 범위 (Scopes)

| 서비스 | Scope | 권한 |
|--------|-------|------|
| Sheets | `spreadsheets.readonly` | 읽기 전용 |
| Sheets | `spreadsheets` | 읽기/쓰기 |
| Drive | `drive.readonly` | 읽기 전용 |
| Drive | `drive.file` | 앱이 생성한 파일만 |
| Drive | `drive` | 전체 접근 |
| Gmail | `gmail.readonly` | 읽기 전용 |
| Gmail | `gmail.send` | 발송만 |
| Gmail | `gmail.modify` | 읽기/쓰기 |
| Calendar | `calendar.readonly` | 읽기 전용 |
| Calendar | `calendar` | 읽기/쓰기 |

**권장**: 필요한 최소 권한만 요청

## 체크리스트

### API 설정

- [ ] Google Cloud Console 프로젝트 생성
- [ ] 필요한 API 활성화 (Sheets, Drive, Gmail, Calendar)
- [ ] OAuth 동의 화면 설정
- [ ] 인증 정보 생성 (OAuth 또는 서비스 계정)
- [ ] credentials.json 다운로드 및 저장

### 코드 설정

- [ ] 클라이언트 라이브러리 설치
- [ ] credentials.json 경로 설정
- [ ] 필요한 Scopes 정의
- [ ] 인증 함수 구현

### 보안

- [ ] credentials.json `.gitignore`에 추가
- [ ] token.json `.gitignore`에 추가
- [ ] 서비스 계정 키 안전하게 보관
- [ ] 최소 권한 원칙 적용

## Anti-Patterns

| 금지 | 이유 | 대안 |
|------|------|------|
| credentials.json 커밋 | 보안 키 노출 | .gitignore 추가 |
| 과도한 권한 요청 | 불필요한 접근 | 최소 Scope만 사용 |
| 토큰 하드코딩 | 유출 위험 | 환경 변수 또는 파일 |
| API 호출 무한 루프 | 할당량 초과 | 에러 핸들링 추가 |
| 동기 호출 남용 | 성능 저하 | 배치 처리 활용 |

## 할당량 관리

```
┌─────────────────────────────────────────────────────────────┐
│  API 할당량 (기본값)                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Sheets API                                                  │
│  ├── 읽기: 300 요청/분/프로젝트                              │
│  └── 쓰기: 300 요청/분/프로젝트                              │
│                                                              │
│  Drive API                                                   │
│  └── 10,000 요청/100초/사용자                                │
│                                                              │
│  Gmail API                                                   │
│  └── 250 요청/초/사용자                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**할당량 초과 방지**:
1. 배치 요청 사용
2. 지수 백오프 재시도
3. 캐싱 적용

## 연동

| 스킬/에이전트 | 연동 시점 |
|---------------|----------|
| `data-specialist` | 데이터 분석 및 ETL |
| `backend-dev` | API 서버 통합 |
| `python-dev` | Python 자동화 |
| `ai-engineer` | AI 워크플로우 연동 |

## 트러블슈팅

### 인증 오류

```python
# 토큰 삭제 후 재인증
import os
if os.path.exists('credentials/token.json'):
    os.remove('credentials/token.json')
# 다시 get_credentials() 호출
```

### 권한 오류 (403)

```
1. Google Cloud Console에서 API 활성화 확인
2. OAuth 동의 화면에서 Scope 추가
3. 서비스 계정의 경우 파일/폴더 공유 확인
```

### 업로드 실패 - storageQuotaExceeded

**증상**: `Service Accounts do not have storage quota`

**원인**: 서비스 계정은 저장 용량 할당량이 없음

**해결**: OAuth 2.0 인증으로 전환

```python
# 서비스 계정 대신 OAuth 사용
CREDENTIALS_FILE = r'D:\AI\claude01\json\desktop_credentials.json'
TOKEN_FILE = r'D:\AI\claude01\json\token.json'
```

### 할당량 초과 (429)

```python
import time
from googleapiclient.errors import HttpError

def api_call_with_retry(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            return func()
        except HttpError as e:
            if e.resp.status == 429:
                wait_time = 2 ** attempt
                time.sleep(wait_time)
            else:
                raise
    raise Exception("Max retries exceeded")
```

---

## 참조 문서

- [Google Sheets API](https://developers.google.com/sheets/api)
- [Google Drive API](https://developers.google.com/drive/api)
- [Gmail API](https://developers.google.com/gmail/api)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [Python Quickstart](https://developers.google.com/sheets/api/quickstart/python)
