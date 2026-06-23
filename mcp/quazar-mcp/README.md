# quazar-mcp/

> Quazar 프로젝트/아이템 조회와 안전한 아이템 수정을 제공하는 stdio MCP 서버.

## 책임
- MCP 툴 `create_quazar_item` 노출
- MCP 툴 `list_quazar_sections` 노출
- MCP 툴 `resolve_quazar_section` 노출
- MCP 툴 `create_quazar_section` 노출
- MCP 툴 `create_quazar_project` 노출
- MCP 툴 `list_quazar_projects` 노출
- MCP 툴 `resolve_quazar_project` 노출
- MCP 툴 `search_quazar_items` 노출
- MCP 툴 `get_quazar_project` 노출
- MCP 툴 `get_quazar_project_activity` 노출
- MCP 툴 `get_quazar_item` 노출
- MCP 툴 `list_quazar_item_comments` 노출
- MCP 툴 `create_quazar_item_comment` 노출
- MCP 툴 `update_quazar_item_comment` 노출
- MCP 툴 `delete_quazar_item_comment` 노출
- MCP 툴 `update_quazar_project` 노출
- MCP 툴 `update_quazar_item` 노출
- MCP 툴 `create_quazar_item_github_issue` 노출
- MCP 툴 `create_quazar_item_github_branch` 노출
- MCP 툴 `get_quazar_item_github_branch` 노출
- Quazar 내부 API `POST /api/mcp/projects` 호출
- Quazar 내부 API `GET /api/mcp/sections` 호출
- Quazar 내부 API `GET /api/mcp/sections/resolve` 호출
- Quazar 내부 API `POST /api/mcp/sections` 호출
- Quazar 내부 API `POST /api/mcp/items` 호출
- Quazar 내부 API `GET /api/mcp/projects` 호출
- Quazar 내부 API `GET /api/mcp/projects/resolve` 호출
- Quazar 내부 API `GET /api/mcp/projects/:projectId` 호출
- Quazar 내부 API `GET /api/mcp/projects/:projectId/activity` 호출
- Quazar 내부 API `GET /api/mcp/items` 호출
- Quazar 내부 API `GET /api/mcp/items/:itemId` 호출
- Quazar 내부 API `GET /api/mcp/items/:itemId/comments` 호출
- Quazar 내부 API `POST /api/mcp/items/:itemId/comments` 호출
- Quazar 내부 API `PATCH /api/mcp/items/:itemId/comments/:commentId` 호출
- Quazar 내부 API `DELETE /api/mcp/items/:itemId/comments/:commentId` 호출
- Quazar 내부 API `PATCH /api/mcp/projects/:projectId` 호출
- Quazar 내부 API `PATCH /api/mcp/items/:itemId` 호출
- 결과를 MCP `content` + `structuredContent`로 반환
- GitHub 브랜치 응답에 `suggestedCheckoutCommand`를 포함해 로컬 체크아웃 단계를 안내

## 설치

사내 전용이라 외부 배포 대신 로컬 경로나 사설 Git 저장소 기준으로 설치한다.

```bash
npm install -g C:\Users\uguls\Documents\quazar-roadmap\mcp\quazar-mcp
```

또는 다른 머신에서는 이 패키지 폴더를 복사하거나 사설 Git URL을 사용하면 된다.

## 실행

```bash
MCP_SHARED_TOKEN=shared-secret QUAZAR_API_BASE_URL=http://localhost:3001 quazar-mcp
```

직접 패키지 폴더 안에서 실행할 때는 아래도 가능하다.

```bash
MCP_SHARED_TOKEN=shared-secret QUAZAR_API_BASE_URL=http://localhost:3001 npm start
```

## 필수 환경변수

- `MCP_SHARED_TOKEN`: Quazar Express 서버와 공유하는 bearer token
- `QUAZAR_API_BASE_URL`: Quazar API 기본 URL 예: `http://localhost:3001`

## Claude/Codex 등록 예시

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

## 스킬과의 관계

- `quazar`는 MCP 서버 이름이다.
- `quazar-workflow`는 자연어 워크플로우를 조합하는 스킬 이름이다.
- 복합 요청은 `$quazar-workflow`로 시작하는 편이 가장 안전하다.
- 원자 작업은 MCP 툴 이름 기준으로 직접 호출해도 된다.

예:
- `$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 Pinata IPFS 임시 업로드 작업을 만들고 GitHub issue와 branch까지 준비해줘`
- `개발팀 보드에서 DPP 섹션 목록 보여줘`

## 사용 예시

- 프로젝트명 먼저 찾기:
  - `개발팀 보드에서 온보딩이 들어간 프로젝트 목록 보여줘`
- 섹션 먼저 찾기:
  - `개발팀 보드에서 DPP가 들어간 섹션 목록 보여줘`
- 섹션 exact resolve:
  - `개발팀 보드에서 DPP 섹션이 정확히 하나인지 resolve 해줘`
- 섹션 만들기:
  - `개발팀 보드에 제목 "DPP" 섹션 만들어줘`
- 프로젝트 만들기:
  - `개발팀 보드에 제목 "신규 온보딩 프로젝트" 프로젝트 만들어줘`
  - `개발팀 보드의 DPP 섹션에 제목 "신규 온보딩 프로젝트" 프로젝트 만들어줘`
- 프로젝트 exact resolve:
  - `개발팀 보드에서 박형우 프로젝트를 정확히 resolve 해줘`
- 프로젝트 상세 확인:
  - `AI팀의 project-123 프로젝트 정보 보여줘`
- 프로젝트 활동 확인:
  - `개발팀의 project-123 프로젝트에 현재 어떤 아이템들이 있는지 활동 기준으로 보여줘`
- 프로젝트 수정:
  - `지원팀의 project-77 제목을 "CS 운영 개선"으로 바꾸고 완료 상태를 true로 바꿔줘`
- 아이템 검색:
  - `개발팀 보드에서 온보딩 프로젝트의 todo 아이템 찾아줘`
- 아이템 상세 확인:
  - `AI팀의 item-123 상세 정보 보여줘`
- 아이템 만들기:
  - `개발팀의 "온보딩 개선" 프로젝트에 제목 "MCP 테스트", description "로컬 연결 확인", 태그 test,mcp 로 아이템 만들어줘`
- 아이템 수정:
  - `지원팀의 item-77 상태를 done으로 바꾸고 tags를 ops,faq로 덮어써줘`
- 댓글 목록:
  - `개발팀의 item-123 댓글 목록 보여줘`
- 댓글 만들기:
  - `개발팀의 item-123에 "이건 MCP에서 남긴 댓글입니다" 댓글 추가해줘`
- 댓글 수정:
  - `개발팀의 item-123에서 comment-456 댓글 내용을 최신 내용으로 바꿔줘`
- 댓글 삭제:
  - `개발팀의 item-123에서 comment-456 댓글 삭제해줘`
- 프로젝트 요약용 조회:
  - `박형우 프로젝트의 작업 이력을 티켓 포함해서 보여줘`
- 아이템 GitHub 이슈 생성:
  - `item-123으로 GitHub 이슈 만들어줘. repo는 비우고 현재 프로젝트 git remote 기준으로 해줘`
- 아이템 GitHub 브랜치 생성:
  - `item-123으로 linked branch 만들어줘`
- 아이템 GitHub 브랜치 조회:
  - `item-123 브랜치 정보랑 suggestedCheckoutCommand 보여줘`

## GitHub 연동 규칙

- `create_quazar_item_github_issue`의 `repoFullName`은 선택 입력이다.
- `repoFullName`을 생략하면 MCP 서버가 현재 실행 중인 워크스페이스의 `origin` remote를 읽어 GitHub `owner/repo` 형식으로 추천한다.
- 원격 이슈/브랜치 생성은 MCP가 처리하지만, 로컬 git checkout은 수행하지 않는다.
- 대신 브랜치 생성/조회 응답에 `suggestedCheckoutCommand`가 들어가며, 현재 프로젝트 폴더에서 그 명령으로 이어서 작업하면 된다.
- 같은 `itemId`에 이미 연결된 이슈나 브랜치가 있으면 실패 대신 `ok: true`, `status: "ALREADY_EXISTS"`로 기존 연결 정보를 반환한다.

## 응답 계약

- 성공 응답은 공통으로 `ok: true`와 `status`를 포함한다.
- 실패 응답은 공통으로 `ok: false`, `code`, `message`를 포함한다.
- 섹션/프로젝트 이름 해석 충돌은 `SECTION_NOT_FOUND`, `SECTION_AMBIGUOUS`, `PROJECT_NOT_FOUND`, `PROJECT_AMBIGUOUS` 같은 코드를 사용한다.
- 아이템 상세/검색 응답의 실제 업무 상태는 공통 envelope `status`와 구분하기 위해 `itemStatus` 필드로 내려간다.
- 조회 전용 resolve 툴은 실패를 던지지 않고 `status: FOUND | NOT_FOUND | AMBIGUOUS`로 결과를 반환한다.

## 로컬 API 테스트

프로젝트 검색:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/projects?boardType=개발팀&query=온보딩&limit=10" `
  -Headers $headers
```

섹션 검색:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/sections?boardType=개발팀&query=DPP&limit=10" `
  -Headers $headers
```

섹션 resolve:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/sections/resolve?boardType=개발팀&sectionName=DPP" `
  -Headers $headers
```

섹션 생성:

```powershell
$headers = @{
  Authorization = "Bearer test-shared-secret"
  "Content-Type" = "application/json"
}

$body = @{
  boardType = "개발팀"
  title = "DPP"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/mcp/sections" `
  -Headers $headers `
  -Body $body
```

프로젝트 생성:

```powershell
$headers = @{
  Authorization = "Bearer test-shared-secret"
  "Content-Type" = "application/json"
}

$body = @{
  boardType = "개발팀"
  title = "신규 온보딩 프로젝트"
  sectionName = "DPP"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/mcp/projects" `
  -Headers $headers `
  -Body $body
```

프로젝트 resolve:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/projects/resolve?boardType=개발팀&projectName=박형우" `
  -Headers $headers
```

프로젝트 상세:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/projects/project-a?boardType=개발팀" `
  -Headers $headers
```

프로젝트 수정:

```powershell
$headers = @{
  Authorization = "Bearer test-shared-secret"
  "Content-Type" = "application/json"
}

$body = @{
  boardType = "개발팀"
  title = "신규 온보딩 프로젝트 v2"
  isCompleted = $true
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:3001/api/mcp/projects/project-a" `
  -Headers $headers `
  -Body $body
```

아이템 검색:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/items?boardType=개발팀&query=온보딩&projectName=온보딩%20개선&status=todo&tags=docs,ux&limit=10" `
  -Headers $headers
```

아이템 상세:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/items/item-1?boardType=개발팀" `
  -Headers $headers
```

아이템 수정:

```powershell
$headers = @{
  Authorization = "Bearer test-shared-secret"
  "Content-Type" = "application/json"
}

$body = @{
  boardType = "개발팀"
  status = "done"
  description = "최신 설명"
  tags = @("docs", "ux")
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:3001/api/mcp/items/item-1" `
  -Headers $headers `
  -Body $body
```

아이템 GitHub 이슈 생성:

```powershell
$headers = @{
  Authorization = "Bearer test-shared-secret"
  "Content-Type" = "application/json"
}

$body = @{
  itemId = "item-1"
  repoFullName = "phw0224-bit/quazar-roadmap"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/github/issues" `
  -Headers $headers `
  -Body $body
```

아이템 GitHub 브랜치 생성:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/github/items/item-1/branch" `
  -Headers $headers
```

아이템 GitHub 브랜치 조회:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/github/items/item-1/branch" `
  -Headers $headers
```
