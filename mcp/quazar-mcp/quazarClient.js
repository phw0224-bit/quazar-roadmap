function createError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function requestJson({ baseUrl, token, fetchImpl = fetch }, path, init) {
  const response = await fetchImpl(`${String(baseUrl || '').replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw createError(data?.code || 'REQUEST_FAILED', data?.message || 'Quazar API request failed.', {
      status: response.status,
      candidates: data?.candidates,
      issue: data?.issue,
      branch: data?.branch,
    });
  }

  return data;
}

async function requestJsonAllowAlreadyExists({ baseUrl, token, fetchImpl = fetch }, path, init, mapExisting) {
  try {
    return await requestJson({ baseUrl, token, fetchImpl }, path, init);
  } catch (error) {
    if (error?.status === 409 && typeof mapExisting === 'function') {
      const mapped = mapExisting(error);
      if (mapped) return mapped;
    }
    throw error;
  }
}

export async function createQuazarItemViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    boardType: payload.boardType,
    projectName: payload.projectName,
    title: payload.title,
    description: typeof payload.description === 'string' ? payload.description : '',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
  };

  return requestJson({ baseUrl, token, fetchImpl }, '/api/mcp/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function createQuazarProjectViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    boardType: payload.boardType,
    title: payload.title,
    sectionId: payload.sectionId === undefined ? null : payload.sectionId,
    sectionName: typeof payload.sectionName === 'string' ? payload.sectionName : '',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
  };

  return requestJson({ baseUrl, token, fetchImpl }, '/api/mcp/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function listQuazarSectionsViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  if (typeof payload.query === 'string' && payload.query.trim()) {
    params.set('query', payload.query);
  }

  if (payload.limit !== undefined) {
    params.set('limit', String(payload.limit));
  }

  return requestJson({ baseUrl, token, fetchImpl }, `/api/mcp/sections?${params.toString()}`, {
    method: 'GET',
  });
}

export async function createQuazarSectionViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    boardType: payload.boardType,
    title: payload.title,
  };

  return requestJson({ baseUrl, token, fetchImpl }, '/api/mcp/sections', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function resolveQuazarSectionViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
    sectionName: payload.sectionName,
  });

  return requestJson({ baseUrl, token, fetchImpl }, `/api/mcp/sections/resolve?${params.toString()}`, {
    method: 'GET',
  });
}

export async function listQuazarProjectsViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  if (typeof payload.query === 'string' && payload.query.trim()) {
    params.set('query', payload.query);
  }

  if (payload.limit !== undefined) {
    params.set('limit', String(payload.limit));
  }

  return requestJson({ baseUrl, token, fetchImpl }, `/api/mcp/projects?${params.toString()}`, {
    method: 'GET',
  });
}

export async function resolveQuazarProjectViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
    projectName: payload.projectName,
  });

  return requestJson({ baseUrl, token, fetchImpl }, `/api/mcp/projects/resolve?${params.toString()}`, {
    method: 'GET',
  });
}

export async function searchQuazarItemsViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  if (typeof payload.query === 'string' && payload.query.trim()) {
    params.set('query', payload.query);
  }

  if (typeof payload.projectName === 'string' && payload.projectName.trim()) {
    params.set('projectName', payload.projectName);
  }

  if (typeof payload.status === 'string' && payload.status.trim()) {
    params.set('status', payload.status);
  }

  if (Array.isArray(payload.tags) && payload.tags.length > 0) {
    params.set('tags', payload.tags.join(','));
  }

  if (payload.limit !== undefined) {
    params.set('limit', String(payload.limit));
  }

  if (payload.includeCompletedProjects !== undefined) {
    params.set('includeCompletedProjects', String(payload.includeCompletedProjects));
  }

  return requestJson({ baseUrl, token, fetchImpl }, `/api/mcp/items?${params.toString()}`, {
    method: 'GET',
  });
}

export async function getQuazarItemViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/items/${encodeURIComponent(payload.itemId)}?${params.toString()}`,
    {
      method: 'GET',
    }
  );
}

export async function listQuazarItemCommentsViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/items/${encodeURIComponent(payload.itemId)}/comments?${params.toString()}`,
    {
      method: 'GET',
    }
  );
}

export async function createQuazarItemCommentViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    boardType: payload.boardType,
    content: payload.content,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    authorName: typeof payload.authorName === 'string' ? payload.authorName : '',
  };

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/items/${encodeURIComponent(payload.itemId)}/comments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
}

export async function updateQuazarItemCommentViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    boardType: payload.boardType,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'content')) {
    body.content = payload.content;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    body.tags = payload.tags;
  }

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/items/${encodeURIComponent(payload.itemId)}/comments/${encodeURIComponent(payload.commentId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
}

export async function deleteQuazarItemCommentViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/items/${encodeURIComponent(payload.itemId)}/comments/${encodeURIComponent(payload.commentId)}?${params.toString()}`,
    {
      method: 'DELETE',
    }
  );
}

export async function getQuazarProjectViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/projects/${encodeURIComponent(payload.projectId)}?${params.toString()}`,
    {
      method: 'GET',
    }
  );
}

export async function getQuazarProjectActivityViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const params = new URLSearchParams({
    boardType: payload.boardType,
  });

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/projects/${encodeURIComponent(payload.projectId)}/activity?${params.toString()}`,
    {
      method: 'GET',
    }
  );
}

export async function updateQuazarItemViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    boardType: payload.boardType,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    body.status = payload.status;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'priority')) {
    body.priority = payload.priority;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    body.description = typeof payload.description === 'string' ? payload.description : '';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    body.tags = Array.isArray(payload.tags) ? payload.tags : payload.tags;
  }

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/items/${encodeURIComponent(payload.itemId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
}

export async function updateQuazarProjectViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    boardType: payload.boardType,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    body.title = payload.title;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    body.tags = payload.tags;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'isCompleted')) {
    body.isCompleted = payload.isCompleted;
  }

  return requestJson(
    { baseUrl, token, fetchImpl },
    `/api/mcp/projects/${encodeURIComponent(payload.projectId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
}

export async function createQuazarItemGitHubIssueViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const body = {
    itemId: payload.itemId,
  };

  if (typeof payload.repoFullName === 'string' && payload.repoFullName.trim()) {
    body.repoFullName = payload.repoFullName.trim();
  }

  return requestJsonAllowAlreadyExists(
    { baseUrl, token, fetchImpl },
    '/api/github/issues',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    (error) => {
      if (!error?.issue) return null;
      return {
        ok: true,
        status: 'ALREADY_EXISTS',
        issue: error.issue,
        ticket: null,
        labelSync: null,
      };
    }
  );
}

export async function createQuazarItemGitHubBranchViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const result = await requestJson(
    { baseUrl, token, fetchImpl },
    `/api/github/items/${encodeURIComponent(payload.itemId)}/branch`,
    {
      method: 'POST',
    }
  );
  return {
    ok: true,
    status: result?.created ? 'CREATED' : 'ALREADY_EXISTS',
    ...result,
  };
}

export async function getQuazarItemGitHubBranchViaApi(
  { baseUrl, token, fetchImpl = fetch },
  payload,
) {
  const result = await requestJson(
    { baseUrl, token, fetchImpl },
    `/api/github/items/${encodeURIComponent(payload.itemId)}/branch`,
    {
      method: 'GET',
    }
  );
  return {
    ok: true,
    status: 'FOUND',
    ...result,
  };
}
