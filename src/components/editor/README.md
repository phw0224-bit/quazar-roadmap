# components/editor/

> 상세내용을 옵시디언형 Markdown 편집기로 고정해, Live Preview와 원문/보기 모드를 같은 원본 위에서 운영하는 폴더.

## 책임
- CodeMirror 기반 Markdown live/source editor 제공
- Markdown preview 렌더링과 위키링크/토글 상호작용 제공
- legacy HTML import와 clipboard normalization 처리
- 툴바와 슬래시 메뉴가 공유하는 Markdown 명령 정의 유지
- Markdown 표 편집 보조와 새 페이지 생성 명령 제공

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `Editor.jsx` | **핵심.** CodeMirror live/source editor orchestration, 슬래시 메뉴 상태, 편집 이벤트 브리지 | `EditorToolbar.jsx`, `codemirror/livePreviewExtension.js`, `codemirror/tableSelectionExtension.js` |
| `EditorToolbar.jsx` | 상단 툴바 버튼 렌더링 + 표 컨텍스트 액션 UI + 파일 선택 input | `utils/tableEditing.js`, `utils/editorCommands.js` |
| `MarkdownPreview.jsx` | Markdown 읽기 전용 렌더링과 위키링크 클릭 처리 | `utils/markdownPreview.js` |
| `SlashCommandMenu.jsx` | `/query` 기반 Markdown 명령 팔레트 UI | - |
| `codemirror/livePreviewExtension.js` | live preview decoration + 헤딩 폴딩 위젯/상태 확장 | `utils/livePreview.js`, `utils/mermaidRenderer.js` |
| `codemirror/tableSelectionExtension.js` | 표 활성 셀 강조 decoration 확장 | `utils/tableEditing.js` |
| `utils/editorCommands.js` | 툴바/슬래시 메뉴 공용 명령 정의와 slash query 파싱 | - |
| `utils/editorTextOps.js` | CodeMirror selection 기반 공용 삽입/치환 유틸 | `@codemirror/state` |
| `utils/tableEditing.js` | 표 감지, Tab 셀 이동, 행/열 추가, 셀 비우기 | - |
| `utils/markdownPreview.js` | 토글/위키링크 포함 preview HTML 렌더링 | `marked` |
| `utils/markdownTransform.js` | Markdown 저장 경계와 legacy HTML -> Markdown 정규화 | `marked`, `turndown` |

## 패턴 & 규칙

**Markdown 단일 원본**
- `items.description` 저장값은 Markdown 문자열이다.
- `Live`는 현재 줄만 source처럼 두고 나머지 줄은 decoration으로 렌더처럼 보여준다.
- `Source`는 전체 Markdown 원문을 그대로 보여준다.
- `View`만 HTML preview를 사용한다.

**공용 명령 정의**

```javascript
const command = commandMap['toggle'];
runCommand(command);
// 툴바와 슬래시 메뉴 모두 같은 command 메타데이터를 사용
```

**슬래시 메뉴**

```javascript
const context = getSlashCommandContext(doc, cursor);
// /toggle, /todo, /table, /page 같은 query를 감지해
// SlashCommandMenu에 필터링된 명령 목록을 띄운다.
```

**표 편집 보조**
- Markdown 표는 source text 그대로 저장한다.
- 커서가 표 안에 있으면 `Tab`/`Shift+Tab`으로 셀 이동한다.
- 마지막 셀에서 `Tab`을 누르면 새 행을 자동 추가한다.
- 표 전용 툴바에서 행 추가, 열 추가, 셀 삭제(내용 비우기)를 제공한다.

**토글 canonical 문법**

```md
> [!toggle] 제목
> 내용
```

- 변형은 `toggle-note`, `toggle-h1`, `toggle-h2`, `toggle-h3`를 사용한다.
- Live/Source 편집은 Markdown 원문을 유지하고, View preview에서 `details/summary` UI로 렌더한다.
