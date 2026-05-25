import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSuggestedCheckoutCommands,
  inferRepoFullNameFromGitRemote,
  runCreateQuazarItemGitHubBranchTool,
  runCreateQuazarItemGitHubIssueTool,
  runCreateQuazarProjectTool,
  runResolveQuazarProjectTool,
  runResolveQuazarSectionTool,
  runCreateQuazarSectionTool,
  runCreateQuazarItemTool,
  runGetQuazarProjectTool,
  runGetQuazarItemGitHubBranchTool,
  runGetQuazarItemTool,
  runListQuazarProjectsTool,
  runListQuazarSectionsTool,
  runSearchQuazarItemsTool,
  runUpdateQuazarProjectTool,
  runUpdateQuazarItemTool,
} from './server.js';

test('runCreateQuazarItemTool returns structured MCP content from the Quazar API result', async () => {
  const result = await runCreateQuazarItemTool({
    boardType: '개발팀',
    projectName: '온보딩 개선',
    title: '신규 유저 가이드 추가',
    description: '상세 설명',
    tags: ['ux'],
  }, {
    createItem: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        projectName: '온보딩 개선',
        title: '신규 유저 가이드 추가',
        description: '상세 설명',
        tags: ['ux'],
      });

      return {
        ok: true,
        status: 'CREATED',
        itemId: 'item-1',
        projectId: 'project-a',
        projectTitle: '온보딩 개선',
        boardType: '개발팀',
        title: '신규 유저 가이드 추가',
        tags: ['ux'],
      };
    },
  });

  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.status, 'CREATED');
  assert.match(result.content[0].text, /item-1/);
  assert.match(result.content[0].text, /온보딩 개선/);
});

test('runListQuazarSectionsTool returns section lookup content and structured output', async () => {
  const result = await runListQuazarSectionsTool({
    boardType: '개발팀',
    query: 'DPP',
    limit: 10,
  }, {
    listSections: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        query: 'DPP',
        limit: 10,
      });

      return {
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
        count: 2,
        sections: [
          { id: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 },
          { id: 'section-b', title: 'DPP BE', boardType: '개발팀', orderIndex: 1 },
        ],
      };
    },
  });

  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.count, 2);
  assert.match(result.content[0].text, /DPP/);
});

test('runCreateQuazarSectionTool returns structured MCP content from the Quazar API result', async () => {
  const result = await runCreateQuazarSectionTool({
    boardType: '개발팀',
    title: 'DPP',
  }, {
    createSection: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        title: 'DPP',
      });

      return {
        ok: true,
        status: 'CREATED',
        sectionId: 'section-a',
        title: 'DPP',
        boardType: '개발팀',
        orderIndex: 0,
      };
    },
  });

  assert.equal(result.structuredContent.sectionId, 'section-a');
  assert.equal(result.structuredContent.ok, true);
  assert.match(result.content[0].text, /DPP/);
});

test('runResolveQuazarSectionTool returns AMBIGUOUS resolution without throwing', async () => {
  const result = await runResolveQuazarSectionTool({
    boardType: '개발팀',
    sectionName: 'DPP',
  }, {
    resolveSection: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        sectionName: 'DPP',
      });

      return {
        ok: true,
        status: 'AMBIGUOUS',
        boardType: '개발팀',
        sectionName: 'DPP',
        section: null,
        candidates: [
          { sectionId: 'section-a', title: 'DPP', boardType: '개발팀', orderIndex: 0 },
        ],
      };
    },
  });

  assert.equal(result.structuredContent.status, 'AMBIGUOUS');
  assert.equal(result.structuredContent.ok, true);
  assert.match(result.content[0].text, /Multiple Quazar sections matched/);
});

test('runListQuazarProjectsTool returns project lookup content and structured output', async () => {
  const result = await runListQuazarProjectsTool({
    boardType: '개발팀',
    query: '온보딩',
    limit: 10,
  }, {
    listProjects: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        query: '온보딩',
        limit: 10,
      });

      return {
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
        count: 2,
        projects: [
          { id: 'project-a', title: '온보딩 개선' },
          { id: 'project-b', title: '온보딩 문서 정리' },
        ],
      };
    },
  });

  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.count, 2);
  assert.match(result.content[0].text, /온보딩 개선/);
  assert.match(result.content[0].text, /온보딩 문서 정리/);
});

test('runResolveQuazarProjectTool returns FOUND resolution payload', async () => {
  const result = await runResolveQuazarProjectTool({
    boardType: '개발팀',
    projectName: '박형우',
  }, {
    resolveProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        projectName: '박형우',
      });

      return {
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
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
      };
    },
  });

  assert.equal(result.structuredContent.status, 'FOUND');
  assert.equal(result.structuredContent.project.projectId, 'project-phw');
  assert.match(result.content[0].text, /Resolved Quazar project/);
});

test('runSearchQuazarItemsTool returns compact item summaries', async () => {
  const result = await runSearchQuazarItemsTool({
    boardType: '개발팀',
    projectName: '온보딩 개선',
    query: '온보딩',
  }, {
    searchItems: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        projectName: '온보딩 개선',
        query: '온보딩',
      });

      return {
        ok: true,
        status: 'FOUND',
        boardType: '개발팀',
        count: 1,
        items: [{
          itemId: 'item-1',
          title: '온보딩 문서 정리',
          projectTitle: '온보딩 개선',
          itemStatus: 'todo',
        }],
      };
    },
  });

  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.count, 1);
  assert.match(result.content[0].text, /온보딩 문서 정리/);
  assert.match(result.content[0].text, /온보딩 개선/);
});

test('runGetQuazarItemTool returns detail payload and readable summary', async () => {
  const result = await runGetQuazarItemTool({
    boardType: 'AI팀',
    itemId: 'item-4',
  }, {
    getItem: async (payload) => {
      assert.deepEqual(payload, {
        boardType: 'AI팀',
        itemId: 'item-4',
      });

      return {
        ok: true,
        status: 'FOUND',
        itemId: 'item-4',
        title: '요약 개선',
        projectTitle: 'LLM 개선',
        boardType: 'AI팀',
        itemStatus: 'in_progress',
      };
    },
  });

  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.itemId, 'item-4');
  assert.match(result.content[0].text, /요약 개선/);
  assert.match(result.content[0].text, /LLM 개선/);
});

test('runUpdateQuazarItemTool returns updated item details', async () => {
  const result = await runUpdateQuazarItemTool({
    boardType: '지원팀',
    itemId: 'item-9',
    status: 'done',
  }, {
    updateItem: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '지원팀',
        itemId: 'item-9',
        status: 'done',
      });

      return {
        ok: true,
        status: 'UPDATED',
        itemId: 'item-9',
        title: '응대 문구 정리',
        projectTitle: 'CS 운영',
        boardType: '지원팀',
        itemStatus: 'done',
      };
    },
  });

  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.status, 'UPDATED');
  assert.match(result.content[0].text, /응대 문구 정리/);
});

test('runCreateQuazarProjectTool returns structured MCP content from the Quazar API result', async () => {
  const result = await runCreateQuazarProjectTool({
    boardType: '개발팀',
    title: '신규 온보딩 프로젝트',
    sectionName: 'DPP',
  }, {
    createProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        title: '신규 온보딩 프로젝트',
        sectionName: 'DPP',
      });

      return {
        ok: true,
        status: 'CREATED',
        projectId: 'project-a',
        title: '신규 온보딩 프로젝트',
        boardType: '개발팀',
      };
    },
  });

  assert.equal(result.structuredContent.projectId, 'project-a');
  assert.equal(result.structuredContent.ok, true);
  assert.match(result.content[0].text, /신규 온보딩 프로젝트/);
});

test('runGetQuazarProjectTool returns detail payload and readable summary', async () => {
  const result = await runGetQuazarProjectTool({
    boardType: 'AI팀',
    projectId: 'project-a',
  }, {
    getProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: 'AI팀',
        projectId: 'project-a',
      });

      return {
        ok: true,
        status: 'FOUND',
        projectId: 'project-a',
        title: 'LLM 개선',
        boardType: 'AI팀',
        isCompleted: false,
      };
    },
  });

  assert.equal(result.structuredContent.projectId, 'project-a');
  assert.equal(result.structuredContent.ok, true);
  assert.match(result.content[0].text, /LLM 개선/);
});

test('runUpdateQuazarProjectTool returns updated project details', async () => {
  const result = await runUpdateQuazarProjectTool({
    boardType: '지원팀',
    projectId: 'project-z',
    title: 'CS 운영 개선',
  }, {
    updateProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '지원팀',
        projectId: 'project-z',
        title: 'CS 운영 개선',
      });

      return {
        ok: true,
        status: 'UPDATED',
        projectId: 'project-z',
        title: 'CS 운영 개선',
        boardType: '지원팀',
        isCompleted: false,
      };
    },
  });

  assert.equal(result.structuredContent.projectId, 'project-z');
  assert.equal(result.structuredContent.ok, true);
  assert.match(result.content[0].text, /CS 운영 개선/);
});

test('runCreateQuazarItemGitHubIssueTool uses explicit repoFullName when provided', async () => {
  const result = await runCreateQuazarItemGitHubIssueTool({
    itemId: 'item-55',
    repoFullName: 'phw0224-bit/quazar-roadmap',
  }, {
    createGitHubIssue: async (payload) => {
      assert.deepEqual(payload, {
        itemId: 'item-55',
        repoFullName: 'phw0224-bit/quazar-roadmap',
      });

      return {
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
          requested: [],
          applied: [],
          success: true,
          message: '',
        },
      };
    },
  });

  assert.equal(result.structuredContent.repoFullName, 'phw0224-bit/quazar-roadmap');
  assert.equal(result.structuredContent.repoSource, 'explicit');
  assert.equal(result.structuredContent.issueNumber, 31);
  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.status, 'CREATED');
  assert.match(result.content[0].text, /QZR-31/);
});

test('runCreateQuazarItemGitHubIssueTool surfaces ALREADY_EXISTS as success', async () => {
  const result = await runCreateQuazarItemGitHubIssueTool({
    itemId: 'item-55',
    repoFullName: 'phw0224-bit/quazar-roadmap',
  }, {
    createGitHubIssue: async () => ({
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
    }),
  });

  assert.equal(result.structuredContent.status, 'ALREADY_EXISTS');
  assert.equal(result.structuredContent.ok, true);
});

test('runCreateQuazarItemGitHubIssueTool falls back to workspace repo suggestion', async () => {
  const result = await runCreateQuazarItemGitHubIssueTool({
    itemId: 'item-56',
  }, {
    getSuggestedRepoFullName: () => 'phw0224-bit/quazar-roadmap',
    createGitHubIssue: async (payload) => {
      assert.deepEqual(payload, {
        itemId: 'item-56',
        repoFullName: 'phw0224-bit/quazar-roadmap',
      });

      return {
        ok: true,
        status: 'CREATED',
        issue: {
          item_id: 'item-56',
          repo_full_name: 'phw0224-bit/quazar-roadmap',
          issue_number: 32,
          issue_url: 'https://github.com/phw0224-bit/quazar-roadmap/issues/32',
        },
        ticket: {
          ticket_key: 'QZR-32',
          ticket_number: 32,
        },
        labelSync: {
          requested: ['mcp'],
          applied: ['mcp'],
          success: true,
          message: '',
        },
      };
    },
  });

  assert.equal(result.structuredContent.repoSource, 'workspace');
  assert.equal(result.structuredContent.repoFullName, 'phw0224-bit/quazar-roadmap');
});

test('runCreateQuazarItemGitHubIssueTool throws when repoFullName cannot be resolved', async () => {
  await assert.rejects(
    runCreateQuazarItemGitHubIssueTool({
      itemId: 'item-57',
    }, {
      getSuggestedRepoFullName: () => null,
      createGitHubIssue: async () => {
        throw new Error('should not be called');
      },
    }),
    /repoFullName을 명시하거나 현재 워크스페이스의 origin remote를 GitHub로 설정해야 합니다\./
  );
});

test('runCreateQuazarItemGitHubBranchTool includes suggested checkout commands', async () => {
  const result = await runCreateQuazarItemGitHubBranchTool({
    itemId: 'item-77',
  }, {
    createGitHubBranch: async (payload) => {
      assert.deepEqual(payload, {
        itemId: 'item-77',
      });

      return {
        ok: true,
        status: 'CREATED',
        itemId: 'item-77',
        repoFullName: 'phw0224-bit/quazar-roadmap',
        issueNumber: 77,
        issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/77',
        branchName: 'QZR-77',
        branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-77',
        created: true,
        branchSource: 'linked',
      };
    },
  });

  assert.equal(result.structuredContent.branchName, 'QZR-77');
  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.status, 'CREATED');
  assert.deepEqual(result.structuredContent.suggestedCheckoutCommand, [
    'git fetch origin QZR-77',
    'git switch QZR-77 || git switch --track -c QZR-77 origin/QZR-77',
  ]);
});

test('runCreateQuazarItemGitHubBranchTool maps reused branch to ALREADY_EXISTS', async () => {
  const result = await runCreateQuazarItemGitHubBranchTool({
    itemId: 'item-77',
  }, {
    createGitHubBranch: async () => ({
      ok: true,
      status: 'ALREADY_EXISTS',
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
    }),
  });

  assert.equal(result.structuredContent.status, 'ALREADY_EXISTS');
  assert.equal(result.structuredContent.ok, true);
});

test('runGetQuazarItemGitHubBranchTool flattens branch payload and adds checkout commands', async () => {
  const result = await runGetQuazarItemGitHubBranchTool({
    itemId: 'item-88',
  }, {
    getGitHubBranch: async (payload) => {
      assert.deepEqual(payload, {
        itemId: 'item-88',
      });

      return {
        ok: true,
        status: 'FOUND',
        hasLinkedIssue: true,
        hasLinkedBranch: true,
        repoFullName: 'phw0224-bit/quazar-roadmap',
        issue: {
          issueNumber: 88,
          issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/88',
        },
        branch: {
          branchName: 'QZR-88',
          branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-88',
        },
        branchSource: 'linked',
        fromCache: true,
      };
    },
  });

  assert.equal(result.structuredContent.branchName, 'QZR-88');
  assert.equal(result.structuredContent.repoFullName, 'phw0224-bit/quazar-roadmap');
  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.status, 'FOUND');
  assert.deepEqual(result.structuredContent.suggestedCheckoutCommand, [
    'git fetch origin QZR-88',
    'git switch QZR-88 || git switch --track -c QZR-88 origin/QZR-88',
  ]);
});

test('inferRepoFullNameFromGitRemote supports GitHub SSH and HTTPS remotes', () => {
  assert.equal(
    inferRepoFullNameFromGitRemote('git@github.com:phw0224-bit/quazar-roadmap.git'),
    'phw0224-bit/quazar-roadmap'
  );
  assert.equal(
    inferRepoFullNameFromGitRemote('https://github.com/phw0224-bit/quazar-roadmap.git'),
    'phw0224-bit/quazar-roadmap'
  );
  assert.equal(
    inferRepoFullNameFromGitRemote('git@github-company:phw0224-bit/quazar-roadmap.git'),
    'phw0224-bit/quazar-roadmap'
  );
  assert.equal(inferRepoFullNameFromGitRemote('ssh://gitlab.example.com/team/repo.git'), null);
});

test('buildSuggestedCheckoutCommands returns null when branchName is missing', () => {
  assert.equal(buildSuggestedCheckoutCommands(''), null);
});

test('project MCP server schema includes section tools and ok/status envelopes', async () => {
  const { readFile } = await import('node:fs/promises');
  const serverSource = await readFile(new URL('./server.js', import.meta.url), 'utf8');

  assert.match(serverSource, /list_quazar_sections/);
  assert.match(serverSource, /create_quazar_section/);
  assert.match(serverSource, /resolve_quazar_section/);
  assert.match(serverSource, /resolve_quazar_project/);
  assert.match(serverSource, /sectionName/);
  assert.match(serverSource, /ok: z\.boolean\(\)/);
  assert.match(serverSource, /status: z\.string\(\)/);
});

test('README documents section tools and checkout guidance', async () => {
  const { readFile } = await import('node:fs/promises');
  const readmeSource = await readFile(new URL('./README.md', import.meta.url), 'utf8');

  assert.match(readmeSource, /list_quazar_sections/);
  assert.match(readmeSource, /create_quazar_section/);
  assert.match(readmeSource, /resolve_quazar_section/);
  assert.match(readmeSource, /resolve_quazar_project/);
  assert.match(readmeSource, /sectionName/);
  assert.match(readmeSource, /suggestedCheckoutCommand/);
});
