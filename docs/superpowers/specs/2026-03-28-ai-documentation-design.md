# AI-Friendly Documentation Design
**Date:** 2026-03-28
**Status:** Approved

---

## Context

Quazar Roadmap은 Phase 5까지 구현이 완료된 성숙한 프로젝트다. 현재 CLAUDE.md는 "앞으로 할 일" 위주의 로드맵 문서라 AI 세션이 새로 시작될 때 프로젝트의 *현재 상태*를 빠르게 파악하기 어렵다. 목표는 MCP/Claude 세션이 최소한의 탐색으로 최대한 많은 컨텍스트를 얻을 수 있도록 3-레이어 문서 시스템을 구축하는 것이다.

---

## Goals

1. **CLAUDE.md 재작성** — 현재 상태 지도(Map)로. Phase 1~5 구현 계획 삭제, 아키텍처/도메인/규칙 중심으로 재편성
2. **폴더별 README.md** — 13개 폴더에 각 폴더의 "왜/무엇을/어떻게" 설명
3. **JSDoc 추가 (Phase 2)** — 모든 컴포넌트 + hooks + api 파일에 AI 최적화 스타일 주석

---

## Phase 1: 문서 레이어

### 1A. CLAUDE.md 재작성

기존 CLAUDE.md를 완전히 대체. 구조:

```
## 1. Domain Context        왜 존재하는가, 사용자/도메인 특수성
## 2. Architecture Overview 텍스트 다이어그램 (레이어, 데이터 흐름)
## 3. Tech Stack            스택 + 선택 이유 한 줄
## 4. Data Model            실제 DB 스키마 + 필드 의미 설명
## 5. Business Rules        board_type, page_type, status, order_index 동작 규칙
## 6. Key Flows             상태관리, Realtime, DnD, 파일업로드, AI요약 흐름
## 7. Component Map         각 컴포넌트 역할 + props 핵심만 (파일 경로 포함)
## 8. Conventions           stopProp, isReadOnly, onShowToast, optimistic update 패턴
## 9. Dev Guide             실행법, 환경변수, Supabase 마이그레이션
## 10. Roadmap              Phase 6~7만 (미구현분)
```

**분량 목표:** ~350줄, 현재보다 밀도 높게

### 1B. 폴더별 README.md (13개)

대상 폴더:
- `src/api/`
- `src/components/`
- `src/components/editor/`
- `src/components/editor/extensions/`
- `src/components/Auth/`
- `src/components/UI/`
- `src/hooks/`
- `src/lib/`
- `server/`
- `google-chat-bot/`
- `google-chat-bot/handlers/`
- `google-chat-bot/lib/`

**각 README.md 템플릿:**
```markdown
# {폴더명}

> 한 줄 요약: 이 폴더가 왜 존재하는가

## 책임
- 담당하는 것

## 주요 파일
| 파일 | 역할 | 주요 의존성 |
|------|------|------------|

## 패턴 & 규칙
- 이 폴더 코드를 읽기 전에 알아야 할 것
```

---

## Phase 2: 코드 주석 레이어

### JSDoc 형식 (AI 최적화)

```javascript
/**
 * @description [왜 이 함수가 필요한가] — 비즈니스 맥락과 핵심 주의사항
 * @param {Object} updates - { status, assignees, tags } 업데이트할 필드만 포함
 * @returns {Promise<void>} optimistic dispatch 후 API 호출 — 실패해도 UI 반영됨
 */
```

- `@description`: "왜" 중심 — 타입이 아닌 비즈니스 맥락
- `@param`: 데이터 구조 설명 (가능한 값, 형태)
- `@returns`: 반환값의 의미, 사이드이펙트 포함

### 대상 파일

**hooks/ (6개):**
- useKanbanData.js — reducer actions, realtime 구독, optimistic update 패턴
- useAuth.js — auth lifecycle, profile setup flow
- useUrlState.js — URL 파라미터 매핑
- usePeopleData.js
- usePageTree.js — 재귀 트리 빌더
- useFilterState.js — 필터/정렬 적용 로직

**api/ (3개):**
- kanbanAPI.js — 모든 exported 함수 (getBoardData, moveItem 등)
- fileAPI.js
- summarizeAPI.js

**components/ (주요 컴포넌트):**
- KanbanBoard.jsx — handleDragEnd, view switching
- ItemDetailPanel.jsx — AI citation, breadcrumb nav
- KanbanCard.jsx, BoardSection.jsx, ProjectColumn.jsx
- editor/Editor.jsx
- editor/extensions/ 4개 (Callout, Toggle, PageLink, SlashCommand)

---

## Verification

Phase 1 완료 후:
- 새 Claude 세션에서 CLAUDE.md만 읽고 전체 아키텍처를 이해할 수 있는지 확인
- 각 폴더 README.md가 해당 폴더 진입 전 필요한 컨텍스트를 제공하는지 확인

Phase 2 완료 후:
- JSDoc이 코드 로직을 이해하는 데 도움이 되는지 확인 (타입 주석이 아닌 "왜" 설명 확인)
