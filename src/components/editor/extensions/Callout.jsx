import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import { useState } from 'react';

const CALLOUT_TYPES = {
  tip:     { emoji: '💡', bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-400' },
  warning: { emoji: '⚠️', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-400' },
  danger:  { emoji: '❌', bg: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-400' },
  info:    { emoji: 'ℹ️', bg: 'bg-blue-50 dark:bg-blue-950/20',     border: 'border-blue-400' },
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
            className={`text-xl leading-none select-none ${isEditable ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
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
        parseHTML: el => el.getAttribute('data-type') || 'tip',
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
      insertCallout: (attrs) => ({ chain }) =>
        chain()
          .insertContent({ type: this.name, attrs, content: [{ type: 'paragraph' }] })
          .run(),
    };
  },
});

export default Callout;
