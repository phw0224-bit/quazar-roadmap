# Quazar Agent Setup

Quazar MCP와 `quazar-workflow` 스킬을 개발자 개인 환경에 붙이는 최소 설치 가이드다.

대상:
- Windows
- macOS
- Ubuntu/Linux

준비물:
- Node.js 18 이상
- npm
- Quazar MCP 패키지 접근 경로
- `quazar-workflow` 스킬 파일
- `MCP_SHARED_TOKEN`
- `QUAZAR_API_BASE_URL`

## 1. 무엇을 설치하나

개인 환경에는 두 가지만 넣으면 된다.

1. `quazar` MCP 서버
2. `quazar-workflow` 스킬

역할 구분:
- `quazar`: MCP 서버 이름
- `quazar-workflow`: 스킬 이름
- `$quazar-workflow`: 스킬 명시 호출 방식
- `resolve_quazar_section`, `create_quazar_item`: MCP 툴 이름

## 2. MCP 설치

설치 경로는 팀에서 정한 배포 방식에 맞춘다.

예시 1. 로컬 저장소 경로 설치

```bash
npm install -g /path/to/quazar-roadmap/mcp/quazar-mcp
```

예시 2. GitHub repo 직접 설치

```bash
npm install -g git+ssh://git@github.com/your-org/quazar-mcp.git
```

설치 확인:

```bash
quazar-mcp --help
```

## 3. MCP 설정

Codex/Claude의 MCP 설정에 아래 항목을 추가한다.

```json
{
  "mcpServers": {
    "quazar": {
      "command": "quazar-mcp",
      "args": [],
      "env": {
        "MCP_SHARED_TOKEN": "여기에_토큰",
        "QUAZAR_API_BASE_URL": "여기에_API_URL"
      }
    }
  }
}
```

필수 환경값:
- `MCP_SHARED_TOKEN`
- `QUAZAR_API_BASE_URL`

## 4. 스킬 설치

배포받은 `quazar-workflow` 폴더를 개인 스킬 디렉터리에 복사한다.

최소 필요 파일:
- `SKILL.md`
- `agents/openai.yaml`

### Windows

대상 경로:

```text
C:\Users\<username>\.agents\skills\quazar-workflow
```

### macOS

대상 경로:

```text
/Users/<username>/.agents/skills/quazar-workflow
```

### Ubuntu / Linux

대상 경로:

```text
/home/<username>/.agents/skills/quazar-workflow
```

복사 후 최종 구조:

```text
~/.agents/skills/quazar-workflow/
  SKILL.md
  agents/
    openai.yaml
```

## 5. 사용법

### 복합 자연어 요청

복합 요청은 `$quazar-workflow`로 시작하는 편이 가장 안전하다.

예:

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 Pinata IPFS 임시 업로드 작업을 만들고 GitHub issue와 branch까지 준비해줘
```

### 원자 작업

간단한 조회/수정은 스킬 없이 바로 요청해도 된다.

예:

```text
개발팀 보드에서 DPP 섹션을 resolve 해줘
```

```text
개발팀 보드에서 박형우 프로젝트를 resolve 해줘
```

## 6. 대표 프롬프트 예시

1. 아이템만 만들기

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 Pinata IPFS 임시 업로드 구현 아이템만 만들어줘
```

2. 아이템 + GitHub issue + branch

```text
$quazar-workflow 개발팀 보드의 DPP 섹션 하위 박형우 프로젝트에 Pinata IPFS 임시 업로드 작업을 만들고 GitHub issue와 branch까지 준비해줘
```

3. repo를 명시해서 issue/branch 생성

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 JSON 업로드 검증 작업을 만들고 repo는 phw0224-bit/quazar-roadmap으로 해서 issue와 branch까지 만들어줘
```

4. 섹션이 없으면 생성 여부 확인

```text
$quazar-workflow 개발팀 보드에서 DPP Backend 섹션을 찾고 없으면 확인 후 만들고 그 아래에 신규 업로드 프로젝트와 첫 아이템을 준비해줘
```

5. 프로젝트가 없으면 확인 후 생성

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우-실험 프로젝트를 찾고 없으면 확인 후 만들고 Pinata 연동 작업 아이템을 생성해줘
```

6. issue까지만 만들기

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트에 CID 응답 포맷 정리 작업을 만들고 GitHub issue까지만 생성해줘
```

7. branch 상태 재확인

```text
$quazar-workflow item-123에 연결된 GitHub branch가 있으면 상태를 확인하고 checkout 가능한 명령까지 보여줘
```

8. dry-run으로 모호성 확인

```text
$quazar-workflow 개발팀 보드에서 DPP 섹션과 박형우 프로젝트가 정확히 하나씩 맞는지 먼저 dry-run으로 확인해줘
```

## 7. 기대 동작

정상 동작이면 응답은 대체로 이 순서를 따른다.

1. dry-run 계획
2. 모호성 또는 생성 필요 여부 확인
3. 실행 결과
4. `해당 브랜치로 체크아웃하시겠습니까?`

## 8. 문제 확인 체크리스트

- `quazar-mcp` 명령이 실행되는지 확인
- MCP 설정에 `quazar` 서버가 들어갔는지 확인
- `MCP_SHARED_TOKEN`, `QUAZAR_API_BASE_URL` 값이 맞는지 확인
- `~/.agents/skills/quazar-workflow` 경로에 `SKILL.md`가 있는지 확인
- 복합 요청은 `$quazar-workflow`로 시작했는지 확인
