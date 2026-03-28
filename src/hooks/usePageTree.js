import { useMemo } from 'react';

export function usePageTree(phases, sections) {
  return useMemo(() => {
    // 1. 모든 page 타입 아이템 수집
    const allPages = phases.flatMap(p =>
      (p.items || []).filter(item => item.page_type === 'page')
    );

    // 2. parentItemId → children 맵 구성
    const childMap = {};
    allPages.forEach(item => {
      const pid = item.parent_item_id || null;
      if (pid !== null) {
        if (!childMap[pid]) childMap[pid] = [];
        childMap[pid].push(item);
      }
    });

    // 3. 재귀적으로 트리 노드 빌드
    function buildTree(parentId) {
      return (childMap[parentId] || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => ({
          ...item,
          children: buildTree(item.id),
        }));
    }

    // 4. main 보드가 아닌 phase들만 필터링하여 page children 붙이기
    const phasesWithTree = phases
      .filter(p => p.board_type !== 'main')
      .map(phase => ({
        ...phase,
        pageChildren: (phase.items || [])
          .filter(item => item.page_type === 'page' && !item.parent_item_id)
          .sort((a, b) => a.order_index - b.order_index)
          .map(item => ({ ...item, children: buildTree(item.id) })),
      }));

    // 5. board_type별 그룹핑
    const boardTypes = [...new Set([
      ...phasesWithTree.map(p => p.board_type),
      ...sections.filter(s => s.board_type !== 'main').map(s => s.board_type)
    ])].filter(Boolean);

    const boards = boardTypes.map(boardType => {
      const boardSections = sections
        .filter(s => s.board_type === boardType)
        .sort((a, b) => a.order_index - b.order_index)
        .map(section => ({
          ...section,
          phases: phasesWithTree
            .filter(p => p.section_id === section.id)
            .sort((a, b) => a.order_index - b.order_index)
        }));

      const standalonePhases = phasesWithTree
        .filter(p => p.board_type === boardType && !p.section_id)
        .sort((a, b) => a.order_index - b.order_index);

      return {
        id: `board-${boardType}`,
        title: boardType,
        sections: boardSections,
        standalone: standalonePhases,
      };
    });

    return boards.sort((a, b) => a.title.localeCompare(b.title, 'ko-KR'));
  }, [phases, sections]);
}

