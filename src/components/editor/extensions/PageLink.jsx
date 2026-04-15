/**
 * @fileoverview Tiptap 페이지 링크 노드. 다른 item(page)을 에디터 내에서 링크.
 *
 * Attributes: id (item UUID), title (표시 텍스트)
 * 렌더링: 버튼 스타일의 인라인 노드 (아이콘 + 제목)
 * 클릭: onOpenDetail(itemId) 콜백 호출 → ItemDetailPanel 열림
 *
 * SlashCommand의 'Child Page' 커맨드가 이 노드를 삽입함.
 * 저장 시 Tiptap HTML에 <page-link id="..." title="..."> 태그로 직렬화.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

function PageLinkView({ node, editor }) {
  const { id, title } = node.attrs;
  
  // 에디터 옵션에서 onOpenDetail 콜백을 가져옵니다.
  const extension = editor.extensionManager.extensions.find(e => e.name === 'pageLink');
  const onOpenDetail = extension?.options?.onOpenDetail;

  return (
    <NodeViewWrapper className="my-2">
      <button
        type="button"
        onClick={() => onOpenDetail?.(id)}
        className="
          flex items-center gap-2 px-3 py-2 rounded-xl
          border border-gray-100 dark:border-border-subtle
          bg-gray-50/50 dark:bg-bg-elevated/30
          hover:bg-brand-50 dark:hover:bg-brand-800/20
          hover:border-brand-200 dark:hover:border-brand-700/40
          transition-all duration-200 group w-full text-left cursor-pointer
          shadow-sm hover:shadow-md
        "
      >
        <span className="text-base shrink-0">📄</span>
        <span className="text-[14px] font-bold text-gray-800 dark:text-text-primary group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
          {title || '제목 없음'}
        </span>
        <span className="ml-auto text-[11px] font-black text-gray-300 dark:text-text-tertiary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          Open Page
        </span>
      </button>
    </NodeViewWrapper>
  );
}

const PageLink = Node.create({
  name: 'pageLink',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,

  addOptions() {
    return {
      onOpenDetail: null,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: el => el.getAttribute('data-id'),
        renderHTML: attrs => ({ 'data-id': attrs.id }),
      },
      title: {
        default: '제목 없음',
        parseHTML: el => el.getAttribute('data-title'),
        renderHTML: attrs => ({ 'data-title': attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-page-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-link': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
});

export default PageLink;
