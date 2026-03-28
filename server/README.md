# server/

> Express 5 백엔드. 파일 업로드와 AI 요약 두 가지 기능만 담당. Supabase 직접 접근은 하지 않음 (AI 요약은 프론트가 결과를 받아 Supabase에 저장).

## 책임
- multipart/form-data 파일 수신 및 디스크 저장
- Ollama AI 요약 프록시 (HTML → Ollama → JSON)

## 주요 파일

| 파일 | 역할 |
|------|------|
| `index.js` | Express 앱 진입점. 라우트 정의, multer 설정, Ollama 호출 로직 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| POST | `/upload/:itemId` | 파일 업로드. `multipart/form-data`, `file` 필드 |
| DELETE | `/uploads/:itemId/:filename` | 단일 파일 삭제 |
| DELETE | `/uploads/:itemId` | 아이템의 모든 파일 삭제 |
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

환경변수 불필요 (Supabase 직접 접근 없음).
