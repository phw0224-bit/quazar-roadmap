import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createQuazarSection,
  createQuazarSectionLookup,
  resolveQuazarSection,
  createQuazarItem,
  createQuazarComment,
  createQuazarCommentUpdate,
  createQuazarItemSearch,
  createQuazarItemCommentLookup,
  createQuazarItemUpdate,
  getQuazarProjectActivity,
  createQuazarProject,
  createQuazarProjectUpdate,
  createQuazarProjectLookup,
  resolveQuazarProject,
  filterSectionsByQuery,
  findMatchingSections,
  findMatchingProjects,
  filterProjectsByQuery,
  formatQuazarItemDetail,
  formatQuazarProjectDetail,
  formatQuazarSectionDetail,
  normalizeProjectName,
  normalizeSectionName,
  validateCreateQuazarSectionInput,
  validateResolveQuazarSectionInput,
  validateListQuazarSectionsInput,
  validateCreateQuazarCommentInput,
  validateCreateQuazarItemInput,
  validateCreateQuazarProjectInput,
  validateDeleteQuazarCommentInput,
  validateGetQuazarProjectInput,
  validateResolveQuazarProjectInput,
  validateGetQuazarItemInput,
  validateListQuazarItemCommentsInput,
  validateSearchQuazarItemsInput,
  validateUpdateQuazarCommentInput,
  validateUpdateQuazarItemInput,
  validateUpdateQuazarProjectInput,
  createQuazarItemService,
  deleteQuazarComment,
  formatQuazarCommentDetail,
} from './quazarMcpItems.js';

test('normalizeProjectName collapses whitespace and lowercases values', () => {
  assert.equal(normalizeProjectName('  AI   Feature  Team  '), 'ai feature team');
});

test('validateCreateQuazarItemInput applies defaults for optional fields', () => {
  assert.deepEqual(
    validateCreateQuazarItemInput({
      boardType: '개발팀',
      projectName: '온보딩 개선',
      title: '신규 유저 가이드 추가',
    }),
    {
      boardType: '개발팀',
      projectName: '온보딩 개선',
      normalizedProjectName: '온보딩 개선',
      title: '신규 유저 가이드 추가',
      description: '',
      tags: [],
    }
  );
});

test('validateCreateQuazarItemInput rejects empty titles', () => {
  assert.throws(
    () => validateCreateQuazarItemInput({
      boardType: '개발팀',
      projectName: '온보딩 개선',
      title: '   ',
    }),
    (error) => error?.code === 'INVALID_INPUT' && /title/i.test(error.message)
  );
});

test('findMatchingProjects returns exact normalized title matches', () => {
  const projects = [
    { id: 'project-a', title: '온보딩 개선' },
    { id: 'project-b', title: '온보딩   개선 ' },
    { id: 'project-c', title: '백로그' },
  ];

  assert.deepEqual(
    findMatchingProjects(projects, ' 온보딩 개선 '),
    [
      { id: 'project-a', title: '온보딩 개선' },
      { id: 'project-b', title: '온보딩   개선 ' },
    ]
  );
});

test('filterProjectsByQuery returns normalized partial title matches', () => {
  const projects = [
    { id: 'project-a', title: '온보딩 개선' },
    { id: 'project-b', title: '온보딩 문서 정리' },
    { id: 'project-c', title: '백로그' },
  ];

  assert.deepEqual(
    filterProjectsByQuery(projects, '  온보딩  '),
    [
      { id: 'project-a', title: '온보딩 개선' },
      { id: 'project-b', title: '온보딩 문서 정리' },
    ]
  );
});

test('normalizeSectionName collapses whitespace and lowercases values', () => {
  assert.equal(normalizeSectionName('  DPP   Backend  '), 'dpp backend');
});

test('validateListQuazarSectionsInput applies defaults for lookup', () => {
  assert.deepEqual(
    validateListQuazarSectionsInput({
      boardType: '개발팀',
      query: ' DPP ',
    }),
    {
      boardType: '개발팀',
      query: 'DPP',
      limit: 20,
    }
  );
});

test('validateCreateQuazarSectionInput trims boardType and title', () => {
  assert.deepEqual(
    validateCreateQuazarSectionInput({
      boardType: ' 개발팀 ',
      title: ' DPP ',
    }),
    {
      boardType: '개발팀',
      title: 'DPP',
    }
  );
});

test('validateResolveQuazarSectionInput trims boardType and sectionName', () => {
  assert.deepEqual(
    validateResolveQuazarSectionInput({
      boardType: ' 개발팀 ',
      sectionName: ' DPP ',
    }),
    {
      boardType: '개발팀',
      sectionName: 'DPP',
    }
  );
});

test('findMatchingSections returns exact normalized title matches', () => {
  const sections = [
    { id: 'section-a', title: 'DPP' },
    { id: 'section-b', title: ' DPP ' },
    { id: 'section-c', title: '플랫폼' },
  ];

  assert.deepEqual(
    findMatchingSections(sections, ' dpp '),
    [
      { id: 'section-a', title: 'DPP' },
      { id: 'section-b', title: ' DPP ' },
    ]
  );
});

test('filterSectionsByQuery returns normalized partial title matches', () => {
  const sections = [
    { id: 'section-a', title: 'DPP' },
    { id: 'section-b', title: 'DPP Backend' },
    { id: 'section-c', title: '플랫폼' },
  ];

  assert.deepEqual(
    filterSectionsByQuery(sections, ' dpp '),
    [
      { id: 'section-a', title: 'DPP' },
      { id: 'section-b', title: 'DPP Backend' },
    ]
  );
});

test('createQuazarSectionLookup filters by query and limit', async () => {
  const lookup = createQuazarSectionLookup({
    listSections: async ({ boardType }) => {
      assert.equal(boardType, '개발팀');
      return [
        { id: 'section-a', title: 'DPP', board_type: '개발팀', order_index: 0 },
        { id: 'section-b', title: 'DPP Backend', board_type: '개발팀', order_index: 1 },
        { id: 'section-c', title: '플랫폼', board_type: '개발팀', order_index: 2 },
      ];
    },
  });

  const result = await lookup({
    boardType: '개발팀',
    query: 'DPP',
    limit: 1,
  });

  assert.deepEqual(result, {
    boardType: '개발팀',
    count: 1,
    sections: [
      { id: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 },
    ],
  });
});

test('createQuazarSection returns normalized created section detail', async () => {
  const result = await createQuazarSection({
    payload: {
      boardType: '개발팀',
      title: 'DPP',
    },
    insertSection: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        title: 'DPP',
      });

      return {
        id: 'section-a',
        title: 'DPP',
        board_type: '개발팀',
        order_index: 2,
      };
    },
  });

  assert.deepEqual(result, {
    sectionId: 'section-a',
    title: 'DPP',
    boardType: '개발팀',
    orderIndex: 2,
  });
});

test('resolveQuazarSection returns AMBIGUOUS without throwing', async () => {
  const result = await resolveQuazarSection({
    payload: {
      boardType: '개발팀',
      sectionName: 'DPP',
    },
    listSections: async () => [
      { id: 'section-a', title: 'DPP', board_type: '개발팀', order_index: 0 },
      { id: 'section-b', title: ' DPP ', board_type: '개발팀', order_index: 1 },
    ],
  });

  assert.deepEqual(result, {
    boardType: '개발팀',
    status: 'AMBIGUOUS',
    sectionName: 'DPP',
    section: null,
    candidates: [
      { sectionId: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 },
      { sectionId: 'section-b', title: ' DPP ', boardType: '개발팀', orderIndex: 1 },
    ],
  });
});

test('createQuazarProjectLookup filters by query and limit', async () => {
  const lookup = createQuazarProjectLookup({
    listProjects: async ({ boardType }) => {
      assert.equal(boardType, '개발팀');
      return [
        { id: 'project-a', title: '온보딩 개선' },
        { id: 'project-b', title: '온보딩 문서 정리' },
        { id: 'project-c', title: '백로그' },
      ];
    },
  });

  const result = await lookup({
    boardType: '개발팀',
    query: '온보딩',
    limit: 1,
  });

  assert.deepEqual(result, {
    boardType: '개발팀',
    count: 1,
    projects: [
      { id: 'project-a', title: '온보딩 개선' },
    ],
  });
});

test('createQuazarItem inserts with default item fields when one project matches', async () => {
  const insertedItem = { id: 'item-1' };
  const result = await createQuazarItem({
    payload: {
      boardType: '개발팀',
      projectName: '온보딩 개선',
      title: '신규 유저 가이드 추가',
      description: '상세 설명',
      tags: ['ux', 'docs'],
    },
    listProjects: async ({ boardType }) => {
      assert.equal(boardType, '개발팀');
      return [{ id: 'project-a', title: '온보딩 개선' }];
    },
    insertItem: async ({ boardType, projectId, title, description, tags }) => {
      assert.deepEqual(
        { boardType, projectId, title, description, tags },
        {
          boardType: '개발팀',
          projectId: 'project-a',
          title: '신규 유저 가이드 추가',
          description: '상세 설명',
          tags: ['ux', 'docs'],
        }
      );
      return insertedItem;
    },
  });

  assert.deepEqual(result, {
    itemId: 'item-1',
    projectId: 'project-a',
    projectTitle: '온보딩 개선',
    boardType: '개발팀',
    title: '신규 유저 가이드 추가',
    tags: ['ux', 'docs'],
  });
});

test('createQuazarItem returns PROJECT_NOT_FOUND when no project matches', async () => {
  await assert.rejects(
    createQuazarItem({
      payload: {
        boardType: '개발팀',
        projectName: '없는 프로젝트',
        title: '신규 유저 가이드 추가',
      },
      listProjects: async () => [{ id: 'project-a', title: '온보딩 개선' }],
      insertItem: async () => {
        throw new Error('should not insert');
      },
    }),
    (error) => error?.code === 'PROJECT_NOT_FOUND'
  );
});

test('createQuazarItem returns PROJECT_AMBIGUOUS with candidates when multiple projects match', async () => {
  await assert.rejects(
    createQuazarItem({
      payload: {
        boardType: '개발팀',
        projectName: '온보딩 개선',
        title: '신규 유저 가이드 추가',
      },
      listProjects: async () => [
        { id: 'project-a', title: '온보딩 개선' },
        { id: 'project-b', title: '온보딩   개선 ' },
      ],
      insertItem: async () => {
        throw new Error('should not insert');
      },
    }),
    (error) => error?.code === 'PROJECT_AMBIGUOUS'
      && Array.isArray(error.candidates)
      && error.candidates.length === 2
  );
});

test('validateSearchQuazarItemsInput applies defaults for optional filters', () => {
  assert.deepEqual(
    validateSearchQuazarItemsInput({
      boardType: 'AI팀',
      query: '  요약  ',
    }),
    {
      boardType: 'AI팀',
      query: '요약',
      projectName: '',
      normalizedProjectName: '',
      status: '',
      tags: [],
      limit: 20,
      includeCompletedProjects: true,
    }
  );
});

test('validateSearchQuazarItemsInput rejects invalid tags payloads', () => {
  assert.throws(
    () => validateSearchQuazarItemsInput({
      boardType: 'AI팀',
      tags: 'wrong',
    }),
    (error) => error?.code === 'INVALID_INPUT' && /tags/i.test(error.message)
  );
});

test('createQuazarItemSearch returns project-scoped summaries', async () => {
  const result = await createQuazarItemSearch({
    payload: {
      boardType: '개발팀',
      query: '온보딩',
      projectName: '온보딩 개선',
      tags: ['docs'],
      limit: 10,
      includeCompletedProjects: false,
    },
    listProjects: async ({ boardType }) => {
      assert.equal(boardType, '개발팀');
      return [{ id: 'project-a', title: '온보딩 개선' }];
    },
    searchItems: async (searchPayload) => {
      assert.deepEqual(searchPayload, {
        boardType: '개발팀',
        query: '온보딩',
        status: '',
        tags: ['docs'],
        limit: 10,
        includeCompletedProjects: false,
        projectId: 'project-a',
      });

      return [{
        id: 'item-1',
        title: '온보딩 문서 정리',
        description: '설명',
        status: 'todo',
        priority: 'high',
        tags: ['docs'],
        project_id: 'project-a',
        project_title: '온보딩 개선',
        updated_at: '2026-05-22T00:00:00.000Z',
      }];
    },
  });

  assert.deepEqual(result, {
    boardType: '개발팀',
    count: 1,
    items: [{
      itemId: 'item-1',
      title: '온보딩 문서 정리',
      description: '설명',
      itemStatus: 'todo',
      priority: 'high',
      tags: ['docs'],
      assignees: [],
      projectId: 'project-a',
      projectTitle: '온보딩 개선',
      pageType: null,
      startDate: null,
      endDate: null,
      ticketKey: null,
      ticketNumber: null,
      hasLinkedIssue: false,
      linkedIssueCount: 0,
      hasLinkedBranch: false,
      linkedBranchName: null,
      commentCount: 0,
      latestCommentAt: null,
      updatedAt: '2026-05-22T00:00:00.000Z',
    }],
  });
});

test('createQuazarItemSearch returns PROJECT_AMBIGUOUS when scoped project name matches multiple projects', async () => {
  await assert.rejects(
    createQuazarItemSearch({
      payload: {
        boardType: '개발팀',
        projectName: '온보딩 개선',
      },
      listProjects: async () => [
        { id: 'project-a', title: '온보딩 개선' },
        { id: 'project-b', title: '온보딩   개선 ' },
      ],
      searchItems: async () => [],
    }),
    (error) => error?.code === 'PROJECT_AMBIGUOUS'
      && Array.isArray(error.candidates)
      && error.candidates.length === 2
  );
});

test('validateGetQuazarItemInput trims board type and item id', () => {
  assert.deepEqual(
    validateGetQuazarItemInput({
      boardType: ' 개발팀 ',
      itemId: ' item-1 ',
    }),
    {
      boardType: '개발팀',
      itemId: 'item-1',
    }
  );
});

test('validateListQuazarItemCommentsInput trims board type and item id', () => {
  assert.deepEqual(
    validateListQuazarItemCommentsInput({
      boardType: ' 개발팀 ',
      itemId: ' item-1 ',
    }),
    {
      boardType: '개발팀',
      itemId: 'item-1',
    }
  );
});

test('validateCreateQuazarCommentInput normalizes optional author and tags', () => {
  assert.deepEqual(
    validateCreateQuazarCommentInput({
      boardType: '개발팀',
      itemId: 'item-1',
      content: ' 새 댓글 ',
      tags: ['mcp', 'MCP'],
      authorName: ' Codex ',
    }),
    {
      boardType: '개발팀',
      itemId: 'item-1',
      content: '새 댓글',
      tags: ['mcp'],
      authorName: 'Codex',
    }
  );
});

test('validateUpdateQuazarCommentInput accepts partial updates', () => {
  assert.deepEqual(
    validateUpdateQuazarCommentInput({
      boardType: '개발팀',
      itemId: 'item-1',
      commentId: 'comment-1',
      content: '수정 댓글',
      tags: [],
    }),
    {
      boardType: '개발팀',
      itemId: 'item-1',
      commentId: 'comment-1',
      patch: {
        content: '수정 댓글',
        tags: [],
      },
    }
  );
});

test('validateDeleteQuazarCommentInput trims ids', () => {
  assert.deepEqual(
    validateDeleteQuazarCommentInput({
      boardType: '개발팀',
      itemId: ' item-1 ',
      commentId: ' comment-1 ',
    }),
    {
      boardType: '개발팀',
      itemId: 'item-1',
      commentId: 'comment-1',
    }
  );
});

test('formatQuazarItemDetail normalizes item shape', () => {
  assert.deepEqual(
    formatQuazarItemDetail({
      id: 'item-1',
      title: '온보딩 문서 정리',
      description: null,
      status: 'todo',
      priority: null,
      tags: null,
      project_id: 'project-a',
      project_title: '온보딩 개선',
      created_at: '2026-05-20T00:00:00.000Z',
      updated_at: '2026-05-21T00:00:00.000Z',
    }, '개발팀'),
    {
      itemId: 'item-1',
      title: '온보딩 문서 정리',
      description: '',
      itemStatus: 'todo',
      priority: '',
      tags: [],
      assignees: [],
      assigneeUserIds: [],
      projectId: 'project-a',
      projectTitle: '온보딩 개선',
      pageType: null,
      startDate: null,
      endDate: null,
      isTicket: false,
      ticketKey: null,
      ticketNumber: null,
      hasLinkedIssue: false,
      linkedIssueCount: 0,
      linkedIssueRepoFullName: null,
      linkedIssueUrl: null,
      hasLinkedBranch: false,
      linkedBranchName: null,
      linkedBranchUrl: null,
      linkedBranchSource: null,
      commentCount: 0,
      latestCommentAt: null,
      boardType: '개발팀',
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
    }
  );
});

test('formatQuazarCommentDetail normalizes comment shape and author fallback', () => {
  assert.deepEqual(
    formatQuazarCommentDetail({
      id: 'comment-1',
      item_id: 'item-1',
      user_id: null,
      content: '댓글',
      tags: null,
      source: 'mcp',
      source_url: null,
      source_metadata: { author_name: 'Codex' },
      profiles: null,
      created_at: '2026-05-20T00:00:00.000Z',
      updated_at: '2026-05-21T00:00:00.000Z',
    }, '개발팀'),
    {
      commentId: 'comment-1',
      itemId: 'item-1',
      boardType: '개발팀',
      content: '댓글',
      tags: [],
      source: 'mcp',
      sourceUrl: null,
      sourceMetadata: { author_name: 'Codex' },
      authorUserId: null,
      authorName: 'Codex',
      authorDepartment: '',
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
    }
  );
});

test('createQuazarItemCommentLookup returns formatted comments for one item', async () => {
  const result = await createQuazarItemCommentLookup({
    payload: {
      boardType: '개발팀',
      itemId: 'item-1',
    },
    getItem: async () => ({ id: 'item-1' }),
    listComments: async ({ itemId }) => {
      assert.equal(itemId, 'item-1');
      return [{
        id: 'comment-1',
        item_id: 'item-1',
        content: '첫 댓글',
        tags: ['mcp'],
        source: 'mcp',
        source_metadata: { author_name: 'Codex' },
      }];
    },
  });

  assert.equal(result.count, 1);
  assert.equal(result.comments[0].authorName, 'Codex');
});

test('createQuazarComment returns formatted created comment', async () => {
  const result = await createQuazarComment({
    payload: {
      boardType: '개발팀',
      itemId: 'item-1',
      content: '새 댓글',
      authorName: 'Codex',
    },
    getItem: async () => ({ id: 'item-1' }),
    insertComment: async ({ itemId, content, tags, authorName }) => {
      assert.deepEqual({ itemId, content, tags, authorName }, {
        itemId: 'item-1',
        content: '새 댓글',
        tags: [],
        authorName: 'Codex',
      });
      return {
        id: 'comment-1',
        item_id: 'item-1',
        content: '새 댓글',
        tags: [],
        source: 'mcp',
        source_metadata: { author_name: 'Codex' },
      };
    },
  });

  assert.equal(result.commentId, 'comment-1');
  assert.equal(result.authorName, 'Codex');
});

test('createQuazarCommentUpdate rejects GitHub review comments', async () => {
  await assert.rejects(
    createQuazarCommentUpdate({
      payload: {
        boardType: '개발팀',
        itemId: 'item-1',
        commentId: 'comment-1',
        content: '수정 댓글',
      },
      getItem: async () => ({ id: 'item-1' }),
      getComment: async () => ({ id: 'comment-1', source: 'github_review' }),
      updateComment: async () => {
        throw new Error('should not update');
      },
    }),
    (error) => error?.code === 'COMMENT_READ_ONLY'
  );
});

test('deleteQuazarComment returns delete envelope for mutable comments', async () => {
  const result = await deleteQuazarComment({
    payload: {
      boardType: '개발팀',
      itemId: 'item-1',
      commentId: 'comment-1',
    },
    getItem: async () => ({ id: 'item-1' }),
    getComment: async () => ({ id: 'comment-1', source: 'mcp' }),
    deleteComment: async ({ itemId, commentId }) => {
      assert.deepEqual({ itemId, commentId }, { itemId: 'item-1', commentId: 'comment-1' });
    },
  });

  assert.deepEqual(result, {
    boardType: '개발팀',
    itemId: 'item-1',
    commentId: 'comment-1',
    deleted: true,
  });
});

test('validateUpdateQuazarItemInput accepts partial safe-core updates', () => {
  assert.deepEqual(
    validateUpdateQuazarItemInput({
      boardType: '지원팀',
      itemId: 'item-7',
      description: '새 설명',
      tags: ['ops'],
    }),
    {
      boardType: '지원팀',
      itemId: 'item-7',
      patch: {
        description: '새 설명',
        tags: ['ops'],
      },
    }
  );
});

test('validateUpdateQuazarItemInput rejects empty patch bodies', () => {
  assert.throws(
    () => validateUpdateQuazarItemInput({
      boardType: '지원팀',
      itemId: 'item-7',
    }),
    (error) => error?.code === 'INVALID_INPUT' && /at least one/i.test(error.message)
  );
});

test('createQuazarItemUpdate returns normalized updated item detail', async () => {
  const result = await createQuazarItemUpdate({
    payload: {
      boardType: '지원팀',
      itemId: 'item-7',
      status: 'done',
      tags: [],
    },
    getItem: async ({ boardType, itemId }) => {
      assert.deepEqual({ boardType, itemId }, { boardType: '지원팀', itemId: 'item-7' });
      return { id: 'item-7' };
    },
    updateItem: async ({ boardType, itemId, patch }) => {
      assert.deepEqual(
        { boardType, itemId, patch },
        {
          boardType: '지원팀',
          itemId: 'item-7',
          patch: {
            status: 'done',
            tags: [],
          },
        }
      );

      return {
        id: 'item-7',
        title: '응대 문구 정리',
        description: '최신 설명',
        status: 'done',
        priority: 'medium',
        tags: [],
        project_id: 'project-z',
        project_title: 'CS 운영',
        created_at: '2026-05-20T00:00:00.000Z',
        updated_at: '2026-05-22T00:00:00.000Z',
      };
    },
  });

  assert.deepEqual(result, {
    itemId: 'item-7',
    title: '응대 문구 정리',
    description: '최신 설명',
    itemStatus: 'done',
    priority: 'medium',
    tags: [],
    assignees: [],
    assigneeUserIds: [],
    projectId: 'project-z',
    projectTitle: 'CS 운영',
    pageType: null,
    startDate: null,
    endDate: null,
    isTicket: false,
    ticketKey: null,
    ticketNumber: null,
    hasLinkedIssue: false,
    linkedIssueCount: 0,
    linkedIssueRepoFullName: null,
    linkedIssueUrl: null,
    hasLinkedBranch: false,
    linkedBranchName: null,
    linkedBranchUrl: null,
    linkedBranchSource: null,
    commentCount: 0,
    latestCommentAt: null,
    boardType: '지원팀',
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
  });
});

test('getQuazarProjectActivity returns project detail with item summaries', async () => {
  const result = await getQuazarProjectActivity({
    payload: {
      boardType: '개발팀',
      projectId: 'project-phw',
    },
    getProject: async ({ boardType, projectId }) => {
      assert.deepEqual({ boardType, projectId }, {
        boardType: '개발팀',
        projectId: 'project-phw',
      });
      return {
        id: 'project-phw',
        title: '박형우',
        tags: ['개발'],
        is_completed: false,
        section_id: 'section-dpp',
      };
    },
    listItems: async ({ boardType, projectId }) => {
      assert.deepEqual({ boardType, projectId }, {
        boardType: '개발팀',
        projectId: 'project-phw',
      });
      return [{
        id: 'item-1',
        title: '업무',
        description: '설명',
        status: 'done',
        priority: 'high',
        tags: ['개발'],
        assignees: ['박형우'],
        project_id: 'project-phw',
        project_title: '박형우',
        ticket_key: 'QZR-DPPBE-1',
      }];
    },
    listCommentMetrics: async () => new Map([['item-1', { comment_count: 2, latest_comment_at: '2026-06-23T00:00:00.000Z' }]]),
    listIssueMetrics: async () => new Map([['item-1', { linked_issue_count: 1, has_linked_issue: true }]]),
  });

  assert.equal(result.project.projectId, 'project-phw');
  assert.equal(result.count, 1);
  assert.equal(result.items[0].ticketKey, 'QZR-DPPBE-1');
  assert.equal(result.items[0].commentCount, 2);
});

test('validateCreateQuazarProjectInput applies defaults for optional fields', () => {
  assert.deepEqual(
    validateCreateQuazarProjectInput({
      boardType: '개발팀',
      title: '신규 온보딩 프로젝트',
    }),
    {
      boardType: '개발팀',
      title: '신규 온보딩 프로젝트',
      sectionId: null,
      sectionName: '',
      tags: [],
    }
  );
});

test('validateCreateQuazarProjectInput preserves optional sectionName', () => {
  assert.deepEqual(
    validateCreateQuazarProjectInput({
      boardType: '개발팀',
      title: '신규 온보딩 프로젝트',
      sectionName: ' DPP ',
    }),
    {
      boardType: '개발팀',
      title: '신규 온보딩 프로젝트',
      sectionId: null,
      sectionName: 'DPP',
      tags: [],
    }
  );
});

test('createQuazarProject returns normalized created project detail', async () => {
  const result = await createQuazarProject({
    payload: {
      boardType: '개발팀',
      title: '신규 온보딩 프로젝트',
      sectionId: 'section-a',
      tags: ['docs'],
    },
    insertProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        title: '신규 온보딩 프로젝트',
        sectionId: 'section-a',
        tags: ['docs'],
      });

      return {
        id: 'project-a',
        title: '신규 온보딩 프로젝트',
        tags: ['docs'],
        is_completed: false,
        section_id: 'section-a',
        order_index: 3,
        created_at: '2026-05-22T00:00:00.000Z',
        updated_at: '2026-05-22T00:00:00.000Z',
      };
    },
  });

  assert.deepEqual(result, {
    projectId: 'project-a',
    title: '신규 온보딩 프로젝트',
    tags: ['docs'],
    isCompleted: false,
    sectionId: 'section-a',
    boardType: '개발팀',
    orderIndex: 3,
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
  });
});

test('createQuazarProject resolves sectionName before insert', async () => {
  const result = await createQuazarProject({
    payload: {
      boardType: '개발팀',
      title: 'Pinata 작업',
      sectionName: 'DPP',
    },
    listSections: async ({ boardType }) => {
      assert.equal(boardType, '개발팀');
      return [
        { id: 'section-dpp', title: 'DPP' },
      ];
    },
    insertProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        title: 'Pinata 작업',
        sectionId: 'section-dpp',
        tags: [],
      });

      return {
        id: 'project-dpp',
        title: 'Pinata 작업',
        tags: [],
        is_completed: false,
        section_id: 'section-dpp',
        order_index: 0,
        created_at: '2026-05-22T00:00:00.000Z',
      };
    },
  });

  assert.equal(result.sectionId, 'section-dpp');
});

test('createQuazarProject returns SECTION_NOT_FOUND when sectionName does not match', async () => {
  await assert.rejects(
    createQuazarProject({
      payload: {
        boardType: '개발팀',
        title: 'Pinata 작업',
        sectionName: 'DPP',
      },
      listSections: async () => [{ id: 'section-a', title: '플랫폼' }],
      insertProject: async () => {
        throw new Error('should not insert');
      },
    }),
    (error) => error?.code === 'SECTION_NOT_FOUND'
  );
});

test('createQuazarProject returns SECTION_AMBIGUOUS when sectionName matches multiple sections', async () => {
  await assert.rejects(
    createQuazarProject({
      payload: {
        boardType: '개발팀',
        title: 'Pinata 작업',
        sectionName: 'DPP',
      },
      listSections: async () => [
        { id: 'section-a', title: 'DPP' },
        { id: 'section-b', title: ' DPP ' },
      ],
      insertProject: async () => {
        throw new Error('should not insert');
      },
    }),
    (error) => error?.code === 'SECTION_AMBIGUOUS'
      && Array.isArray(error.candidates)
      && error.candidates.length === 2
  );
});

test('validateGetQuazarProjectInput trims board type and project id', () => {
  assert.deepEqual(
    validateGetQuazarProjectInput({
      boardType: ' AI팀 ',
      projectId: ' project-a ',
    }),
    {
      boardType: 'AI팀',
      projectId: 'project-a',
    }
  );
});

test('validateResolveQuazarProjectInput trims boardType and projectName', () => {
  assert.deepEqual(
    validateResolveQuazarProjectInput({
      boardType: ' 개발팀 ',
      projectName: ' 박형우 ',
    }),
    {
      boardType: '개발팀',
      projectName: '박형우',
    }
  );
});

test('formatQuazarProjectDetail normalizes project shape', () => {
  assert.deepEqual(
    formatQuazarProjectDetail({
      id: 'project-a',
      title: 'LLM 개선',
      tags: null,
      is_completed: null,
      section_id: null,
      order_index: 1,
      created_at: '2026-05-20T00:00:00.000Z',
      updated_at: '2026-05-21T00:00:00.000Z',
    }, 'AI팀'),
    {
      projectId: 'project-a',
      title: 'LLM 개선',
      tags: [],
      isCompleted: false,
      sectionId: null,
      boardType: 'AI팀',
      orderIndex: 1,
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
    }
  );
});

test('resolveQuazarProject returns FOUND project detail without throwing', async () => {
  const result = await resolveQuazarProject({
    payload: {
      boardType: '개발팀',
      projectName: '박형우',
    },
    listProjects: async () => [
      { id: 'project-phw', title: '박형우', section_id: 'section-dpp', is_completed: false, board_type: '개발팀' },
    ],
  });

  assert.deepEqual(result, {
    boardType: '개발팀',
    status: 'FOUND',
    projectName: '박형우',
    project: {
      projectId: 'project-phw',
      title: '박형우',
      sectionId: 'section-dpp',
      isCompleted: false,
      boardType: '개발팀',
    },
    candidates: [{
      projectId: 'project-phw',
      title: '박형우',
      sectionId: 'section-dpp',
      isCompleted: false,
      boardType: '개발팀',
    }],
  });
});

test('formatQuazarSectionDetail normalizes section shape', () => {
  assert.deepEqual(
    formatQuazarSectionDetail({
      id: 'section-a',
      title: 'DPP',
      board_type: '개발팀',
      order_index: 3,
    }),
    {
      sectionId: 'section-a',
      title: 'DPP',
      boardType: '개발팀',
      orderIndex: 3,
    }
  );
});

test('validateUpdateQuazarProjectInput accepts safe-core project updates', () => {
  assert.deepEqual(
    validateUpdateQuazarProjectInput({
      boardType: '지원팀',
      projectId: 'project-z',
      title: 'CS 운영 개선',
      isCompleted: true,
    }),
    {
      boardType: '지원팀',
      projectId: 'project-z',
      patch: {
        title: 'CS 운영 개선',
        isCompleted: true,
      },
    }
  );
});

test('validateUpdateQuazarProjectInput rejects empty patch bodies', () => {
  assert.throws(
    () => validateUpdateQuazarProjectInput({
      boardType: '지원팀',
      projectId: 'project-z',
    }),
    (error) => error?.code === 'INVALID_INPUT'
  );
});

test('createQuazarProjectUpdate returns normalized updated project detail', async () => {
  const result = await createQuazarProjectUpdate({
    payload: {
      boardType: '지원팀',
      projectId: 'project-z',
      title: 'CS 운영 개선',
      tags: ['ops'],
    },
    getProject: async ({ boardType, projectId }) => {
      assert.deepEqual({ boardType, projectId }, { boardType: '지원팀', projectId: 'project-z' });
      return { id: 'project-z' };
    },
    updateProject: async ({ boardType, projectId, patch }) => {
      assert.deepEqual(
        { boardType, projectId, patch },
        {
          boardType: '지원팀',
          projectId: 'project-z',
          patch: {
            title: 'CS 운영 개선',
            tags: ['ops'],
          },
        }
      );

      return {
        id: 'project-z',
        title: 'CS 운영 개선',
        tags: ['ops'],
        is_completed: false,
        section_id: 'section-z',
        order_index: 4,
        created_at: '2026-05-20T00:00:00.000Z',
        updated_at: '2026-05-22T00:00:00.000Z',
      };
    },
  });

  assert.deepEqual(result, {
    projectId: 'project-z',
    title: 'CS 운영 개선',
    tags: ['ops'],
    isCompleted: false,
    sectionId: 'section-z',
    boardType: '지원팀',
    orderIndex: 4,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
  });
});

test('createQuazarItemService createProject persists tags in insert payload', async () => {
  let insertedPayload = null;

  const supabase = {
    from(table) {
      assert.equal(table, 'projects');

      return {
        select(fields) {
          if (fields === 'id, title, board_type, order_index') {
            return Promise.resolve({ data: [], error: null });
          }

          if (fields === 'order_index') {
            return {
              eq(column, value) {
                assert.equal(column, 'board_type');
                assert.equal(value, '개발팀');
                return {
                  order(orderColumn, options) {
                    assert.equal(orderColumn, 'order_index');
                    assert.deepEqual(options, { ascending: false });
                    return {
                      limit(limitValue) {
                        assert.equal(limitValue, 1);
                        return Promise.resolve({ data: [], error: null });
                      },
                    };
                  },
                };
              },
            };
          }

          throw new Error(`unexpected select fields: ${fields}`);
        },
        insert(rows) {
          insertedPayload = rows;
          return {
            select(fields) {
              assert.equal(fields, 'id, title, tags, is_completed, section_id, order_index, created_at, board_type');
              return {
                single() {
                  return Promise.resolve({
                    data: {
                      id: 'project-a',
                      title: '신규 온보딩 프로젝트',
                      tags: ['docs'],
                      is_completed: false,
                      section_id: 'section-a',
                      order_index: 0,
                      created_at: '2026-05-22T00:00:00.000Z',
                      board_type: '개발팀',
                    },
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const service = createQuazarItemService(supabase);
  const result = await service.createProject({
    boardType: '개발팀',
    title: '신규 온보딩 프로젝트',
    sectionId: 'section-a',
    tags: ['docs'],
  });

  assert.deepEqual(insertedPayload, [{
    title: '신규 온보딩 프로젝트',
    order_index: 0,
    board_type: '개발팀',
    assignees: [],
    assignee_user_ids: [],
    section_id: 'section-a',
    is_completed: false,
    tags: ['docs'],
  }]);
  assert.deepEqual(result.tags, ['docs']);
});

test('createQuazarItemService updateProject persists tags in update payload', async () => {
  let updatedPayload = null;

  const supabase = {
    from(table) {
      assert.equal(table, 'projects');

      return {
        select(fields) {
          assert.equal(fields, 'id, title, tags, assignees, assignee_user_ids, is_completed, section_id, order_index, created_at, updated_at, board_type');
          return {
            eq(column, value) {
              assert.equal(column, 'board_type');
              assert.equal(value, '지원팀');
              return {
                eq(nextColumn, nextValue) {
                  assert.equal(nextColumn, 'id');
                  assert.equal(nextValue, 'project-z');
                  return {
                    maybeSingle() {
                      return Promise.resolve({
                        data: {
                          id: 'project-z',
                          title: '기존 프로젝트',
                          is_completed: false,
                          section_id: 'section-z',
                          order_index: 4,
                          created_at: '2026-05-20T00:00:00.000Z',
                          board_type: '지원팀',
                        },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
        update(payload) {
          updatedPayload = payload;
          return {
            eq(column, value) {
              assert.equal(column, 'board_type');
              assert.equal(value, '지원팀');
              return {
                eq(nextColumn, nextValue) {
                  assert.equal(nextColumn, 'id');
                  assert.equal(nextValue, 'project-z');
                  return {
                    select(fields) {
                      assert.equal(fields, 'id, title, tags, is_completed, section_id, order_index, created_at, board_type');
                      return {
                        maybeSingle() {
                          return Promise.resolve({
                            data: {
                              id: 'project-z',
                              title: 'CS 운영 개선',
                              tags: ['ops'],
                              is_completed: false,
                              section_id: 'section-z',
                              order_index: 4,
                              created_at: '2026-05-20T00:00:00.000Z',
                              updated_at: '2026-05-22T00:00:00.000Z',
                              board_type: '지원팀',
                            },
                            error: null,
                          });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const service = createQuazarItemService(supabase);
  const result = await service.updateProject({
    boardType: '지원팀',
    projectId: 'project-z',
    title: 'CS 운영 개선',
    tags: ['ops'],
  });

  assert.deepEqual(updatedPayload, {
    title: 'CS 운영 개선',
    tags: ['ops'],
  });
  assert.deepEqual(result.tags, ['ops']);
});
