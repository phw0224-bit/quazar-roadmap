# components/editor/extensions/

> 구 Tiptap 상세내용 경로의 커스텀 확장 보관소. 현재 상세내용 주 경로는 CodeMirror Markdown editor이므로 이 폴더는 레거시 호환 맥락에서만 의미가 있다.

## 책임
- 이전 Tiptap 기반 description 편집기의 커스텀 노드/확장 보존
- legacy HTML 구조를 이해할 때 참고할 스키마 제공
- 완전 제거 전까지 다른 미확인 경로가 의존할 가능성 방어

## 주요 파일

| 파일 | 역할 |
|------|------|
| `Toggle.jsx` | 이전 노션형 토글 컨테이너 구현 |
| `Callout.jsx` | 이전 callout 블록 노드 |
| `PageLink.jsx` | 이전 inline 페이지 링크 노드 |
| `ResizableImage.jsx` | 이전 이미지 리사이즈 노드 |
| `SlashCommand.js` | 이전 Tiptap suggestion 기반 슬래시 커맨드 |

## 패턴 & 규칙

- 새 description 기능은 이 폴더에 추가하지 않는다.
- 현재 상세내용 편집 확장은 `src/components/editor/Editor.jsx` + `src/components/editor/EditorToolbar.jsx` 조합과 `src/components/editor/utils/editorCommands.js`에서 Markdown 스니펫으로 처리한다.
- 이 폴더 파일을 수정해야 할 때는 “legacy import/호환 유지” 목적이 명확할 때만 수정한다.
