# google-chat-bot/handlers/

> Google Chat 메시지를 처리하는 두 핸들러. action(쓰기)과 query(읽기)로 역할 분리.

## 주요 파일

| 파일 | 역할 |
|------|------|
| `action.js` | Ollama NLU로 명령 파싱 → Supabase 쓰기 (생성/수정/삭제). Ollama 실패 시 정규식 폴백 |
| `query.js` | Supabase 읽기 전용 조회. 팀원별/프로젝트별/전체 작업 목록 반환 |

## 패턴

두 핸들러 모두 `(event) => Promise<string>` 시그니처.
응답은 Google Chat 카드 형식이 아닌 plain text.

Ollama 프롬프트는 한국어 입력 → JSON 명령 추출 방식:

```javascript
// action.js 내부 프롬프트 패턴
"다음 메시지에서 작업 명령을 JSON으로 추출하세요: ..."
// → { action: 'update_status', itemId: '...', status: 'done' }
```
