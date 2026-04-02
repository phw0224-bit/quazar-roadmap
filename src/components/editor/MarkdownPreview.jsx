/**
 * @fileoverview Markdown 읽기 전용 미리보기.
 *
 * Markdown 원문을 HTML로 렌더링하고, 위키링크/토글 같은 커스텀 문법에 상호작용을 부여한다.
 */
import { useMemo } from 'react';
import { renderMarkdownPreviewHTML } from './utils/markdownPreview';

export default function MarkdownPreview({ content, onOpenLink, containerRef }) {
  const html = useMemo(() => renderMarkdownPreviewHTML(content || ''), [content]);

  return (
    <div
      ref={containerRef}
      className="detail-markdown markdown-preview prose max-w-none dark:prose-invert rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-border-subtle dark:bg-bg-elevated"
      onClick={(event) => {
        const anchor = event.target.closest('[data-wiki-link]');
        if (!anchor) return;
        event.preventDefault();
        onOpenLink?.(anchor.getAttribute('data-wiki-link'));
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
