# server/

> Express 5 백엔드. 파일 업로드와 AI 요약을 담당하며, 업로드 권한 확인을 위해 Supabase auth/admin 클라이언트를 사용한다.

## 책임
- multipart/form-data 파일 수신 및 디스크 저장
- 업로드/삭제 요청 인증 및 개인 메모 소유권 검증
- Ollama AI 요약 프록시 (HTML → Ollama → JSON)

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
| POST | `/api/summarize` | AI 요약. `{ content: htmlString }` |

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
