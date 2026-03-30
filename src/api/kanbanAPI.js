/**
 * @fileoverview Supabase PostgreSQL CRUD 레이어. 모든 함수는 Supabase JS Client 직접 호출.
 *
 * 패턴: const { data, error } = await supabase.from('table').method()
 *       if (error) throw error;
 *
 * order_index 관리: 이동 시 영향받는 배열 전체를 재계산하여 upsert. gap 없이 0부터 연속.
 * cross-phase moveItem: source/target 두 phase 배열 모두 갱신.
 * related_items: A→B 추가 시 B→A도 자동 추가 (양방향).
 */
import { supabase } from '../lib/supabase';

const normalizeNameKey = (value) => (value || '').trim().toLowerCase();

const supabaseAPI = {
  /**
   * @description 전체 보드 데이터를 단일 조회로 로드. projects + items(with comments) + sections.
   * page_type='page' 아이템은 포함됨 (useKanbanData reducer에서 필터링).
   * @returns {Promise<{ phases: Array, sections: Array }>}
   * phases: 각 project에 items 배열 내장, items에 comments(with profiles) 배열 내장
   */
  getBoardData: async () => {
    // 1. 프로젝트 가져오기
    const { data: projects, error: pError } = await supabase
      .from('projects')
      .select('*')
      .order('order_index', { ascending: true });

    if (pError) throw pError;

    // 2. 아이템과 댓글(작성자 이름 포함) 가져오기
    const { data: items, error: iError } = await supabase
      .from('items')
      .select(`
        *,
        comments (
          *,
          profiles (name, department)
        )
      `)
      .order('order_index', { ascending: true });

    if (iError) throw iError;

    // 3. 섹션 가져오기
    const { data: sections, error: sError } = await supabase
      .from('sections')
      .select('*')
      .order('order_index', { ascending: true });
    if (sError) throw sError;

    // 4. 트리 구조로 조립
    const formattedProjects = projects.map(project => ({
      ...project,
      assignees: Array.isArray(project.assignees) ? project.assignees : [],
      items: items
        .filter(item => item.project_id === project.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => ({
          ...item,
          related_items: Array.isArray(item.related_items) ? item.related_items : [],
          comments: (item.comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        }))
    }));

    return { phases: formattedProjects, sections: sections || [] };
  },

  getPeopleData: async () => {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, department')
      .order('name', { ascending: true });

    if (profileError) throw profileError;

    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, title, board_type');

    if (projectError) throw projectError;

    const { data: items, error: itemError } = await supabase
      .from('items')
      .select('id, title, status, assignees, project_id')
      .order('order_index', { ascending: true });

    if (itemError) throw itemError;

    const phaseMap = new Map((projects || []).map((project) => [project.id, project]));
    const membersByName = new Map();
    const teamsByName = new Map();
    const unassignedTeamName = '미분류';

    (profiles || []).forEach((profile) => {
      const memberName = (profile.name || '').trim();
      if (!memberName) return;

      const key = normalizeNameKey(memberName);
      const department = (profile.department || '').trim() || unassignedTeamName;

      const member = {
        id: profile.id,
        name: memberName,
        department,
        tasks: [],
      };

      if (!membersByName.has(key)) {
        membersByName.set(key, []);
      }
      membersByName.get(key).push(member);

      if (!teamsByName.has(department)) {
        teamsByName.set(department, []);
      }
      teamsByName.get(department).push(member);
    });

    (items || []).forEach((item) => {
      const assignees = Array.isArray(item.assignees) ? item.assignees : [];
      if (assignees.length === 0) return;

      const project = phaseMap.get(item.project_id);
      const task = {
        id: item.id,
        title: item.title || '제목 없음',
        status: item.status || 'none',
        projectId: item.project_id,
        projectTitle: project?.title || '미지정 프로젝트',
        boardType: project?.board_type || 'main',
      };

      assignees.forEach((assigneeName) => {
        const cleanName = (assigneeName || '').trim();
        if (!cleanName) return;

        const key = normalizeNameKey(cleanName);
        const linkedMembers = membersByName.get(key);

        if (linkedMembers && linkedMembers.length > 0) {
          linkedMembers.forEach((member) => {
            member.tasks.push(task);
          });
          return;
        }

        if (!teamsByName.has(unassignedTeamName)) {
          teamsByName.set(unassignedTeamName, []);
        }

        const fallbackMembers = teamsByName.get(unassignedTeamName);
        let fallbackMember = fallbackMembers.find((m) => m.id === `name:${cleanName}`);
        if (!fallbackMember) {
          fallbackMember = {
            id: `name:${cleanName}`,
            name: cleanName,
            department: unassignedTeamName,
            tasks: [],
          };
          fallbackMembers.push(fallbackMember);
        }
        fallbackMember.tasks.push(task);
      });
    });

    const teams = Array.from(teamsByName.entries())
      .map(([teamName, members]) => ({
        teamName,
        members: [...members].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko-KR'));

    return { teams };
  },

  addPhase: async (title, boardType = 'main', sectionId = null) => {
    const { data: existingProjects } = await supabase.from('projects').select('order_index').order('order_index', { ascending: false }).limit(1);
    const nextOrder = existingProjects?.[0] ? existingProjects[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from('projects')
      .insert([{ title, order_index: nextOrder, board_type: boardType, assignees: [], section_id: sectionId }])
      .select();

    if (error) throw error;
    return data[0];
  },

  updatePhase: async (phaseId, updates) => {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', phaseId)
      .select();

    if (error) throw error;
    return data[0];
  },

  deletePhase: async (phaseId) => {
    const { error } = await supabase.from('projects').delete().eq('id', phaseId);
    if (error) throw error;
  },

  movePhase: async (phaseId, targetIndex) => {
    const { data: projects } = await supabase.from('projects').select('id, order_index').order('order_index', { ascending: true });
    const movingProjectIdx = projects.findIndex(p => p.id === phaseId);
    const [movingProject] = projects.splice(movingProjectIdx, 1);
    projects.splice(targetIndex, 0, movingProject);

    const updatePromises = projects.map((p, idx) =>
      supabase.from('projects').update({ order_index: idx }).eq('id', p.id)
    );
    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  addItem: async (phaseId, title, content = '') => {
    const { data: existingItems } = await supabase.from('items').select('order_index').eq('project_id', phaseId).order('order_index', { ascending: false }).limit(1);
    const nextOrder = existingItems?.[0] ? existingItems[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from('items')
      .insert([{
        project_id: phaseId,
        title,
        content,
        order_index: nextOrder,
        status: 'none',
        teams: [],
        assignees: [],
        tags: [],
        related_items: []
      }])
      .select();

    if (error) throw error;
    return data[0];
  },

  updateItem: async (phaseId, itemId, updates) => {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  deleteItem: async (phaseId, itemId) => {
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (error) throw error;
  },

  /**
   * @description 아이템을 다른 phase로 이동하거나 같은 phase 내에서 재정렬.
   * source와 target phase 양쪽의 order_index 전체를 재계산하여 upsert.
   * @param {string} sourcePhaseId
   * @param {string} targetPhaseId - sourcePhaseId와 같으면 재정렬
   * @param {string} itemId
   * @param {number} targetIndex - 0-based 삽입 위치
   */
  moveItem: async (sourcePhaseId, targetPhaseId, itemId, targetIndex) => {
    const { data: targetItems } = await supabase
      .from('items')
      .select('id, order_index')
      .eq('project_id', targetPhaseId)
      .order('order_index', { ascending: true });

    const movingItemIdx = targetItems.findIndex(i => i.id === itemId);
    let newItems = [...targetItems];

    if (movingItemIdx !== -1) {
      const [movingItem] = newItems.splice(movingItemIdx, 1);
      newItems.splice(targetIndex, 0, movingItem);
    } else {
      newItems.splice(targetIndex, 0, { id: itemId });
    }

    const updatePromises = newItems.map((item, idx) =>
      supabase.from('items').update({
        project_id: targetPhaseId,
        order_index: idx
      }).eq('id', item.id)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  addComment: async (phaseId, itemId, content) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('comments')
      .insert([{ 
        item_id: itemId, 
        user_id: userData.user.id,
        content 
      }])
      .select(`
        *,
        profiles (name, department)
      `);
    
    if (error) throw error;
    return data[0];
  },

  updateComment: async (phaseId, itemId, commentId, updates) => {
    const { data, error } = await supabase
      .from('comments')
      .update(updates)
      .eq('id', commentId)
      .select(`
        *,
        profiles (name, department)
      `);
    
    if (error) throw error;
    return data[0];
  },

  deleteComment: async (phaseId, itemId, commentId) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) throw error;
  },

  addSection: async (boardType, title) => {
    const { data: existing } = await supabase
      .from('sections')
      .select('order_index')
      .eq('board_type', boardType)
      .order('order_index', { ascending: false })
      .limit(1);
    const nextOrder = existing?.[0] ? existing[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from('sections')
      .insert([{ board_type: boardType, title, order_index: nextOrder }])
      .select();
    if (error) throw error;
    return data[0];
  },

  updateSection: async (sectionId, updates) => {
    const { data, error } = await supabase
      .from('sections')
      .update(updates)
      .eq('id', sectionId)
      .select();
    if (error) throw error;
    return data[0];
  },

  deleteSection: async (sectionId) => {
    await supabase.from('projects').update({ section_id: null }).eq('section_id', sectionId);
    const { error } = await supabase.from('sections').delete().eq('id', sectionId);
    if (error) throw error;
  },

  moveSection: async (sectionId, targetIndex, boardType) => {
    const { data: secs } = await supabase
      .from('sections')
      .select('id, order_index')
      .eq('board_type', boardType)
      .order('order_index', { ascending: true });

    const movingIdx = secs.findIndex(s => s.id === sectionId);
    const [moving] = secs.splice(movingIdx, 1);
    secs.splice(targetIndex, 0, moving);

    const results = await Promise.all(
      secs.map((s, idx) => supabase.from('sections').update({ order_index: idx }).eq('id', s.id))
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  // ========== 타임라인 전용 함수 ==========

  /**
   * @description 타임라인 뷰에서 섹션 순서 변경. order_index가 아닌 timeline_order_index 사용.
   * @param {string} sectionId 
   * @param {string} boardType 
   * @param {number} targetIndex - 0-based 타임라인 내 목표 위치
   */
  moveSectionTimeline: async (sectionId, boardType, targetIndex) => {
    const { data: secs } = await supabase
      .from('sections')
      .select('id, timeline_order_index')
      .eq('board_type', boardType)
      .order('timeline_order_index', { ascending: true });

    const movingIdx = secs.findIndex(s => s.id === sectionId);
    if (movingIdx === -1) throw new Error('Section not found');
    
    const [moving] = secs.splice(movingIdx, 1);
    secs.splice(targetIndex, 0, moving);

    const results = await Promise.all(
      secs.map((s, idx) => supabase.from('sections').update({ timeline_order_index: idx }).eq('id', s.id))
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  /**
   * @description 타임라인 뷰에서 프로젝트 순서 변경. 같은 섹션 내에서만 이동 가능.
   * @param {string} phaseId 
   * @param {string} sectionId - 속한 섹션 ID (null 허용)
   * @param {number} targetIndex - 0-based 타임라인 내 목표 위치
   */
  movePhaseTimeline: async (phaseId, sectionId, targetIndex) => {
    let query = supabase
      .from('projects')
      .select('id, timeline_order_index')
      .order('timeline_order_index', { ascending: true });

    // sectionId가 null이면 null 프로젝트끼리만, 있으면 같은 섹션 내에서만
    if (sectionId === null) {
      query = query.is('section_id', null);
    } else {
      query = query.eq('section_id', sectionId);
    }

    const { data: phases } = await query;
    const movingIdx = phases.findIndex(p => p.id === phaseId);
    if (movingIdx === -1) throw new Error('Project not found in section');
    
    const [moving] = phases.splice(movingIdx, 1);
    phases.splice(targetIndex, 0, moving);

    const results = await Promise.all(
      phases.map((p, idx) => supabase.from('projects').update({ timeline_order_index: idx }).eq('id', p.id))
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  /**
   * @description 타임라인 뷰에서 아이템 순서 변경. 같은 프로젝트 내에서만 이동 가능.
   * @param {string} itemId 
   * @param {string} projectId - 속한 프로젝트 ID
   * @param {number} targetIndex - 0-based 타임라인 내 목표 위치
   */
  moveItemTimeline: async (itemId, projectId, targetIndex) => {
    const { data: items } = await supabase
      .from('items')
      .select('id, timeline_order_index')
      .eq('project_id', projectId)
      .order('timeline_order_index', { ascending: true });

    const movingIdx = items.findIndex(i => i.id === itemId);
    if (movingIdx === -1) throw new Error('Item not found in project');
    
    const [moving] = items.splice(movingIdx, 1);
    items.splice(targetIndex, 0, moving);

    const results = await Promise.all(
      items.map((item, idx) => supabase.from('items').update({ timeline_order_index: idx }).eq('id', item.id))
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },
};

export default supabaseAPI;

/**
 * @description page_type='page' 아이템 생성 + 부모 아이템의 related_items에 양방향 연결.
 * 칸반 카드가 아닌 문서 페이지 생성. 사이드바 트리에만 표시됨.
 * @param {string} projectId - 속할 project(phase) ID
 * @param {string} parentItemId - 부모 아이템 (related_items 양방향 연결)
 * @param {string} title
 * @returns {Promise<Object>} 생성된 item 객체
 */
/**
 * @description 하위 페이지 생성. 부모의 속성(팀, 태그 등)을 상속받을 수 있음.
 * @param {string} projectId - 소속 프로젝트 ID
 * @param {string} parentItemId - 부모 아이템 ID
 * @param {string} title - 페이지 제목
 * @param {Object} inheritedProps - { teams: string[], tags: string[] } 상속받을 속성
 * @returns {Promise<Object>} 생성된 아이템 객체
 */
export async function createChildPage(projectId, parentItemId, title, inheritedProps = {}) {
  const { data: existing } = await supabase
    .from('items')
    .select('order_index')
    .eq('parent_item_id', parentItemId)
    .order('order_index', { ascending: false })
    .limit(1);

  const nextOrder = existing?.length > 0 ? existing[0].order_index + 1 : 0;

  const { data, error } = await supabase
    .from('items')
    .insert([{
      project_id: projectId,
      parent_item_id: parentItemId,
      title,
      page_type: 'page',
      status: 'none',
      assignees: [],
      teams: inheritedProps.teams || [],
      tags: inheritedProps.tags || [],
      related_items: [],
      order_index: nextOrder,
    }])
    .select();

  if (error) throw error;
  return data[0];
}

// NOTE: 현재 미사용. usePageTree 훅이 이미 로드된 phases 데이터에서
// 하위 페이지를 파생하므로 직접 API 호출이 필요없음.
// 향후 on-demand 로딩 시 사용 예정.
export async function getChildPages(parentItemId) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('parent_item_id', parentItemId)
    .eq('page_type', 'page')
    .order('order_index');
  if (error) throw error;
  return data;
}
