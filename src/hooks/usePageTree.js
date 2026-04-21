/**
 * @fileoverview projects와 sections를 Sidebar 네비게이션용 계층 트리로 변환.
 *
 * 입력: projects[] + sections[] + generalDocs[] (useKanbanData 상태)
 * 출력: board_type별 그룹 → sections → projects 구조 + generalDocs
 *
 * 모든 items를 트리에 포함 (page_type 무관: task, page, null, folder)
 * parent_item_id를 따라 재귀적으로 자식 items 연결.
 */
import { useMemo } from 'react';

export function usePageTree(projects, sections, generalDocs = []) {
  return useMemo(() => {
    const isLegacyRequestDoc = (doc) => doc?.entity_type === 'request' || (Array.isArray(doc?.tags) && doc.tags.includes('request'));

    // 1. 모든 items 수집 (page_type 무관)
    const allItems = projects.flatMap(p => p.items || []);

    // 2. parentItemId → children 맵 구성
    const childMap = {};
    allItems.forEach(item => {
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

    // 4. main 보드가 아닌 phase들만 필터링하여 모든 children 붙이기
    const projectsWithTree = projects
      .filter(p => p.board_type !== 'main')
      .map(project => ({
        ...project,
        pageChildren: (project.items || [])
          .filter(item => !item.parent_item_id)  // 루트 items만 (page_type 무관)
          .sort((a, b) => a.order_index - b.order_index)
          .map(item => ({ ...item, children: buildTree(item.id) })),
      }));

    // 5. board_type별 그룹핑
    const boardTypes = [...new Set([
      ...projectsWithTree.map(p => p.board_type),
      ...sections.filter(s => s.board_type !== 'main').map(s => s.board_type),
      ...generalDocs.filter(d => (d.board_type || 'main') !== 'main' && !isLegacyRequestDoc(d)).map(d => d.board_type)
    ])].filter(Boolean);

    const boards = boardTypes.map(boardType => {
      const boardSections = sections
        .filter(s => s.board_type === boardType)
        .sort((a, b) => a.order_index - b.order_index)
        .map(section => ({
          ...section,
          projects: projectsWithTree
            .filter(p => p.section_id === section.id)
            .sort((a, b) => a.order_index - b.order_index)
        }));

      const standaloneProjects = projectsWithTree
        .filter(p => p.board_type === boardType && !p.section_id)
        .sort((a, b) => a.order_index - b.order_index);

      const boardGeneralDocs = buildGeneralDocTree(
        generalDocs.filter((d) => (d.board_type || 'main') === boardType && !isLegacyRequestDoc(d))
      );

      return {
        id: `board-${boardType}`,
        title: boardType,
        sections: boardSections,
        standalone: standaloneProjects,
        generalDocs: boardGeneralDocs,
      };
    });

    return boards.sort((a, b) => a.title.localeCompare(b.title, 'ko-KR'));
  }, [projects, sections, generalDocs]);
}
    function buildGeneralDocTree(docs) {
      const childMap = {};
      docs.forEach((doc) => {
        const parentId = doc.parent_item_id || null;
        if (parentId !== null) {
          if (!childMap[parentId]) childMap[parentId] = [];
          childMap[parentId].push(doc);
        }
      });

      function buildNodeChildren(parentId) {
        return (childMap[parentId] || [])
          .sort((a, b) => a.order_index - b.order_index)
          .map((doc) => ({
            ...doc,
            children: buildNodeChildren(doc.id),
          }));
      }

      return docs
        .filter((doc) => !doc.parent_item_id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((doc) => ({
          ...doc,
          children: buildNodeChildren(doc.id),
        }));
    }
