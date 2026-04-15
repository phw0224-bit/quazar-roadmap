/**
 * @fileoverview Markdown 읽기 전용 미리보기.
 *
 * Markdown 원문을 읽기 전용 HTML로 렌더링하고, 위키링크/체크리스트/mermaid 같은 상호작용만 부여한다.
 */
import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdownPreviewHTML } from './utils/markdownPreview';
import { renderMermaidSVG } from './utils/mermaidRenderer';

function assignRef(ref, node) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(node);
    return;
  }
  ref.current = node;
}

export default function MarkdownPreview({ content, onOpenLink, containerRef, onToggleTaskItem }) {
  const html = useMemo(() => {
    return renderMarkdownPreviewHTML(content || '');
  }, [content]);
  const localRef = useRef(null);

  useEffect(() => {
    const root = localRef.current;
    if (!root) return;
    const checkboxNodes = root.querySelectorAll('input[type="checkbox"]');
    checkboxNodes.forEach((checkbox, index) => {
      checkbox.dataset.taskIndex = String(index);
      checkbox.disabled = !onToggleTaskItem;
      checkbox.classList.add('markdown-preview-task-checkbox');
    });

    const codeNodes = root.querySelectorAll('pre > code.language-mermaid');
    codeNodes.forEach((codeNode, index) => {
      const source = codeNode.textContent || '';
      const pre = codeNode.closest('pre');
      if (!pre) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'markdown-preview-mermaid-wrapper';
      pre.replaceWith(wrapper);

      renderMermaidSVG(source, `preview-mermaid-${index}`)
        .then((svg) => {
          if (!wrapper.isConnected) return;
          wrapper.innerHTML = svg;
        })
        .catch((error) => {
          if (!wrapper.isConnected) return;
          wrapper.innerHTML = `<pre class="cm-live-mermaid-error">${error.message}</pre>`;
        });
    });
  }, [html, onToggleTaskItem]);

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        assignRef(containerRef, node);
      }}
      className="detail-markdown markdown-preview rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-border-subtle dark:bg-bg-elevated"
      onClick={(event) => {
        const anchor = event.target.closest('[data-wiki-link]');
        if (anchor) {
          event.preventDefault();
          onOpenLink?.(anchor.getAttribute('data-wiki-link'));
          return;
        }
        const checkbox = event.target.closest('input[type="checkbox"][data-task-index]');
        if (!checkbox || !onToggleTaskItem) return;
        const taskIndex = Number.parseInt(checkbox.getAttribute('data-task-index'), 10);
        if (!Number.isNaN(taskIndex)) {
          onToggleTaskItem(taskIndex, checkbox.checked);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
