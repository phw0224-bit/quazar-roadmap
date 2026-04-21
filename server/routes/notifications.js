import { Router } from 'express';
import { requireAuthenticatedUser } from '../lib/auth.js';
import { GOOGLE_CHAT_DEV_REQUEST_WEBHOOK_URL } from '../lib/config.js';
import { supabaseAdminClient, supabaseAuthClient } from '../lib/supabase.js';
import { buildDevRequestChatMessage, postGoogleChatWebhookMessage } from '../lib/googleChat.js';

const router = Router();

const ALLOWED_ENTITY_TABLES = new Set(['items', 'projects', 'roadmap_items', 'roadmap_projects']);
const DEV_REQUEST_TABLE = 'team_requests';

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

function normalizeLimit(value, fallback = 20, max = 50) {
  return Math.max(1, Math.min(Number(value) || fallback, max));
}

async function fetchRequestProfileName(userId) {
  const cleanUserId = normalizeOptionalText(userId);
  if (!cleanUserId || !supabaseAdminClient) {
    return null;
  }

  const { data, error } = await supabaseAdminClient
    .from('profiles')
    .select('name')
    .eq('id', cleanUserId)
    .maybeSingle();

  if (error) throw error;
  return normalizeOptionalText(data?.name);
}

async function fetchDevRequestById(requestId) {
  const cleanRequestId = normalizeOptionalText(requestId);
  if (!cleanRequestId || !supabaseAdminClient) {
    return null;
  }

  const { data, error } = await supabaseAdminClient
    .from(DEV_REQUEST_TABLE)
    .select('id, title, description, request_team, status, priority, board_type, created_by')
    .eq('id', cleanRequestId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchNotificationActorProfiles(actorUserIds = []) {
  const normalizedActorUserIds = normalizeUuidList(actorUserIds);
  if (normalizedActorUserIds.length === 0 || !supabaseAdminClient) {
    return [];
  }

  const { data, error } = await supabaseAdminClient
    .from('profiles')
    .select('id, name, department')
    .in('id', normalizedActorUserIds);

  if (error) throw error;
  return data || [];
}

router.get('/api/notifications', async (req, res) => {
  try {
    if (!supabaseAdminClient) {
      return res.status(500).json({ error: 'Supabase server configuration is missing.' });
    }

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const limit = normalizeLimit(req.query.limit, 20, 50);
    const [
      { data: notifications, error: notificationsError },
      { count: unreadCount, error: unreadCountError },
    ] = await Promise.all([
      supabaseAdminClient
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdminClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .is('read_at', null),
    ]);

    if (notificationsError) throw notificationsError;
    if (unreadCountError) throw unreadCountError;

    const actorProfiles = await fetchNotificationActorProfiles(
      (notifications || []).map((row) => row.actor_user_id)
    );
    const actorProfilesById = new Map(actorProfiles.map((profile) => [profile.id, profile]));

    return res.json({
      notifications: (notifications || []).map((notification) => ({
        ...notification,
        actor_profile: notification.actor_user_id
          ? actorProfilesById.get(notification.actor_user_id) || null
          : null,
      })),
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('Notification inbox fetch error:', error);
    return res.status(error.status || 500).json({
      error: error.message || '알림을 불러오지 못했습니다.',
    });
  }
});

router.post('/api/notifications/read', async (req, res) => {
  try {
    if (!supabaseAdminClient) {
      return res.status(500).json({ error: 'Supabase server configuration is missing.' });
    }

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const notificationIds = normalizeUuidList(req.body?.notificationIds || req.body?.ids);
    if (notificationIds.length === 0) {
      return res.json([]);
    }

    const timestamp = new Date().toISOString();
    const { data, error } = await supabaseAdminClient
      .from('notifications')
      .update({ read_at: timestamp })
      .eq('recipient_user_id', user.id)
      .in('id', notificationIds)
      .is('read_at', null)
      .select('id, read_at');

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('Notification read update error:', error);
    return res.status(error.status || 500).json({
      error: error.message || '알림 읽음 처리에 실패했습니다.',
    });
  }
});

router.post('/api/notifications/read-all', async (req, res) => {
  try {
    if (!supabaseAdminClient) {
      return res.status(500).json({ error: 'Supabase server configuration is missing.' });
    }

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const timestamp = new Date().toISOString();
    const { data, error } = await supabaseAdminClient
      .from('notifications')
      .update({ read_at: timestamp })
      .eq('recipient_user_id', user.id)
      .is('read_at', null)
      .select('id, read_at');

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('Notification read-all error:', error);
    return res.status(error.status || 500).json({
      error: error.message || '모든 알림을 읽음 처리하는 데 실패했습니다.',
    });
  }
});

router.post('/api/notifications/dev-requests', async (req, res) => {
  try {
    if (!supabaseAuthClient || !supabaseAdminClient) {
      return res.status(500).json({ error: 'Supabase server configuration is missing.' });
    }

    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;

    const requestId = normalizeOptionalText(req.body?.request_id || req.body?.requestId);
    if (!requestId) {
      return res.status(400).json({ error: 'request_id가 필요합니다.' });
    }

    if (!GOOGLE_CHAT_DEV_REQUEST_WEBHOOK_URL) {
      return res.json({ success: true, skipped: true, reason: 'webhook-not-configured' });
    }

    const request = await fetchDevRequestById(requestId);
    if (!request) {
      return res.status(404).json({ error: '개발팀 요청을 찾을 수 없습니다.' });
    }

    if (request.board_type !== '개발팀') {
      return res.status(400).json({ error: '개발팀 요청만 알림으로 보낼 수 있습니다.' });
    }

    const creatorName =
      (await fetchRequestProfileName(request.created_by)) ||
      user?.user_metadata?.name ||
      user?.email ||
      '알 수 없음';
    const messageText = buildDevRequestChatMessage({
      request: {
        ...request,
        id: request.id,
      },
      creatorName,
    });

    await postGoogleChatWebhookMessage(GOOGLE_CHAT_DEV_REQUEST_WEBHOOK_URL, messageText);

    return res.json({
      success: true,
      request: {
        id: request.id,
        title: request.title,
      },
    });
  } catch (error) {
    console.error('Dev request Google Chat notification error:', error);
    return res.status(error.status || 500).json({
      error: error.message || '개발팀 요청 Google Chat 알림 전송에 실패했습니다.',
    });
  }
});

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
