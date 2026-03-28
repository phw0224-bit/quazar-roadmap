# components/editor/extensions/

> Tiptap 커스텀 확장 5개. 각각 독립적인 블록 타입을 구현.

## 책임
- 노션 스타일 커스텀 블록 구현 (Callout, Toggle)
- 리사이즈 가능한 이미지 노드 (ResizableImage)
- 페이지 간 링크 노드 (PageLink)
- 슬래시 커맨드 Tiptap 확장 (SlashCommand)

## 주요 파일

| 파일 | 역할 |
|------|------|
| `SlashCommand.js` | `/` 입력 시 커맨드 팔레트 트리거. `@tiptap/suggestion` 기반. 12개 블록 타입 지원 |
| `Callout.jsx` | 강조 박스 노드. 타입(tip/warning/danger/info)에 따라 색상/이모지 변경 |
| `Toggle.jsx` | 접기/펼치기 블록. 클릭으로 content 영역 toggle |
| `PageLink.jsx` | 다른 item을 링크하는 인라인 노드. `id`, `title` attribute 저장. 클릭 시 onOpenDetail 호출 |
| `ResizableImage.jsx` | Tiptap Image 확장. width attribute + 드래그 리사이즈 핸들 추가 |

## 패턴 & 규칙

**SlashCommand 동작:**

```
사용자 `/` 입력
  → suggestion.items() 로 필터링된 커맨드 목록 반환
  → ReactRenderer로 SlashCommandMenu 마운트
  → 선택 시 command.action(editor) 실행
  → PageLink 커맨드는 onAddChildPage 콜백이 있을 때만 노출
```

**새 확장 추가 시:** `Editor.jsx`의 `extensions` 배열에 import 후 추가.
SlashCommand에 블록 타입 지원 추가 시 `defaultCommands` 배열에 항목 추가.

**Callout 타입:**

```javascript
{ type: 'tip',     emoji: '💡', bg: 'bg-yellow-50 dark:bg-yellow-900/20' }
{ type: 'warning', emoji: '⚠️', bg: 'bg-orange-50 dark:bg-orange-900/20' }
{ type: 'danger',  emoji: '❌', bg: 'bg-red-50    dark:bg-red-900/20'    }
{ type: 'info',    emoji: 'ℹ️', bg: 'bg-blue-50   dark:bg-blue-900/20'   }
```
