import { getTemplateScaffold } from '../src/lib/itemTemplates.js';

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function detectGitHubIntent(normalizedText) {
  return /(?:github|깃허브|이슈|issue)/i.test(normalizedText);
}

function detectBranchIntent(normalizedText) {
  return /(?:브랜치|branch|checkout|체크아웃)/i.test(normalizedText);
}

function buildResolution(kind, matches = [], boardType) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      status: 'NOT_FOUND',
      [kind]: null,
      candidates: [],
      requiresConfirmation: true,
      boardType,
    };
  }

  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      [kind]: null,
      candidates: matches,
      requiresConfirmation: true,
      boardType,
    };
  }

  return {
    status: 'FOUND',
    [kind]: matches[0],
    candidates: matches,
    requiresConfirmation: false,
    boardType,
  };
}

export function parseWorkflowRequest(requestText) {
  const normalizedText = normalizeWhitespace(requestText);
  const sectionMatch = normalizedText.match(/([A-Za-z0-9가-힣_-]+)\s*(?:섹션|쪽)/);
  const projectMatch = normalizedText.match(/([A-Za-z0-9가-힣_-]+)\s*프로젝트/);

  const summaryTokens = [];
  const lower = normalizedText.toLowerCase();
  if (lower.includes('pinata')) summaryTokens.push('Pinata');
  if (lower.includes('ipfs')) summaryTokens.push('IPFS');
  if (normalizedText.includes('임시')) summaryTokens.push('임시');
  if (normalizedText.includes('업로드')) summaryTokens.push('업로드');
  if (normalizedText.includes('구현')) summaryTokens.push('구현');

  const workSummary = summaryTokens.length > 0
    ? summaryTokens.join(' ')
    : normalizedText.slice(0, 60);

  return {
    requestText: normalizedText,
    boardType: normalizedText.includes('AI팀') ? 'AI팀' : normalizedText.includes('지원팀') ? '지원팀' : '개발팀',
    sectionName: sectionMatch?.[1] || '',
    projectName: projectMatch?.[1] || '',
    workSummary,
    shouldCreateGitHubIssue: detectGitHubIntent(normalizedText),
    shouldCreateGitHubBranch: detectBranchIntent(normalizedText),
  };
}

function buildSummaryTitle(parsed) {
  const tokens = parsed.workSummary.split(' ').filter(Boolean);
  const uniqueTokens = [...new Set(tokens.map((token) => token.toLowerCase()))];
  const restoredTokens = uniqueTokens.map((token) => {
    if (token === 'pinata') return 'Pinata';
    if (token === 'ipfs') return 'IPFS';
    return token;
  });
  return normalizeWhitespace(`${restoredTokens.join(' ')} 작업`.replace(/\s+작업$/, ' 구현'));
}

export function buildDevelopmentItemDraft(requestText) {
  const parsed = typeof requestText === 'string' ? parseWorkflowRequest(requestText) : requestText;
  const titleBase = buildSummaryTitle(parsed);
  const title = titleBase.includes('구현') ? titleBase : `${titleBase} 구현`;
  const scaffold = getTemplateScaffold('development');
  const description = `${scaffold}

## [원문 요청]
- ${parsed.requestText}

## [현재 미정/가정]
- JSON 스키마는 아직 임시 버전
- Pinata를 사용해 업로드 후 CID 응답까지를 우선 목표로 함
`;

  return {
    title,
    description,
    tags: ['개발'],
  };
}

export async function createWorkflowDryRun(input, deps) {
  const parsedRequest = parseWorkflowRequest(input.requestText || '');
  const parsed = {
    ...parsedRequest,
    boardType: input.boardType || parsedRequest.boardType,
    repoFullName: input.repoFullName || null,
  };

  const sectionsResult = parsed.sectionName
    ? await deps.listSections({
        boardType: parsed.boardType,
        query: parsed.sectionName,
        limit: 10,
      })
    : { sections: [] };

  const sectionMatches = (sectionsResult.sections || []).map((section) => ({
    sectionId: section.id || section.sectionId,
    title: section.title,
    boardType: section.boardType || parsed.boardType,
  }));
  const sectionResolution = parsed.sectionName
    ? buildResolution('section', sectionMatches, parsed.boardType)
    : {
        status: 'UNSPECIFIED',
        section: null,
        candidates: [],
        requiresConfirmation: false,
        boardType: parsed.boardType,
      };

  const projectsResult = parsed.projectName
    ? await deps.listProjects({
        boardType: parsed.boardType,
        query: parsed.projectName,
        limit: 10,
      })
    : { projects: [] };

  const projectMatches = (projectsResult.projects || []).map((project) => ({
    projectId: project.id || project.projectId,
    projectTitle: project.title,
  }));
  const projectResolution = parsed.projectName
    ? buildResolution('project', projectMatches, parsed.boardType)
    : {
        status: 'UNSPECIFIED',
        project: null,
        candidates: [],
        requiresConfirmation: true,
        boardType: parsed.boardType,
      };

  const itemDraft = buildDevelopmentItemDraft(parsed);
  const steps = [];

  if (parsed.sectionName) {
    steps.push({
      type: 'use-section',
      label: sectionResolution.status === 'FOUND'
        ? `${parsed.boardType} 보드의 ${sectionResolution.section.title} 섹션 사용`
        : `${parsed.boardType} 보드에서 ${parsed.sectionName} 섹션 확인 필요`,
    });
  }

  steps.push({
    type: 'use-project',
    label: projectResolution.status === 'FOUND'
      ? `${projectResolution.project.projectTitle} 프로젝트 사용`
      : `${parsed.projectName || '프로젝트'} 프로젝트 확인 필요`,
  });
  steps.push({ type: 'create-item', label: `"${itemDraft.title}" 아이템 생성` });

  if (parsed.shouldCreateGitHubIssue) {
    steps.push({ type: 'create-github-issue', label: 'GitHub issue 생성' });
  }
  if (parsed.shouldCreateGitHubBranch) {
    steps.push({ type: 'create-github-branch', label: '브랜치 생성' });
  }

  const requiresConfirmation = sectionResolution.requiresConfirmation || projectResolution.requiresConfirmation;
  const canExecute = projectResolution.status === 'FOUND'
    && (!parsed.sectionName || sectionResolution.status === 'FOUND');

  return {
    ok: true,
    status: 'PLANNED',
    boardType: parsed.boardType,
    repoFullName: parsed.repoFullName,
    section: sectionResolution.section,
    sectionResolution,
    project: projectResolution.project,
    projectResolution,
    itemDraft,
    shouldCreateGitHubIssue: parsed.shouldCreateGitHubIssue,
    shouldCreateGitHubBranch: parsed.shouldCreateGitHubBranch,
    requiresConfirmation,
    canExecute,
    steps,
  };
}

export async function executeWorkflowPlan(plan, deps) {
  if (!plan?.project?.projectTitle || plan?.canExecute === false) {
    const error = new Error('Workflow plan is not ready to execute.');
    error.code = 'INVALID_WORKFLOW_PLAN';
    throw error;
  }

  const itemResult = await deps.createItem({
    boardType: plan.boardType,
    projectName: plan.project.projectTitle,
    title: plan.itemDraft.title,
    description: plan.itemDraft.description,
    tags: plan.itemDraft.tags,
  });

  let issueResult = null;
  if (plan.shouldCreateGitHubIssue) {
    issueResult = await deps.createGitHubIssue({
      itemId: itemResult.itemId,
      repoFullName: plan.repoFullName,
    });
  }

  let branchResult = null;
  if (plan.shouldCreateGitHubBranch) {
    branchResult = await deps.createGitHubBranch({
      itemId: itemResult.itemId,
    });
  }

  return {
    ok: true,
    status: 'EXECUTED',
    item: itemResult,
    issue: issueResult,
    branch: branchResult,
    shouldAskForCheckout: Boolean(branchResult?.suggestedCheckoutCommand),
    checkoutPrompt: '해당 브랜치로 체크아웃하시겠습니까?',
    suggestedCheckoutCommand: branchResult?.suggestedCheckoutCommand || null,
  };
}
