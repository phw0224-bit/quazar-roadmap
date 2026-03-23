import { supabase } from '../lib/supabase';

// 환경 변수 설정 (기본값 true로 설정하여 바로 연동)
const USE_SUPABASE = true;

const supabaseAPI = {
  getBoardData: async () => {
    // 1. 페이즈 가져오기 (order_index 순)
    const { data: phases, error: pError } = await supabase
      .from('phases')
      .select('*')
      .order('order_index', { ascending: true });
    
    if (pError) throw pError;

    // 2. 아이템 가져오기 (order_index 순)
    const { data: items, error: iError } = await supabase
      .from('items')
      .select('*, comments(*)')
      .order('order_index', { ascending: true });

    if (iError) throw iError;

    // 3. 트리 구조로 조립
    const formattedPhases = phases.map(phase => ({
      ...phase,
      items: items
        .filter(item => item.phase_id === phase.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => ({
          ...item,
          comments: item.comments || []
        }))
    }));

    return { phases: formattedPhases };
  },

  addPhase: async (title) => {
    // 마지막 order_index 확인
    const { data: existingPhases } = await supabase.from('phases').select('order_index').order('order_index', { ascending: false }).limit(1);
    const nextOrder = existingPhases?.[0] ? existingPhases[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from('phases')
      .insert([{ title, order_index: nextOrder }])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  updatePhase: async (phaseId, updates) => {
    const { data, error } = await supabase
      .from('phases')
      .update(updates)
      .eq('id', phaseId)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  deletePhase: async (phaseId) => {
    const { error } = await supabase.from('phases').delete().eq('id', phaseId);
    if (error) throw error;
  },

  movePhase: async (phaseId, targetIndex) => {
    // 전체 페이즈 목록을 가져와서 메모리에서 재정렬 후 전체 업데이트 (가장 단순한 방식)
    const { data: phases } = await supabase.from('phases').select('id, order_index').order('order_index', { ascending: true });
    const movingPhaseIdx = phases.findIndex(p => p.id === phaseId);
    const [movingPhase] = phases.splice(movingPhaseIdx, 1);
    phases.splice(targetIndex, 0, movingPhase);

    const updatePromises = phases.map((p, idx) => 
      supabase.from('phases').update({ order_index: idx }).eq('id', p.id)
    );
    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw errors[0].error;
  },

  addItem: async (phaseId, title, content = '') => {
    const { data: existingItems } = await supabase.from('items').select('order_index').eq('phase_id', phaseId).order('order_index', { ascending: false }).limit(1);
    const nextOrder = existingItems?.[0] ? existingItems[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from('items')
      .insert([{ 
        phase_id: phaseId, 
        title, 
        content,
        order_index: nextOrder,
        status: 'none',
        teams: [],
        assignees: [],
        tags: []
      }])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  updateItem: async (phaseId, itemId, updates) => {
    // phase_id는 조건절에서만 사용하거나 무시 (Supabase는 PK로 업데이트)
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
    // 1. 타겟 페이즈의 아이템들을 가져와서 순서 조정
    const { data: targetItems } = await supabase
      .from('items')
      .select('id, order_index')
      .eq('phase_id', targetPhaseId)
      .order('order_index', { ascending: true });

    // 2. 이동할 아이템이 타겟 페이즈에 이미 있는지 확인
    const movingItemIdx = targetItems.findIndex(i => i.id === itemId);
    let newItems = [...targetItems];

    if (movingItemIdx !== -1) {
      // 동일 페이즈 내 이동
      const [movingItem] = newItems.splice(movingItemIdx, 1);
      newItems.splice(targetIndex, 0, movingItem);
    } else {
      // 다른 페이즈로 이동
      newItems.splice(targetIndex, 0, { id: itemId });
    }

    // 3. 전체 아이템의 phase_id와 order_index 일괄 업데이트
    const updatePromises = newItems.map((item, idx) => 
      supabase.from('items').update({
        phase_id: targetPhaseId,
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
      .select();
    
    if (error) throw error;
    return data[0];
  },

  updateComment: async (phaseId, itemId, commentId, updates) => {
    const { data, error } = await supabase
      .from('comments')
      .update(updates)
      .eq('id', commentId)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  deleteComment: async (phaseId, itemId, commentId) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) throw error;
  }
};

const API = USE_SUPABASE ? supabaseAPI : supabaseAPI; // 로컬 스토리지 코드는 제거하거나 유지
export default API;
