/**
 * @fileoverview [일반 문서] 섹션 - 보드에서 렌더링합니다.
 * 팀별 보드의 project_id=null, page_type='page'인 문서들을 표시합니다.
 * parent_item_id로 계층 구조(폴더)를 지원합니다.
 */

import React, { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';

function GeneralDocumentSection({
  documents = [],
  onOpenDetail,
  onDeleteDocument,
  onMoveToFolder,
  onAddDocumentToFolder,
  isReadOnly = false,
}) {
  // 각 문서별 펼침 상태 (폴더 같은 구조)
  const [expandedDocs, setExpandedDocs] = useState(new Set());

  // parent_item_id 기준으로 문서 구조화
  const docStructure = useMemo(() => {
    const map = new Map();
    documents.forEach(doc => {
      map.set(doc.id, { ...doc, children: [] });
    });

    const roots = [];
    documents.forEach(doc => {
      if (!doc.parent_item_id) {
        roots.push(map.get(doc.id));
      } else if (map.has(doc.parent_item_id)) {
        map.get(doc.parent_item_id).children.push(map.get(doc.id));
      }
    });

    return roots;
  }, [documents]);

  const renderDocTree = (docs, depth = 0) => {
    return docs.map(doc => (
      <div key={doc.id} className="general-doc-tree-node">
        <div className="group flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
          {/* 폴더 펼침 버튼 - 폴더이거나 자식이 있을 때 표시 */}
          {(doc.page_type === 'folder' || doc.children.length > 0) && (
            <button
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 dark:text-text-tertiary hover:text-gray-600 dark:hover:text-text-secondary transition-colors"
              onClick={() => {
                setExpandedDocs(prev => {
                  const next = new Set(prev);
                  next.has(doc.id) ? next.delete(doc.id) : next.add(doc.id);
                  return next;
                });
              }}
              title="펼치기"
            >
              <ChevronRight
                size={14}
                className={`transition-transform duration-150 ${expandedDocs.has(doc.id) ? 'rotate-90' : ''}`}
              />
            </button>
          )}

          {/* 폴더가 아니고 자식도 없으면 공간 차지 */}
          {doc.page_type !== 'folder' && doc.children.length === 0 && (
            <div className="w-5 flex-shrink-0" />
          )}

          {/* 문서 아이콘 및 제목 - page_type으로 폴더/문서 구분 */}
          {doc.page_type === 'folder' ? (
            <div className="document-link flex-1 flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-text-primary rounded no-underline">
              <span className="text-sm">📁</span>
              <span className="truncate flex-1">{doc.title}</span>
            </div>
          ) : (
            <a
              href={`?item=${doc.id}`}
              className="document-link flex-1 flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-text-primary hover:bg-gray-50 dark:hover:bg-bg-hover rounded transition-colors no-underline"
              onClick={(e) => {
                e.preventDefault();
                onOpenDetail?.(doc);
              }}
              title={doc.title}
            >
              <span className="text-sm">📄</span>
              <span className="truncate flex-1">{doc.title}</span>
            </a>
          )}

          {/* 폴더 내 문서 추가 버튼 (폴더만) */}
          {!isReadOnly && doc.page_type === 'folder' && (
            <button
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-1 text-gray-400 dark:text-text-tertiary hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onAddDocumentToFolder?.(doc.id);
              }}
              title="이 폴더에 문서 추가"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`"${doc.title}"에 문서 추가`}
            >
              <span>➕</span>
            </button>
          )}

          {/* 이동 버튼 (문서만) */}
          {!isReadOnly && doc.page_type !== 'folder' && (
            <button
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-1 text-gray-400 dark:text-text-tertiary hover:text-blue-500 dark:hover:text-blue-400"
              onClick={(e) => {
                e.stopPropagation();
                onMoveToFolder?.(doc.id);
              }}
              title="폴더로 이동"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`"${doc.title}" 이동`}
            >
              ↪
            </button>
          )}

          {/* 삭제 버튼 */}
          {!isReadOnly && (
            <button
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-1 text-gray-400 dark:text-text-tertiary hover:text-red-500 dark:hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteDocument?.(doc.id);
              }}
              title="삭제"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`"${doc.title}" 삭제`}
            >
              ⨯
            </button>
          )}
        </div>

        {/* 자식 문서 - 펼쳤을 때만 표시 */}
        {expandedDocs.has(doc.id) && doc.children.length > 0 && (
          <div className="border-l border-gray-200 dark:border-border-subtle ml-4">
            {renderDocTree(doc.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="general-documents-container">
      {documents.length === 0 ? (
        <p className="empty-message px-3 py-2 text-sm text-gray-500 dark:text-text-tertiary">
          아직 일반 문서가 없습니다
        </p>
      ) : (
        <div className="general-doc-list">
          {renderDocTree(docStructure)}
        </div>
      )}

      <style>{`
        .general-documents-container {
          width: 100%;
        }

        .general-doc-list {
          space-y: 0.25rem;
        }

        .general-doc-tree-node {
          margin-bottom: 0;
        }

        .general-doc-tree-node:hover button[aria-label*="삭제"] {
          opacity: 1;
        }

        .general-doc-tree-node .document-link {
          color: inherit;
          text-decoration: none;
        }

        .general-doc-tree-node .document-link:hover {
          background-color: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .empty-message {
          text-align: center;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default GeneralDocumentSection;
