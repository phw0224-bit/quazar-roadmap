import { supabase } from '../lib/supabase';

const normalizeNameKey = (value) => (value || '').trim().toLowerCase();

const supabaseAPI = {
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

    // 3. 트리 구조로 조립
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

    return { phases: formattedProjects };
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

  addPhase: async (title, boardType = 'main') => {
    const { data: existingProjects } = await supabase.from('projects').select('order_index').order('order_index', { ascending: false }).limit(1);
    const nextOrder = existingProjects?.[0] ? existingProjects[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from('projects')
      .insert([{ title, order_index: nextOrder, board_type: boardType, assignees: [] }])
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
  }
};

export default supabaseAPI;
