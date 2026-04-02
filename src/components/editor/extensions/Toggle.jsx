/**
 * @fileoverview 노션형 토글 컨테이너 블록.
 *
 * 토글 내부 첫 번째 블록을 헤더로 간주하고, 나머지 블록을 접고 펼치는 구조로 렌더링한다.
 * 저장 포맷은 data-toggle HTML이지만, description의 source of truth는 markdownTransform을 통해 canonical Markdown으로 유지된다.
 *
 * 지원 동작:
 * - 화살표 클릭 접기/펼치기
 * - Enter: 헤더 다음에 본문 블록 생성
 * - Tab: 직전 토글 안으로 현재 블록 이동
 * - Shift+Tab / 빈 블록 Backspace: 토글 밖으로 블록 꺼내기
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';

function ToggleView({ node, updateAttributes, editor }) {
  const isOpen = node.attrs.open !== false;
  const variant = node.attrs.variant || 'default';

  return (
    <NodeViewWrapper
      className="toggle-node my-1"
      data-open={String(isOpen)}
      data-variant={variant}
      data-toggle=""
    >
      <div className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-base px-2 py-1.5 transition-colors">
        <button
          type="button"
          contentEditable={false}
          onMouseDown={(event) => {
            event.preventDefault();
            if (editor.isEditable) updateAttributes({ open: !isOpen });
          }}
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-secondary"
          aria-label={isOpen ? '토글 접기' : '토글 펼치기'}
        >
          <span
            className="text-[11px] transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <NodeViewContent className="toggle-node-content min-w-0" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function findToggleContext(selection) {
  const { $from } = selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'toggle') {
      return {
        depth,
        node: $from.node(depth),
        pos: $from.before(depth),
        childIndex: $from.index(depth),
      };
    }
  }

  return null;
}

function moveBlockOutOfToggle(editor) {
  const { state, view } = editor;
  const context = findToggleContext(state.selection);
  if (!context || context.childIndex === 0) return false;

  const blockDepth = context.depth + 1;
  const blockPos = state.selection.$from.before(blockDepth);
  const blockNode = state.doc.nodeAt(blockPos);
  if (!blockNode) return false;

  let tr = state.tr.delete(blockPos, blockPos + blockNode.nodeSize);
  const mappedTogglePos = tr.mapping.map(context.pos);
  const mappedToggleNode = tr.doc.nodeAt(mappedTogglePos);
  if (!mappedToggleNode) return false;

  const insertPos = mappedTogglePos + mappedToggleNode.nodeSize;
  tr = tr.insert(insertPos, blockNode.copy(blockNode.content));
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));

  view.dispatch(tr.scrollIntoView());
  return true;
}

function moveBlockIntoPreviousToggle(editor) {
  const { state, view } = editor;
  const { $from } = state.selection;

  if ($from.depth !== 1 || $from.index(0) === 0) return false;

  const currentPos = $from.before(1);
  const currentNode = state.doc.nodeAt(currentPos);
  if (!currentNode) return false;

  const previousIndex = $from.index(0) - 1;
  const previousNode = state.doc.child(previousIndex);
  if (!previousNode || previousNode.type.name !== 'toggle') return false;

  let previousPos = 0;
  for (let index = 0; index < previousIndex; index += 1) {
    previousPos += state.doc.child(index).nodeSize;
  }

  let tr = state.tr.delete(currentPos, currentPos + currentNode.nodeSize);
  const insertPos = previousPos + previousNode.nodeSize - 1;
  tr = tr.insert(insertPos, currentNode.copy(currentNode.content));
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));

  view.dispatch(tr.scrollIntoView());
  return true;
}

function insertBodyParagraph(editor) {
  const { state, view } = editor;
  const context = findToggleContext(state.selection);
  if (!context || context.childIndex !== 0 || !state.selection.empty) return false;

  const headerDepth = context.depth + 1;
  const headerPos = state.selection.$from.before(headerDepth);
  const headerNode = state.doc.nodeAt(headerPos);
  if (!headerNode) return false;

  const insertPos = headerPos + headerNode.nodeSize;
  const paragraph = state.schema.nodes.paragraph?.create();
  if (!paragraph) return false;

  const tr = state.tr.insert(insertPos, paragraph);
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));

  view.dispatch(tr.scrollIntoView());
  return true;
}

const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-open') !== 'false',
        renderHTML: (attrs) => ({ 'data-open': String(attrs.open !== false) }),
      },
      variant: {
        default: 'default',
        parseHTML: (element) => element.getAttribute('data-variant') || 'default',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant || 'default' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details[data-toggle]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { 'data-toggle': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addCommands() {
    return {
      insertToggle:
        (attrs = {}) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { open: true, variant: 'default', ...attrs },
              content: [{ type: 'paragraph' }],
            })
            .run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => moveBlockIntoPreviousToggle(this.editor),
      'Shift-Tab': () => moveBlockOutOfToggle(this.editor),
      Backspace: () => {
        const { state } = this.editor;
        const context = findToggleContext(state.selection);
        if (!context || context.childIndex === 0) return false;

        const blockDepth = context.depth + 1;
        const blockNode = state.selection.$from.node(blockDepth);
        const isEmptyParagraph = blockNode.type.name === 'paragraph' && blockNode.textContent.length === 0;
        const atStart = state.selection.empty && state.selection.$from.parentOffset === 0;

        if (!isEmptyParagraph || !atStart) return false;
        return moveBlockOutOfToggle(this.editor);
      },
      Enter: () => insertBodyParagraph(this.editor),
    };
  },
});

export default Toggle;
