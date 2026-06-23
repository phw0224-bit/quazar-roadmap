---
name: quazar-workflow
description: Use when working in the Quazar roadmap workspace and the user asks for a natural-language work-management flow such as finding or creating a section/project, drafting a development item, appending a work-log comment, reviewing a member project, creating a linked GitHub issue or branch, or asking whether to check out the branch after the workflow completes.
---

# Quazar Workflow

Use this skill only for the Quazar roadmap workspace. Treat Quazar MCP as the atomic tool layer and use this skill to orchestrate multi-step work requests.

## Invocation

Use this skill explicitly as `$quazar-workflow` when the request contains multiple Quazar steps.

Examples:
- `$quazar-workflow DPP 섹션 하위의 박형우 프로젝트에 Pinata IPFS 작업 아이템 만들고 issue, branch까지 준비해줘`
- `$quazar-workflow 개발팀 보드에서 프로젝트를 찾고 없으면 확인 후 만들고 아이템까지 생성해줘`

Assume the `quazar` MCP server is already installed and configured. This skill does not replace the MCP server.

## Core Rule

Do not compress the whole request into one opaque MCP call.

Always do this:
1. Resolve context from the user's natural language.
2. Build a dry-run plan first.
3. If the flow mutates data, show the draft and ask for the user's opinion first.
4. Execute MCP steps only after the user approves or revises the draft.
5. For read-only review/report requests, skip mutation approval and return the structured summary.
6. Ask `해당 브랜치로 체크아웃하시겠습니까?` after branch creation if checkout guidance exists.

## Use This Flow

Use this skill when the request looks like:
- "DPP 쪽에 Pinata IPFS 작업 만들고 이슈/브랜치까지"
- "개발팀 보드에서 박형우 프로젝트 찾고 없으면 만들고 아이템 만들어줘"
- "이 작업을 Quazar 아이템으로 만들고 GitHub issue랑 branch도 연결해줘"
- "박형우 프로젝트에서 이번 주 한 작업 정리해줘"
- "item-123 댓글에 오늘 진행 내용 남겨줘"

Do not use this skill for:
- Single atomic MCP actions the user already specified precisely
- Generic Git work that does not involve Quazar hierarchy
- Non-Quazar workspaces

## Inputs To Extract

Extract these candidates from the user's request:
- `boardType`
- `sectionName`
- `projectName`
- work summary
- optional `repoFullName`

If the request does not say `boardType`, default to `개발팀` unless surrounding context clearly says otherwise.

## Required Repo Context

If behavior is unclear, inspect these workspace files before executing:
- `AGENTS.md`
- `mcp/quazar-mcp/README.md`
- `orchestrator/quazarWorkflowOrchestrator.js`

They define the current Quazar hierarchy, MCP contract, and dry-run execution model.

## Dry-Run First

Before mutating anything, produce a dry-run plan.

The dry-run should:
- resolve section candidates
- resolve project candidates
- choose between item creation, comment append, or read-only summary
- build an item draft using the `개발` template when a new item is the right target
- build a comment draft using the repo comment template when a comment append is the right target
- mark the draft as review-required before any mutating call
- identify whether GitHub issue creation and branch creation are intended
- identify whether `repoFullName` is explicit or should fall back to workspace git remote

If a section or project is ambiguous, do not guess. Present the candidates and ask the user to choose.

If a section is missing, do not auto-create it silently. State that the section was not found and ask whether to create it.

If a project is missing, do not invent one silently. Ask whether to create it under the resolved section.

Even when section and project resolution are complete, do not create or mutate immediately. Show the item/comment draft first and ask the user whether to proceed or what to change.

## MCP Tool Order

Use MCP as an atomic toolbox in this order:

1. `list_quazar_sections`
2. `create_quazar_section` only if the user confirms creation
3. `list_quazar_projects`
4. `create_quazar_project` only if needed and confirmed
5. `get_quazar_project_activity` when the request is review/report oriented
6. `create_quazar_item`
7. `create_quazar_item_comment`
8. `create_quazar_item_github_issue`
9. `create_quazar_item_github_branch`
10. `get_quazar_item_github_branch` if branch detail confirmation is needed

Prefer exact resolution before creation:
- section: exact normalized title match
- project: exact normalized title match

## Item Draft Rules

For development workflow requests:
- default tags: `["개발"]`
- build the description from the workspace development template
- include the user's original request text
- include a short `현재 미정/가정` section when requirements are incomplete

Typical incomplete cases:
- JSON schema not finalized
- file naming rule is fixed but payload format is temporary
- only CID response is required for v1

## Idempotency Rules

Treat these as successful reuse, not failure:
- existing linked GitHub issue
- existing linked GitHub branch

When MCP returns `ok: true` with `status: "ALREADY_EXISTS"`, continue the workflow using the existing resource.

Do not create duplicates when:
- the item already has a linked issue
- the item already has a linked branch

## Error Handling

Expect unified MCP/server errors:
- `SECTION_NOT_FOUND`
- `SECTION_AMBIGUOUS`
- `PROJECT_NOT_FOUND`
- `PROJECT_AMBIGUOUS`
- `ITEM_NOT_FOUND`
- `GITHUB_REPO_NOT_FOUND`
- `GITHUB_ISSUE_ALREADY_EXISTS`
- `GITHUB_BRANCH_ALREADY_EXISTS`

When `candidates` are present, show them to the user instead of retrying blindly.

## Checkout Boundary

MCP does not perform local checkout.

After branch creation:
- read `suggestedCheckoutCommand`
- ask `해당 브랜치로 체크아웃하시겠습니까?`
- only run git checkout commands if the user explicitly agrees

## Response Pattern

When handling a user request with this skill, keep the response sequence tight:

1. Dry-run summary
2. Item/comment draft review request when mutation is involved
3. Missing or ambiguous choices, if any
4. Execution result after approval, or read-only summary result
5. Final checkout question if branch info exists

Do not hide the plan. The user should always be able to see what will be created before mutation starts.
