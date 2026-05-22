import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMcpProjectCreateHandler,
  createMcpProjectDetailHandler,
  createMcpProjectUpdateHandler,
  createMcpItemDetailHandler,
  createMcpItemSearchHandler,
  createMcpItemUpdateHandler,
  createMcpItemsHandler,
  createMcpProjectsHandler,
} from './mcp.js';

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('createMcpItemsHandler rejects requests with an invalid bearer token', async () => {
  const res = createMockResponse();
  const handler = createMcpItemsHandler({
    expectedToken: 'shared-secret',
    createItem: async () => ({ itemId: 'item-1' }),
  });

  await handler(
    {
      headers: { authorization: 'Bearer wrong-secret' },
      body: {},
    },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    code: 'UNAUTHORIZED',
    message: 'Unauthorized MCP request.',
  });
});

test('createMcpItemsHandler returns item payload from the domain service', async () => {
  const res = createMockResponse();
  const handler = createMcpItemsHandler({
    expectedToken: 'shared-secret',
    createItem: async ({ boardType, projectName, title, description, tags }) => {
      assert.deepEqual(
        { boardType, projectName, title, description, tags },
        {
          boardType: '개발팀',
          projectName: '온보딩 개선',
          title: '신규 유저 가이드 추가',
          description: '',
          tags: [],
        }
      );
      return {
        itemId: 'item-1',
        projectId: 'project-a',
        projectTitle: '온보딩 개선',
        boardType,
        title,
        tags,
      };
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      body: {
        boardType: '개발팀',
        projectName: '온보딩 개선',
        title: '신규 유저 가이드 추가',
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    itemId: 'item-1',
    projectId: 'project-a',
    projectTitle: '온보딩 개선',
    boardType: '개발팀',
    title: '신규 유저 가이드 추가',
    tags: [],
  });
});

test('createMcpItemsHandler maps domain errors to JSON responses', async () => {
  const res = createMockResponse();
  const handler = createMcpItemsHandler({
    expectedToken: 'shared-secret',
    createItem: async () => {
      const error = new Error('Project match is ambiguous.');
      error.code = 'PROJECT_AMBIGUOUS';
      error.status = 409;
      error.candidates = [{ id: 'project-a', title: '온보딩 개선' }];
      throw error;
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      body: {
        boardType: '개발팀',
        projectName: '온보딩 개선',
        title: '신규 유저 가이드 추가',
      },
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    code: 'PROJECT_AMBIGUOUS',
    message: 'Project match is ambiguous.',
    candidates: [{ id: 'project-a', title: '온보딩 개선' }],
  });
});

test('createMcpProjectsHandler returns filtered project lookup results', async () => {
  const res = createMockResponse();
  const handler = createMcpProjectsHandler({
    expectedToken: 'shared-secret',
    listProjects: async ({ boardType, query, limit }) => {
      assert.deepEqual(
        { boardType, query, limit },
        { boardType: '개발팀', query: '온보딩', limit: 10 }
      );

      return {
        boardType,
        count: 1,
        projects: [{ id: 'project-a', title: '온보딩 개선' }],
      };
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      query: { boardType: '개발팀', query: '온보딩', limit: '10' },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    boardType: '개발팀',
    count: 1,
    projects: [{ id: 'project-a', title: '온보딩 개선' }],
  });
});

test('createMcpItemSearchHandler parses query filters and returns summaries', async () => {
  const res = createMockResponse();
  const handler = createMcpItemSearchHandler({
    expectedToken: 'shared-secret',
    searchItems: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        query: '온보딩',
        projectName: '온보딩 개선',
        status: 'todo',
        tags: ['docs', 'ux'],
        limit: 5,
        includeCompletedProjects: false,
      });

      return {
        boardType: '개발팀',
        count: 1,
        items: [{ itemId: 'item-1', title: '온보딩 문서 정리' }],
      };
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      query: {
        boardType: '개발팀',
        query: '온보딩',
        projectName: '온보딩 개선',
        status: 'todo',
        tags: 'docs,ux',
        limit: '5',
        includeCompletedProjects: 'false',
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    boardType: '개발팀',
    count: 1,
    items: [{ itemId: 'item-1', title: '온보딩 문서 정리' }],
  });
});

test('createMcpItemDetailHandler returns normalized item detail', async () => {
  const res = createMockResponse();
  const handler = createMcpItemDetailHandler({
    expectedToken: 'shared-secret',
    getItem: async (payload) => {
      assert.deepEqual(payload, {
        boardType: 'AI팀',
        itemId: 'item-1',
      });

      return {
        itemId: 'item-1',
        title: '요약 개선',
        description: '상세',
      };
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      params: { itemId: 'item-1' },
      query: { boardType: 'AI팀' },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    itemId: 'item-1',
    title: '요약 개선',
    description: '상세',
  });
});

test('createMcpItemUpdateHandler normalizes patch body and maps errors', async () => {
  const res = createMockResponse();
  const handler = createMcpItemUpdateHandler({
    expectedToken: 'shared-secret',
    updateItem: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '지원팀',
        itemId: 'item-9',
        status: 'done',
        tags: [],
      });

      const error = new Error('Item was not found.');
      error.code = 'ITEM_NOT_FOUND';
      error.status = 404;
      throw error;
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      params: { itemId: 'item-9' },
      body: {
        boardType: '지원팀',
        status: 'done',
        tags: [],
      },
    },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    code: 'ITEM_NOT_FOUND',
    message: 'Item was not found.',
  });
});

test('createMcpProjectCreateHandler returns created project detail', async () => {
  const res = createMockResponse();
  const handler = createMcpProjectCreateHandler({
    expectedToken: 'shared-secret',
    createProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        title: '신규 온보딩 프로젝트',
        sectionId: 'section-a',
        tags: ['docs'],
      });

      return {
        projectId: 'project-a',
        title: '신규 온보딩 프로젝트',
      };
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      body: {
        boardType: '개발팀',
        title: '신규 온보딩 프로젝트',
        sectionId: 'section-a',
        tags: ['docs'],
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    projectId: 'project-a',
    title: '신규 온보딩 프로젝트',
  });
});

test('createMcpProjectDetailHandler returns normalized project detail', async () => {
  const res = createMockResponse();
  const handler = createMcpProjectDetailHandler({
    expectedToken: 'shared-secret',
    getProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: 'AI팀',
        projectId: 'project-a',
      });

      return {
        projectId: 'project-a',
        title: 'LLM 개선',
      };
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      params: { projectId: 'project-a' },
      query: { boardType: 'AI팀' },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    projectId: 'project-a',
    title: 'LLM 개선',
  });
});

test('createMcpProjectUpdateHandler normalizes patch body and maps errors', async () => {
  const res = createMockResponse();
  const handler = createMcpProjectUpdateHandler({
    expectedToken: 'shared-secret',
    updateProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '지원팀',
        projectId: 'project-z',
        title: 'CS 운영 개선',
        isCompleted: true,
      });

      const error = new Error('Project was not found.');
      error.code = 'PROJECT_NOT_FOUND';
      error.status = 404;
      throw error;
    },
  });

  await handler(
    {
      headers: { authorization: 'Bearer shared-secret' },
      params: { projectId: 'project-z' },
      body: {
        boardType: '지원팀',
        title: 'CS 운영 개선',
        isCompleted: true,
      },
    },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    code: 'PROJECT_NOT_FOUND',
    message: 'Project was not found.',
  });
});
