import { Router } from 'express';
import { requireAuthenticatedUser } from '../lib/auth.js';
import { supabaseAdminClient } from '../lib/supabase.js';

const router = Router();

const ALLOWED_ENTITY_TABLES = new Set(['items', 'projects', 'roadmap_items', 'roadmap_projects']);

function normalizeUuidList(values = []) {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((value) => `${value || ''}`.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function normalizeOptionalText(value) {
  const trimmed = `${value || ''}`.trim();
  return trimmed || null;
}

router.post('/api/notifications/assignments', async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    if (!supabaseAdminClient) {
      return res.status(500).json({ error: 'Supabase admin client is not configured.' });
    }

    const {
      recipient_user_ids: rawRecipientUserIds,
      entity_table: entityTable,
      entity_id: entityId,
      entity_title: entityTitle,
      board_type: boardType,
      parent_entity_table: parentEntityTable,
      parent_entity_id: parentEntityId,
    } = req.body || {};

    if (!ALLOWED_ENTITY_TABLES.has(entityTable)) {
      return res.status(400).json({ error: '지원하지 않는 알림 대상 테이블입니다.' });
    }

    const cleanEntityId = `${entityId || ''}`.trim();
    if (!cleanEntityId) {
      return res.status(400).json({ error: '알림 대상 ID가 필요합니다.' });
    }

    const recipientUserIds = normalizeUuidList(rawRecipientUserIds).filter((recipientId) => recipientId !== user.id);
    if (recipientUserIds.length === 0) {
      return res.json({ success: true, inserted: 0 });
    }

    if (parentEntityTable && !ALLOWED_ENTITY_TABLES.has(parentEntityTable)) {
      return res.status(400).json({ error: '지원하지 않는 상위 엔터티 테이블입니다.' });
    }

    const notifications = recipientUserIds.map((recipientUserId) => ({
      recipient_user_id: recipientUserId,
      actor_user_id: user.id,
      type: 'assignment_added',
      entity_table: entityTable,
      entity_id: cleanEntityId,
      parent_entity_table: normalizeOptionalText(parentEntityTable),
      parent_entity_id: normalizeOptionalText(parentEntityId),
      payload: {
        entity_title: normalizeOptionalText(entityTitle),
        board_type: normalizeOptionalText(boardType),
      },
    }));

    const { error } = await supabaseAdminClient
      .from('notifications')
      .insert(notifications);

    if (error) throw error;

    return res.json({ success: true, inserted: notifications.length });
  } catch (error) {
    console.error('Assignment notification error:', error);
    return res.status(500).json({ error: '담당자 알림 생성 중 오류가 발생했습니다.' });
  }
});

export const notificationsRouter = router;
