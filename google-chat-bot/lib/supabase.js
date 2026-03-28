import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 환경변수가 없습니다.');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role key (anon key 아님!)
);

// ─── 보드 데이터 조회 ───────────────────────────────────────────

/**
 * 전체 보드 현황 조회
 * sections → projects(columns) → items 트리 구조로 반환
 */
export async function getBoardData() {
  const [{ data: sections }, { data: projects }, { data: items }] = await Promise.all([
    supabase.from('sections').select('*').order('order_index'),
    supabase.from('projects').select('*').order('order_index'),
    supabase.from('items').select('*').order('order_index'),
  ]);

  // sections > projects > items 트리 조립
  return (sections || []).map(section => ({
    ...section,
    columns: (projects || [])
      .filter(p => p.section_id === section.id)
      .map(project => ({
        ...project,
        items: (items || []).filter(i => i.project_id === project.id),
      })),
  }));
}

/**
 * 특정 상태의 아이템 조회
 * @param {string} status - 'none' | 'in-progress' | 'done'
 * @param {string} [boardType] - 'main' | 특정 board_type
 */
export async function getItemsByStatus(status, boardType = null) {
  let query = supabase
    .from('items')
    .select('*, projects(title, board_type, section_id), sections:projects(section_id(title))')
    .order('order_index');

  if (status) query = query.eq('status', status);

  const { data: items, error } = await query;
  if (error) throw error;

  // board_type 필터
  if (boardType) {
    return (items || []).filter(i => i.projects?.board_type === boardType);
  }

  return items || [];
}

/**
 * 담당자(assignee) 이름으로 작업 조회
 * @param {string} memberName - 담당자 이름
 */
export async function getItemsByMember(memberName) {
  const { data: items, error } = await supabase
    .from('items')
    .select('*, projects(title, board_type)')
    .contains('assignees', [memberName])
    .order('order_index');

  if (error) throw error;
  return items || [];
}

/**
 * 키워드로 아이템 검색
 * @param {string} keyword
 */
export async function searchItems(keyword) {
  const { data, error } = await supabase
    .from('items')
    .select('*, projects(title, board_type)')
    .ilike('title', `%${keyword}%`)
    .order('order_index');

  if (error) throw error;
  return data || [];
}

/**
 * 섹션(보드) 목록 조회
 */
export async function getSections() {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .order('order_index');

  if (error) throw error;
  return data || [];
}

/**
 * 특정 섹션의 컬럼(프로젝트) 목록 조회
 * @param {string} sectionId
 */
export async function getColumns(sectionId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('section_id', sectionId)
    .order('order_index');

  if (error) throw error;
  return data || [];
}

// ─── 아이템 생성/수정 ─────────────────────────────────────────────

/**
 * 아이템 생성
 * @param {Object} params
 * @param {string} params.columnId - 프로젝트(컬럼) ID
 * @param {string} params.title
 * @param {string} [params.content] - 마크다운
 * @param {string} [params.status] - 'none' | 'in-progress' | 'done'
 * @param {string[]} [params.assignees]
 * @param {string[]} [params.tags]
 */
export async function createItem({ columnId, title, content = '', status = 'none', assignees = [], tags = [] }) {
  // 현재 마지막 order_index 확인
  const { data: existing } = await supabase
    .from('items')
    .select('order_index')
    .eq('project_id', columnId)
    .order('order_index', { ascending: false })
    .limit(1);

  const nextOrder = existing?.[0] ? existing[0].order_index + 1 : 0;

  const { data, error } = await supabase
    .from('items')
    .insert([{
      project_id: columnId,
      title,
      content,
      status,
      assignees,
      tags,
      teams: [],
      related_items: [],
      order_index: nextOrder,
    }])
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * 아이템 상태 변경
 * @param {string} itemId
 * @param {string} status - 'none' | 'in-progress' | 'done'
 */
export async function updateItemStatus(itemId, status) {
  const { data, error } = await supabase
    .from('items')
    .update({ status })
    .eq('id', itemId)
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * 아이템 수정
 * @param {string} itemId
 * @param {Object} updates - 수정할 필드들
 */
export async function updateItem(itemId, updates) {
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', itemId)
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * 아이템 제목으로 검색 후 ID 반환 (상태 변경 등에서 활용)
 * @param {string} title
 */
export async function findItemByTitle(title) {
  const { data, error } = await supabase
    .from('items')
    .select('*, projects(title)')
    .ilike('title', `%${title}%`)
    .limit(5);

  if (error) throw error;
  return data || [];
}
