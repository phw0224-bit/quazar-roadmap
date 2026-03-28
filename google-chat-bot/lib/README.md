# google-chat-bot/lib/

> 외부 서비스(Ollama, Supabase) 클라이언트 초기화.

## 주요 파일

| 파일 | 역할 |
|------|------|
| `ollama.js` | Ollama health check + `chat(messages)` 함수. 타임아웃 30s. OLLAMA_URL 환경변수 |
| `supabase.js` | Supabase 클라이언트. `SUPABASE_SERVICE_KEY` 사용 — RLS 우회 (봇은 모든 데이터 접근 가능) |

## 주의

`supabase.js`는 `SUPABASE_SERVICE_KEY`를 사용하므로 RLS를 우회함.
프론트엔드의 `src/lib/supabase.js`(`SUPABASE_PUBLISHABLE_DEFAULT_KEY`)와 다름.
봇 서버 외부에 절대 노출하지 말 것.
