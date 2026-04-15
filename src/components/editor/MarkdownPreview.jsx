/**
 * @fileoverview Markdown 읽기 전용 미리보기.
 *
 * Markdown 원문을 HTML로 렌더링하고, 위키링크/토글 같은 커스텀 문법에 상호작용을 부여한다.
 * allItems가 전달되면 ![[pagename|id]] 임베드 문법도 처리한다.
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

/**
 * @description ![[title|id]] 임베드 문법을 실제 아이템 description으로 치환한다.
 * allItems 전달 시에만 동작하며, 순환 임베드를 방지하기 위해 단일 depth만 지원.
 */
function resolveEmbeds(markdown, allItems) {
  if (!allItems?.length) return markdown;
  return markdown.replace(/!\[\[([^|\]]+)\|?([^\]]*)\]\]/g, (_match, title, id) => {
    const targetId = id?.trim() || null;
    const item = targetId
      ? allItems.find((i) => i.id === targetId)
      : allItems.find((i) => (i.title || i.content || '') === title.trim());
    if (!item) return `<span class="md-embed-missing">임베드를 찾을 수 없음: ${title}</span>`;
    const embedHtml = renderMarkdownPreviewHTML(item.description || '*내용 없음*');
    return `<div class="md-embed-block" data-embed-id="${item.id}">
  <div class="md-embed-title">📄 ${item.title || item.content || title}</div>
  <div class="md-embed-content">${embedHtml}</div>
</div>`;
  });
}

export default function MarkdownPreview({ content, onOpenLink, containerRef, onToggleTaskItem, allItems }) {
  const html = useMemo(() => {
    const resolved = resolveEmbeds(content || '', allItems);
    return renderMarkdownPreviewHTML(resolved);
  }, [content, allItems]);
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
