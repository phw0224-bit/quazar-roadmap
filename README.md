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
- **로컬 AI**: Ollama(qwen2.5:14b) 요약 + 챗봇
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
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
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

### 파일 업로드
- 경로: `server/uploads/{itemId}/`
- 정적 서빙: `public/uploads/{itemId}/`

### AI 요약
- Ollama 실행 중이면 자동 활성화
- 없으면 503 반환 (정상)

---

## 기술 스택

- **Frontend**: React 19 + Vite 8 + Tailwind v4
- **Editor**: Tiptap v3 (ProseMirror)
- **DB**: Supabase (PostgreSQL + Realtime)
- **DnD**: @dnd-kit 6.3
- **Backend**: Express 5
- **AI**: Ollama (qwen2.5:14b)

---

## 아키텍처

```
Browser (React :5173)
  └── KanbanBoard (칸반/타임라인/팀원 뷰)
       ├── useKanbanData → kanbanAPI (Supabase)
       └── Editor (Tiptap)

Express (:3001)
  ├── POST /upload/:itemId (multer)
  └── POST /api/summarize (Ollama 프록시)

Google Chat Bot (:3002)
  └── 웹훅 → Ollama NLU → Supabase
```

**상세:** [CLAUDE.md](./CLAUDE.md) 참고

---

## 상세 문서

- **[docs/FRONTEND_PROJECT_MAP.md](./docs/FRONTEND_PROJECT_MAP.md)** — `server/` 제외 프론트엔드 프로젝트 맵
- **[CLAUDE.md](./CLAUDE.md)** — 프로젝트 전체 맵 (아키텍처, 데이터 모델, 비즈니스 규칙, 플로우)
- **[docs/DATA_MODEL.md](./docs/DATA_MODEL.md)** — DB 스키마 상세
- **[docs/BUSINESS_RULES.md](./docs/BUSINESS_RULES.md)** — 비즈니스 로직
- **[docs/FLOWS.md](./docs/FLOWS.md)** — 핵심 플로우 코드 예제
- **[docs/ROADMAP.md](./docs/ROADMAP.md)** — 미구현 기능
- **[docs/DOCUMENTATION_GUIDE.md](./docs/DOCUMENTATION_GUIDE.md)** — 문서 작성 규칙

---

## 배포

**Supabase 마이그레이션:**
Supabase 대시보드 SQL Editor에서 직접 실행

**로컬 Supabase 이전:**
[docs/LOCAL_SUPABASE_MIGRATION.md](./docs/LOCAL_SUPABASE_MIGRATION.md)에 Cloud Supabase 덤프, Docker 로컬 Supabase 시작, 데이터 복원 절차를 정리

**Google Chat Bot:**
ngrok 또는 Cloudflare Tunnel로 외부 노출 필요

---

## License

Internal Use Only
