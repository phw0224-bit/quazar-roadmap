# mcp/

> Codex/Claude 같은 에이전트가 Quazar 내부 기능을 안전하게 호출하기 위한 MCP 서버 모음.

## 책임
- 에이전트용 MCP 툴 정의
- Quazar 내부 API 호출 래핑
- 사내 전용 토큰 기반 인증 사용

## 주요 폴더

| 경로 | 역할 |
|------|------|
| `quazar-mcp/` | Quazar 프로젝트/아이템 조회와 안전한 아이템 수정용 stdio MCP 서버 |

## 운영 원칙

- DB 쓰기는 MCP 서버에서 직접 하지 않고 Quazar Express API에 위임한다.
- MCP 툴 입력은 자연어가 아닌 구조화 필드를 기준으로 유지한다.
- 공용 토큰(`MCP_SHARED_TOKEN`)과 API 기본 URL(`QUAZAR_API_BASE_URL`)은 서버 환경변수로 주입한다.
- 현재 제공 툴은 `list_quazar_sections`, `resolve_quazar_section`, `create_quazar_section`, `list_quazar_projects`, `resolve_quazar_project`, `create_quazar_project`, `get_quazar_project`, `update_quazar_project`, `create_quazar_item`, `search_quazar_items`, `get_quazar_item`, `update_quazar_item`과 GitHub 연동 툴이다.

## 설치 형태

- `mcp/quazar-mcp`는 독립 `package.json`을 가진 로컬 설치형 패키지다.
- 사내 환경에서는 `npm install <path-to-mcp/quazar-mcp>` 또는 사설 Git URL 설치를 기준으로 사용한다.

## 직원 배포 가이드

직원용 최종 설치 문서는 [docs/quazar-agent-setup.md](/C:/Users/uguls/Documents/quazar-roadmap/docs/quazar-agent-setup.md)를 기준으로 배포한다.

직원 PC에는 두 가지가 모두 들어가야 한다.

1. `quazar` MCP 서버
2. `quazar-workflow` 스킬

### 1. MCP 설치

사내 저장소가 로컬에 체크아웃되어 있다고 가정하면:

```bash
npm install -g C:\Users\uguls\Documents\quazar-roadmap\mcp\quazar-mcp
```

그 다음 Codex/Claude의 MCP 설정에 아래처럼 등록한다.

```json
{
  "mcpServers": {
    "quazar": {
      "command": "quazar-mcp",
      "args": [],
      "env": {
        "MCP_SHARED_TOKEN": "shared-secret",
        "QUAZAR_API_BASE_URL": "http://internal-quazar-server:3001"
      }
    }
  }
}
```

### 2. 스킬 설치

아래 폴더를 각자 개인 스킬 디렉터리에 복사한다.

- 원본: `skills/quazar-workflow`
- 대상: `~/.agents/skills/quazar-workflow`

최소 필요 파일:
- `SKILL.md`
- `agents/openai.yaml`

### 3. 호출 이름 구분

- `quazar-workflow`: 스킬 이름
- `$quazar-workflow`: 스킬 명시 호출 방식
- `quazar`: MCP 서버 이름
- `create_quazar_item`, `resolve_quazar_section`: MCP 툴 이름

즉, 복합 자연어 요청은 보통 `$quazar-workflow`로 시작하는 편이 가장 안전하다.

예:

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 Pinata IPFS 임시 업로드 작업을 만들고 GitHub issue와 branch까지 준비해줘
```

원자 작업은 스킬 없이도 된다.

예:

```text
개발팀 보드에서 DPP 섹션을 resolve 해줘
```
