import { Router } from 'express';

import { MCP_SHARED_TOKEN } from '../lib/config.js';
import { supabaseAdminClient } from '../lib/supabase.js';
import { createQuazarItemService } from '../lib/quazarMcpItems.js';

function getBearerToken(headers = {}) {
  const authHeader = headers.authorization || headers.Authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

function getSharedService() {
  if (!supabaseAdminClient) {
    const error = new Error('Supabase server configuration is missing.');
    error.code = 'INTERNAL_ERROR';
    error.status = 500;
    throw error;
  }

  return createQuazarItemService(supabaseAdminClient);
}

function requireAuthorizedRequest(expectedToken, req, res) {
  const token = getBearerToken(req.headers || {});
  if (!expectedToken || token !== expectedToken) {
    res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized MCP request.',
    });
    return false;
  }

  return true;
}

function sendRouteError(res, error, fallbackMessage) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const payload = {
    ok: false,
    code: error?.code || 'INTERNAL_ERROR',
    message: error?.message || fallbackMessage,
  };

  if (Array.isArray(error?.candidates)) {
    payload.candidates = error.candidates;
  }

  return res.status(status).json(payload);
}

function sendRouteSuccess(res, status, result) {
  return res.status(200).json({
    ok: true,
    status,
    ...(result || {}),
  });
}

export function createMcpSectionsHandler({ expectedToken, listSections }) {
  return async function handleMcpSections(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const limitValue = Number(req.query?.limit);
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        query: typeof req.query?.query === 'string' ? req.query.query : '',
        limit: Number.isInteger(limitValue) ? limitValue : undefined,
      };
      const result = await listSections(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to list Quazar sections.');
    }
  };
}

export function createMcpSectionResolveHandler({ expectedToken, resolveSection }) {
  return async function handleMcpSectionResolve(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        sectionName: typeof req.query?.sectionName === 'string' ? req.query.sectionName : '',
      };
      const result = await resolveSection(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to resolve Quazar section.');
    }
  };
}

export function createMcpSectionCreateHandler({ expectedToken, createSection }) {
  return async function handleMcpSectionCreate(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.body?.boardType === 'string' ? req.body.boardType : '',
        title: typeof req.body?.title === 'string' ? req.body.title : '',
      };
      const result = await createSection(payload);
      return sendRouteSuccess(res, 'CREATED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to create Quazar section.');
    }
  };
}

export function createMcpItemsHandler({ expectedToken, createItem }) {
  return async function handleMcpItems(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        ...(req.body || {}),
        description: typeof req.body?.description === 'string' ? req.body.description : '',
        tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
      };
      const result = await createItem(payload);
      return sendRouteSuccess(res, 'CREATED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to create Quazar item.');
    }
  };
}

export function createMcpProjectsHandler({ expectedToken, listProjects }) {
  return async function handleMcpProjects(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const limitValue = Number(req.query?.limit);
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        query: typeof req.query?.query === 'string' ? req.query.query : '',
        limit: Number.isInteger(limitValue) ? limitValue : undefined,
      };
      const result = await listProjects(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to list Quazar projects.');
    }
  };
}

export function createMcpProjectResolveHandler({ expectedToken, resolveProject }) {
  return async function handleMcpProjectResolve(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        projectName: typeof req.query?.projectName === 'string' ? req.query.projectName : '',
      };
      const result = await resolveProject(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to resolve Quazar project.');
    }
  };
}

export function createMcpProjectCreateHandler({ expectedToken, createProject }) {
  return async function handleMcpProjectCreate(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.body?.boardType === 'string' ? req.body.boardType : '',
        title: typeof req.body?.title === 'string' ? req.body.title : '',
        sectionId: req.body?.sectionId === null
          ? null
          : typeof req.body?.sectionId === 'string'
            ? req.body.sectionId
            : undefined,
        sectionName: typeof req.body?.sectionName === 'string' ? req.body.sectionName : '',
        tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
      };
      const result = await createProject(payload);
      return sendRouteSuccess(res, 'CREATED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to create Quazar project.');
    }
  };
}

export function createMcpProjectDetailHandler({ expectedToken, getProject }) {
  return async function handleMcpProjectDetail(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        projectId: typeof req.params?.projectId === 'string' ? req.params.projectId : '',
      };
      const result = await getProject(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to get Quazar project.');
    }
  };
}

export function createMcpProjectActivityHandler({ expectedToken, getProjectActivity }) {
  return async function handleMcpProjectActivity(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        projectId: typeof req.params?.projectId === 'string' ? req.params.projectId : '',
      };
      const result = await getProjectActivity(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to get Quazar project activity.');
    }
  };
}

export function createMcpProjectUpdateHandler({ expectedToken, updateProject }) {
  return async function handleMcpProjectUpdate(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.body?.boardType === 'string' ? req.body.boardType : '',
        projectId: typeof req.params?.projectId === 'string' ? req.params.projectId : '',
      };

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
        payload.title = req.body.title;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tags')) {
        payload.tags = req.body.tags;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'isCompleted')) {
        payload.isCompleted = req.body.isCompleted;
      }

      const result = await updateProject(payload);
      return sendRouteSuccess(res, 'UPDATED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to update Quazar project.');
    }
  };
}

function parseTagQuery(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (typeof rawValue === 'string') {
    return rawValue.split(',').map((value) => value.trim()).filter(Boolean);
  }

  return [];
}

export function createMcpItemSearchHandler({ expectedToken, searchItems }) {
  return async function handleMcpItemSearch(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const limitValue = Number(req.query?.limit);
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        query: typeof req.query?.query === 'string' ? req.query.query : '',
        projectName: typeof req.query?.projectName === 'string' ? req.query.projectName : '',
        status: typeof req.query?.status === 'string' ? req.query.status : '',
        tags: parseTagQuery(req.query?.tags),
        limit: Number.isInteger(limitValue) ? limitValue : undefined,
        includeCompletedProjects: req.query?.includeCompletedProjects === 'false'
          ? false
          : req.query?.includeCompletedProjects === 'true'
            ? true
            : undefined,
      };
      const result = await searchItems(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to search Quazar items.');
    }
  };
}

export function createMcpItemDetailHandler({ expectedToken, getItem }) {
  return async function handleMcpItemDetail(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        itemId: typeof req.params?.itemId === 'string' ? req.params.itemId : '',
      };
      const result = await getItem(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to get Quazar item.');
    }
  };
}

export function createMcpItemUpdateHandler({ expectedToken, updateItem }) {
  return async function handleMcpItemUpdate(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        ...(req.body || {}),
        itemId: typeof req.params?.itemId === 'string' ? req.params.itemId : '',
      };

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tags') && !Array.isArray(req.body?.tags)) {
        payload.tags = req.body?.tags;
      } else if (Array.isArray(req.body?.tags)) {
        payload.tags = req.body.tags;
      }

      const result = await updateItem(payload);
      return sendRouteSuccess(res, 'UPDATED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to update Quazar item.');
    }
  };
}

export function createMcpItemCommentsHandler({ expectedToken, listComments }) {
  return async function handleMcpItemComments(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        itemId: typeof req.params?.itemId === 'string' ? req.params.itemId : '',
      };
      const result = await listComments(payload);
      return sendRouteSuccess(res, 'FOUND', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to list Quazar item comments.');
    }
  };
}

export function createMcpItemCommentCreateHandler({ expectedToken, createComment }) {
  return async function handleMcpItemCommentCreate(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.body?.boardType === 'string' ? req.body.boardType : '',
        itemId: typeof req.params?.itemId === 'string' ? req.params.itemId : '',
        content: typeof req.body?.content === 'string' ? req.body.content : '',
        tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
        authorName: typeof req.body?.authorName === 'string' ? req.body.authorName : '',
      };
      const result = await createComment(payload);
      return sendRouteSuccess(res, 'CREATED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to create Quazar item comment.');
    }
  };
}

export function createMcpItemCommentUpdateHandler({ expectedToken, updateComment }) {
  return async function handleMcpItemCommentUpdate(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.body?.boardType === 'string' ? req.body.boardType : '',
        itemId: typeof req.params?.itemId === 'string' ? req.params.itemId : '',
        commentId: typeof req.params?.commentId === 'string' ? req.params.commentId : '',
      };

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'content')) {
        payload.content = req.body.content;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tags')) {
        payload.tags = req.body.tags;
      }

      const result = await updateComment(payload);
      return sendRouteSuccess(res, 'UPDATED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to update Quazar item comment.');
    }
  };
}

export function createMcpItemCommentDeleteHandler({ expectedToken, deleteComment }) {
  return async function handleMcpItemCommentDelete(req, res) {
    if (!requireAuthorizedRequest(expectedToken, req, res)) return;

    try {
      const payload = {
        boardType: typeof req.query?.boardType === 'string' ? req.query.boardType : '',
        itemId: typeof req.params?.itemId === 'string' ? req.params.itemId : '',
        commentId: typeof req.params?.commentId === 'string' ? req.params.commentId : '',
      };
      const result = await deleteComment(payload);
      return sendRouteSuccess(res, 'DELETED', result);
    } catch (error) {
      return sendRouteError(res, error, 'Failed to delete Quazar item comment.');
    }
  };
}

export const mcpRouter = Router();

mcpRouter.get('/api/mcp/sections', createMcpSectionsHandler({
  expectedToken: MCP_SHARED_TOKEN,
  listSections: (payload) => getSharedService().listSections(payload),
}));

mcpRouter.get('/api/mcp/sections/resolve', createMcpSectionResolveHandler({
  expectedToken: MCP_SHARED_TOKEN,
  resolveSection: (payload) => getSharedService().resolveSection(payload),
}));

mcpRouter.post('/api/mcp/sections', createMcpSectionCreateHandler({
  expectedToken: MCP_SHARED_TOKEN,
  createSection: (payload) => getSharedService().createSection(payload),
}));

mcpRouter.get('/api/mcp/projects', createMcpProjectsHandler({
  expectedToken: MCP_SHARED_TOKEN,
  listProjects: (payload) => getSharedService().listProjects(payload),
}));

mcpRouter.get('/api/mcp/projects/resolve', createMcpProjectResolveHandler({
  expectedToken: MCP_SHARED_TOKEN,
  resolveProject: (payload) => getSharedService().resolveProject(payload),
}));

mcpRouter.post('/api/mcp/projects', createMcpProjectCreateHandler({
  expectedToken: MCP_SHARED_TOKEN,
  createProject: (payload) => getSharedService().createProject(payload),
}));

mcpRouter.get('/api/mcp/projects/:projectId', createMcpProjectDetailHandler({
  expectedToken: MCP_SHARED_TOKEN,
  getProject: (payload) => getSharedService().getProject(payload),
}));

mcpRouter.get('/api/mcp/projects/:projectId/activity', createMcpProjectActivityHandler({
  expectedToken: MCP_SHARED_TOKEN,
  getProjectActivity: (payload) => getSharedService().getProjectActivity(payload),
}));

mcpRouter.patch('/api/mcp/projects/:projectId', createMcpProjectUpdateHandler({
  expectedToken: MCP_SHARED_TOKEN,
  updateProject: (payload) => getSharedService().updateProject(payload),
}));

mcpRouter.get('/api/mcp/items', createMcpItemSearchHandler({
  expectedToken: MCP_SHARED_TOKEN,
  searchItems: (payload) => getSharedService().searchItems(payload),
}));

mcpRouter.get('/api/mcp/items/:itemId', createMcpItemDetailHandler({
  expectedToken: MCP_SHARED_TOKEN,
  getItem: (payload) => getSharedService().getItem(payload),
}));

mcpRouter.post('/api/mcp/items', createMcpItemsHandler({
  expectedToken: MCP_SHARED_TOKEN,
  createItem: (payload) => getSharedService().createItem(payload),
}));

mcpRouter.patch('/api/mcp/items/:itemId', createMcpItemUpdateHandler({
  expectedToken: MCP_SHARED_TOKEN,
  updateItem: (payload) => getSharedService().updateItem(payload),
}));

mcpRouter.get('/api/mcp/items/:itemId/comments', createMcpItemCommentsHandler({
  expectedToken: MCP_SHARED_TOKEN,
  listComments: (payload) => getSharedService().listComments(payload),
}));

mcpRouter.post('/api/mcp/items/:itemId/comments', createMcpItemCommentCreateHandler({
  expectedToken: MCP_SHARED_TOKEN,
  createComment: (payload) => getSharedService().createComment(payload),
}));

mcpRouter.patch('/api/mcp/items/:itemId/comments/:commentId', createMcpItemCommentUpdateHandler({
  expectedToken: MCP_SHARED_TOKEN,
  updateComment: (payload) => getSharedService().updateComment(payload),
}));

mcpRouter.delete('/api/mcp/items/:itemId/comments/:commentId', createMcpItemCommentDeleteHandler({
  expectedToken: MCP_SHARED_TOKEN,
  deleteComment: (payload) => getSharedService().deleteComment(payload),
}));
