# quazar-mcp/

> Quazar 프로젝트/아이템 조회와 안전한 아이템 수정을 제공하는 stdio MCP 서버.

## 책임
- MCP 툴 `create_quazar_item` 노출
- MCP 툴 `create_quazar_project` 노출
- MCP 툴 `list_quazar_projects` 노출
- MCP 툴 `search_quazar_items` 노출
- MCP 툴 `get_quazar_project` 노출
- MCP 툴 `get_quazar_item` 노출
- MCP 툴 `update_quazar_project` 노출
- MCP 툴 `update_quazar_item` 노출
- MCP 툴 `create_quazar_item_github_issue` 노출
- MCP 툴 `create_quazar_item_github_branch` 노출
- MCP 툴 `get_quazar_item_github_branch` 노출
- Quazar 내부 API `POST /api/mcp/projects` 호출
- Quazar 내부 API `POST /api/mcp/items` 호출
- Quazar 내부 API `GET /api/mcp/projects` 호출
- Quazar 내부 API `GET /api/mcp/projects/:projectId` 호출
- Quazar 내부 API `GET /api/mcp/items` 호출
- Quazar 내부 API `GET /api/mcp/items/:itemId` 호출
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

## 사용 예시

- 프로젝트명 먼저 찾기:
  - `개발팀 보드에서 온보딩이 들어간 프로젝트 목록 보여줘`
- 프로젝트 만들기:
  - `개발팀 보드에 제목 "신규 온보딩 프로젝트" 프로젝트 만들어줘`
- 프로젝트 상세 확인:
  - `AI팀의 project-123 프로젝트 정보 보여줘`
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

## 로컬 API 테스트

프로젝트 검색:

```powershell
$headers = @{ Authorization = "Bearer test-shared-secret" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3001/api/mcp/projects?boardType=개발팀&query=온보딩&limit=10" `
  -Headers $headers
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
  sectionId = "section-a"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/mcp/projects" `
  -Headers $headers `
  -Body $body
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
  -Headers $headers
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
