# Phase 1 — 에디터 완성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TiptapEditor를 editor/ 폴더로 분리하고 슬래시 커맨드, Callout, Toggle, 체크리스트, 코드 하이라이트를 추가한다.

**Architecture:** `@tiptap/suggestion` 기반 슬래시 커맨드가 `SlashCommandMenu.jsx`(React 팝업 UI)를 `ReactRenderer`로 렌더링. Callout/Toggle은 커스텀 Node + ReactNodeViewRenderer. 기존 기능(이미지 리사이즈, 마크다운 변환, 자동저장)은 그대로 유지.

**Tech Stack:** Tiptap v3, @tiptap/suggestion, @tiptap/extension-code-block-lowlight, lowlight, @tiptap/extension-task-list, @tiptap/extension-task-item, React 19, Tailwind v4

---

## 파일 맵

| 액션 | 경로 | 역할 |
|------|------|------|
| 생성 | `src/components/editor/extensions/ResizableImage.js` | 기존 코드 추출 |
| 생성 | `src/components/editor/extensions/Callout.js` | Callout 커스텀 Node |
| 생성 | `src/components/editor/extensions/Toggle.js` | Toggle 커스텀 Node |
| 생성 | `src/components/editor/extensions/SlashCommand.js` | 슬래시 커맨드 로직 |
| 생성 | `src/components/editor/SlashCommandMenu.jsx` | 슬래시 팝업 UI |
| 생성 | `src/components/editor/Editor.jsx` | 메인 에디터 (기존 TiptapEditor.jsx 역할) |
| 삭제 | `src/components/TiptapEditor.jsx` | Editor.jsx로 대체 |
| 수정 | `src/components/ItemDetailPanel.jsx` | import 경로 변경 |
| 수정 | `src/index.css` | Callout, Toggle, TaskList, CodeBlock, DragHandle CSS |

---

## Task 1: 패키지 설치

**Files:** `package.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd /c/Users/uguls/Documents/quazar-roadmap-main
yarn add @tiptap/suggestion @tiptap/extension-code-block-lowlight "lowlight@^3.0.0" @tiptap/extension-task-list @tiptap/extension-task-item
```

Expected output: 5개 패키지 추가됨, `yarn.lock` 업데이트.

- [ ] **Step 2: 설치 확인**

```bash
node -e "require('./node_modules/@tiptap/suggestion/dist/index.js'); console.log('OK')" 2>/dev/null || yarn list --pattern "@tiptap/suggestion" 2>&1 | head -5
```

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "feat(editor): install phase1 editor packages"
```

---

## Task 2: ResizableImage 확장 분리

**Files:**
- Create: `src/components/editor/extensions/ResizableImage.js`

- [ ] **Step 1: editor 폴더 생성 후 파일 작성**

`src/components/editor/extensions/ResizableImage.js` 를 아래 내용으로 생성:

```javascript
import { useRef } from 'react';
import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

function ImageResizeView({ node, updateAttributes, selected, editor }) {
  const imgRef = useRef(null);
  const isEditable = editor.isEditable;

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current.offsetWidth;

    const onMouseMove = (e) => {
      const newWidth = Math.max(50, startWidth + (e.clientX - startX));
      imgRef.current.style.width = `${newWidth}px`;
    };
    const onMouseUp = () => {
      updateAttributes({ width: `${imgRef.current.offsetWidth}px` });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <NodeViewWrapper style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}>
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={{
            width: node.attrs.width || 'auto',
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '0.5rem',
            outline: selected ? '2px solid #3b82f6' : 'none',
            outlineOffset: '2px',
          }}
          draggable={false}
        />
        {isEditable && selected && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute', right: -5, bottom: -5,
              width: 14, height: 14,
              background: '#3b82f6', border: '2px solid white',
              borderRadius: '50%', cursor: 'se-resize', zIndex: 10,
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.style.width || el.getAttribute('width') || null,
        renderHTML: attrs => attrs.width ? { style: `width: ${attrs.width}` } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageResizeView);
  },
});

export default ResizableImage;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/extensions/ResizableImage.js
git commit -m "feat(editor): extract ResizableImage to editor/extensions/"
```

---

## Task 3: Callout 확장 구현

**Files:**
- Create: `src/components/editor/extensions/Callout.js`

- [ ] **Step 1: Callout.js 생성**

`src/components/editor/extensions/Callout.js`:

```javascript
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import { useState } from 'react';

const CALLOUT_TYPES = {
  tip:     { emoji: '💡', bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-400' },
  warning: { emoji: '⚠️', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-400' },
  danger:  { emoji: '❌', bg: 'bg-red-50 dark:bg-red-950/20',    border: 'border-red-400' },
  info:    { emoji: 'ℹ️', bg: 'bg-blue-50 dark:bg-blue-950/20',   border: 'border-blue-400' },
};

function CalloutView({ node, updateAttributes, editor }) {
  const [showPicker, setShowPicker] = useState(false);
  const type = node.attrs.type || 'tip';
  const { emoji, bg, border } = CALLOUT_TYPES[type];
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper>
      <div className={`flex gap-3 my-2 px-4 py-3 rounded-lg border-l-4 ${bg} ${border}`}>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => isEditable && setShowPicker(!showPicker)}
            className={`text-xl leading-none ${isEditable ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
          >
            {emoji}
          </button>
          {showPicker && (
            <div className="absolute left-0 top-8 z-50 flex gap-1 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-lg p-1.5 shadow-lg">
              {Object.entries(CALLOUT_TYPES).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { updateAttributes({ type: key }); setShowPicker(false); }}
                  className="text-xl p-1 rounded hover:bg-gray-100 dark:hover:bg-bg-hover transition-colors"
                >
                  {val.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <NodeViewContent className="flex-1 min-w-0 prose dark:prose-invert max-w-none text-sm" />
      </div>
    </NodeViewWrapper>
  );
}

const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'tip',
        parseHTML: el => el.getAttribute('data-type'),
        renderHTML: attrs => ({ 'data-type': attrs.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout: (attrs) => ({ commands }) =>
        commands.wrapIn(this.name, attrs),
      insertCallout: (attrs) => ({ chain }) =>
        chain().insertContent({ type: this.name, attrs, content: [{ type: 'paragraph' }] }).run(),
    };
  },
});

export default Callout;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/extensions/Callout.js
git commit -m "feat(editor): add Callout custom node extension"
```

---

## Task 4: Toggle 확장 구현

**Files:**
- Create: `src/components/editor/extensions/Toggle.js`

- [ ] **Step 1: Toggle.js 생성**

`src/components/editor/extensions/Toggle.js`:

```javascript
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';

function ToggleView({ node, updateAttributes, editor }) {
  const isOpen = node.attrs.open !== false;
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper className="my-1">
      <div className="border border-gray-200 dark:border-border-subtle rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-bg-elevated hover:bg-gray-100 dark:hover:bg-bg-hover transition-colors">
          {/* 화살표: 클릭 시 접기/펼치기 */}
          <button
            type="button"
            onClick={() => updateAttributes({ open: !isOpen })}
            className="text-gray-400 dark:text-text-tertiary text-xs transition-transform duration-200 flex-shrink-0 cursor-pointer p-0.5"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </button>
          {/* 제목: 편집 모드에서 직접 타이핑, 읽기 모드에서 텍스트 */}
          {isEditable ? (
            <input
              type="text"
              value={node.attrs.summary || ''}
              onChange={e => updateAttributes({ summary: e.target.value })}
              className="text-sm font-medium bg-transparent outline-none flex-1 text-gray-700 dark:text-text-primary placeholder-gray-400"
              placeholder="Toggle 제목..."
            />
          ) : (
            <span
              className="text-sm font-medium text-gray-700 dark:text-text-primary flex-1 cursor-pointer"
              onClick={() => updateAttributes({ open: !isOpen })}
            >
              {node.attrs.summary || 'Toggle'}
            </span>
          )}
        </div>
        {isOpen && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-border-subtle">
            <NodeViewContent className="prose dark:prose-invert max-w-none text-sm" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: el => el.getAttribute('data-open') !== 'false',
        renderHTML: attrs => ({ 'data-open': attrs.open }),
      },
      summary: {
        default: '',
        parseHTML: el => el.getAttribute('data-summary') || '',
        renderHTML: attrs => ({ 'data-summary': attrs.summary || '' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-toggle]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addCommands() {
    return {
      insertToggle: () => ({ chain }) =>
        chain().insertContent({
          type: this.name,
          attrs: { open: true, summary: '' },
          content: [{ type: 'paragraph' }],
        }).run(),
    };
  },
});

export default Toggle;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/extensions/Toggle.js
git commit -m "feat(editor): add Toggle custom node extension"
```

---

## Task 5: SlashCommandMenu 컴포넌트 구현

**Files:**
- Create: `src/components/editor/SlashCommandMenu.jsx`

- [ ] **Step 1: SlashCommandMenu.jsx 생성**

`src/components/editor/SlashCommandMenu.jsx`:

```jsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const SlashCommandMenu = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex];
        if (item) { command(item); return true; }
      }
      return false;
    },
  }));

  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!items.length) return null;

  return (
    <div
      ref={containerRef}
      className="
        z-50 w-64 max-h-72 overflow-y-auto
        bg-white dark:bg-bg-elevated
        border border-gray-200 dark:border-border-subtle
        rounded-xl shadow-xl py-1
      "
    >
      {items.map((item, index) => (
        <button
          key={item.title}
          data-index={index}
          type="button"
          onClick={() => command(item)}
          className={`
            w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
            ${index === selectedIndex
              ? 'bg-gray-100 dark:bg-bg-hover text-gray-900 dark:text-text-primary'
              : 'text-gray-700 dark:text-text-secondary hover:bg-gray-50 dark:hover:bg-bg-hover'
            }
          `}
        >
          <span className="w-8 h-8 flex items-center justify-center text-base bg-gray-100 dark:bg-bg-hover rounded-lg flex-shrink-0 font-mono text-xs font-bold">
            {item.icon}
          </span>
          <div>
            <div className="text-sm font-medium">{item.title}</div>
            {item.description && (
              <div className="text-xs text-gray-400 dark:text-text-tertiary">{item.description}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';
export default SlashCommandMenu;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/SlashCommandMenu.jsx
git commit -m "feat(editor): add SlashCommandMenu popup UI"
```

---

## Task 6: SlashCommand 확장 구현

**Files:**
- Create: `src/components/editor/extensions/SlashCommand.js`

- [ ] **Step 1: SlashCommand.js 생성**

`src/components/editor/extensions/SlashCommand.js`:

```javascript
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import SlashCommandMenu from '../SlashCommandMenu';

const COMMANDS = [
  {
    title: '텍스트',
    description: '기본 단락',
    icon: '¶',
    keywords: ['text', 'paragraph', '텍스트', '단락'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: '제목 1',
    description: '큰 제목',
    icon: 'H1',
    keywords: ['h1', 'heading', '제목', 'heading1'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: '제목 2',
    description: '중간 제목',
    icon: 'H2',
    keywords: ['h2', 'heading2', '제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: '제목 3',
    description: '소제목',
    icon: 'H3',
    keywords: ['h3', 'heading3', '소제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: '불릿 리스트',
    description: '점으로 구분된 목록',
    icon: '•',
    keywords: ['bullet', 'list', '목록', '불릿'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: '번호 목록',
    description: '순서 있는 목록',
    icon: '1.',
    keywords: ['ordered', 'numbered', '번호', '순서'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: '체크리스트',
    description: '할 일 목록',
    icon: '☑',
    keywords: ['todo', 'check', 'task', '체크', '할일'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Callout',
    description: '강조 박스 (💡⚠️❌ℹ️)',
    icon: '💡',
    keywords: ['callout', '콜아웃', 'note', 'highlight'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertCallout({ type: 'tip' }).run();
    },
  },
  {
    title: 'Toggle',
    description: '접기/펼치기 블록',
    icon: '▶',
    keywords: ['toggle', '토글', 'collapse', 'accordion'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertToggle().run();
    },
  },
  {
    title: '인용구',
    description: 'Blockquote',
    icon: '"',
    keywords: ['quote', 'blockquote', '인용'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: '코드블록',
    description: '언어별 코드 하이라이팅',
    icon: '</>',
    keywords: ['code', 'codeblock', '코드'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    title: '구분선',
    description: '수평 구분선',
    icon: '—',
    keywords: ['divider', 'hr', '구분', '선'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: '이미지',
    description: '이미지 업로드',
    icon: '🖼',
    keywords: ['image', '이미지', '사진', 'photo'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // 파일 입력 트리거: 에디터 컨테이너에서 찾아 클릭
      const wrapper = editor.view.dom.closest('.tiptap-wrapper');
      const fileInput = wrapper?.querySelector('input[type="file"]');
      fileInput?.click();
    },
  },
];

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => {
          const q = query.toLowerCase().trim();
          if (!q) return COMMANDS;
          return COMMANDS.filter(item =>
            item.title.toLowerCase().includes(q) ||
            item.keywords.some(k => k.includes(q))
          );
        },
        render: () => {
          let component;
          let popup;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = document.createElement('div');
              popup.style.position = 'fixed';
              popup.style.zIndex = '9999';
              document.body.appendChild(popup);
              popup.appendChild(component.element);
              updatePosition(popup, props.clientRect());
            },
            onUpdate: (props) => {
              component?.updateProps(props);
              if (!props.clientRect || !popup) return;
              updatePosition(popup, props.clientRect());
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                cleanup(component, popup);
                return true;
              }
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              cleanup(component, popup);
            },
          };
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

function updatePosition(popup, rect) {
  if (!rect) return;
  const OFFSET = 8;
  const menuHeight = 288; // max-h-72
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > menuHeight
    ? rect.bottom + OFFSET
    : rect.top - menuHeight - OFFSET;
  popup.style.top = `${top}px`;
  popup.style.left = `${Math.min(rect.left, window.innerWidth - 264)}px`;
}

function cleanup(component, popup) {
  component?.destroy();
  popup?.remove();
}

export default SlashCommand;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/extensions/SlashCommand.js
git commit -m "feat(editor): add SlashCommand extension with 13 block types"
```

---

## Task 7: Editor.jsx 생성 (메인 에디터)

**Files:**
- Create: `src/components/editor/Editor.jsx`

- [ ] **Step 1: Editor.jsx 생성**

`src/components/editor/Editor.jsx`:

```jsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { DOMSerializer } from '@tiptap/pm/model';
import { useRef, useEffect } from 'react';
import {
  Bold, Italic, List, ListOrdered, Quote, Code, Minus,
  Heading1, Heading2, Heading3, ImagePlus, CheckSquare
} from 'lucide-react';

import ResizableImage from './extensions/ResizableImage';
import Callout from './extensions/Callout';
import Toggle from './extensions/Toggle';
import SlashCommand from './extensions/SlashCommand';

const lowlight = createLowlight(common);
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

function convertToHTML(content) {
  if (!content) return '';
  if (content.trimStart().startsWith('<')) return content;
  return marked(content);
}

function ToolbarButton({ onClick, isActive, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
        isActive
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
          : 'text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-border-subtle mx-0.5 self-center" />;
}

function Toolbar({ editor, itemId, onShowToast }) {
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      onShowToast?.('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/upload/${itemId}`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('업로드 실패');
      const result = await response.json();
      if (result.mimetype?.startsWith('image/')) {
        editor.chain().focus().setImage({ src: result.url, alt: result.originalName, width: null }).run();
      } else {
        editor.chain().focus().insertContent(
          `<a href="${result.url}" target="_blank">${result.originalName}</a>`
        ).run();
      }
      onShowToast?.('파일이 업로드되었습니다.');
    } catch (err) {
      onShowToast?.('파일 업로드 실패: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 bg-gray-50 dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl mb-3">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="굵게 (Ctrl+B)">
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="기울임 (Ctrl+I)">
        <Italic size={15} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="제목 1">
        <Heading1 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="제목 2">
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="제목 3">
        <Heading3 size={15} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="글머리 기호">
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="번호 목록">
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="체크리스트">
        <CheckSquare size={15} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="인용">
        <Quote size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="코드 블록">
        <Code size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} isActive={false} title="구분선">
        <Minus size={15} />
      </ToolbarButton>
      <Divider />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />
      <ToolbarButton onClick={() => fileInputRef.current?.click()} isActive={false} title="이미지/파일 첨부">
        <ImagePlus size={15} />
      </ToolbarButton>
    </div>
  );
}

export default function Editor({ content, onChange, editable, itemId, onShowToast, onBlur }) {
  const lastEmittedHTML = useRef(null);
  const editorRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage.configure({ inline: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: '내용을 입력하세요... (/ 로 블록 추가, # 헤더, **볼드**, - 목록)',
      }),
      Callout,
      Toggle,
      SlashCommand,
    ],
    content: convertToHTML(content),
    editable,
    onCreate: ({ editor }) => { editorRef.current = editor; },
    editorProps: {
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;
        const html = marked(text);
        editorRef.current?.commands.insertContent(html);
        return true;
      },
      handleCopy: (view, event) => {
        const { from, to } = view.state.selection;
        if (from === to) return false;
        const fragment = view.state.doc.slice(from, to).content;
        const serializer = DOMSerializer.fromSchema(view.state.schema);
        const div = document.createElement('div');
        div.appendChild(serializer.serializeFragment(fragment));
        const html = div.innerHTML;
        event.clipboardData?.setData('text/plain', turndown.turndown(html));
        event.clipboardData?.setData('text/html', html);
        event.preventDefault();
        return true;
      },
      handleCut: (view, event) => {
        const { from, to } = view.state.selection;
        if (from === to) return false;
        const fragment = view.state.doc.slice(from, to).content;
        const serializer = DOMSerializer.fromSchema(view.state.schema);
        const div = document.createElement('div');
        div.appendChild(serializer.serializeFragment(fragment));
        const html = div.innerHTML;
        event.clipboardData?.setData('text/plain', turndown.turndown(html));
        event.clipboardData?.setData('text/html', html);
        event.preventDefault();
        view.dispatch(view.state.tr.deleteSelection());
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedHTML.current = html;
      onChange?.(html);
    },
    onBlur: ({ event }) => { onBlur?.(event); },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const newHTML = convertToHTML(content);
    if (newHTML === lastEmittedHTML.current) {
      lastEmittedHTML.current = null;
      return;
    }
    if (!editor.isFocused) {
      editor.commands.setContent(newHTML, false);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper">
      {editable && (
        <Toolbar editor={editor} itemId={itemId} onShowToast={onShowToast} />
      )}
      <EditorContent
        editor={editor}
        className="prose dark:prose-invert max-w-none tiptap-content"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/Editor.jsx
git commit -m "feat(editor): create Editor.jsx assembling all extensions"
```

---

## Task 8: CSS 추가 (TaskList, CodeBlock, 드래그 핸들)

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: index.css에 스타일 추가**

`src/index.css` 파일 맨 끝에 아래 내용 추가:

```css
/* ── TaskList (체크리스트) ── */
.tiptap-content ul[data-type="taskList"] {
  list-style: none;
  padding: 0;
}

.tiptap-content ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.tiptap-content ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 0.2rem;
}

.tiptap-content ul[data-type="taskList"] li > label input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
  cursor: pointer;
  border-radius: 3px;
}

.tiptap-content ul[data-type="taskList"] li[data-checked="true"] > div {
  opacity: 0.6;
  text-decoration: line-through;
}

/* ── CodeBlock (lowlight 하이라이팅) ── */
.tiptap-content pre {
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  overflow-x: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

.dark .tiptap-content pre {
  background: #11111b;
}

.tiptap-content pre code {
  background: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

/* lowlight token colors */
.tiptap-content .hljs-comment, .tiptap-content .hljs-quote { color: #6c7086; }
.tiptap-content .hljs-keyword, .tiptap-content .hljs-selector-tag { color: #cba6f7; }
.tiptap-content .hljs-string, .tiptap-content .hljs-attr { color: #a6e3a1; }
.tiptap-content .hljs-number, .tiptap-content .hljs-literal { color: #fab387; }
.tiptap-content .hljs-title, .tiptap-content .hljs-class, .tiptap-content .hljs-function { color: #89b4fa; }
.tiptap-content .hljs-built_in, .tiptap-content .hljs-type { color: #f38ba8; }
.tiptap-content .hljs-variable, .tiptap-content .hljs-name { color: #cdd6f4; }
.tiptap-content .hljs-tag { color: #f38ba8; }

/* ── 블록 드래그 핸들 (호버 시 왼쪽 표시) ── */
.tiptap-content .ProseMirror > * {
  position: relative;
}

.tiptap-content .ProseMirror > *::before {
  content: '⠿';
  position: absolute;
  left: -1.5rem;
  top: 0.1em;
  color: transparent;
  font-size: 0.875rem;
  cursor: grab;
  user-select: none;
  transition: color 0.15s;
  line-height: 1.5;
}

.tiptap-content .ProseMirror > *:hover::before {
  color: #d1d5db;
}

.dark .tiptap-content .ProseMirror > *:hover::before {
  color: #4b5563;
}

.tiptap-wrapper:has(.ProseMirror:focus) .ProseMirror > *::before {
  visibility: visible;
}

/* 에디터 영역 왼쪽 여백 (드래그 핸들 공간) */
.tiptap-content .ProseMirror {
  padding-left: 1.75rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat(editor): add CSS for taskList, codeBlock highlight, drag handle"
```

---

## Task 9: import 경로 변경 + TiptapEditor.jsx 삭제

**Files:**
- Modify: `src/components/ItemDetailPanel.jsx`
- Delete: `src/components/TiptapEditor.jsx`

- [ ] **Step 1: ItemDetailPanel.jsx import 수정**

`src/components/ItemDetailPanel.jsx` 9번째 줄:

```javascript
// 변경 전
import TiptapEditor from './TiptapEditor';

// 변경 후
import TiptapEditor from './editor/Editor';
```

- [ ] **Step 2: 다른 파일에서 TiptapEditor import 확인**

```bash
grep -r "from.*TiptapEditor" src/ --include="*.jsx" --include="*.js"
```

추가로 발견된 파일이 있으면 동일하게 경로 변경.

- [ ] **Step 3: TiptapEditor.jsx 삭제**

```bash
rm src/components/TiptapEditor.jsx
```

- [ ] **Step 4: 개발 서버 실행 후 브라우저 확인**

```bash
yarn dev
```

확인 사항:
- [ ] 아이템 상세 패널에서 에디터가 정상 렌더링됨
- [ ] 편집 모드에서 툴바 표시됨
- [ ] `/` 입력 시 슬래시 커맨드 팝업 표시됨
- [ ] Callout 삽입 → 이모지 클릭으로 타입 변경됨
- [ ] Toggle 삽입 → 제목 클릭으로 접기/펼치기됨
- [ ] 체크리스트 삽입 → 체크박스 클릭 동작
- [ ] 코드블록 삽입 → 하이라이팅 적용됨

- [ ] **Step 5: Commit**

```bash
git add src/components/ItemDetailPanel.jsx
git rm src/components/TiptapEditor.jsx
git commit -m "feat(editor): migrate to editor/ folder, remove TiptapEditor.jsx"
```

---

## 완료 체크리스트

- [ ] `yarn dev` 시 컴파일 에러 없음
- [ ] 기존 이미지 리사이즈 기능 정상 동작
- [ ] 마크다운 붙여넣기 변환 정상 동작
- [ ] 자동저장(blur) 정상 동작
- [ ] `/` 슬래시 커맨드 13개 블록 삽입 가능
- [ ] Callout 4가지 타입 전환 가능
- [ ] Toggle 접기/펼치기 동작
- [ ] 체크리스트 체크/언체크 동작
- [ ] 코드블록 하이라이팅 적용
- [ ] 다크모드에서 모든 블록 정상 표시
- [ ] 읽기 모드에서 툴바/슬래시 커맨드 비활성화
