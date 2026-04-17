/**
 * @fileoverview Supabase PostgreSQL CRUD 레이어. 모든 함수는 Supabase JS Client 직접 호출.
 *
 * 패턴: const { data, error } = await supabase.from('table').method()
 *       if (error) throw error;
 *
 * order_index 관리: 이동 시 영향받는 배열 전체를 재계산하여 upsert. gap 없이 0부터 연속.
 * cross-project moveItem: source/target 두 project 배열 모두 갱신.
 * related_items: A→B 추가 시 B→A도 자동 추가 (양방향).
 * items.created_by는 auth.users.id를 저장하고, 조회 시 creator_profile로 표시용 이름을 붙인다.
 */
import { supabase } from '../lib/supabase';
import { buildProjectMovePlan } from './projectMove';
import { syncGitHubIssueStatus } from './githubAPI';
import {
  DEFAULT_PROFILE_CUSTOMIZATION,
  REACTION_TYPES,
  normalizeProfileCustomization,
  toCustomizationPayload,
} from '../lib/profileAppearance';

const API_SERVER_URL = '';
const normalizeNameKey = (value) => (value || '').trim().toLowerCase();

const itemsTable = (boardType) => boardType === 'main' ? 'roadmap_items' : 'items';
const projectsTable = (boardType) => boardType === 'main' ? 'roadmap_projects' : 'projects';
const personalMemosTable = 'personal_memos';

const requireAuthenticatedUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user?.id) throw new Error('User not authenticated');
  return user.id;
};

const getServerAuthHeaders = async (extra = {}) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
};

const normalizeAssigneeNames = (values = []) => {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((value) => (value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeNameKey(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeUuidList = (values = []) => {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((value) => `${value || ''}`.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const diffAddedAssigneeUserIds = (previousValues = [], nextValues = []) => {
  const previousIds = new Set(normalizeUuidList(previousValues));
  return normalizeUuidList(nextValues).filter((userId) => !previousIds.has(userId));
};

const createAssignmentNotifications = async ({
  recipientUserIds = [],
  entityTable,
  entityId,
  entityTitle,
  boardType,
  parentEntityTable = null,
  parentEntityId = null,
}) => {
  const recipients = normalizeUuidList(recipientUserIds);
  if (recipients.length === 0) return;

  const response = await fetch(`${API_SERVER_URL}/api/notifications/assignments`, {
    method: 'POST',
    headers: await getServerAuthHeaders(),
    body: JSON.stringify({
      recipient_user_ids: recipients,
      entity_table: entityTable,
      entity_id: entityId,
      entity_title: entityTitle || null,
      board_type: boardType || null,
      parent_entity_table: parentEntityTable,
      parent_entity_id: parentEntityId,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || '담당자 알림 생성에 실패했습니다.');
  }
};

const fetchProfileIdentityMaps = async () => {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name');

  if (error) throw error;

  const idsByNameKey = new Map();
  const namesById = new Map();

  (profiles || []).forEach((profile) => {
    const cleanName = (profile.name || '').trim();
    if (!cleanName) return;

    const key = normalizeNameKey(cleanName);
    const current = idsByNameKey.get(key) || [];
    current.push(profile.id);
    idsByNameKey.set(key, current);
    namesById.set(profile.id, cleanName);
  });

  return { idsByNameKey, namesById };
};

const resolveAssigneeFields = async (updates = {}) => {
  const hasAssigneeNames = Object.prototype.hasOwnProperty.call(updates, 'assignees');
  const hasAssigneeIds = Object.prototype.hasOwnProperty.call(updates, 'assignee_user_ids');

  if (!hasAssigneeNames && !hasAssigneeIds) {
    return updates;
  }

  const { idsByNameKey, namesById } = await fetchProfileIdentityMaps();

  if (hasAssigneeIds) {
    const assigneeUserIds = normalizeUuidList(updates.assignee_user_ids);
    const assignees = assigneeUserIds.map((userId) => {
      const profileName = namesById.get(userId);
      if (!profileName) {
        throw new Error(`존재하지 않는 담당자 프로필입니다: ${userId}`);
      }
      return profileName;
    });

    return {
      ...updates,
      assignees,
      assignee_user_ids: assigneeUserIds,
    };
  }

  const assignees = normalizeAssigneeNames(updates.assignees);
  const assigneeUserIds = assignees.map((assigneeName) => {
    const matchedIds = idsByNameKey.get(normalizeNameKey(assigneeName)) || [];
    if (matchedIds.length === 0) {
      throw new Error(`등록된 프로필이 없는 담당자입니다: ${assigneeName}`);
    }
    if (matchedIds.length > 1) {
      throw new Error(`동명이인 프로필이 있어 담당자를 식별할 수 없습니다: ${assigneeName}`);
    }
    return matchedIds[0];
  });

  return {
    ...updates,
    assignees,
    assignee_user_ids: assigneeUserIds,
  };
};

const normalizePersonalMemo = (memo) => ({
  ...memo,
  board_type: 'personal',
  content: memo?.content || '',
  description: memo?.description || '',
  status: 'none',
  priority: 0,
  page_type: null,
  project_id: null,
  related_items: [],
  assignees: [],
  assignee_user_ids: [],
  teams: [],
  tags: [],
  comments: [],
  creator_profile: null,
  entity_type: 'memo',
});

const supabaseAPI = {
  /**
   * @description 전체 보드 데이터를 단일 조회로 로드. projects + items(with comments) + sections + generalDocs.
   * page_type='page' 아이템은 포함됨 (useKanbanData reducer에서 필터링).
   * generalDocs: project_id=null && page_type='page'인 문서들 (팀별 분리).
   * @returns {Promise<{ projects: Array, sections: Array, generalDocs: Array }>}
   * projects: 각 project에 items 배열 내장, items에 comments(with profiles) 배열 내장
   */
  getBoardData: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isAuthenticated = Boolean(user);

    // 1+2: projects, roadmap_projects, items, roadmap_items 병렬 조회
    const [
      { data: teamProjects, error: pError },
      { data: mainProjects, error: rpError },
      { data: teamItems, error: iError },
      { data: mainItemsData, error: riError },
    ] = await Promise.all([
      supabase.from('projects').select('*').order('order_index', { ascending: true }),
      supabase.from('roadmap_projects').select('*').order('order_index', { ascending: true }),
      supabase.from('items').select(`*, comments (*, profiles (name, department))`).order('order_index', { ascending: true }),
      supabase.from('roadmap_items').select('*').order('order_index', { ascending: true }),
    ]);
    if (pError) throw pError;
    if (rpError) throw rpError;
    if (iError) throw iError;
    if (riError) throw riError;

    const allProjects = [...(mainProjects || []), ...(teamProjects || [])];
    const allItems = [...(mainItemsData || []), ...(teamItems || [])];

    // 2.5 일반 문서 + 폴더 가져오기 (project_id=null, page_type='page'|'folder')
    // 최상위 + 자식 문서/폴더 모두 포함 (GeneralDocumentSection에서 트리 구조 생성)
    const [
      { data: teamGeneralDocs, error: docError },
      { data: mainGeneralDocs, error: rdocError },
    ] = await Promise.all([
      supabase.from('items').select(`*, comments (*, profiles (name, department))`).is('project_id', null).in('page_type', ['page', 'folder']).order('board_type', { ascending: true }).order('order_index', { ascending: true }),
      supabase.from('roadmap_items').select('*').is('project_id', null).in('page_type', ['page', 'folder']).order('order_index', { ascending: true }),
    ]);
    if (docError) throw docError;
    if (rdocError) throw rdocError;

    const generalDocItems = [...(mainGeneralDocs || []), ...(teamGeneralDocs || [])];

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, department');

    if (profileError) throw profileError;

    let customizationRows = [];
    if (isAuthenticated) {
      const { data: customizationData, error: customizationError } = await supabase
        .from('profile_customizations')
        .select('user_id, avatar_style, theme_color, status_message, mood_emoji');
      if (customizationError) {
        console.warn('[getBoardData] profile_customizations 조회 실패:', customizationError.message);
      } else {
        customizationRows = customizationData || [];
      }
    }

    // 3. 섹션 가져오기
    const { data: sections, error: sError } = await supabase
      .from('sections')
      .select('*')
      .order('order_index', { ascending: true });
    if (sError) throw sError;

    const customizationsByUserId = new Map(
      customizationRows.map((row) => [row.user_id, normalizeProfileCustomization(row)])
    );
    const profilesById = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        {
          ...profile,
          customization: customizationsByUserId.get(profile.id) || DEFAULT_PROFILE_CUSTOMIZATION,
        },
      ])
    );

    // 4. 트리 구조로 조립
    const formattedProjects = allProjects.map(project => ({
      ...project,
      assignees: Array.isArray(project.assignees) ? project.assignees : [],
      assignee_user_ids: Array.isArray(project.assignee_user_ids) ? project.assignee_user_ids : [],
      items: allItems
        .filter(item => item.project_id === project.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => ({
          ...item,
          related_items: Array.isArray(item.related_items) ? item.related_items : [],
          assignee_user_ids: Array.isArray(item.assignee_user_ids) ? item.assignee_user_ids : [],
          creator_profile: item.created_by ? profilesById.get(item.created_by) || null : null,
          comments: (item.comments || [])
            .map((comment) => {
              if (!comment?.user_id) return comment;
              const userProfile = profilesById.get(comment.user_id);
              if (!userProfile) return comment;
              return {
                ...comment,
                profiles: {
                  ...(comment.profiles || {}),
                  customization: userProfile.customization,
                },
              };
            })
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        }))
    }));

    // 4.5 일반 문서 포맷팅
    const formattedGeneralDocs = (generalDocItems || []).map(item => ({
      ...item,
      related_items: Array.isArray(item.related_items) ? item.related_items : [],
      assignee_user_ids: Array.isArray(item.assignee_user_ids) ? item.assignee_user_ids : [],
      creator_profile: item.created_by ? profilesById.get(item.created_by) || null : null,
      comments: (item.comments || [])
        .map((comment) => {
          if (!comment?.user_id) return comment;
          const userProfile = profilesById.get(comment.user_id);
          if (!userProfile) return comment;
          return {
            ...comment,
            profiles: {
              ...(comment.profiles || {}),
              customization: userProfile.customization,
            },
          };
        })
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }));

    return {
      projects: formattedProjects,
      sections: sections || [],
      generalDocs: formattedGeneralDocs
    };
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

    const [
      { data: teamItems, error: itemError },
      { data: mainItems, error: mainItemError },
    ] = await Promise.all([
      supabase.from('items').select('id, title, status, assignees, project_id')
        .not('assignees', 'eq', '{}')
        .not('assignees', 'is', null),
      supabase.from('roadmap_items').select('id, title, status, assignees, project_id')
        .not('assignees', 'eq', '{}')
        .not('assignees', 'is', null),
    ]);
    if (itemError) throw itemError;
    if (mainItemError) throw mainItemError;
    const allItems = [...(mainItems || []), ...(teamItems || [])];

    const projectMap = new Map((projects || []).map((project) => [project.id, project]));
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

    (allItems || []).forEach((item) => {
      const assignees = Array.isArray(item.assignees) ? item.assignees : [];
      if (assignees.length === 0) return;

      const project = projectMap.get(item.project_id);
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

  addProject: async (title, boardType = 'main', sectionId = null) => {
    const { data: existingProjects } = await supabase.from(projectsTable(boardType)).select('order_index').order('order_index', { ascending: false }).limit(1);
    const nextOrder = existingProjects?.[0] ? existingProjects[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from(projectsTable(boardType))
      .insert([{ title, order_index: nextOrder, board_type: boardType, assignees: [], assignee_user_ids: [], section_id: sectionId }])
      .select();

    if (error) throw error;
    return data[0];
  },

  updateProject: async (projectId, updates, boardType = 'main') => {
    const tableName = projectsTable(boardType);
    const { data: existingProject, error: existingError } = await supabase
      .from(tableName)
      .select('id, title, assignee_user_ids')
      .eq('id', projectId)
      .maybeSingle();

    if (existingError) throw existingError;

    const normalizedUpdates = await resolveAssigneeFields(updates);
    const { data, error } = await supabase
      .from(tableName)
      .update(normalizedUpdates)
      .eq('id', projectId)
      .select();

    if (error) throw error;
    const updatedProject = data[0];

    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'assignee_user_ids') && updatedProject) {
      const addedAssigneeUserIds = diffAddedAssigneeUserIds(
        existingProject?.assignee_user_ids || [],
        updatedProject.assignee_user_ids || []
      );

      if (addedAssigneeUserIds.length > 0) {
        try {
          await createAssignmentNotifications({
            recipientUserIds: addedAssigneeUserIds,
            entityTable: tableName,
            entityId: updatedProject.id,
            entityTitle: updatedProject.title,
            boardType,
          });
        } catch (notificationError) {
          console.warn('[updateProject] Assignment notification failed:', notificationError.message);
        }
      }
    }

    return updatedProject;
  },

  /**
   * @description 프로젝트 완료/복귀 처리. 완료 시 현재 위치를 저장, 복귀 시 복원.
   * @param {string} projectId
   * @param {boolean} isCompleted - true: 완료, false: 복귀
   * @param {Object} meta - { sectionId, orderIndex } 완료 시 저장할 현재 위치
   *                      - { preCompletionSectionId, preCompletionOrderIndex } 복귀 시 복원할 위치
   */
  completeProject: async (projectId, isCompleted, meta = {}, boardType = 'main') => {
    const updates = isCompleted
      ? {
          is_completed: true,
          pre_completion_section_id: meta.sectionId ?? null,
          pre_completion_order_index: meta.orderIndex ?? null,
        }
      : {
          is_completed: false,
          section_id: meta.preCompletionSectionId ?? null,
          order_index: meta.preCompletionOrderIndex ?? null,
        };
    const { data, error } = await supabase
      .from(projectsTable(boardType))
      .update(updates)
      .eq('id', projectId)
      .select();
    if (error) throw error;
    return data[0];
  },

  deleteProject: async (projectId, boardType = 'main') => {
    const { error } = await supabase.from(projectsTable(boardType)).delete().eq('id', projectId);
    if (error) throw error;
  },

  moveProject: async (projectId, targetIndex, boardType = 'main') => {
    const { data: projects } = await supabase.from(projectsTable(boardType)).select('id, order_index').order('order_index', { ascending: true });
    const movingProjectIdx = projects.findIndex(p => p.id === projectId);
    const [movingProject] = projects.splice(movingProjectIdx, 1);
    projects.splice(targetIndex, 0, movingProject);

    const updatePromises = projects.map((p, idx) =>
      supabase.from(projectsTable(boardType)).update({ order_index: idx }).eq('id', p.id)
    );
    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  /**
   * @description 사이드바 DnD용: section 내에서 프로젝트 이동 (section_id 변경 포함).
   * @param {string} projectId 이동할 프로젝트 ID
   * @param {string|null} targetSectionId 대상 섹션 ID (null이면 standalone)
   * @param {number} targetIndex 대상 섹션 내 위치
   */
  moveProjectSidebar: async (projectId, targetSectionId, targetIndex, boardType = 'main') => {
    // 1. 대상 section 내 현재 프로젝트들 가져오기
    let query = supabase.from(projectsTable(boardType)).select('id, order_index');
    if (targetSectionId) {
      query = query.eq('section_id', targetSectionId);
    } else {
      query = query.is('section_id', null);
    }

    const { data: sectionProjects, error: fetchError } = await query.order('order_index', { ascending: true });
    if (fetchError) throw fetchError;

    // 2. 현재 위치에서 제거 후 targetIndex에 삽입
    const movingIdx = sectionProjects.findIndex(p => p.id === projectId);
    const newList = [...sectionProjects];
    if (movingIdx !== -1) {
      newList.splice(movingIdx, 1);
    } else {
      // 다른 section에서 이동하는 경우 시작점에 임시 추가
      newList.splice(0, 0, { id: projectId });
    }
    newList.splice(targetIndex, 0, { id: projectId });

    // 3. 순서 + section_id 업데이트
    const updatePromises = newList.map((p, idx) =>
      supabase.from(projectsTable(boardType)).update({
        order_index: idx,
        section_id: targetSectionId,
      }).eq('id', p.id)
    );
    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  addItem: async (projectId, title, content = '', createdBy = null, boardType = 'main') => {
    const { data: existingItems } = await supabase.from(itemsTable(boardType)).select('order_index').eq('project_id', projectId).order('order_index', { ascending: false }).limit(1);
    const nextOrder = existingItems?.[0] ? existingItems[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from(itemsTable(boardType))
      .insert([{
        project_id: projectId,
        title,
        content,
        order_index: nextOrder,
        status: 'none',
        created_by: createdBy,
        board_type: boardType,
        teams: [],
        assignees: [],
        assignee_user_ids: [],
        tags: [],
        related_items: []
      }])
      .select();

    if (error) throw error;
    return data[0];
  },

  updateItem: async (projectId, itemId, updates, boardType = 'main') => {
    const tableName = itemsTable(boardType);
    const { data: existingItem, error: existingError } = await supabase
      .from(tableName)
      .select('id, title, project_id, assignee_user_ids')
      .eq('id', itemId)
      .maybeSingle();

    if (existingError) throw existingError;

    const normalizedUpdates = await resolveAssigneeFields(updates);
    const { data, error } = await supabase
      .from(tableName)
      .update(normalizedUpdates)
      .eq('id', itemId)
      .select();
    
    if (error) throw error;
    const updatedItem = data[0];

    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'assignee_user_ids') && updatedItem) {
      const addedAssigneeUserIds = diffAddedAssigneeUserIds(
        existingItem?.assignee_user_ids || [],
        updatedItem.assignee_user_ids || []
      );

      if (addedAssigneeUserIds.length > 0) {
        try {
          await createAssignmentNotifications({
            recipientUserIds: addedAssigneeUserIds,
            entityTable: tableName,
            entityId: updatedItem.id,
            entityTitle: updatedItem.title,
            boardType,
            parentEntityTable: projectsTable(boardType),
            parentEntityId: updatedItem.project_id || projectId || null,
          });
        } catch (notificationError) {
          console.warn('[updateItem] Assignment notification failed:', notificationError.message);
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'status') && updatedItem?.status) {
      try {
        await syncGitHubIssueStatus(itemId, updatedItem.status);
      } catch (syncError) {
        console.warn('[updateItem] GitHub issue status sync failed:', syncError.message);
      }
    }
    return updatedItem;
  },

  deleteItem: async (projectId, itemId, boardType = 'main') => {
    const { error } = await supabase.from(itemsTable(boardType)).delete().eq('id', itemId);
    if (error) throw error;
  },

  /**
   * @description 아이템을 다른 project나 부모로 이동하거나 같은 레벨 내에서 재정렬.
   * @param {string} sourceProjectId
   * @param {string} targetProjectId
   * @param {string} itemId
   * @param {number} targetIndex - 0-based 삽입 위치
   * @param {string|null} targetParentId - 새로운 부모 아이템 ID (undefined면 기존 로직 동작)
   */
  moveItem: async (sourceProjectId, targetProjectId, itemId, targetIndex, targetParentId = undefined, boardType = 'main') => {
    const projectIds = [...new Set([sourceProjectId, targetProjectId].filter(Boolean))];
    const { data: allItems, error: fetchError } = await supabase
      .from(itemsTable(boardType))
      .select('id, project_id, parent_item_id, order_index')
      .in('project_id', projectIds);

    if (fetchError) throw fetchError;

    const plan = buildProjectMovePlan({
      allItems: allItems || [],
      sourceProjectId,
      targetProjectId,
      itemId,
      targetIndex,
      targetParentId,
    });

    const results = await Promise.all(
      plan.updates.map(({ id, updates }) =>
        supabase.from(itemsTable(boardType)).update(updates).eq('id', id)
      )
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  addComment: async (projectId, itemId, content) => {
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
    const comment = data[0];
    const { data: customization } = await supabase
      .from('profile_customizations')
      .select('avatar_style, theme_color, status_message, mood_emoji')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    return {
      ...comment,
      profiles: {
        ...(comment.profiles || {}),
        customization: normalizeProfileCustomization(customization),
      },
    };
  },

  updateComment: async (projectId, itemId, commentId, updates) => {
    const { data, error } = await supabase
      .from('comments')
      .update(updates)
      .eq('id', commentId)
      .select(`
        *,
        profiles (name, department)
      `);
    
    if (error) throw error;
    const comment = data[0];
    const { data: customization } = await supabase
      .from('profile_customizations')
      .select('avatar_style, theme_color, status_message, mood_emoji')
      .eq('user_id', comment.user_id)
      .maybeSingle();
    return {
      ...comment,
      profiles: {
        ...(comment.profiles || {}),
        customization: normalizeProfileCustomization(customization),
      },
    };
  },

  deleteComment: async (projectId, itemId, commentId) => {
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
    await Promise.all([
      supabase.from('projects').update({ section_id: null }).eq('section_id', sectionId),
      supabase.from('roadmap_projects').update({ section_id: null }).eq('section_id', sectionId),
    ]);
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

  getTeamBoardConfig: async (boardType) => {
    const { data } = await supabase
      .from('team_boards')
      .select('description, pinned_doc_ids')
      .eq('board_type', boardType)
      .maybeSingle();
    return {
      description: data?.description ?? '',
      pinned_doc_ids: data?.pinned_doc_ids ?? [],
    };
  },

  upsertTeamBoardConfig: async (boardType, updates) => {
    const { error } = await supabase
      .from('team_boards')
      .upsert({ board_type: boardType, ...updates, updated_at: new Date().toISOString() });
    if (error) throw error;
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
   * @param {string} projectId 
   * @param {string} sectionId - 속한 섹션 ID (null 허용)
   * @param {number} targetIndex - 0-based 타임라인 내 목표 위치
   */
  moveProjectTimeline: async (projectId, sectionId, targetIndex, boardType = 'main') => {
    let query = supabase
      .from(projectsTable(boardType))
      .select('id, timeline_order_index')
      .order('timeline_order_index', { ascending: true });

    // sectionId가 null이면 null 프로젝트끼리만, 있으면 같은 섹션 내에서만
    if (sectionId === null) {
      query = query.is('section_id', null);
    } else {
      query = query.eq('section_id', sectionId);
    }

    const { data: projects } = await query;
    const movingIdx = projects.findIndex(p => p.id === projectId);
    if (movingIdx === -1) throw new Error('Project not found in section');

    const [moving] = projects.splice(movingIdx, 1);
    projects.splice(targetIndex, 0, moving);

    const results = await Promise.all(
      projects.map((p, idx) => supabase.from(projectsTable(boardType)).update({ timeline_order_index: idx }).eq('id', p.id))
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
  moveItemTimeline: async (itemId, projectId, targetIndex, boardType = 'main') => {
    const { data: items } = await supabase
      .from(itemsTable(boardType))
      .select('id, timeline_order_index')
      .eq('project_id', projectId)
      .order('timeline_order_index', { ascending: true });

    const movingIdx = items.findIndex(i => i.id === itemId);
    if (movingIdx === -1) throw new Error('Item not found in project');

    const [moving] = items.splice(movingIdx, 1);
    items.splice(targetIndex, 0, moving);

    const results = await Promise.all(
      items.map((item, idx) => supabase.from(itemsTable(boardType)).update({ timeline_order_index: idx }).eq('id', item.id))
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  getCurrentProfileBundle: async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, department')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const { data: customization, error: customizationError } = await supabase
      .from('profile_customizations')
      .select('avatar_style, theme_color, status_message, mood_emoji')
      .eq('user_id', user.id)
      .maybeSingle();
    if (customizationError) throw customizationError;

    return {
      ...profile,
      customization: normalizeProfileCustomization(customization),
    };
  },

  getProfileDirectory: async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return [];

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, department')
      .order('name', { ascending: true });
    if (profileError) throw profileError;

    const { data: customizationRows, error: customizationError } = await supabase
      .from('profile_customizations')
      .select('user_id, avatar_style, theme_color, status_message, mood_emoji');
    if (customizationError) throw customizationError;

    const customizationByUserId = new Map(
      (customizationRows || []).map((row) => [row.user_id, normalizeProfileCustomization(row)])
    );

    return (profiles || []).map((profile) => ({
      ...profile,
      customization: customizationByUserId.get(profile.id) || DEFAULT_PROFILE_CUSTOMIZATION,
    }));
  },

  updateCurrentProfileCustomization: async (customizationUpdates) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const payload = toCustomizationPayload(customizationUpdates);
    const { data, error } = await supabase
      .from('profile_customizations')
      .upsert(
        {
          user_id: user.id,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('avatar_style, theme_color, status_message, mood_emoji')
      .single();
    if (error) throw error;
    return normalizeProfileCustomization(data);
  },

  getProfileReactionSummary: async (targetUserId, lookbackHours = 24) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    const cutoffDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from('profile_reactions')
      .select('reaction_type, actor_user_id')
      .eq('target_user_id', targetUserId)
      .gte('created_at', cutoffDate);
    if (error) throw error;

    const counts = REACTION_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
    const myReactions = {};
    (rows || []).forEach((row) => {
      if (!REACTION_TYPES.includes(row.reaction_type)) return;
      counts[row.reaction_type] += 1;
      if (row.actor_user_id === currentUserId) {
        myReactions[row.reaction_type] = true;
      }
    });

    return { counts, myReactions };
  },

  toggleProfileReaction: async (targetUserId, reactionType) => {
    if (!REACTION_TYPES.includes(reactionType)) {
      throw new Error('Unsupported reaction type');
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    if (user.id === targetUserId) {
      return supabaseAPI.getProfileReactionSummary(targetUserId);
    }

    const { data: existing, error: existingError } = await supabase
      .from('profile_reactions')
      .select('id')
      .eq('target_user_id', targetUserId)
      .eq('actor_user_id', user.id)
      .eq('reaction_type', reactionType)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.id) {
      const { error: deleteError } = await supabase
        .from('profile_reactions')
        .delete()
        .eq('id', existing.id);
      if (deleteError) throw deleteError;
    } else {
      const { error: insertError } = await supabase.from('profile_reactions').insert({
        target_user_id: targetUserId,
        actor_user_id: user.id,
        reaction_type: reactionType,
      });
      if (insertError) throw insertError;
    }

    return supabaseAPI.getProfileReactionSummary(targetUserId);
  },
};

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
export async function createChildPage(projectId, parentItemId, title, inheritedProps = {}, boardType = 'main', createdBy = null) {
  const { data: existing } = await supabase
    .from(itemsTable(boardType))
    .select('order_index')
    .eq('parent_item_id', parentItemId)
    .order('order_index', { ascending: false })
    .limit(1);

  const nextOrder = existing?.length > 0 ? existing[0].order_index + 1 : 0;

  const { data, error } = await supabase
    .from(itemsTable(boardType))
    .insert([{
      project_id: projectId,
      parent_item_id: parentItemId,
      title,
      page_type: 'page',
      status: 'none',
      assignees: [],
      assignee_user_ids: [],
      teams: inheritedProps.teams || [],
      tags: inheritedProps.tags || [],
      related_items: [],
      order_index: nextOrder,
      created_by: createdBy,
    }])
    .select();

  if (error) throw error;
  return data[0];
}

// NOTE: 현재 미사용. usePageTree 훅이 이미 로드된 phases 데이터에서
// 하위 페이지를 파생하므로 직접 API 호출이 필요없음.
// 향후 on-demand 로딩 시 사용 예정.
export async function getChildPages(parentItemId, boardType = 'main') {
  const { data, error } = await supabase
    .from(itemsTable(boardType))
    .select('*')
    .eq('parent_item_id', parentItemId)
    .eq('page_type', 'page')
    .order('order_index');
  if (error) throw error;
  return data;
}


/**
 * @description 특정 아이템을 [[위키링크]]로 참조하는 다른 아이템들을 조회한다.
 * wiki link 저장 포맷: [[title|itemId]] 또는 [[title]] — id 포함 패턴으로 검색.
 * @param {string} itemId - 대상 아이템 UUID
 * @returns {Array} backlink 아이템 목록 (id, title, content, page_type)
 */
export async function getBacklinks(itemId) {
  // directMatches: 두 테이블 모두 검색
  const [
    { data: directMatchesTeam, error: directError },
    { data: directMatchesMain, error: directErrorMain },
    { data: directMatchesMemos, error: directErrorMemos },
  ] = await Promise.all([
    supabase.from('items').select('id, title, content, page_type, project_id').ilike('description', `%|${itemId}]]%`),
    supabase.from('roadmap_items').select('id, title, content, page_type, project_id').ilike('description', `%|${itemId}]]%`),
    supabase.from(personalMemosTable).select('id, title, content, description').ilike('description', `%|${itemId}]]%`),
  ]);
  if (directError) throw directError;
  if (directErrorMain) throw directErrorMain;
  if (directErrorMemos) throw directErrorMemos;

  const backlinkMap = new Map(
    [
      ...(directMatchesTeam || []),
      ...(directMatchesMain || []),
      ...(directMatchesMemos || []).map(normalizePersonalMemo),
    ].map((item) => [item.id, item])
  );

  // targetItem: 두 테이블에서 검색
  const [
    { data: targetItemTeam },
    { data: targetItemMain },
    { data: targetItemMemo },
  ] = await Promise.all([
    supabase.from('items').select('title, content').eq('id', itemId).maybeSingle(),
    supabase.from('roadmap_items').select('title, content').eq('id', itemId).maybeSingle(),
    supabase.from(personalMemosTable).select('title, content').eq('id', itemId).maybeSingle(),
  ]);
  const targetItem = targetItemMain || targetItemTeam || targetItemMemo;

  const titleCandidates = [targetItem?.title, targetItem?.content]
    .map((value) => `${value || ''}`.trim())
    .filter(Boolean);

  for (const title of titleCandidates) {
    const [
      { data: titleMatchesTeam, error: titleError },
      { data: titleMatchesMain, error: titleErrorMain },
      { data: titleMatchesMemos, error: titleErrorMemos },
    ] = await Promise.all([
      supabase.from('items').select('id, title, content, page_type, project_id').ilike('description', `%[[${title}]]%`),
      supabase.from('roadmap_items').select('id, title, content, page_type, project_id').ilike('description', `%[[${title}]]%`),
      supabase.from(personalMemosTable).select('id, title, content, description').ilike('description', `%[[${title}]]%`),
    ]);
    if (titleError) throw titleError;
    if (titleErrorMain) throw titleErrorMain;
    if (titleErrorMemos) throw titleErrorMemos;
    [
      ...(titleMatchesTeam || []),
      ...(titleMatchesMain || []),
      ...(titleMatchesMemos || []).map(normalizePersonalMemo),
    ].forEach((item) => backlinkMap.set(item.id, item));
  }

  backlinkMap.delete(itemId);
  return Array.from(backlinkMap.values());
}

/**
 * @description 개인 메모장만 조회 (비공개 + 사용자 소유)
 * @param {string} userId - auth.users.id
 * @returns {Promise<Array>} 개인 메모 아이템 배열
 */
export async function getPersonalMemos(userId) {
  const { data, error } = await supabase
    .from(personalMemosTable)
    .select('*')
    .eq('owner_id', userId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizePersonalMemo);
}

/**
 * @description 개인 메모 생성
 * @param {string} title - 메모 제목
 * @param {string} content - 메모 부제목
 * @param {string} createdBy - 작성자 UUID (auth.users.id)
 * @returns {Promise<Object>} 생성된 메모 아이템
 */
export async function createPersonalMemo(title, content = '', createdBy) {
  const ownerId = createdBy || await requireAuthenticatedUserId();
  const { data: existingItems, error: orderError } = await supabase
    .from(personalMemosTable)
    .select('order_index')
    .eq('owner_id', ownerId)
    .order('order_index', { ascending: false })
    .limit(1);

  if (orderError) throw orderError;
  const nextOrder = existingItems?.[0] ? existingItems[0].order_index + 1 : 0;

  const { data, error } = await supabase
    .from(personalMemosTable)
    .insert([{
      title,
      content,
      description: '',
      owner_id: ownerId,
      order_index: nextOrder,
      updated_at: new Date().toISOString(),
    }])
    .select();

  if (error) throw error;
  return data?.[0] ? normalizePersonalMemo(data[0]) : null;
}

/**
 * @description 개인 메모 업데이트
 * @param {string} memoId - 메모 아이템 ID
 * @param {Object} updates - 변경할 필드 (title, content, description 등)
 * @param {string} userId - 소유자 UUID (권한 확인용)
 * @returns {Promise<Object>} 업데이트된 메모
 */
export async function updatePersonalMemo(memoId, updates) {
  await requireAuthenticatedUserId();

  const { data, error } = await supabase
    .from(personalMemosTable)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memoId)
    .select();

  if (error) throw error;
  return data?.[0] ? normalizePersonalMemo(data[0]) : null;
}

/**
 * @description 개인 메모 삭제
 * @param {string} memoId - 메모 아이템 ID
 * @param {string} userId - 소유자 UUID (권한 확인용)
 * @returns {Promise<void>}
 */
export async function deletePersonalMemo(memoId) {
  await requireAuthenticatedUserId();

  const { error } = await supabase
    .from(personalMemosTable)
    .delete()
    .eq('id', memoId);

  if (error) throw error;
}

/**
 * @description 일반 문서 또는 폴더를 생성합니다 (프로젝트 없이).
 * project_id=null로 저장되어 칸반 보드에 표시되지 않습니다.
 * @param {string} boardType - 'main' | '개발팀' | ...
 * @param {string} title - 제목
 * @param {string} type - 'document' (기본값) 또는 'folder'
 * @param {string} parentFolderId - 부모 폴더 ID (선택사항)
 * @returns {Promise<Object>} 생성된 일반 문서/폴더 아이템
 */
export async function createGeneralDocument(boardType, title, type = 'document', parentFolderId = null, createdBy = null) {
  const pageType = type === 'folder' ? 'folder' : 'page';

  const { data, error } = await supabase
    .from(itemsTable(boardType))
    .insert([
      {
        board_type: boardType,
        project_id: null,  // ← 일반 문서/폴더는 프로젝트 미배정
        title: title.trim(),
        page_type: pageType,  // ← 'page' 또는 'folder'
        status: 'none',
        order_index: 0,
        parent_item_id: parentFolderId,  // ← 부모 폴더 지정 (선택사항)
        created_by: createdBy,
      },
    ])
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * @description 일반 문서 또는 폴더를 삭제합니다.
 * 안전장치: project_id=null && (page_type='page' || page_type='folder') 조건을 확인합니다.
 * @param {string} itemId - 아이템 ID
 * @param {string} [boardType='main'] - 보드 타입 ('main' → roadmap_items, 그 외 → items)
 * @returns {Promise<void>}
 */
export async function deleteGeneralDocument(itemId, boardType = 'main') {
  // 안전장치: 일반 문서/폴더만 삭제
  const { error } = await supabase
    .from(itemsTable(boardType))
    .delete()
    .eq('id', itemId)
    .is('project_id', null)
    .in('page_type', ['page', 'folder']);

  if (error) throw error;
}

/**
 * @description 일반 문서/폴더를 다시 정렬합니다 (같은 팀 보드 내에서).
 * @param {string} itemId - 이동할 아이템 ID
 * @param {number} newIndex - 새로운 order_index
 * @param {string} [boardType='main'] - 보드 타입 ('main' → roadmap_items, 그 외 → items)
 * @returns {Promise<void>}
 */
export async function moveGeneralDocument(itemId, newIndex, boardType = 'main') {
  const { error } = await supabase
    .from(itemsTable(boardType))
    .update({ order_index: newIndex })
    .eq('id', itemId)
    .is('project_id', null)
    .in('page_type', ['page', 'folder']);

  if (error) throw error;
}

// Export all functions as default for backward compatibility
export default {
  ...supabaseAPI,
  createChildPage,
  getChildPages,
  getBacklinks,
  getPersonalMemos,
  createPersonalMemo,
  updatePersonalMemo,
  deletePersonalMemo,
  createGeneralDocument,
  deleteGeneralDocument,
  moveGeneralDocument,
};
