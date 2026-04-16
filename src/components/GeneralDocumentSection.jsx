/**
 * @fileoverview [일반 문서] 섹션 - 보드에서 렌더링합니다.
 * 팀별 보드의 project_id=null, page_type='page'인 문서들을 표시합니다.
 * parent_item_id로 계층 구조(폴더)를 지원합니다.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

const stopProp = (event) => event.stopPropagation();

function GeneralDocumentSection({
  documents = [],
  onOpenDetail,
  onDeleteDocument,
  onMoveToFolder,
  onAddDocumentToFolder,
  onTogglePinDocument,
  pinnedDocIds = [],
  isReadOnly = false,
}) {
  // 각 문서별 펼침 상태 (폴더 같은 구조)
  const [expandedDocs, setExpandedDocs] = useState(new Set());
  // 드롭다운 메뉴 상태 (어떤 문서의 메뉴가 열려있는지 추적)
  const [openMenuId, setOpenMenuId] = useState(null);
  // 메뉴 컨테이너 참조
  const menuContainerRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!openMenuId) return undefined;

    const handleClickOutside = (event) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

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

  const renderMenu = (doc) => (
    <div className="absolute left-0 top-full z-20 mt-2 min-w-[188px] overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-white/8 dark:bg-[#151515] dark:shadow-[0_16px_32px_rgba(0,0,0,0.45)]">
      {doc.page_type === 'folder' ? (
        <button
          type="button"
          className="block w-full px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-white/5"
          onClick={() => {
            onAddDocumentToFolder?.(doc.id);
            setOpenMenuId(null);
          }}
        >
          + 폴더 내 문서 추가
        </button>
      ) : (
        <button
          type="button"
          className="block w-full px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-white/5"
          onClick={() => {
            onTogglePinDocument?.(doc.id, !pinnedDocIds.includes(doc.id));
            setOpenMenuId(null);
          }}
        >
          {pinnedDocIds.includes(doc.id) ? '📌 고정 해제' : '📍 보드 안내에 고정'}
        </button>
      )}

      {doc.page_type !== 'folder' && (
        <button
          type="button"
          className="block w-full px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-white/5"
          onClick={() => {
            onMoveToFolder?.(doc.id);
            setOpenMenuId(null);
          }}
        >
          ↪ 폴더로 이동
        </button>
      )}

      <button
        type="button"
        className="block w-full px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
        onClick={() => {
          onDeleteDocument?.(doc.id);
          setOpenMenuId(null);
        }}
      >
        ⨯ 삭제
      </button>
    </div>
  );

  const renderDocTree = (docs, depth = 0) => {
    return docs.map(doc => (
      <div key={doc.id} className="general-doc-tree-node">
        <div
        className={`group relative flex items-center rounded-xl border px-2.5 py-2 transition-all duration-150 ${
            doc.page_type === 'folder'
              ? 'border-amber-200/80 bg-amber-50/75 dark:border-amber-500/20 dark:bg-[#171411]'
              : 'border-gray-200/90 bg-white/90 hover:border-gray-300 hover:bg-gray-50/90 dark:border-white/8 dark:bg-[#161616] dark:hover:border-white/12 dark:hover:bg-[#1b1b1b]'
          }`}
          style={{ marginLeft: `${depth * 1.1}rem` }}
        >
          {/* 폴더 펼침 버튼 - 폴더이거나 자식이 있을 때 표시 */}
          {(doc.page_type === 'folder' || doc.children.length > 0) && (
            <button
              className="mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-gray-500 transition-colors hover:text-gray-800 dark:bg-[#202020] dark:text-zinc-500 dark:hover:bg-[#262626] dark:hover:text-zinc-200"
              onClick={() => {
                setExpandedDocs(prev => {
                  const next = new Set(prev);
                  next.has(doc.id) ? next.delete(doc.id) : next.add(doc.id);
                  return next;
                });
              }}
              title="펼치기"
            >
              <span className="text-gray-400 dark:text-text-tertiary">
                {expandedDocs.has(doc.id) ? '▼' : '▶'}
              </span>
            </button>
          )}

          {/* 폴더가 아니고 자식도 없으면 공간 차지 */}
          {doc.page_type !== 'folder' && doc.children.length === 0 && (
            <div className="mr-1 w-7 flex-shrink-0" />
          )}

          {/* 문서 아이콘 및 제목 - page_type으로 폴더/문서 구분 */}
          {doc.page_type === 'folder' ? (
            <div className="document-link flex min-w-0 flex-1 items-center text-sm text-gray-800 dark:text-zinc-100">
              <span className="shrink-0 text-base">📁</span>
              <span className="ml-2 truncate text-[14px] font-bold tracking-[-0.01em]">{doc.title}</span>
              {doc.children.length > 0 && (
                <span className="ml-2 shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  {doc.children.length}
                </span>
              )}

              {!isReadOnly && (
                <div
                  className="relative ml-3 flex flex-shrink-0 items-center"
                  ref={openMenuId === doc.id ? menuContainerRef : null}
                  onClick={stopProp}
                  onPointerDown={stopProp}
                >
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 dark:bg-[#202020] dark:text-zinc-500 dark:hover:bg-[#262626] dark:hover:text-zinc-100"
                    onClick={() => setOpenMenuId(prev => (prev === doc.id ? null : doc.id))}
                    title="메뉴"
                    aria-label={`"${doc.title}" 메뉴`}
                  >
                    ⋮
                  </button>

                  {openMenuId === doc.id && renderMenu(doc)}
                </div>
              )}
            </div>
          ) : (
            <div className="document-link flex min-w-0 flex-1 items-center text-sm text-gray-700 dark:text-zinc-100">
              <a
                href={`?item=${doc.id}`}
                className="flex min-w-0 items-center text-inherit no-underline hover:text-inherit"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenDetail?.(doc.id);
                }}
                title={doc.title}
              >
                <span className="shrink-0 text-base">📄</span>
                <span className="ml-2 truncate text-[14px] font-medium tracking-[-0.01em]">{doc.title}</span>
              </a>

              {pinnedDocIds.includes(doc.id) && (
                <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  고정
                </span>
              )}

              {!isReadOnly && (
                <div
                  className="relative ml-3 flex flex-shrink-0 items-center"
                  ref={openMenuId === doc.id ? menuContainerRef : null}
                  onClick={stopProp}
                  onPointerDown={stopProp}
                >
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100/80 text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-800 dark:bg-[#202020] dark:text-zinc-500 dark:hover:bg-[#262626] dark:hover:text-zinc-100"
                    onClick={() => setOpenMenuId(prev => (prev === doc.id ? null : doc.id))}
                    title="메뉴"
                    aria-label={`"${doc.title}" 메뉴`}
                  >
                    ⋮
                  </button>

                  {openMenuId === doc.id && renderMenu(doc)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 자식 문서 - 펼쳤을 때만 표시 */}
        {expandedDocs.has(doc.id) && doc.children.length > 0 && (
          <div className="ml-5 mt-2 space-y-2 border-l border-dashed border-gray-300/90 pl-3 dark:border-white/8">
            {renderDocTree(doc.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="general-documents-container rounded-2xl border border-gray-200/90 bg-white p-2.5 shadow-sm dark:border-white/8 dark:bg-[#0f0f0f]">
      {documents.length === 0 ? (
        <p className="empty-message rounded-xl border border-dashed border-gray-200 px-3 py-6 text-sm text-gray-500 dark:border-white/8 dark:text-zinc-500">
          아직 일반 문서가 없습니다
        </p>
      ) : (
        <div className="general-doc-list space-y-2">
          {renderDocTree(docStructure)}
        </div>
      )}

      <style>{`
        .general-documents-container {
          width: 100%;
        }
        .general-doc-tree-node {
          margin-bottom: 0;
        }

        .general-doc-tree-node .document-link {
          color: inherit;
          text-decoration: none;
        }

        .general-doc-tree-node .document-link:hover {
          color: inherit;
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
