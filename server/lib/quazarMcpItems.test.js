import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createQuazarItem,
  createQuazarItemSearch,
  createQuazarItemUpdate,
  createQuazarProject,
  createQuazarProjectUpdate,
  createQuazarProjectLookup,
  findMatchingProjects,
  filterProjectsByQuery,
  formatQuazarItemDetail,
  formatQuazarProjectDetail,
  normalizeProjectName,
  validateCreateQuazarItemInput,
  validateCreateQuazarProjectInput,
  validateGetQuazarProjectInput,
  validateGetQuazarItemInput,
  validateSearchQuazarItemsInput,
  validateUpdateQuazarItemInput,
  validateUpdateQuazarProjectInput,
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
      status: 'todo',
      priority: 'high',
      tags: ['docs'],
      projectId: 'project-a',
      projectTitle: '온보딩 개선',
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
      status: 'todo',
      priority: '',
      tags: [],
      projectId: 'project-a',
      projectTitle: '온보딩 개선',
      boardType: '개발팀',
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
    }
  );
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
    status: 'done',
    priority: 'medium',
    tags: [],
    projectId: 'project-z',
    projectTitle: 'CS 운영',
    boardType: '지원팀',
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
  });
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
