import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSuggestedCheckoutCommands,
  inferRepoFullNameFromGitRemote,
  runCreateQuazarItemGitHubBranchTool,
  runCreateQuazarItemGitHubIssueTool,
  runCreateQuazarProjectTool,
  runCreateQuazarItemTool,
  runGetQuazarProjectTool,
  runGetQuazarItemGitHubBranchTool,
  runGetQuazarItemTool,
  runListQuazarProjectsTool,
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
        itemId: 'item-1',
        projectId: 'project-a',
        projectTitle: '온보딩 개선',
        boardType: '개발팀',
        title: '신규 유저 가이드 추가',
        tags: ['ux'],
      };
    },
  });

  assert.deepEqual(result.structuredContent, {
    itemId: 'item-1',
    projectId: 'project-a',
    projectTitle: '온보딩 개선',
    boardType: '개발팀',
    title: '신규 유저 가이드 추가',
    tags: ['ux'],
  });
  assert.match(result.content[0].text, /item-1/);
  assert.match(result.content[0].text, /온보딩 개선/);
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
        boardType: '개발팀',
        count: 2,
        projects: [
          { id: 'project-a', title: '온보딩 개선' },
          { id: 'project-b', title: '온보딩 문서 정리' },
        ],
      };
    },
  });

  assert.deepEqual(result.structuredContent, {
    boardType: '개발팀',
    count: 2,
    projects: [
      { id: 'project-a', title: '온보딩 개선' },
      { id: 'project-b', title: '온보딩 문서 정리' },
    ],
  });
  assert.match(result.content[0].text, /온보딩 개선/);
  assert.match(result.content[0].text, /온보딩 문서 정리/);
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
        boardType: '개발팀',
        count: 1,
        items: [{
          itemId: 'item-1',
          title: '온보딩 문서 정리',
          projectTitle: '온보딩 개선',
          status: 'todo',
        }],
      };
    },
  });

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
        itemId: 'item-4',
        title: '요약 개선',
        projectTitle: 'LLM 개선',
        boardType: 'AI팀',
        status: 'in_progress',
      };
    },
  });

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
        itemId: 'item-9',
        title: '응대 문구 정리',
        projectTitle: 'CS 운영',
        boardType: '지원팀',
        status: 'done',
      };
    },
  });

  assert.equal(result.structuredContent.status, 'done');
  assert.match(result.content[0].text, /응대 문구 정리/);
  assert.match(result.content[0].text, /done/);
});

test('runCreateQuazarProjectTool returns structured MCP content from the Quazar API result', async () => {
  const result = await runCreateQuazarProjectTool({
    boardType: '개발팀',
    title: '신규 온보딩 프로젝트',
  }, {
    createProject: async (payload) => {
      assert.deepEqual(payload, {
        boardType: '개발팀',
        title: '신규 온보딩 프로젝트',
      });

      return {
        projectId: 'project-a',
        title: '신규 온보딩 프로젝트',
        boardType: '개발팀',
      };
    },
  });

  assert.equal(result.structuredContent.projectId, 'project-a');
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
        projectId: 'project-a',
        title: 'LLM 개선',
        boardType: 'AI팀',
        isCompleted: false,
      };
    },
  });

  assert.equal(result.structuredContent.projectId, 'project-a');
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
        projectId: 'project-z',
        title: 'CS 운영 개선',
        boardType: '지원팀',
        isCompleted: false,
      };
    },
  });

  assert.equal(result.structuredContent.projectId, 'project-z');
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
  assert.match(result.content[0].text, /QZR-31/);
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
  assert.deepEqual(result.structuredContent.suggestedCheckoutCommand, [
    'git fetch origin QZR-77',
    'git switch QZR-77 || git switch --track -c QZR-77 origin/QZR-77',
  ]);
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

test('project MCP server schema no longer advertises unsupported project tags fields', async () => {
  const { readFile } = await import('node:fs/promises');
  const serverSource = await readFile(new URL('./server.js', import.meta.url), 'utf8');

  assert.doesNotMatch(serverSource, /Optional project tags/);
  assert.doesNotMatch(serverSource, /Update safe-core Quazar project fields: title, tags, and completion state\./);
  assert.match(serverSource, /create_quazar_item_github_issue/);
  assert.match(serverSource, /create_quazar_item_github_branch/);
  assert.match(serverSource, /get_quazar_item_github_branch/);
});

test('README no longer documents project tag writes that current DB schema does not support', async () => {
  const { readFile } = await import('node:fs/promises');
  const readmeSource = await readFile(new URL('./README.md', import.meta.url), 'utf8');

  assert.doesNotMatch(readmeSource, /태그 docs인 프로젝트 만들어줘/);
  assert.doesNotMatch(readmeSource, /title = "신규 온보딩 프로젝트"[\s\S]*tags = @\("docs"\)/);
  assert.doesNotMatch(readmeSource, /title = "신규 온보딩 프로젝트 v2"[\s\S]*tags = @\("docs", "onboarding"\)/);
  assert.match(readmeSource, /create_quazar_item_github_issue/);
  assert.match(readmeSource, /suggestedCheckoutCommand/);
});
