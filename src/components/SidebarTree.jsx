import { memo } from 'react';
import { ChevronRight, Plus, GripVertical } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const stopProp = (e) => e.stopPropagation();

const SortableTreeItem = memo(function SortableTreeItem({
  node,
  depth,
  expandedIds,
  onToggle,
  activeItemId,
  onSelectItem,
  onAddChild,
  isReadOnly,
  dragOverInfo,
}) {
  const isProject = Array.isArray(node.pageChildren);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const children = node.pageChildren || node.children || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds?.has(node.id);
  const isActive = activeItemId === node.id;

  const paddingLeft = depth * 12 + 4;

  const handleClick = (e) => {
    e.stopPropagation();
    onSelectItem?.(node.id);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggle?.(node.id);
  };

  const handleAddChild = (e) => {
    e.stopPropagation();
    onAddChild?.(isProject ? null : node.id, isProject ? node.id : node.project_id ?? null);
  };

  const label = node.title || node.content || '제목 없음';
  const icon = isProject ? '📋' : node.page_type === 'folder' ? '📁' : '📄';
  const isOver = dragOverInfo?.id === node.id;
  const canAddChild = !isReadOnly && Boolean(isProject || node.project_id);

  return (
    <li ref={setNodeRef} style={style} className="select-none list-none">
      {isOver && dragOverInfo.type === 'before' && (
        <div className="h-0.5 bg-green-400 rounded mx-1" />
      )}
      <div
        className={`group flex items-center gap-1 py-[3px] pr-1 rounded-md cursor-pointer transition-colors duration-100
          ${isActive
            ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400'
            : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-hover)] hover:text-[color:var(--color-text-primary)]'
          }
          ${isOver && dragOverInfo.type === 'inside' ? 'bg-green-100/50 dark:bg-green-900/20' : ''}`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* Drag Handle - visible on hover */}
        {!isReadOnly && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 opacity-0 group-hover:opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5"
          >
            <GripVertical size={12} />
          </div>
        )}

        {/* Arrow toggle */}
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

        {/* + button */}
        {canAddChild && (
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

      {/* Recursive children with their own SortableContext */}
      {hasChildren && isExpanded && (
        <div className="ml-0">
          <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <SidebarTree
              nodes={children}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              activeItemId={activeItemId}
              onSelectItem={onSelectItem}
              onAddChild={onAddChild}
              isReadOnly={isReadOnly}
              dragOverInfo={dragOverInfo}
            />
          </SortableContext>
        </div>
      )}
      {isOver && dragOverInfo.type === 'after' && (
        <div className="h-0.5 bg-green-400 rounded mx-1" />
      )}
    </li>
  );
});

const SidebarTree = memo(function SidebarTree({
  nodes = [],
  depth = 0,
  expandedIds,
  onToggle,
  activeItemId,
  onSelectItem,
  onAddChild,
  isReadOnly = false,
  dragOverInfo = null,
}) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <ul className="list-none m-0 p-0">
      <SortableContext items={nodes.map(n => n.id)} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => (
          <SortableTreeItem
            key={node.id}
            node={node}
            depth={depth}
            expandedIds={expandedIds}
            onToggle={onToggle}
            activeItemId={activeItemId}
            onSelectItem={onSelectItem}
            onAddChild={onAddChild}
            isReadOnly={isReadOnly}
            dragOverInfo={dragOverInfo}
          />
        ))}
      </SortableContext>
    </ul>
  );
});

export default SidebarTree;
