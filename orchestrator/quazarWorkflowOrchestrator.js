import { getTemplateScaffold } from '../src/lib/itemTemplates.js';
import { getCommentScaffold } from '../src/lib/itemTemplates.js';

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function detectGitHubIntent(normalizedText) {
  return /(?:github|깃허브|이슈|issue)/i.test(normalizedText);
}

function detectBranchIntent(normalizedText) {
  return /(?:브랜치|branch|checkout|체크아웃)/i.test(normalizedText);
}

function detectCommentIntent(normalizedText) {
  return /(?:댓글|코멘트|일일업무|업무기록|로그|기록|업데이트 남겨)/i.test(normalizedText);
}

function detectMutationIntent(normalizedText) {
  return /(?:만들어줘|생성|추가|등록|작성|남겨줘|달아줘)/i.test(normalizedText);
}

function detectSummaryIntent(normalizedText) {
  if (detectMutationIntent(normalizedText)) {
    return false;
  }

  return /(?:작업 이력|요약(?:해줘)?|정리해줘|kpi용|포폴용|포트폴리오용|연봉협상|회고|리포트|보고|리뷰(?:해줘)?|review)/i.test(normalizedText);
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
  const itemIdMatch = normalizedText.match(/\b(item-[A-Za-z0-9_-]+)\b/);

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
  const isCommentIntent = detectCommentIntent(normalizedText);
  const isSummaryIntent = detectSummaryIntent(normalizedText);

  let intent = 'create-item';
  if (isCommentIntent && itemIdMatch?.[1]) {
    intent = 'append-comment';
  } else if (isSummaryIntent) {
    intent = 'summarize-project';
  }

  return {
    requestText: normalizedText,
    boardType: normalizedText.includes('AI팀') ? 'AI팀' : normalizedText.includes('지원팀') ? '지원팀' : '개발팀',
    sectionName: sectionMatch?.[1] || '',
    projectName: projectMatch?.[1] || '',
    itemId: itemIdMatch?.[1] || '',
    intent,
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

export function buildCommentDraft(requestText) {
  const parsed = typeof requestText === 'string' ? parseWorkflowRequest(requestText) : requestText;
  const templateType = /(?:일일업무|오늘|어제)/.test(parsed.requestText) ? 'daily' : 'common';
  const scaffold = getCommentScaffold(templateType);

  return {
    templateType,
    content: `${scaffold}

## [원문 요청]
- ${parsed.requestText}
`,
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
        requiresConfirmation: false,
        boardType: parsed.boardType,
      };

  const itemDraft = buildDevelopmentItemDraft(parsed);
  const commentDraft = buildCommentDraft(parsed);
  const steps = [];

  if (parsed.sectionName) {
    steps.push({
      type: 'use-section',
      label: sectionResolution.status === 'FOUND'
        ? `${parsed.boardType} 보드의 ${sectionResolution.section.title} 섹션 사용`
        : `${parsed.boardType} 보드에서 ${parsed.sectionName} 섹션 확인 필요`,
    });
  }

  if (parsed.projectName) {
    steps.push({
      type: 'use-project',
      label: projectResolution.status === 'FOUND'
        ? `${projectResolution.project.projectTitle} 프로젝트 사용`
        : `${parsed.projectName} 프로젝트 확인 필요`,
    });
  }

  let planType = 'create-item';
  let requiresDraftReview = true;
  let canExecute = projectResolution.status === 'FOUND'
    && (!parsed.sectionName || sectionResolution.status === 'FOUND');
  let readOnlySummary = null;
  let targetItem = null;

  if (parsed.intent === 'append-comment') {
    planType = 'append-comment';
    if (parsed.itemId && typeof deps.getItem === 'function') {
      targetItem = await deps.getItem({
        boardType: parsed.boardType,
        itemId: parsed.itemId,
      });
    }

    steps.push({
      type: 'use-item',
      label: targetItem
        ? `${parsed.itemId} 아이템에 댓글 초안 추가`
        : `${parsed.itemId || 'itemId'} 아이템 확인 필요`,
    });
    canExecute = Boolean(targetItem);
  } else if (parsed.intent === 'summarize-project') {
    planType = 'summarize-project';
    requiresDraftReview = false;
    steps.push({ type: 'summarize-project', label: `${parsed.projectName || '프로젝트'} 작업 이력 요약` });
    if (projectResolution.status === 'FOUND' && typeof deps.getProjectActivity === 'function') {
      readOnlySummary = await deps.getProjectActivity({
        boardType: parsed.boardType,
        projectId: projectResolution.project.projectId,
      });
    }
    canExecute = Boolean(readOnlySummary);
  } else {
    steps.push({ type: 'create-item', label: `"${itemDraft.title}" 아이템 생성` });

    if (parsed.shouldCreateGitHubIssue) {
      steps.push({ type: 'create-github-issue', label: 'GitHub issue 생성' });
    }
    if (parsed.shouldCreateGitHubBranch) {
      steps.push({ type: 'create-github-branch', label: '브랜치 생성' });
    }
  }

  const requiresConfirmation = parsed.intent === 'append-comment'
    ? !targetItem
    : sectionResolution.requiresConfirmation || projectResolution.requiresConfirmation;

  return {
    ok: true,
    status: 'PLANNED',
    intent: planType,
    boardType: parsed.boardType,
    repoFullName: parsed.repoFullName,
    section: sectionResolution.section,
    sectionResolution,
    project: projectResolution.project,
    projectResolution,
    itemDraft,
    commentDraft,
    targetItem,
    requiresDraftReview,
    itemDraftApproved: false,
    reviewPrompt: planType === 'append-comment'
      ? '댓글 초안입니다. 내용과 템플릿 방향이 괜찮은지 의견을 주세요. 승인 전에는 생성하지 않습니다.'
      : planType === 'summarize-project'
        ? '읽기 전용 요약 계획입니다. 원본 데이터 확인 후 요약만 수행합니다.'
        : '아이템 초안입니다. 제목, 태그, 본문 방향이 괜찮은지 의견을 주세요. 승인 전에는 생성하지 않습니다.',
    shouldCreateGitHubIssue: parsed.shouldCreateGitHubIssue,
    shouldCreateGitHubBranch: parsed.shouldCreateGitHubBranch,
    requiresConfirmation,
    canExecute,
    isReadOnlyPlan: planType === 'summarize-project',
    projectActivity: readOnlySummary,
    steps,
  };
}

export async function executeWorkflowPlan(plan, deps) {
  if (plan?.intent === 'summarize-project') {
    if (!plan?.projectActivity || plan?.canExecute === false) {
      const error = new Error('Workflow summary plan is not ready to execute.');
      error.code = 'INVALID_WORKFLOW_PLAN';
      throw error;
    }

    return {
      ok: true,
      status: 'READ_ONLY',
      summary: plan.projectActivity || null,
    };
  }

  if (plan?.intent === 'append-comment') {
    if (!plan?.targetItem?.itemId && !plan?.targetItem?.id) {
      const error = new Error('Workflow comment plan is not ready to execute.');
      error.code = 'INVALID_WORKFLOW_PLAN';
      throw error;
    }

    if (plan?.canExecute === false) {
      const error = new Error('Workflow plan is not ready to execute.');
      error.code = 'INVALID_WORKFLOW_PLAN';
      throw error;
    }

    if (plan?.itemDraftApproved !== true) {
      const error = new Error('Item draft review is required before execution.');
      error.code = 'ITEM_DRAFT_REVIEW_REQUIRED';
      throw error;
    }

    const commentResult = await deps.createComment({
      boardType: plan.boardType,
      itemId: plan.targetItem.itemId || plan.targetItem.id,
      content: plan.commentDraft.content,
      tags: ['업무기록'],
      authorName: 'Quazar Workflow',
    });

    return {
      ok: true,
      status: 'EXECUTED',
      comment: commentResult,
      shouldAskForCheckout: false,
      checkoutPrompt: null,
      suggestedCheckoutCommand: null,
    };
  }

  if (!plan?.project?.projectTitle || plan?.canExecute === false) {
    const error = new Error('Workflow plan is not ready to execute.');
    error.code = 'INVALID_WORKFLOW_PLAN';
    throw error;
  }

  if (plan?.itemDraftApproved !== true) {
    const error = new Error('Item draft review is required before execution.');
    error.code = 'ITEM_DRAFT_REVIEW_REQUIRED';
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
