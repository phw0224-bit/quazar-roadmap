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

    // 4. 각 phase에 직계 최상위 page children 붙이기
    // (parent_item_id가 없는 page 타입 아이템들)
    const phasesWithTree = phases.map(phase => ({
      ...phase,
      pageChildren: (phase.items || [])
        .filter(item => item.page_type === 'page' && !item.parent_item_id)
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => ({ ...item, children: buildTree(item.id) })),
    }));

    // 5. section별 그룹핑
    const sectionMap = {};
    const standalone = [];
    phasesWithTree.forEach(phase => {
      if (phase.section_id) {
        if (!sectionMap[phase.section_id]) sectionMap[phase.section_id] = [];
        sectionMap[phase.section_id].push(phase);
      } else {
        standalone.push(phase);
      }
    });

    return {
      sections: sections.map(s => ({
        ...s,
        phases: (sectionMap[s.id] || []).sort((a, b) => a.order_index - b.order_index),
      })),
      standalone: standalone.sort((a, b) => a.order_index - b.order_index),
    };
  }, [phases, sections]);
}
