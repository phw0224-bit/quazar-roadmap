# Quazar Roadmap

> 사내 로드맵/작업 관리 툴 (Notion 기능 + 팀 맞춤 커스텀)

배포: **[roadmap.ai-quazar.uk](https://roadmap.ai-quazar.uk)**

---

## 프로젝트 개요

**목적**
5개 팀(감정/개발/AI/기획/지원)의 협업 로드맵 관리 시스템

**주요 특징**
- **팀별 독립 보드**: 단일 DB, 팀별 뷰 분리
- **이중 아이템**: 칸반 카드 + 문서 페이지 (Notion 스타일)
- **다중 뷰**: 칸반, 타임라인(간트), 팀원 뷰
- **GitHub 연동**: 레포 대시보드, 티켓 prefix, 아이템 → GitHub 이슈 생성
- **로컬 AI**: Ollama(qwen2.5:14b) 요약 + 챗봇
- **Self-host Supabase**: Docker 기반 Supabase 운영/복원 스크립트 포함
- **한국어 우선**: 전체 UI 한국어
- **비로그인 접근**: 공개 읽기 허용

---

## 빠른 시작

### 1. 설치
```bash
yarn install
```

### 2. 환경변수 (.env)

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
APP_BASE_URL=http://localhost:5173
```

**옵션 (Google Chat Bot, google-chat-bot/.env):**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b
GOOGLE_CHAT_DEV_REQUEST_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/...
```

### 3. 실행

```bash
# 프론트(5173) + Express(3001) 동시 실행
yarn dev:all

# 또는 개별 실행
yarn dev          # React 프론트엔드만
yarn server       # Express 서버만
```

---

## 기본 사용법

### 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `yarn dev:all` | 프론트 + 백엔드 동시 실행 |
| `yarn build` | 프로덕션 빌드 |
| `yarn dev` | React 개발 서버 (5173) |
| `yarn server` | Express 서버 (3001) |
| `yarn supabase:selfhost:setup` | self-host Supabase `.env` 생성 |
| `yarn supabase:selfhost:up` | Docker Supabase 스택 기동 |
| `yarn supabase:selfhost:down` | Docker Supabase 스택 종료 |
| `yarn supabase:export` | Cloud Supabase DB 덤프 생성 |
| `yarn supabase:restore` | self-host Postgres로 덤프 복원 |

### 파일 업로드
- 경로: `server/uploads/{itemId}/`
- 정적 서빙: `public/uploads/{itemId}/`

### AI 요약
- Ollama 실행 중이면 자동 활성화
- 없으면 503 반환 (정상)

---

## 기술 스택

- **Frontend**: React 19 + Vite 8 + Tailwind v4
- **Editor**: CodeMirror 6 Markdown live preview
- **DB**: Self-host Supabase (PostgreSQL + Realtime)
- **DnD**: @dnd-kit 6.3
- **Backend**: Express 5
- **AI**: Ollama (qwen2.5:14b)

---

## 아키텍처

```
Browser (React :5173)
  └── KanbanBoard (칸반/타임라인/팀원 뷰)
       ├── useKanbanData → kanbanAPI (Supabase)
       └── Editor (CodeMirror Markdown live preview)

Express (:3001)
  ├── POST /upload/:itemId (multer)
  └── POST /api/summarize (Ollama 프록시)

Supabase self-host (Docker)
  ├── Kong/API (:8000)
  ├── Studio (:3000)
  └── Postgres (:5432, 외부 공개 금지)

Google Chat Bot (:3002)
  └── 웹훅 → Ollama NLU → Supabase
```

**상세:** [AGENTS.md](./AGENTS.md) 참고

---

## 상세 문서

- **[AGENTS.md](./AGENTS.md)** — 프로젝트 전체 맵 (아키텍처, 데이터 모델, 비즈니스 규칙, 플로우)
- **[docs/LOCAL_SUPABASE_MIGRATION.md](./docs/LOCAL_SUPABASE_MIGRATION.md)** — Cloud Supabase → Docker self-host 이전/복원/배포 절차
- **[docs/GITHUB_APP_SETUP_2026-04-15.md](./docs/GITHUB_APP_SETUP_2026-04-15.md)** — GitHub OAuth/App 설정 절차
- **[docs/GITHUB_REPO_TICKETS_2026-04-21.sql](./docs/GITHUB_REPO_TICKETS_2026-04-21.sql)** — 레포별 티켓 prefix/번호 발급 SQL

---

## 배포

**로컬 Supabase 이전:**
[docs/LOCAL_SUPABASE_MIGRATION.md](./docs/LOCAL_SUPABASE_MIGRATION.md)에 Cloud Supabase 덤프, Docker 로컬 Supabase 시작, 데이터 복원 절차를 정리

**운영 원칙:**
- Postgres `5432`/pooler는 외부에 공개하지 않는다.
- 외부 접근이 필요한 경우 Cloudflare Tunnel 등으로 Supabase API(Kong `8000`)와 앱/API 서버만 HTTPS 도메인에 연결한다.
- GitHub OAuth/App callback을 쓰려면 Express API도 외부 HTTPS callback URL이 필요하다.

**Google Chat Bot:**
ngrok 또는 Cloudflare Tunnel로 외부 노출 필요

---

## License

Internal Use Only
