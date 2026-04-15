/**
 * @fileoverview 문서 아웃라인(TOC) 패널
 *
 * Markdown description에서 헤딩을 추출하여 트리 형태로 표시.
 * 클릭 시 에디터 스크롤, 현재 뷰포트에 있는 헤딩 하이라이트.
 */
import { useMemo, useState } from 'react';
import { List, ChevronRight, ChevronDown } from 'lucide-react';
import { extractHeadings, buildHeadingTree } from './editor/utils/headingExtractor';

function HeadingNode({ node, activeOffset, onHeadingClick, depth = 0 }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = node.offset === activeOffset;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) setIsOpen(!isOpen);
          onHeadingClick(node.offset);
        }}
        className={`
          w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm
          transition-colors group
          ${isActive 
            ? 'bg-brand-100 dark:bg-brand-800/30 text-brand-700 dark:text-brand-300 font-semibold'
            : 'hover:bg-gray-100 dark:hover:bg-bg-hover text-gray-700 dark:text-text-secondary'
          }
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren && (
          <span className="flex-shrink-0">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        <span className="flex-1 truncate">{node.text}</span>
      </button>
      {isOpen && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <HeadingNode
              key={idx}
              node={child}
              activeOffset={activeOffset}
              onHeadingClick={onHeadingClick}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentOutline({ markdown, onHeadingClick, currentOffset = 0 }) {
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const tree = useMemo(() => buildHeadingTree(headings), [headings]);

  if (headings.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-text-tertiary text-center">
        <List size={20} className="mx-auto mb-2 opacity-50" />
        <p>헤딩이 없습니다</p>
      </div>
    );
  }

  // 현재 스크롤 위치에 가장 가까운 헤딩 찾기
  const activeHeading = headings.reduce((prev, curr) => 
    (curr.offset <= currentOffset && curr.offset > (prev?.offset || 0)) ? curr : prev,
    null
  );

  return (
    <div className="p-3 overflow-y-auto max-h-full">
      <div className="flex items-center gap-2 mb-3 px-2">
        <List size={16} className="text-gray-400 dark:text-text-tertiary" />
        <h3 className="text-xs font-bold text-gray-500 dark:text-text-tertiary uppercase tracking-wide">
          목차
        </h3>
      </div>
      <div className="space-y-0.5">
        {tree.map((node, idx) => (
          <HeadingNode
            key={idx}
            node={node}
            activeOffset={activeHeading?.offset || -1}
            onHeadingClick={onHeadingClick}
          />
        ))}
      </div>
    </div>
  );
}

export default DocumentOutline;
