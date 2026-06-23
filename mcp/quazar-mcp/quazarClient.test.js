import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createQuazarSectionViaApi,
  createQuazarProjectViaApi,
  createQuazarItemViaApi,
  createQuazarItemCommentViaApi,
  createQuazarItemGitHubBranchViaApi,
  createQuazarItemGitHubIssueViaApi,
  createQuazarItemGitHubPullRequestViaApi,
  deleteQuazarItemCommentViaApi,
  getQuazarProjectActivityViaApi,
  getQuazarProjectViaApi,
  getQuazarItemViaApi,
  getQuazarItemGitHubBranchViaApi,
  listQuazarItemCommentsViaApi,
  listQuazarSectionsViaApi,
  listQuazarProjectsViaApi,
  resolveQuazarSectionViaApi,
  resolveQuazarProjectViaApi,
  searchQuazarItemsViaApi,
  updateQuazarItemCommentViaApi,
  updateQuazarProjectViaApi,
  updateQuazarItemViaApi,
} from './quazarClient.js';

test('createQuazarItemViaApi posts normalized payload with default tags and content', async () => {
  const calls = [];
  const result = await createQuazarItemViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'CREATED',
        itemId: 'item-1',
        projectId: 'project-a',
        projectTitle: '온보딩 개선',
        boardType: '개발팀',
        title: '신규 유저 가이드 추가',
        tags: [],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    projectName: '온보딩 개선',
    title: '신규 유저 가이드 추가',
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'CREATED',
    itemId: 'item-1',
    projectId: 'project-a',
    projectTitle: '온보딩 개선',
    boardType: '개발팀',
    title: '신규 유저 가이드 추가',
    tags: [],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/items');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer shared-secret');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '개발팀',
    projectName: '온보딩 개선',
    title: '신규 유저 가이드 추가',
    description: '',
    tags: [],
  });
});

test('createQuazarItemViaApi throws JSON API errors with the server code', async () => {
  await assert.rejects(
    createQuazarItemViaApi({
      baseUrl: 'http://localhost:3001',
      token: 'shared-secret',
      fetchImpl: async () => new Response(JSON.stringify({
        ok: false,
        code: 'PROJECT_NOT_FOUND',
        message: 'Project was not found.',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    }, {
      boardType: '개발팀',
      projectName: '없는 프로젝트',
      title: '신규 유저 가이드 추가',
    }),
    (error) => error?.code === 'PROJECT_NOT_FOUND'
      && error.message === 'Project was not found.'
  );
});

test('listQuazarSectionsViaApi sends boardType, query, and limit params', async () => {
  const calls = [];
  const result = await listQuazarSectionsViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
        count: 1,
        sections: [{ id: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    query: 'DP',
    limit: 10,
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'FOUND',
    boardType: '개발팀',
    count: 1,
    sections: [{ id: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 }],
  });
  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/sections?boardType=%EA%B0%9C%EB%B0%9C%ED%8C%80&query=DP&limit=10');
  assert.equal(calls[0].init.method, 'GET');
});

test('createQuazarSectionViaApi posts normalized section payload', async () => {
  const calls = [];
  const result = await createQuazarSectionViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'CREATED',
        sectionId: 'section-a',
        title: 'DPP',
        boardType: '개발팀',
        orderIndex: 0,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    title: 'DPP',
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'CREATED',
    sectionId: 'section-a',
    title: 'DPP',
    boardType: '개발팀',
    orderIndex: 0,
  });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '개발팀',
    title: 'DPP',
  });
});

test('resolveQuazarSectionViaApi requests exact section resolution params', async () => {
  const calls = [];
  const result = await resolveQuazarSectionViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
        sectionName: 'DPP',
        section: { sectionId: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 },
        candidates: [{ sectionId: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    sectionName: 'DPP',
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/sections/resolve?boardType=%EA%B0%9C%EB%B0%9C%ED%8C%80&sectionName=DPP');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(result.status, 'FOUND');
  assert.equal(result.section.sectionId, 'section-a');
});

test('listQuazarProjectsViaApi sends boardType, query, and limit params', async () => {
  const calls = [];
  const result = await listQuazarProjectsViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
        count: 1,
        projects: [{ id: 'project-a', title: '온보딩 개선' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    query: '온보딩',
    limit: 10,
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'FOUND',
    boardType: '개발팀',
    count: 1,
    projects: [{ id: 'project-a', title: '온보딩 개선' }],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/projects?boardType=%EA%B0%9C%EB%B0%9C%ED%8C%80&query=%EC%98%A8%EB%B3%B4%EB%94%A9&limit=10');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer shared-secret');
});

test('resolveQuazarProjectViaApi requests exact project resolution params', async () => {
  const calls = [];
  const result = await resolveQuazarProjectViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'AMBIGUOUS',
        boardType: '개발팀',
        projectName: '박형우',
        project: null,
        candidates: [
          { projectId: 'project-a', title: '박형우', sectionId: 'section-dpp', isCompleted: false, boardType: '개발팀' },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    projectName: '박형우',
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/projects/resolve?boardType=%EA%B0%9C%EB%B0%9C%ED%8C%80&projectName=%EB%B0%95%ED%98%95%EC%9A%B0');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(result.status, 'AMBIGUOUS');
  assert.equal(result.candidates.length, 1);
});

test('searchQuazarItemsViaApi sends supported filters as query params', async () => {
  const calls = [];
  const result = await searchQuazarItemsViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
        count: 1,
        items: [{ itemId: 'item-1', title: '온보딩 문서 정리' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    query: '온보딩',
    projectName: '온보딩 개선',
    status: 'todo',
    tags: ['docs', 'ux'],
    limit: 10,
    includeCompletedProjects: false,
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'FOUND',
    boardType: '개발팀',
    count: 1,
    items: [{ itemId: 'item-1', title: '온보딩 문서 정리' }],
  });
  assert.equal(
    calls[0].url,
    'http://localhost:3001/api/mcp/items?boardType=%EA%B0%9C%EB%B0%9C%ED%8C%80&query=%EC%98%A8%EB%B3%B4%EB%94%A9&projectName=%EC%98%A8%EB%B3%B4%EB%94%A9+%EA%B0%9C%EC%84%A0&status=todo&tags=docs%2Cux&limit=10&includeCompletedProjects=false'
  );
  assert.equal(calls[0].init.method, 'GET');
});

test('getQuazarItemViaApi requests item detail by board and id', async () => {
  const calls = [];
  const result = await getQuazarItemViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        itemId: 'item-1',
        title: '요약 개선',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: 'AI팀',
    itemId: 'item-1',
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'FOUND',
    itemId: 'item-1',
    title: '요약 개선',
  });
  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/items/item-1?boardType=AI%ED%8C%80');
  assert.equal(calls[0].init.method, 'GET');
});

test('listQuazarItemCommentsViaApi requests item comments by board and id', async () => {
  const calls = [];
  const result = await listQuazarItemCommentsViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        itemId: 'item-1',
        count: 1,
        comments: [{ commentId: 'comment-1', content: '첫 댓글' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: 'AI팀',
    itemId: 'item-1',
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/items/item-1/comments?boardType=AI%ED%8C%80');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(result.comments[0].commentId, 'comment-1');
});

test('createQuazarItemCommentViaApi posts normalized comment payload', async () => {
  const calls = [];
  await createQuazarItemCommentViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'CREATED',
        commentId: 'comment-1',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    itemId: 'item-1',
    content: '새 댓글',
    tags: ['mcp'],
    authorName: 'Codex',
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/items/item-1/comments');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '개발팀',
    content: '새 댓글',
    tags: ['mcp'],
    authorName: 'Codex',
  });
});

test('updateQuazarItemCommentViaApi patches comment content and tags', async () => {
  const calls = [];
  await updateQuazarItemCommentViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'UPDATED',
        commentId: 'comment-1',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    itemId: 'item-1',
    commentId: 'comment-1',
    content: '수정 댓글',
    tags: [],
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/items/item-1/comments/comment-1');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '개발팀',
    content: '수정 댓글',
    tags: [],
  });
});

test('deleteQuazarItemCommentViaApi deletes comment with board scope query', async () => {
  const calls = [];
  await deleteQuazarItemCommentViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'DELETED',
        commentId: 'comment-1',
        deleted: true,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    itemId: 'item-1',
    commentId: 'comment-1',
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/items/item-1/comments/comment-1?boardType=%EA%B0%9C%EB%B0%9C%ED%8C%80');
  assert.equal(calls[0].init.method, 'DELETE');
});

test('updateQuazarItemViaApi patches safe-core fields and forwards API errors', async () => {
  const calls = [];
  await assert.rejects(
    updateQuazarItemViaApi({
      baseUrl: 'http://localhost:3001',
      token: 'shared-secret',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({
          ok: false,
          code: 'ITEM_NOT_FOUND',
          message: 'Item was not found.',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    }, {
      boardType: '지원팀',
      itemId: 'item-7',
      description: '최신 설명',
      tags: [],
    }),
    (error) => error?.code === 'ITEM_NOT_FOUND' && error.status === 404
  );

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/items/item-7');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '지원팀',
    description: '최신 설명',
    tags: [],
  });
});

test('createQuazarProjectViaApi posts normalized project payload', async () => {
  const calls = [];
  const result = await createQuazarProjectViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'CREATED',
        projectId: 'project-a',
        title: '신규 온보딩 프로젝트',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    title: '신규 온보딩 프로젝트',
    tags: ['docs'],
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'CREATED',
    projectId: 'project-a',
    title: '신규 온보딩 프로젝트',
  });
  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/projects');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '개발팀',
    title: '신규 온보딩 프로젝트',
    sectionId: null,
    sectionName: '',
    tags: ['docs'],
  });
});

test('createQuazarProjectViaApi includes sectionName when provided', async () => {
  const calls = [];
  await createQuazarProjectViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'CREATED',
        projectId: 'project-a',
        title: '신규 온보딩 프로젝트',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '개발팀',
    title: '신규 온보딩 프로젝트',
    sectionName: 'DPP',
  });

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '개발팀',
    title: '신규 온보딩 프로젝트',
    sectionId: null,
    sectionName: 'DPP',
    tags: [],
  });
});

test('getQuazarProjectViaApi requests project detail by board and id', async () => {
  const calls = [];
  const result = await getQuazarProjectViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        projectId: 'project-a',
        title: 'LLM 개선',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: 'AI팀',
    projectId: 'project-a',
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'FOUND',
    projectId: 'project-a',
    title: 'LLM 개선',
  });
  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/projects/project-a?boardType=AI%ED%8C%80');
  assert.equal(calls[0].init.method, 'GET');
});

test('getQuazarProjectActivityViaApi requests project activity by board and id', async () => {
  const calls = [];
  const result = await getQuazarProjectActivityViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'FOUND',
        project: { projectId: 'project-a', title: '박형우' },
        count: 1,
        items: [{ itemId: 'item-1', title: '업무' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: 'AI팀',
    projectId: 'project-a',
  });

  assert.deepEqual(result.project, {
    projectId: 'project-a',
    title: '박형우',
  });
  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/projects/project-a/activity?boardType=AI%ED%8C%80');
  assert.equal(calls[0].init.method, 'GET');
});

test('updateQuazarProjectViaApi patches safe-core project fields', async () => {
  const calls = [];
  await updateQuazarProjectViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'UPDATED',
        projectId: 'project-z',
        title: 'CS 운영 개선',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    boardType: '지원팀',
    projectId: 'project-z',
    title: 'CS 운영 개선',
    isCompleted: true,
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/mcp/projects/project-z');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    boardType: '지원팀',
    title: 'CS 운영 개선',
    isCompleted: true,
  });
});

test('createQuazarItemGitHubIssueViaApi posts itemId with optional repoFullName', async () => {
  const calls = [];
  const result = await createQuazarItemGitHubIssueViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        ok: true,
        status: 'CREATED',
        issue: {
          item_id: 'item-55',
          repo_full_name: 'phw0224-bit/quazar-roadmap',
          issue_number: 31,
          issue_url: 'https://github.com/phw0224-bit/quazar-roadmap/issues/31',
        },
        ticket: {
          ticket_key: 'QZR-31',
          ticket_number: 31,
        },
        labelSync: {
          requested: ['mcp'],
          applied: ['mcp'],
          success: true,
          message: '',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    itemId: 'item-55',
    repoFullName: 'phw0224-bit/quazar-roadmap',
  });

  assert.equal(result.issue.issue_number, 31);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'CREATED');
  assert.equal(calls[0].url, 'http://localhost:3001/api/github/issues');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    itemId: 'item-55',
    repoFullName: 'phw0224-bit/quazar-roadmap',
  });
});

test('createQuazarItemGitHubIssueViaApi omits repoFullName when not provided', async () => {
  const calls = [];
  await createQuazarItemGitHubIssueViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, status: 'CREATED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    itemId: 'item-56',
  });

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    itemId: 'item-56',
  });
});

test('createQuazarItemGitHubIssueViaApi reuses existing linked issue as ALREADY_EXISTS', async () => {
  const result = await createQuazarItemGitHubIssueViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      ok: false,
      code: 'GITHUB_ISSUE_ALREADY_EXISTS',
      message: 'Issue already linked.',
      issue: {
        item_id: 'item-55',
        repo_full_name: 'phw0224-bit/quazar-roadmap',
        issue_number: 31,
        issue_url: 'https://github.com/phw0224-bit/quazar-roadmap/issues/31',
      },
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    }),
  }, {
    itemId: 'item-55',
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'ALREADY_EXISTS',
    issue: {
      item_id: 'item-55',
      repo_full_name: 'phw0224-bit/quazar-roadmap',
      issue_number: 31,
      issue_url: 'https://github.com/phw0224-bit/quazar-roadmap/issues/31',
    },
    ticket: null,
    labelSync: null,
  });
});

test('createQuazarItemGitHubBranchViaApi posts to the item branch endpoint', async () => {
  const calls = [];
  const result = await createQuazarItemGitHubBranchViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        itemId: 'item-77',
        repoFullName: 'phw0224-bit/quazar-roadmap',
        issueNumber: 77,
        issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/77',
        hasLinkedIssue: true,
        hasLinkedBranch: true,
        branchName: 'QZR-77',
        branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-77',
        created: true,
        branchSource: 'linked',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    itemId: 'item-77',
  });

  assert.equal(result.branchName, 'QZR-77');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'CREATED');
  assert.equal(calls[0].url, 'http://localhost:3001/api/github/items/item-77/branch');
  assert.equal(calls[0].init.method, 'POST');
});

test('createQuazarItemGitHubBranchViaApi returns ALREADY_EXISTS when branch already exists', async () => {
  const result = await createQuazarItemGitHubBranchViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      itemId: 'item-77',
      repoFullName: 'phw0224-bit/quazar-roadmap',
      issueNumber: 77,
      issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/77',
      hasLinkedIssue: true,
      hasLinkedBranch: true,
      branchName: 'QZR-77',
      branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-77',
      created: false,
      branchSource: 'linked',
      fromCache: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  }, {
    itemId: 'item-77',
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'ALREADY_EXISTS');
  assert.equal(result.branchName, 'QZR-77');
});

test('getQuazarItemGitHubBranchViaApi requests the item branch endpoint', async () => {
  const calls = [];
  const result = await getQuazarItemGitHubBranchViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        hasLinkedIssue: true,
        repoFullName: 'phw0224-bit/quazar-roadmap',
        branch: {
          branchName: 'QZR-77',
          branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-77',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    itemId: 'item-77',
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'FOUND');
  assert.equal(result.branch.branchName, 'QZR-77');
  assert.equal(calls[0].url, 'http://localhost:3001/api/github/items/item-77/branch');
  assert.equal(calls[0].init.method, 'GET');
});

test('createQuazarItemGitHubPullRequestViaApi uses roadmap draft defaults and creates a PR', async () => {
  const calls = [];
  const result = await createQuazarItemGitHubPullRequestViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/pull-request/prepare')) {
        return new Response(JSON.stringify({
          repoFullName: 'phw0224-bit/quazar-roadmap',
          issue: {
            issueNumber: 77,
            issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/77',
          },
          ticket: {
            ticket_key: 'QZR-77',
            ticket_number: 77,
          },
          branch: {
            branchName: 'QZR-77',
            branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-77',
          },
          baseBranch: 'main',
          defaultTitle: '[QZR-77] 작업 제목',
          defaultBody: 'PR 본문 초안',
          draft: true,
          existingPullRequest: null,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        itemId: 'item-77',
        repoFullName: 'phw0224-bit/quazar-roadmap',
        issue: {
          issueNumber: 77,
          issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/77',
        },
        branch: {
          branchName: 'QZR-77',
          branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-77',
        },
        pullRequest: {
          pull_number: 15,
          pull_url: 'https://github.com/phw0224-bit/quazar-roadmap/pull/15',
          pull_state_snapshot: 'open',
        },
        body: 'PR 본문 초안',
        created: true,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }, {
    itemId: 'item-77',
  });

  assert.equal(calls[0].url, 'http://localhost:3001/api/github/items/item-77/pull-request/prepare');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[1].url, 'http://localhost:3001/api/github/items/item-77/pull-request');
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    title: '[QZR-77] 작업 제목',
    body: 'PR 본문 초안',
    base: 'main',
    draft: true,
  });
  assert.equal(result.pullRequest.pull_number, 15);
});

test('createQuazarItemGitHubPullRequestViaApi returns ALREADY_EXISTS when prepare finds an existing PR', async () => {
  const result = await createQuazarItemGitHubPullRequestViaApi({
    baseUrl: 'http://localhost:3001',
    token: 'shared-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      repoFullName: 'phw0224-bit/quazar-roadmap',
      issue: {
        issueNumber: 77,
        issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/77',
      },
      ticket: {
        ticket_key: 'QZR-77',
        ticket_number: 77,
      },
      branch: {
        branchName: 'QZR-77',
        branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-77',
      },
      existingPullRequest: {
        pull_number: 15,
        pull_url: 'https://github.com/phw0224-bit/quazar-roadmap/pull/15',
        pull_state_snapshot: 'open',
      },
      defaultBody: 'PR 본문 초안',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  }, {
    itemId: 'item-77',
  });

  assert.equal(result.status, 'ALREADY_EXISTS');
  assert.equal(result.created, false);
  assert.equal(result.pullRequest.pull_number, 15);
});
