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
            className="text-gray-400 dark:text-text-tertiary text-xs transition-transform duration-200 flex-shrink-0 cursor-pointer p-0.5 hover:text-gray-600 dark:hover:text-text-secondary"
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
              className="text-sm font-medium bg-transparent outline-none flex-1 text-gray-700 dark:text-text-primary placeholder-gray-400 dark:placeholder-text-tertiary"
              placeholder="Toggle 제목..."
            />
          ) : (
            <span
              className="text-sm font-medium text-gray-700 dark:text-text-primary flex-1 cursor-pointer select-none"
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
        renderHTML: attrs => ({ 'data-open': String(attrs.open) }),
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
        chain()
          .insertContent({
            type: this.name,
            attrs: { open: true, summary: '' },
            content: [{ type: 'paragraph' }],
          })
          .run(),
    };
  },
});

export default Toggle;
