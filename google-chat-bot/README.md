# Roadmap 구글챗 봇

구글챗 스페이스에서 자연어로 Roadmap 보드를 조회하고 조작하는 봇입니다.

## 집에서 할 것 (코드 작업)

1. `.env.example` → `.env` 복사 후 값 채우기
2. `npm install`

## 회사에서 할 것 (환경 설정 + 배포)

### 1. Mac Mini M4 - Ollama 외부 접근 설정

```bash
# Mac Mini에서 실행 (외부 IP에서 접근 가능하게)
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# 또는 launchd로 영구 설정 (재부팅 후에도 유지)
# ~/.ollama/config 파일에 OLLAMA_HOST=0.0.0.0 추가
```

### 2. 봇 서버 실행

```bash
cd google-chat-bot
npm install
cp .env.example .env
# .env 파일에 값 채우기

npm start
```

### 3. 외부 URL 생성 (ngrok - 테스트용)

```bash
brew install ngrok
ngrok http 3002
# → https://xxxx.ngrok.io 생성됨
```

### 4. Google Cloud Console 설정

1. https://console.cloud.google.com 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. **API 및 서비스 → 라이브러리 → Google Chat API → 사용 설정**
4. **Google Chat API → 구성**
   - 앱 이름: `Roadmap Bot`
   - 연결 설정: `HTTP 엔드포인트`
   - URL: `https://xxxx.ngrok.io/webhook`
   - 기능: 스페이스 및 DM 모두 체크
5. **저장**

### 5. 구글챗 스페이스에 봇 추가

1. 구글챗 스페이스 → 사용자 및 앱 추가
2. `Roadmap Bot` 검색 후 추가
3. `@Roadmap Bot 도움말` 입력해서 테스트

## 운영 배포 (ngrok 대신)

```bash
# Cloudflare Tunnel 사용 (무료, 안정적)
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create roadmap-bot
cloudflared tunnel route dns roadmap-bot bot.your-domain.com
cloudflared tunnel run roadmap-bot
```

## 사용 예시

```
@Roadmap봇 도움말
@Roadmap봇 이번주 작업 알려줘
@Roadmap봇 진행 중인 이슈 보여줘
@Roadmap봇 홍길동 작업 뭐야?
@Roadmap봇 로그인 찾아줘
@Roadmap봇 JWT 이슈 완료로 바꿔줘
@Roadmap봇 이슈 만들어줘: 로그인 페이지 버튼 스타일 수정
```

## 환경변수

| 변수 | 설명 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role 키 (anon key 아님!) |
| `OLLAMA_URL` | Mac Mini Ollama 주소 (예: http://192.168.1.10:11434) |
| `OLLAMA_MODEL` | 사용할 모델 (기본: qwen2.5:14b) |
| `PORT` | 봇 서버 포트 (기본: 3002) |

---

## Architecture (AI Reference)

> 이 섹션은 AI/MCP 세션을 위한 코드 구조 요약.

```
google-chat-bot/
├── index.js           Express 서버 (port 3002). /webhook 수신 → handleAction → handleQuery
├── handlers/
│   ├── action.js      NLU 기반 작업 실행 (이슈 생성, 상태 변경). Ollama 우선, 실패 시 기본 명령어 파싱
│   └── query.js       작업 조회 (팀원별, 프로젝트별). Supabase 직접 쿼리
└── lib/
    ├── ollama.js      Ollama health check + chat API 호출
    └── supabase.js    Supabase 클라이언트 (SUPABASE_SERVICE_KEY 사용 — RLS 우회)
```

**이벤트 흐름:**

```
Google Chat → POST /webhook
  → ADDED_TO_SPACE: 환영 메시지
  → MESSAGE: handleAction(event) → handleQuery(event) → 텍스트 응답
```

**자연어 명령 예시:**
- `홍길동 작업 뭐야?` → handleQuery: 해당 팀원 assigned items 조회
- `JWT 이슈 완료로 바꿔줘` → handleAction: status='done' 업데이트
- `새 작업 추가해줘: 로그인 페이지 수정` → handleAction: items 테이블 INSERT
