# server/

> Express 5 백엔드. 파일 업로드, 담당자 알림 기록, AI 요약을 담당하며, 인증 검증과 service-role 작업에 Supabase auth/admin 클라이언트를 사용한다.

## 책임
- multipart/form-data 파일 수신 및 디스크 저장
- 업로드/삭제 요청 인증 및 개인 메모 소유권 검증
- 담당자 추가 시 `notifications` 테이블 기록
- 개발팀 요청 제출 시 Google Chat incoming webhook 알림 전송
- Ollama AI 요약 프록시 (HTML → Ollama → JSON)
- 사내 MCP 호출용 프로젝트/아이템 조회 및 아이템 생성·수정 API

## 주요 파일

| 파일 | 역할 |
|------|------|
| `index.js` | Express 앱 진입점. 라우트 정의, multer 설정, Ollama 호출 로직 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| POST | `/upload/:itemId` | 인증 사용자만 파일 업로드. 개인 메모는 소유자만 가능 |
| DELETE | `/uploads/:itemId/:filename` | 인증 사용자만 단일 파일 삭제. 개인 메모는 소유자만 가능 |
| DELETE | `/uploads/:itemId` | 인증 사용자만 아이템의 모든 파일 삭제. 개인 메모는 소유자만 가능 |
| POST | `/api/notifications/assignments` | 인증 사용자가 추가한 담당자에게 assignment 알림 레코드 생성 |
| POST | `/api/notifications/dev-requests` | 개발팀 요청 제출 시 Google Chat incoming webhook 알림 전송 |
| POST | `/api/summarize` | AI 요약. `{ content: htmlString }` |
| GET | `/api/mcp/projects` | 사내 MCP 전용 프로젝트 목록 조회. `boardType`, 선택 `query`, 선택 `limit` |
| POST | `/api/mcp/projects` | 사내 MCP 전용 프로젝트 생성. `title`, 선택 `sectionId`, 선택 `tags` |
| GET | `/api/mcp/projects/:projectId` | 사내 MCP 전용 프로젝트 상세 조회. `boardType` 필요 |
| PATCH | `/api/mcp/projects/:projectId` | 사내 MCP 전용 프로젝트 수정. `title`, `tags`, `isCompleted`만 허용 |
| GET | `/api/mcp/items` | 사내 MCP 전용 아이템 검색. `boardType`, 선택 `query`, `projectName`, `status`, `tags`, `limit`, `includeCompletedProjects` |
| GET | `/api/mcp/items/:itemId` | 사내 MCP 전용 아이템 상세 조회. `boardType` 필요 |
| POST | `/api/mcp/items` | 사내 MCP 전용 아이템 생성. `MCP_SHARED_TOKEN` bearer 인증 필요 |
| PATCH | `/api/mcp/items/:itemId` | 사내 MCP 전용 안전한 아이템 수정. `status`, `priority`, `description`, `tags`만 허용 |

## 파일 업로드 제약

- 허용 MIME: `image/*`, `application/pdf`, Office 문서 형식
- 최대 크기: 10MB
- 저장 경로: `server/uploads/{itemId}/{sanitized-filename}`
- 한국어 파일명 지원 (sanitizeFilename에서 보존)

## AI 요약 흐름

```
POST /api/summarize { content: '<h1>제목</h1><p>내용</p>' }
  → extractTextBlocks(html) → ['[1] 제목', '[2] 내용']
  → Ollama POST /api/chat (qwen2.5:14b, timeout 60s)
  → { summary: string[], blocks: string[], generatedAt: ISO }
```

Ollama 미실행 시 503 반환 (정상). 프론트가 에러 메시지 표시.

## 실행

```bash
# 포트 3001
yarn server          # 단독 실행
yarn dev:all         # 프론트와 함께 실행 (권장)
```

업로드 권한 확인을 위해 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 필요하다.

Google Chat 알림을 쓰려면 `GOOGLE_CHAT_DEV_REQUEST_WEBHOOK_URL`을 추가로 설정한다. 이 값이 없으면 개발팀 요청 제출은 기록하지만 Chat 전송만 비활성화된다.

MCP 아이템 워크플로우를 쓰려면 `MCP_SHARED_TOKEN`을 서버와 MCP 프로세스 양쪽에 동일하게 설정해야 한다.

## MCP 에러 코드

- `UNAUTHORIZED`: bearer token 불일치
- `INVALID_INPUT`: 필수 필드 누락 또는 허용되지 않은 형식
- `PROJECT_NOT_FOUND`: 생성/검색 범위에 해당 프로젝트가 없음
- `PROJECT_AMBIGUOUS`: 정규화한 프로젝트명이 여러 개와 충돌
- `ITEM_NOT_FOUND`: 요청한 아이템이 없음
