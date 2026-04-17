# GitHub App 하이브리드 전환 가이드 (2026-04-15)

이 프로젝트는 아래 방식으로 동작합니다.

- OAuth App: 사용자 계정 연결 및 이슈 생성 주체(작성자) 유지
- GitHub App: 설치 기반 레포 범위 제어 + App Webhook 기반 동기화

## 1. 서버 환경변수

다음 값을 `.env` 또는 `.env.local`에 추가합니다.

```env
# 기존 OAuth App 설정
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=https://roadmap.ai-quazar.uk/api/github/connect/callback

# 신규 GitHub App 설정
GITHUB_APP_SLUG=quazar-roadmap
GITHUB_APP_ID=1234567
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
# 또는 파일 경로 사용
# GITHUB_APP_PRIVATE_KEY_PATH=.secrets/quazar-roadmap.pem
GITHUB_APP_INSTALL_REDIRECT_URI=https://roadmap.ai-quazar.uk/api/github/app/install/callback

# App Webhook secret (기존 webhook 검증과 동일 키로 사용)
GITHUB_WEBHOOK_SECRET=...
```

## 2. GitHub App 설정

GitHub App 페이지에서 아래를 설정합니다.

1. `App URL`: 서비스 URL
2. `Setup URL`: `https://roadmap.ai-quazar.uk/api/github/app/install/callback`
3. `Webhook URL`: `https://roadmap.ai-quazar.uk/api/github/webhooks`
4. `Webhook secret`: `GITHUB_WEBHOOK_SECRET`와 동일
5. Repository permissions:
   - `Issues`: Read and write
   - `Metadata`: Read-only
6. Subscribe to events:
   - `Issues`

## 3. 사용자 플로우

1. 프로필에서 `GitHub 연결` (OAuth)
2. 같은 화면에서 `GitHub App 설치`
3. Item 상세에서 레포 선택 후 이슈 생성

주의: GitHub App이 설치되지 않은 레포는 목록에서 제외되며 이슈 생성도 차단됩니다.

## 4. 현재 코드 동작

- OAuth로 생성한 이슈는 GitHub에서 생성자가 사용자로 기록됩니다.
- GitHub App 설치 여부와 설치된 repo 목록은 `App ID + private key`로 조회합니다.
- GitHub App Webhook으로 `issues.closed/reopened` 이벤트를 받아 로드맵 상태를 동기화합니다.
- DB 스키마 추가 변경은 이번 단계에서 필요하지 않습니다.
