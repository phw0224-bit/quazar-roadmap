# Quazar Workflow Prompt Examples

`quazar-workflow` 스킬을 명시 호출할 때 쓸 수 있는 예시 프롬프트 모음이다.

## 기본 규칙

- 복합 요청이면 `$quazar-workflow`로 시작한다.
- 섹션/프로젝트가 애매하면 dry-run에서 먼저 확인받는다.
- issue/branch가 필요 없으면 문장에 굳이 넣지 않는다.

## 예시 프롬프트

1. 섹션/프로젝트 확인 후 아이템만 만들기

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 Pinata IPFS 임시 업로드 구현 아이템만 만들어줘
```

2. 아이템 + GitHub issue + branch까지

```text
$quazar-workflow 개발팀 보드의 DPP 섹션 하위 박형우 프로젝트에 Pinata IPFS 임시 업로드 작업을 만들고 GitHub issue와 branch까지 준비해줘
```

3. repo를 명시해서 issue 생성

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 JSON 업로드 검증 작업을 만들고 repo는 phw0224-bit/quazar-roadmap으로 해서 issue와 branch까지 만들어줘
```

4. 섹션이 없으면 생성 여부부터 확인

```text
$quazar-workflow 개발팀 보드에서 DPP Backend 섹션을 찾고 없으면 확인 후 만들고 그 아래에 신규 업로드 프로젝트와 첫 아이템을 준비해줘
```

5. 프로젝트가 없으면 확인 후 생성

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우-실험 프로젝트를 찾고 없으면 확인 후 만들고 Pinata 연동 작업 아이템을 생성해줘
```

6. issue는 만들고 branch는 생략

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트에 CID 응답 포맷 정리 작업을 만들고 GitHub issue까지만 생성해줘
```

7. branch만 재확인

```text
$quazar-workflow item-123에 연결된 GitHub branch가 있으면 상태를 확인하고 checkout 가능한 명령까지 보여줘
```

8. 모호성 확인 중심 요청

```text
$quazar-workflow 개발팀 보드에서 DPP 섹션과 박형우 프로젝트가 정확히 하나씩 맞는지 먼저 dry-run으로 확인해줘
```

9. 임시 요구사항이 섞인 개발 템플릿 초안 생성

```text
$quazar-workflow 개발팀 보드의 DPP 섹션에서 박형우 프로젝트를 찾아 productname_type_time.json 네이밍 규칙으로 Pinata 업로드를 구현하는 작업 초안을 만들고, JSON 스키마는 아직 미정이라고 본문에 반영해줘
```

10. 브랜치 생성 후 checkout 질문까지

```text
$quazar-workflow 개발팀 보드의 DPP 섹션 하위 박형우 프로젝트에 Pinata 업로드 작업을 만들고 issue와 branch까지 진행한 뒤 체크아웃 여부도 물어봐줘
```

## 권장 응답 흐름

정상적인 동작이라면 응답은 대체로 이 순서를 따른다.

1. dry-run 계획
2. 모호성 또는 생성 필요 여부 확인
3. 실행 결과
4. `해당 브랜치로 체크아웃하시겠습니까?`
