# components/editor/

> Tiptap v3 기반 리치텍스트 에디터. ItemDetailPanel의 description 필드에서 사용.

## 책임
- Tiptap 에디터 초기화 및 확장 조합
- 마크다운 ↔ HTML 변환 (복사/붙여넣기)
- 파일 업로드 (이미지 삽입, 문서 링크)
- 슬래시 커맨드 팝업 UI

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `Editor.jsx` | Tiptap useEditor 초기화, 툴바, BubbleMenu, 파일업로드 처리 | tiptap, extensions/* |
| `SlashCommandMenu.jsx` | `/` 커맨드 팔레트 UI (forwardRef + useImperativeHandle) | - |
| `extensions/` | 커스텀 Tiptap 확장 5개 (ResizableImage, Callout, Toggle, PageLink, SlashCommand) | - |

## 패턴 & 규칙

**마크다운 ↔ HTML 변환:**
- 붙여넣기: `marked(markdown)` → HTML → Tiptap 삽입
- 복사: Tiptap HTML → `turndown(html)` → 클립보드에 마크다운

**InputRules (에디터에 이미 내장):**
- `#` → H1, `- ` → BulletList, `**` → Bold, `- [ ]` → TaskItem
- 새로 추가할 필요 없음

**파일 업로드 흐름:**

```
사용자 이미지 선택 → POST /upload/:itemId → { url, filename }
→ 이미지: editor.commands.setImage({ src: url })
→ 문서: editor.commands.insertContent(`<a href="${url}">`)
```

**editable prop:**

```javascript
// editor.setEditable(editable) 으로 읽기/쓰기 전환
// isReadOnly=true → editable=false → 툴바 숨김
```
