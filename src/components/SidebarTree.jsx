import { ChevronRight, Plus } from 'lucide-react';

const stopProp = (e) => e.stopPropagation();

export default function SidebarTree({
  nodes = [],
  depth = 0,
  expandedIds,
  onToggle,
  activeItemId,
  onSelectItem,
  onAddChild,
  isReadOnly = false,
}) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <ul className="list-none m-0 p-0">
      {nodes.map((node) => {
        const children = depth === 0 ? (node.pageChildren || []) : (node.children || []);
        const hasChildren = children.length > 0;
        const isExpanded = expandedIds?.has(node.id);
        const isActive = activeItemId === node.id;
        const isPhase = depth === 0;

        const paddingLeft = depth * 12 + 8;

        const handleClick = (e) => {
          e.stopPropagation();
          if (!isPhase) {
            onSelectItem?.(node.id);
          }
        };

        const handleToggle = (e) => {
          e.stopPropagation();
          onToggle?.(node.id);
        };

        const handleAddChild = (e) => {
          e.stopPropagation();
          onAddChild?.(isPhase ? null : node.id, isPhase ? node.id : node.project_id ?? null);
        };

        const label = node.title || node.content || '제목 없음';
        const icon = isPhase ? '📋' : '📄';

        return (
          <li key={node.id} className="select-none">
            <div
              className={`group flex items-center gap-1 py-[3px] pr-1 rounded-md cursor-pointer transition-colors duration-100
                ${isActive
                  ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400'
                  : isPhase
                    ? 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)]'
                    : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)]'
                }`}
              style={{ paddingLeft }}
              onClick={handleClick}
              onPointerDown={stopProp}
            >
              {/* Arrow toggle — occupies fixed width so alignment is consistent */}
              <span
                className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-transform duration-150
                  ${hasChildren ? 'opacity-60 hover:opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'}
                  ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                onClick={hasChildren ? handleToggle : undefined}
                onPointerDown={stopProp}
              >
                <ChevronRight size={12} strokeWidth={2.5} />
              </span>

              {/* Icon */}
              <span className="flex-shrink-0 text-[13px] leading-none" aria-hidden="true">
                {icon}
              </span>

              {/* Title */}
              <span
                className={`flex-1 text-[13px] font-medium leading-tight truncate min-w-0
                  ${isActive ? 'text-blue-500 dark:text-blue-400' : ''}`}
                title={label}
              >
                {label}
              </span>

              {/* + button — visible on group hover, hidden for readOnly */}
              {!isReadOnly && (
                <button
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded
                    text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)]
                    hover:bg-[color:var(--color-bg-hover)] transition-all duration-100 cursor-pointer"
                  onClick={handleAddChild}
                  onPointerDown={stopProp}
                  title="하위 페이지 추가"
                >
                  <Plus size={11} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Recursive children */}
            {hasChildren && isExpanded && (
              <SidebarTree
                nodes={children}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
                activeItemId={activeItemId}
                onSelectItem={onSelectItem}
                onAddChild={onAddChild}
                isReadOnly={isReadOnly}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
