# Quazar Roadmap Frontend Map

> `server/` 폴더 구현을 제외하고, `src/` 기준으로 빠르게 구조를 파악하기 위한 문서 (2026-04-15)

---

## 1. Scope

이 문서는 아래 범위만 다룬다.

- React/Vite 애플리케이션 (`src/*`)
- Supabase 클라이언트 사용 패턴
- UI 상태/컴포넌트/훅/클라이언트 API 구조

이 문서는 아래 범위를 의도적으로 제외한다.

- `server/` 내부 구현 (Express 라우트, OAuth 처리, 웹훅 처리)
- 별도 봇/백엔드 런타임 운영 절차

---

## 2. Frontend Architecture

```txt
main.jsx
  -> App (auth gate + release notes)
    -> AppLayout (Sidebar + main area)
      -> KanbanBoard (view orchestration)
        -> BoardSection -> ProjectColumn -> KanbanCard
        -> TimelineView / PeopleBoard / PersonalMemoBoard
        -> ItemDetailPanel -> ItemDescriptionSection -> editor/*

hooks/*
  -> useKanbanData/useAuth/useUrlState/useFilterState/usePresence...

api/*
  -> kanbanAPI/fileAPI/summarizeAPI/githubAPI

lib/*
  -> constants/releaseNotes/supabase/entityModel/tagCatalog
```

핵심 오케스트레이터는 `KanbanBoard`이며, 데이터 진실 소스는 `useKanbanData`다.

---

## 3. Folder Map

### `src/components`
- 화면 계층과 상호작용의 중심.
- 보드/타임라인/피플/사이드바/상세패널/모달을 담당.
- 세부 규칙은 [src/components/README.md](../src/components/README.md) 참고.

### `src/hooks`
- 상태 관리, URL 상태, 필터/정렬, realtime/presence 구독, layout 상태 담당.
- 세부 규칙은 [src/hooks/README.md](../src/hooks/README.md) 참고.

### `src/api`
- Supabase CRUD와 외부 호출(파일/요약/GitHub)을 캡슐화.
- UI는 직접 쿼리 세부사항을 알지 않고 API 함수로만 접근.
- 세부 규칙은 [src/api/README.md](../src/api/README.md) 참고.

### `src/lib`
- 팀/상태/우선순위 상수, 릴리즈 노트, Supabase 클라이언트, 엔티티 공용 모델.
- 세부 규칙은 [src/lib/README.md](../src/lib/README.md) 참고.

---

## 4. Core Runtime Flows

### 4.1 Data loading
- `useKanbanData`가 sections/projects/items/comments를 읽어 상태 트리를 구성.
- `board_type` 기준으로 전사/팀 보드를 분기 렌더링.

### 4.2 Update strategy
- 이동/정렬: 낙관적 업데이트(먼저 dispatch, 이후 API 반영)
- 일반 수정: API 응답을 받은 뒤 dispatch
- 담당자 저장: UI는 이름을 보여주되 API 계층에서 `assignees`와 `assignee_user_ids`를 함께 동기화

### 4.3 View state in URL
- `useUrlState`가 `view/item/filter/sort/group/fullscreen`을 URL과 동기화.
- 링크 공유 시 동일한 화면 상태 재현 가능.

### 4.4 Realtime + Presence
- Realtime: 데이터 변경을 구독해 화면을 동기화.
- Presence: 같은 아이템 열람/편집 사용자 정보를 아바타로 표시.

---

## 5. Frontend Business Semantics

- `page_type`
  - `null`/`task`: 보드 카드
  - `page`: 사이드바 문서 노드
- `board_type`
  - `main`: 전사 로드맵
  - 그 외 팀명: 팀 보드
- `isReadOnly`
  - 비로그인 상태에서 편집 UI를 숨김(비활성화보다 렌더 제거 우선)

---

## 6. Key Entry Files

- `src/main.jsx`: 앱 부트스트랩
- `src/App.jsx`: 인증/릴리즈 노트/전역 피드백 초기화
- `src/components/KanbanBoard.jsx`: 뷰 오케스트레이션과 전역 상호작용
- `src/hooks/useKanbanData.js`: 보드 상태/CRUD/realtime 중심 훅
- `src/api/kanbanAPI.js`: 핵심 데이터 접근 계층
- `src/lib/constants.js`: 팀/상태/우선순위/태그 상수

---

## 7. Conventions

- 공용 모듈(`src/lib/*`, `src/api/*`)은 named export 우선
- 배럴(`index.js`) 재-export 금지, 실제 파일 경로 import
- DnD 충돌 방지를 위한 `stopProp` 패턴 유지
- 다크모드 클래스는 `dark:` prefix 강제
- 배열 필드는 `[]` 기본값 유지 (`null` 지양)
- 담당자/알림 스키마는 표시 이름과 식별자 분리 원칙을 따른다 (`assignees`, `assignee_user_ids`, `notifications`)

---

## 8. Frontend-Only Dev Notes

- 로컬 실행(프론트만): `yarn dev`
- 필수 환경변수:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- 빌드: `yarn build`

`fileAPI`, `summarizeAPI`, `githubAPI`는 서버 엔드포인트를 호출하지만, 해당 서버 구현 설명은 이 문서의 범위 밖이다.
