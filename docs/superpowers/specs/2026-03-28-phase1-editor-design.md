# Phase 1 — 에디터 완성 설계 스펙

**날짜:** 2026-03-28
**범위:** TiptapEditor 리팩토링 + 슬래시 커맨드 + Callout/Toggle 블록 + 체크리스트 + 코드 하이라이트 + 블록 드래그 핸들

---

## 1. 목표

현재 단일 파일(`TiptapEditor.jsx`)로 된 에디터를 바이브코딩에 최적화된 폴더 구조로 분리하고, 노션 스타일의 슬래시 커맨드와 커스텀 블록을 추가한다.

---

## 2. 파일 구조

```
src/components/
  TiptapEditor.jsx         ← 삭제 (editor/Editor.jsx로 이전)
  editor/
    Editor.jsx             ← 메인 에디터 (확장 조립 + toolbar)
    SlashCommandMenu.jsx   ← 슬래시 팝업 UI 전담
    extensions/
      SlashCommand.js      ← /커맨드 로직 + 블록 목록 정의
      Callout.js           ← Callout 커스텀 Node
      Toggle.js            ← Toggle 커스텀 Node
      ResizableImage.js    ← 기존 ResizableImage 코드 이동
```

`ItemDetailPanel.jsx`는 import 경로만 변경하고 로직은 무변경.

---

## 3. 설치 패키지

```bash
yarn add @tiptap/suggestion \
         @tiptap/extension-code-block-lowlight \
         lowlight \
         @tiptap/extension-task-list \
         @tiptap/extension-task-item
```

> **참고:** `@tiptap/extension-drag-handle`은 Tiptap Pro 전용. 블록 드래그 핸들은 커스텀 CSS + `NodeViewWrapper`의 `data-drag-handle` 속성으로 구현 (추가 패키지 불필요).

---

## 4. 슬래시 커맨드

### 구현 방식
`@tiptap/suggestion` 기반. `SlashCommand.js`가 suggestion 확장을 정의하고 `SlashCommandMenu.jsx`를 팝업으로 렌더링한다.

### 동작 흐름
1. 빈 줄 또는 텍스트 중간에서 `/` 입력 → 팝업 즉시 표시
2. 추가 텍스트 입력 시 블록 목록 필터링 (이름/키워드 기준)
3. `↑` `↓` 키로 탐색, `Enter` 로 선택
4. `Esc` 또는 포커스 이탈 시 팝업 닫힘
5. 블록 선택 후 `/커맨드텍스트` 자동 삭제, 해당 블록 삽입

### 팝업 위치
현재 커서 위치 기준 아래쪽 표시. 화면 하단 넘칠 경우 위쪽으로 반전.

### 지원 블록 (13개)

| 이름 | 키워드 | Tiptap 커맨드 |
|------|--------|---------------|
| 텍스트 | text, 텍스트 | `setParagraph` |
| 제목 1 | h1, heading, 제목 | `setHeading({ level: 1 })` |
| 제목 2 | h2 | `setHeading({ level: 2 })` |
| 제목 3 | h3 | `setHeading({ level: 3 })` |
| 불릿 리스트 | bullet, list, 목록 | `toggleBulletList` |
| 번호 목록 | ordered, 번호 | `toggleOrderedList` |
| 체크리스트 | todo, check, 체크 | `toggleTaskList` |
| Callout | callout, 콜아웃 | `setCallout({ type: 'info' })` |
| Toggle | toggle, 토글 | `setToggle` |
| 인용구 | quote, 인용 | `setBlockquote` |
| 코드블록 | code, 코드 | `setCodeBlock` |
| 구분선 | divider, hr, 구분 | `setHorizontalRule` |
| 이미지 | image, 이미지 | 파일 업로드 트리거 |

---

## 5. Callout 블록

### 커스텀 Node 스펙 (`Callout.js`)
- 타입: Block node, `callout`
- 속성: `type` — `'info' | 'warning' | 'danger' | 'tip'` (기본: `'tip'`)
- 내부 컨텐츠: 단락, 리스트 등 모든 블록 허용 (`content: 'block+'`)
- NodeView: React 컴포넌트로 렌더링

### 타입별 스타일

| type | 이모지 | 배경색 | 왼쪽 보더 |
|------|--------|--------|-----------|
| tip | 💡 | `#fef9c3` | `#eab308` |
| warning | ⚠️ | `#fff7ed` | `#f97316` |
| danger | ❌ | `#fef2f2` | `#ef4444` |
| info | ℹ️ | `#eff6ff` | `#3b82f6` |

다크모드: 배경 투명도 10%, 보더색 유지.

### 인터랙션
- 슬래시 커맨드로 삽입 시 기본 `tip` 타입
- 이모지 클릭 → 타입 선택 드롭다운 (4가지)
- 읽기 모드에서는 이모지 클릭 비활성화

---

## 6. Toggle 블록

### 커스텀 Node 스펙 (`Toggle.js`)
- 타입: Block node, `toggle`
- 속성: `open` — boolean (기본: `true`)
- 구조: 제목 영역 + 컨텐츠 영역 (`content: 'block+'`)
- NodeView: React 컴포넌트로 렌더링

### 인터랙션
- `▶` 아이콘 클릭 → `open` 속성 토글
- `open: false` 시 컨텐츠 영역 `display: none`
- 제목 영역은 항상 편집 가능
- `open` 상태는 문서 저장 시 함께 저장됨

---

## 7. 체크리스트

`@tiptap/extension-task-list` + `@tiptap/extension-task-item` 사용.

- 슬래시 커맨드로 삽입
- 기존 마크다운 `- [ ]` InputRule 자동 변환 유지
- 체크 상태는 description HTML에 저장됨
- 다크모드 체크박스 색상 별도 CSS 처리

---

## 8. 코드블록 하이라이팅

`@tiptap/extension-code-block-lowlight` + `lowlight` 사용.

- 기존 StarterKit의 `codeBlock`을 `CodeBlockLowlight`로 교체
- 지원 언어: javascript, typescript, python, bash, sql, json, html, css (lowlight 기본 지원)
- 코드블록 우측 상단 언어 선택 드롭다운 추가
- 테마: `github-dark` (다크모드), `github` (라이트모드)

---

## 9. 블록 드래그 핸들

추가 패키지 없이 NodeView의 `data-drag-handle` 속성 활용.

- Callout, Toggle NodeView에 `data-drag-handle` div 포함
- 일반 블록은 CSS `::before` 의사요소로 `⠿` 표시 (호버 시)
- 드래그로 블록 순서 변경 (Tiptap 내장 DnD)
- 편집 모드에서만 표시 (읽기 모드 비활성화)
- 색상: `text-gray-300 hover:text-gray-500`

---

## 10. Editor.jsx 조립 구조

```javascript
// editor/Editor.jsx — 확장 목록
const extensions = [
  StarterKit.configure({ codeBlock: false }),  // CodeBlockLowlight로 교체
  CodeBlockLowlight.configure({ lowlight }),
  TaskList,
  TaskItem.configure({ nested: true }),
  ResizableImage,
  Table, TableRow, TableCell, TableHeader,  // 기존 유지
  Placeholder,
  Callout,
  Toggle,
  SlashCommand,
  // DragHandle — NodeView data-drag-handle 방식으로 처리 (별도 확장 없음)
]
```

---

## 11. 기존 기능 유지 보장

- 이미지 업로드/리사이즈 (ResizableImage) — 동일 동작
- 마크다운 붙여넣기 변환 (marked) — 동일 동작
- 복사 시 마크다운 변환 (turndown) — 동일 동작
- Blur 자동저장 — 동일 동작
- 읽기 모드 (`editable: false`) — 동일 동작
- 다크모드 prose 클래스 — 동일 동작

---

## 12. 범위 밖 (이번 Phase 미포함)

- 테이블 편집 (현재 읽기 전용 유지)
- 이미지 alt 텍스트 편집 UI
- 협업 편집 (Realtime 커서)
- 텍스트 색상/하이라이트
- @멘션 (Phase 6)
