import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCommentDraft,
  buildDevelopmentItemDraft,
  createWorkflowDryRun,
  executeWorkflowPlan,
  parseWorkflowRequest,
} from './quazarWorkflowOrchestrator.js';

test('parseWorkflowRequest extracts section and project candidates from Korean request text', () => {
  const parsed = parseWorkflowRequest('DPP 섹션 하위의 박형우 프로젝트에 Pinata IPFS 임시 업로드 구현 작업 만들고 이슈/브랜치까지');

  assert.equal(parsed.sectionName, 'DPP');
  assert.equal(parsed.projectName, '박형우');
  assert.match(parsed.workSummary, /Pinata IPFS 임시 업로드 구현/);
  assert.equal(parsed.shouldCreateGitHubIssue, true);
  assert.equal(parsed.shouldCreateGitHubBranch, true);
});

test('parseWorkflowRequest keeps creation requests in create-item mode even when they contain 정리 작업 wording', () => {
  const parsed = parseWorkflowRequest('지원팀 박형우 프로젝트에 FAQ 정리 작업 만들어줘');

  assert.equal(parsed.intent, 'create-item');
});

test('parseWorkflowRequest treats review phrasing as a read-only summary intent', () => {
  const parsed = parseWorkflowRequest('박형우 프로젝트 리뷰해줘');

  assert.equal(parsed.intent, 'summarize-project');
});

test('buildDevelopmentItemDraft creates development-tag scaffold with request text embedded', () => {
  const draft = buildDevelopmentItemDraft('Pinata를 사용해서 JSON 데이터를 임시로 IPFS에 업로드하고 CID 응답을 받는다.');

  assert.deepEqual(draft.tags, ['개발']);
  assert.match(draft.title, /Pinata/);
  assert.match(draft.title, /IPFS/);
  assert.match(draft.description, /## 개발/);
  assert.match(draft.description, /원문 요청/);
});

test('buildCommentDraft creates daily comment scaffold when the request looks like a daily log', () => {
  const draft = buildCommentDraft('item-123 댓글에 오늘 진행한 일일업무 기록 남겨줘');

  assert.equal(draft.templateType, 'daily');
  assert.match(draft.content, /## 일일업무/);
  assert.match(draft.content, /원문 요청/);
});

test('createWorkflowDryRun resolves resources and produces an execution plan without mutating calls', async () => {
  let createCallCount = 0;
  const plan = await createWorkflowDryRun({
    requestText: 'DPP 섹션 하위의 박형우 프로젝트에 Pinata IPFS 임시 업로드 구현 작업 만들고 이슈/브랜치까지',
    boardType: '개발팀',
    repoFullName: 'phw0224-bit/quazar-roadmap',
  }, {
    listSections: async () => ({
      ok: true,
      status: 'FOUND',
      boardType: '개발팀',
      count: 1,
      sections: [{ id: 'section-dpp', title: 'DPP', boardType: '개발팀', orderIndex: 0 }],
    }),
    listProjects: async () => ({
      ok: true,
      status: 'FOUND',
      boardType: '개발팀',
      count: 1,
      projects: [{ id: 'project-phw', title: '박형우', sectionId: 'section-dpp' }],
    }),
    createItem: async () => {
      createCallCount += 1;
      return null;
    },
  });

  assert.equal(createCallCount, 0);
  assert.equal(plan.ok, true);
  assert.equal(plan.status, 'PLANNED');
  assert.equal(plan.section.sectionId, 'section-dpp');
  assert.equal(plan.sectionResolution.status, 'FOUND');
  assert.equal(plan.project.projectId, 'project-phw');
  assert.equal(plan.projectResolution.status, 'FOUND');
  assert.equal(plan.requiresConfirmation, false);
  assert.equal(plan.requiresDraftReview, true);
  assert.equal(plan.itemDraftApproved, false);
  assert.equal(plan.canExecute, true);
  assert.match(plan.reviewPrompt, /초안/);
  assert.deepEqual(plan.steps.map((step) => step.type), [
    'use-section',
    'use-project',
    'create-item',
    'create-github-issue',
    'create-github-branch',
  ]);
});

test('createWorkflowDryRun keeps ambiguous matches visible instead of picking the first one', async () => {
  const plan = await createWorkflowDryRun({
    requestText: 'DPP 섹션 하위의 박형우 프로젝트에 작업 만들어줘',
    boardType: '개발팀',
  }, {
    listSections: async () => ({
      ok: true,
      status: 'FOUND',
      boardType: '개발팀',
      count: 2,
      sections: [
        { id: 'section-dpp', title: 'DPP', boardType: '개발팀', orderIndex: 0 },
        { id: 'section-dpp-2', title: 'DPP', boardType: '개발팀', orderIndex: 1 },
      ],
    }),
    listProjects: async () => ({
      ok: true,
      status: 'FOUND',
      boardType: '개발팀',
      count: 0,
      projects: [],
    }),
  });

  assert.equal(plan.sectionResolution.status, 'AMBIGUOUS');
  assert.equal(plan.section, null);
  assert.equal(plan.sectionResolution.candidates.length, 2);
  assert.equal(plan.projectResolution.status, 'NOT_FOUND');
  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.requiresDraftReview, true);
  assert.equal(plan.canExecute, false);
});

test('createWorkflowDryRun only includes GitHub steps when the request asks for them', async () => {
  const plan = await createWorkflowDryRun({
    requestText: 'DPP 섹션 하위의 박형우 프로젝트에 Pinata IPFS 임시 업로드 구현 아이템 만들어줘',
    boardType: '개발팀',
  }, {
    listSections: async () => ({
      ok: true,
      status: 'FOUND',
      boardType: '개발팀',
      count: 1,
      sections: [{ id: 'section-dpp', title: 'DPP', boardType: '개발팀', orderIndex: 0 }],
    }),
    listProjects: async () => ({
      ok: true,
      status: 'FOUND',
      boardType: '개발팀',
      count: 1,
      projects: [{ id: 'project-phw', title: '박형우', sectionId: 'section-dpp' }],
    }),
  });

  assert.equal(plan.shouldCreateGitHubIssue, false);
  assert.equal(plan.shouldCreateGitHubBranch, false);
  assert.deepEqual(plan.steps.map((step) => step.type), [
    'use-section',
    'use-project',
    'create-item',
  ]);
});

test('createWorkflowDryRun builds a read-only project summary plan when the request is a summary intent', async () => {
  const plan = await createWorkflowDryRun({
    requestText: 'DPP 섹션 하위의 박형우 프로젝트 작업 이력 요약해서 KPI용으로 정리해줘',
    boardType: '개발팀',
  }, {
    listSections: async () => ({
      sections: [{ id: 'section-dpp', title: 'DPP', boardType: '개발팀', orderIndex: 0 }],
    }),
    listProjects: async () => ({
      projects: [{ id: 'project-phw', title: '박형우', sectionId: 'section-dpp' }],
    }),
    getProjectActivity: async () => ({
      project: { projectId: 'project-phw', title: '박형우' },
      count: 2,
      items: [],
    }),
  });

  assert.equal(plan.intent, 'summarize-project');
  assert.equal(plan.requiresDraftReview, false);
  assert.equal(plan.isReadOnlyPlan, true);
  assert.equal(plan.projectActivity.project.projectId, 'project-phw');
  assert.deepEqual(plan.steps.map((step) => step.type), [
    'use-section',
    'use-project',
    'summarize-project',
  ]);
});

test('createWorkflowDryRun builds a comment-append plan when the request targets a specific item', async () => {
  const plan = await createWorkflowDryRun({
    requestText: 'item-123 댓글에 오늘 진행 내용 기록 남겨줘',
    boardType: '개발팀',
  }, {
    listProjects: async () => ({ projects: [] }),
    getItem: async ({ itemId }) => ({
      itemId,
      id: itemId,
      title: '기존 업무',
    }),
  });

  assert.equal(plan.intent, 'append-comment');
  assert.equal(plan.targetItem.itemId, 'item-123');
  assert.equal(plan.canExecute, true);
  assert.equal(plan.requiresConfirmation, false);
  assert.match(plan.reviewPrompt, /댓글 초안/);
  assert.deepEqual(plan.steps.map((step) => step.type), [
    'use-item',
  ]);
});

test('executeWorkflowPlan executes item, issue, and branch steps in order and returns checkout prompt', async () => {
  const calls = [];
  const result = await executeWorkflowPlan({
    ok: true,
    status: 'PLANNED',
    boardType: '개발팀',
    project: { projectId: 'project-phw', projectTitle: '박형우' },
    itemDraft: {
      title: 'Pinata IPFS 임시 업로드 구현',
      description: '## 개발',
      tags: ['개발'],
    },
    repoFullName: 'phw0224-bit/quazar-roadmap',
    shouldCreateGitHubIssue: true,
    shouldCreateGitHubBranch: true,
    canExecute: true,
    itemDraftApproved: true,
  }, {
    createItem: async (payload) => {
      calls.push(['createItem', payload]);
      return {
        ok: true,
        status: 'CREATED',
        itemId: 'item-1',
        projectId: 'project-phw',
        projectTitle: '박형우',
        boardType: '개발팀',
        title: 'Pinata IPFS 임시 업로드 구현',
        tags: ['개발'],
      };
    },
    createGitHubIssue: async (payload) => {
      calls.push(['createGitHubIssue', payload]);
      return {
        ok: true,
        status: 'ALREADY_EXISTS',
        itemId: 'item-1',
        repoFullName: 'phw0224-bit/quazar-roadmap',
        issueNumber: 41,
        issueUrl: 'https://github.com/phw0224-bit/quazar-roadmap/issues/41',
      };
    },
    createGitHubBranch: async (payload) => {
      calls.push(['createGitHubBranch', payload]);
      return {
        ok: true,
        status: 'CREATED',
        itemId: 'item-1',
        repoFullName: 'phw0224-bit/quazar-roadmap',
        branchName: 'QZR-41',
        branchUrl: 'https://github.com/phw0224-bit/quazar-roadmap/tree/QZR-41',
        suggestedCheckoutCommand: [
          'git fetch origin QZR-41',
          'git switch QZR-41 || git switch --track -c QZR-41 origin/QZR-41',
        ],
      };
    },
  });

  assert.deepEqual(calls.map(([name]) => name), [
    'createItem',
    'createGitHubIssue',
    'createGitHubBranch',
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.shouldAskForCheckout, true);
  assert.equal(result.checkoutPrompt, '해당 브랜치로 체크아웃하시겠습니까?');
});

test('executeWorkflowPlan executes comment append plans via createComment', async () => {
  const calls = [];
  const result = await executeWorkflowPlan({
    ok: true,
    status: 'PLANNED',
    intent: 'append-comment',
    boardType: '개발팀',
    project: { projectId: 'project-phw', projectTitle: '박형우' },
    targetItem: { itemId: 'item-123', title: '기존 업무' },
    commentDraft: {
      content: '## 일일업무',
    },
    canExecute: true,
    itemDraftApproved: true,
  }, {
    createComment: async (payload) => {
      calls.push(payload);
      return {
        ok: true,
        status: 'CREATED',
        commentId: 'comment-1',
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].itemId, 'item-123');
  assert.equal(result.comment.commentId, 'comment-1');
  assert.equal(result.shouldAskForCheckout, false);
});

test('executeWorkflowPlan executes a real dry-run comment plan without requiring project resolution', async () => {
  const plan = await createWorkflowDryRun({
    requestText: 'item-123 댓글에 오늘 진행 내용 기록 남겨줘',
    boardType: '개발팀',
  }, {
    listProjects: async () => ({ projects: [] }),
    getItem: async ({ itemId }) => ({
      itemId,
      id: itemId,
      title: '기존 업무',
    }),
  });

  const result = await executeWorkflowPlan({
    ...plan,
    itemDraftApproved: true,
  }, {
    createComment: async (payload) => ({
      ok: true,
      status: 'CREATED',
      commentId: 'comment-2',
      ...payload,
    }),
  });

  assert.equal(result.status, 'EXECUTED');
  assert.equal(result.comment.commentId, 'comment-2');
});

test('executeWorkflowPlan returns read-only summaries without mutation for summary plans', async () => {
  const result = await executeWorkflowPlan({
    ok: true,
    status: 'PLANNED',
    intent: 'summarize-project',
    projectActivity: {
      project: { projectId: 'project-phw', title: '박형우' },
      count: 1,
      items: [],
    },
  }, {});

  assert.equal(result.status, 'READ_ONLY');
  assert.equal(result.summary.project.projectId, 'project-phw');
});

test('executeWorkflowPlan rejects unresolved summary plans instead of returning empty success', async () => {
  await assert.rejects(
    () => executeWorkflowPlan({
      ok: true,
      status: 'PLANNED',
      intent: 'summarize-project',
      canExecute: false,
      projectActivity: null,
    }, {}),
    (error) => error?.code === 'INVALID_WORKFLOW_PLAN',
  );
});

test('executeWorkflowPlan blocks execution when the dry-run plan is not executable', async () => {
  await assert.rejects(
    executeWorkflowPlan({
      ok: true,
      status: 'PLANNED',
      boardType: '개발팀',
      project: null,
      itemDraft: {
        title: 'Pinata IPFS 임시 업로드 구현',
        description: '## 개발',
        tags: ['개발'],
      },
      canExecute: false,
    }, {
      createItem: async () => {
        throw new Error('should not be called');
      },
    }),
    (error) => error?.code === 'INVALID_WORKFLOW_PLAN'
  );
});

test('executeWorkflowPlan blocks execution until the user approves the item draft', async () => {
  await assert.rejects(
    executeWorkflowPlan({
      ok: true,
      status: 'PLANNED',
      boardType: '개발팀',
      project: { projectId: 'project-phw', projectTitle: '박형우' },
      itemDraft: {
        title: 'Pinata IPFS 임시 업로드 구현',
        description: '## 개발',
        tags: ['개발'],
      },
      canExecute: true,
      itemDraftApproved: false,
    }, {
      createItem: async () => {
        throw new Error('should not be called');
      },
    }),
    (error) => error?.code === 'ITEM_DRAFT_REVIEW_REQUIRED'
  );
});
