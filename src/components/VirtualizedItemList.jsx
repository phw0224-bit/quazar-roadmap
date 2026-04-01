/**
 * @fileoverview 가상 스크롤 아이템 목록. 10개 이상 아이템이 있을 때 성능 최적화를 위해 사용.
 *
 * @tanstack/react-virtual 사용. 각 카드 높이 추정값 150px.
 * DnD와의 호환성 고려: 드래그 시작 시 일시적으로 전체 렌더링으로 전환 가능 (추후 구현).
 */
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';

export default function VirtualizedItemList({
  items,
  phaseId,
  onUpdateItem,
  onDeleteItem,
  onOpenDetail,
  onShowConfirm,
  onShowToast,
  isReadOnly = false,
}) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 166, // 카드 높이 150px + gap 16px
    overscan: 2, // 위아래 2개씩 추가 렌더링
    gap: 16, // 카드 간격 (tailwind gap-4와 동일)
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto no-scrollbar">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy} disabled={isReadOnly}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <KanbanCard
                  item={item}
                  itemIndex={virtualItem.index + 1}
                  phaseId={phaseId}
                  onUpdateItem={onUpdateItem}
                  onDeleteItem={onDeleteItem}
                  onOpenDetail={onOpenDetail}
                  onShowConfirm={onShowConfirm}
                  onShowToast={onShowToast}
                  isReadOnly={isReadOnly}
                />
              </div>
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
}
