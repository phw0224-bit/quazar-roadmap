/**
 * @fileoverview Markdown 읽기 전용 미리보기.
 *
 * Markdown 원문을 읽기 전용 HTML로 렌더링하고, 위키링크/체크리스트/mermaid 같은 상호작용만 부여한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderMarkdownPreviewHTML } from './utils/markdownPreview';
import { renderMermaidSVG } from './utils/mermaidRenderer';

function buildPreviewSnippet(description = '') {
  return `${description || ''}`
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1 $2')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[#>*`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function slugifyHeading(value = '', fallback = 'section') {
  const normalized = `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
}

function assignRef(ref, node) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(node);
    return;
  }
  ref.current = node;
}

export default function MarkdownPreview({
  content,
  onOpenLink,
  containerRef,
  onToggleTaskItem,
  resolveLinkPreview,
  className = '',
  chromeLess = false,
}) {
  const html = useMemo(() => {
    return renderMarkdownPreviewHTML(content || '');
  }, [content]);
  const localRef = useRef(null);
  const [hoverPreview, setHoverPreview] = useState(null);

  useEffect(() => {
    const root = localRef.current;
    if (!root) return;
    const headingIds = new Map();
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, index) => {
      const headingText = `${heading.textContent || ''}`.trim();
      const baseSlug = slugifyHeading(headingText, `section-${index + 1}`);
      const seenCount = headingIds.get(baseSlug) || 0;
      const nextCount = seenCount + 1;
      headingIds.set(baseSlug, nextCount);
      const finalSlug = nextCount > 1 ? `${baseSlug}-${nextCount}` : baseSlug;
      heading.id = heading.id || `preview-heading-${finalSlug}`;
      heading.classList.add('markdown-preview-heading');

      if (!heading.querySelector('[data-heading-anchor]')) {
        const anchor = document.createElement('button');
        anchor.type = 'button';
        anchor.dataset.headingAnchor = heading.id;
        anchor.className = 'markdown-preview-heading-anchor';
        anchor.textContent = '#';
        anchor.setAttribute('aria-label', `${headingText || '헤딩'} 섹션 링크 복사`);
        heading.appendChild(anchor);
      }
    });

    const checkboxNodes = root.querySelectorAll('input[type="checkbox"]');
    checkboxNodes.forEach((checkbox, index) => {
      checkbox.dataset.taskIndex = String(index);
      checkbox.disabled = !onToggleTaskItem;
      checkbox.classList.add('markdown-preview-task-checkbox');
    });

    root.querySelector('[data-checklist-progress]')?.remove();
    const totalTasks = checkboxNodes.length;
    if (totalTasks > 0) {
      const checkedTasks = Array.from(checkboxNodes).filter((checkbox) => checkbox.checked).length;
      const progress = Math.round((checkedTasks / totalTasks) * 100);
      const summary = document.createElement('div');
      summary.dataset.checklistProgress = 'true';
      summary.className = 'markdown-preview-checklist-progress';
      summary.innerHTML = `
        <div class="markdown-preview-checklist-progress-copy">
          <strong>체크리스트 진행률</strong>
          <span>${checkedTasks}/${totalTasks} 완료</span>
        </div>
        <div class="markdown-preview-checklist-progress-bar">
          <span style="width: ${progress}%"></span>
        </div>
      `;
      root.prepend(summary);
    }

    const codeBlocks = root.querySelectorAll('pre > code:not(.language-mermaid)');
    codeBlocks.forEach((codeNode) => {
      const pre = codeNode.closest('pre');
      if (!pre || pre.parentElement?.classList.contains('markdown-preview-codeblock-shell')) return;

      const shell = document.createElement('div');
      shell.className = 'markdown-preview-codeblock-shell';

      const header = document.createElement('div');
      header.className = 'markdown-preview-codeblock-header';

      const language = `${codeNode.className || ''}`.match(/language-([a-z0-9+-]+)/i)?.[1] || 'text';
      const languageBadge = document.createElement('span');
      languageBadge.className = 'markdown-preview-codeblock-language';
      languageBadge.textContent = language;

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.dataset.copyCode = 'true';
      copyButton.className = 'markdown-preview-codeblock-copy';
      copyButton.textContent = 'Copy';

      header.append(languageBadge, copyButton);
      pre.replaceWith(shell);
      shell.append(header, pre);
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
    <div className="relative">
      <div
        ref={(node) => {
          localRef.current = node;
          assignRef(containerRef, node);
        }}
      className={`detail-markdown markdown-preview ${
        chromeLess
          ? 'bg-transparent p-0 shadow-none border-none rounded-none'
          : 'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-border-subtle dark:bg-bg-elevated'
      } ${className}`.trim()}
      onClick={(event) => {
        const headingAnchor = event.target.closest('[data-heading-anchor]');
        if (headingAnchor) {
          event.preventDefault();
          const headingId = headingAnchor.getAttribute('data-heading-anchor');
          const heading = document.getElementById(headingId);
          const nextUrl = `${window.location.pathname}${window.location.search}#${headingId}`;
          navigator.clipboard?.writeText(nextUrl).catch(() => {});
          if (heading) {
            heading.classList.add('markdown-preview-heading-target');
            window.setTimeout(() => heading.classList.remove('markdown-preview-heading-target'), 1600);
          }
          return;
        }

        const copyButton = event.target.closest('[data-copy-code]');
        if (copyButton) {
          event.preventDefault();
          const shell = copyButton.closest('.markdown-preview-codeblock-shell');
          const codeNode = shell?.querySelector('pre > code');
          const codeText = codeNode?.textContent || '';
          if (codeText) {
            navigator.clipboard?.writeText(codeText).catch(() => {});
            copyButton.textContent = 'Copied';
            window.setTimeout(() => {
              copyButton.textContent = 'Copy';
            }, 1200);
          }
          return;
        }

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
        onMouseMove={(event) => {
          const anchor = event.target.closest('[data-wiki-link]');
          if (!anchor || !resolveLinkPreview) {
            if (hoverPreview) {
              setHoverPreview(null);
            }
            return;
          }

          const target = anchor.getAttribute('data-wiki-link');
          const previewItem = resolveLinkPreview(target);
          if (!previewItem) {
            if (hoverPreview) {
              setHoverPreview(null);
            }
            return;
          }

          const rect = anchor.getBoundingClientRect();
          const nextPreview = {
            id: previewItem.id || target,
            title: previewItem.title || previewItem.content || '제목 없음',
            description: buildPreviewSnippet(previewItem.description || ''),
            kind: previewItem.page_type === 'page' ? '문서' : '업무',
            top: Math.max(16, rect.top - 12),
            left: Math.min(window.innerWidth - 336, rect.right + 16),
          };

          setHoverPreview((current) => {
            if (
              current
              && current.id === nextPreview.id
              && current.top === nextPreview.top
              && current.left === nextPreview.left
            ) {
              return current;
            }
            return nextPreview;
          });
        }}
        onMouseLeave={() => {
          setHoverPreview(null);
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hoverPreview && (
        <div
          className="pointer-events-none fixed z-30 hidden w-80 rounded-2xl border border-gray-200 bg-white/96 p-4 shadow-2xl backdrop-blur xl:block dark:border-border-subtle dark:bg-bg-elevated/96"
          style={{ top: hoverPreview.top, left: hoverPreview.left }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-black text-gray-900 dark:text-text-primary">
              {hoverPreview.title}
            </span>
            <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:bg-bg-hover dark:text-text-tertiary">
              {hoverPreview.kind}
            </span>
          </div>
          {hoverPreview.description ? (
            <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-text-secondary">
              {hoverPreview.description}
            </p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-gray-400 dark:text-text-tertiary">
              미리볼 본문이 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
