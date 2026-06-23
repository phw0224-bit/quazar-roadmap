const SUPPORTED_BOARD_TYPES = new Set(['main', '개발팀', 'AI팀', '지원팀']);

function createError(code, status, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function requireBoardType(value) {
  const boardType = typeof value === 'string' ? value.trim() : '';
  if (!SUPPORTED_BOARD_TYPES.has(boardType)) {
    throw createError('INVALID_INPUT', 400, 'boardType must be one of: main, 개발팀, AI팀, 지원팀.');
  }
  return boardType;
}

function requireNonEmptyString(value, fieldName) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw createError('INVALID_INPUT', 400, `${fieldName} is required.`);
  }
  return normalized;
}

function requireStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw createError('INVALID_INPUT', 400, `${fieldName} must be an array of strings.`);
  }
  return value;
}

function normalizeLimit(value, fallback = 20, max = 100) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
}

function normalizeTags(values = []) {
  const seen = new Set();

  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatusOrPriority(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeProjectName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeSectionName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function validateListQuazarSectionsInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    query: normalizeOptionalString(payload.query),
    limit: normalizeLimit(payload.limit, 20, 100),
  };
}

export function validateCreateQuazarSectionInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    title: requireNonEmptyString(payload.title, 'title'),
  };
}

export function validateResolveQuazarSectionInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    sectionName: requireNonEmptyString(payload.sectionName, 'sectionName'),
  };
}

export function validateCreateQuazarItemInput(payload = {}) {
  const boardType = requireBoardType(payload.boardType);
  const projectName = requireNonEmptyString(payload.projectName, 'projectName');
  const title = requireNonEmptyString(payload.title, 'title');
  const description = typeof payload.description === 'string' ? payload.description : '';
  const tags = payload.tags === undefined ? [] : requireStringArray(payload.tags, 'tags');

  return {
    boardType,
    projectName,
    normalizedProjectName: normalizeProjectName(projectName),
    title,
    description,
    tags,
  };
}

export function validateSearchQuazarItemsInput(payload = {}) {
  const boardType = requireBoardType(payload.boardType);
  const projectName = normalizeOptionalString(payload.projectName);
  const tags = payload.tags === undefined ? [] : requireStringArray(payload.tags, 'tags');

  return {
    boardType,
    query: normalizeOptionalString(payload.query),
    projectName,
    normalizedProjectName: normalizeProjectName(projectName),
    status: normalizeStatusOrPriority(payload.status),
    tags: normalizeTags(tags),
    limit: normalizeLimit(payload.limit, 20, 100),
    includeCompletedProjects: normalizeBoolean(payload.includeCompletedProjects, true),
  };
}

export function validateGetQuazarItemInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    itemId: requireNonEmptyString(payload.itemId, 'itemId'),
  };
}

export function validateListQuazarItemCommentsInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    itemId: requireNonEmptyString(payload.itemId, 'itemId'),
  };
}

export function validateCreateQuazarCommentInput(payload = {}) {
  const boardType = requireBoardType(payload.boardType);
  const itemId = requireNonEmptyString(payload.itemId, 'itemId');
  const content = requireNonEmptyString(payload.content, 'content');
  const tags = payload.tags === undefined ? [] : normalizeTags(requireStringArray(payload.tags, 'tags'));
  const authorName = normalizeOptionalString(payload.authorName) || 'Quazar MCP';

  return {
    boardType,
    itemId,
    content,
    tags,
    authorName,
  };
}

export function validateUpdateQuazarCommentInput(payload = {}) {
  const boardType = requireBoardType(payload.boardType);
  const itemId = requireNonEmptyString(payload.itemId, 'itemId');
  const commentId = requireNonEmptyString(payload.commentId, 'commentId');
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'content')) {
    patch.content = requireNonEmptyString(payload.content, 'content');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    patch.tags = normalizeTags(requireStringArray(payload.tags, 'tags'));
  }

  if (Object.keys(patch).length === 0) {
    throw createError('INVALID_INPUT', 400, 'At least one updatable field is required.');
  }

  return {
    boardType,
    itemId,
    commentId,
    patch,
  };
}

export function validateDeleteQuazarCommentInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    itemId: requireNonEmptyString(payload.itemId, 'itemId'),
    commentId: requireNonEmptyString(payload.commentId, 'commentId'),
  };
}

export function validateUpdateQuazarItemInput(payload = {}) {
  const boardType = requireBoardType(payload.boardType);
  const itemId = requireNonEmptyString(payload.itemId, 'itemId');
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    patch.status = normalizeStatusOrPriority(payload.status);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'priority')) {
    patch.priority = normalizeStatusOrPriority(payload.priority);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    patch.description = typeof payload.description === 'string' ? payload.description : '';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    patch.tags = normalizeTags(requireStringArray(payload.tags, 'tags'));
  }

  if (Object.keys(patch).length === 0) {
    throw createError('INVALID_INPUT', 400, 'At least one updatable field is required.');
  }

  return {
    boardType,
    itemId,
    patch,
  };
}

export function validateCreateQuazarProjectInput(payload = {}) {
  const boardType = requireBoardType(payload.boardType);
  const title = requireNonEmptyString(payload.title, 'title');
  const sectionId = payload.sectionId === undefined || payload.sectionId === null
    ? null
    : requireNonEmptyString(payload.sectionId, 'sectionId');
  const sectionName = normalizeOptionalString(payload.sectionName);
  const tags = payload.tags === undefined ? [] : requireStringArray(payload.tags, 'tags');

  return {
    boardType,
    title,
    sectionId,
    sectionName,
    tags: normalizeTags(tags),
  };
}

export function validateGetQuazarProjectInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    projectId: requireNonEmptyString(payload.projectId, 'projectId'),
  };
}

export function validateGetQuazarProjectActivityInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    projectId: requireNonEmptyString(payload.projectId, 'projectId'),
  };
}

export function validateResolveQuazarProjectInput(payload = {}) {
  return {
    boardType: requireBoardType(payload.boardType),
    projectName: requireNonEmptyString(payload.projectName, 'projectName'),
  };
}

export function validateUpdateQuazarProjectInput(payload = {}) {
  const boardType = requireBoardType(payload.boardType);
  const projectId = requireNonEmptyString(payload.projectId, 'projectId');
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    patch.title = requireNonEmptyString(payload.title, 'title');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    patch.tags = normalizeTags(requireStringArray(payload.tags, 'tags'));
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isCompleted')) {
    if (typeof payload.isCompleted !== 'boolean') {
      throw createError('INVALID_INPUT', 400, 'isCompleted must be a boolean.');
    }
    patch.isCompleted = payload.isCompleted;
  }

  if (Object.keys(patch).length === 0) {
    throw createError('INVALID_INPUT', 400, 'At least one updatable field is required.');
  }

  return {
    boardType,
    projectId,
    patch,
  };
}

export function findMatchingProjects(projects = [], projectName) {
  const normalizedProjectName = normalizeProjectName(projectName);
  return projects.filter((project) => normalizeProjectName(project?.title) === normalizedProjectName);
}

export function findMatchingSections(sections = [], sectionName) {
  const normalizedSectionName = normalizeSectionName(sectionName);
  return sections.filter((section) => normalizeSectionName(section?.title) === normalizedSectionName);
}

export function filterProjectsByQuery(projects = [], query = '') {
  const normalizedQuery = normalizeProjectName(query);
  if (!normalizedQuery) return projects;

  return projects.filter((project) => normalizeProjectName(project?.title).includes(normalizedQuery));
}

export function filterSectionsByQuery(sections = [], query = '') {
  const normalizedQuery = normalizeSectionName(query);
  if (!normalizedQuery) return sections;

  return sections.filter((section) => normalizeSectionName(section?.title).includes(normalizedQuery));
}

function resolveProjectMatch(projects, projectName) {
  const matches = findMatchingProjects(projects, projectName);

  if (matches.length === 0) {
    throw createError('PROJECT_NOT_FOUND', 404, 'Project was not found.');
  }

  if (matches.length > 1) {
    throw createError('PROJECT_AMBIGUOUS', 409, 'Project match is ambiguous.', {
      candidates: matches.map((project) => ({
        id: project.id,
        title: project.title,
      })),
    });
  }

  return matches[0];
}

function resolveSectionMatch(sections, sectionName) {
  const matches = findMatchingSections(sections, sectionName);

  if (matches.length === 0) {
    throw createError('SECTION_NOT_FOUND', 404, 'Section was not found.');
  }

  if (matches.length > 1) {
    throw createError('SECTION_AMBIGUOUS', 409, 'Section match is ambiguous.', {
      candidates: matches.map((section) => ({
        id: section.id,
        title: section.title,
        boardType: section.board_type || section.boardType || '',
      })),
    });
  }

  return matches[0];
}

export function formatQuazarItemDetail(item, boardType) {
  return {
    itemId: item.id,
    title: item.title || '',
    description: item.description || '',
    itemStatus: item.status || '',
    priority: item.priority || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    assignees: Array.isArray(item.assignees) ? item.assignees : [],
    assigneeUserIds: Array.isArray(item.assignee_user_ids) ? item.assignee_user_ids : [],
    projectId: item.project_id || null,
    projectTitle: item.project_title || '',
    pageType: item.page_type || null,
    startDate: item.start_date || null,
    endDate: item.end_date || null,
    isTicket: Boolean(item.is_ticket || item.ticket_key),
    ticketKey: item.ticket_key || null,
    ticketNumber: item.ticket_number ?? null,
    hasLinkedIssue: Boolean(item.has_linked_issue || item.ticket_key),
    linkedIssueCount: Number.isInteger(item.linked_issue_count) ? item.linked_issue_count : 0,
    linkedIssueRepoFullName: item.linked_issue_repo_full_name || null,
    linkedIssueUrl: item.linked_issue_url || null,
    hasLinkedBranch: Boolean(item.github_linked_branch_name),
    linkedBranchName: item.github_linked_branch_name || null,
    linkedBranchUrl: item.github_linked_branch_url || null,
    linkedBranchSource: item.github_branch_source || null,
    commentCount: Number.isInteger(item.comment_count) ? item.comment_count : 0,
    latestCommentAt: item.latest_comment_at || null,
    boardType,
    createdAt: item.created_at || null,
    updatedAt: item.updated_at || null,
  };
}

function resolveCommentAuthorName(comment) {
  if (comment?.source === 'github_review') {
    return comment?.source_metadata?.reviewer_name
      || comment?.source_metadata?.reviewer_login
      || 'GitHub Reviewer';
  }

  return comment?.source_metadata?.author_name
    || comment?.profiles?.name
    || '익명 사용자';
}

export function formatQuazarCommentDetail(comment, boardType) {
  return {
    commentId: comment.id,
    itemId: comment.item_id,
    boardType,
    content: comment.content || '',
    tags: Array.isArray(comment.tags) ? comment.tags : [],
    source: comment.source || '',
    sourceUrl: comment.source_url || null,
    sourceMetadata: comment.source_metadata || null,
    authorUserId: comment.user_id || null,
    authorName: resolveCommentAuthorName(comment),
    authorDepartment: comment.profiles?.department || '',
    createdAt: comment.created_at || null,
    updatedAt: comment.updated_at || null,
  };
}

export function formatQuazarProjectDetail(project, boardType) {
  return {
    projectId: project.id,
    title: project.title || '',
    tags: Array.isArray(project.tags) ? project.tags : [],
    isCompleted: Boolean(project.is_completed),
    sectionId: project.section_id || null,
    boardType,
    orderIndex: Number.isInteger(project.order_index) ? project.order_index : null,
    createdAt: project.created_at || null,
    updatedAt: project.updated_at || null,
  };
}

export function formatQuazarSectionDetail(section) {
  return {
    sectionId: section.id,
    title: section.title || '',
    boardType: section.board_type || section.boardType || '',
    orderIndex: Number.isInteger(section.order_index) ? section.order_index : null,
  };
}

function formatQuazarItemSummary(item) {
  return {
    itemId: item.id,
    title: item.title || '',
    description: item.description || '',
    itemStatus: item.status || '',
    priority: item.priority || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    assignees: Array.isArray(item.assignees) ? item.assignees : [],
    projectId: item.project_id || null,
    projectTitle: item.project_title || '',
    pageType: item.page_type || null,
    startDate: item.start_date || null,
    endDate: item.end_date || null,
    ticketKey: item.ticket_key || null,
    ticketNumber: item.ticket_number ?? null,
    hasLinkedIssue: Boolean(item.has_linked_issue || item.ticket_key),
    linkedIssueCount: Number.isInteger(item.linked_issue_count) ? item.linked_issue_count : 0,
    hasLinkedBranch: Boolean(item.github_linked_branch_name),
    linkedBranchName: item.github_linked_branch_name || null,
    commentCount: Number.isInteger(item.comment_count) ? item.comment_count : 0,
    latestCommentAt: item.latest_comment_at || null,
    updatedAt: item.updated_at || null,
  };
}

function buildCommentMetricsMap(comments = []) {
  const metricsByItemId = new Map();

  for (const comment of comments) {
    const itemId = comment?.item_id || null;
    if (!itemId) continue;
    const existing = metricsByItemId.get(itemId) || {
      comment_count: 0,
      latest_comment_at: null,
    };
    existing.comment_count += 1;
    const createdAt = comment?.created_at || null;
    if (createdAt && (!existing.latest_comment_at || createdAt > existing.latest_comment_at)) {
      existing.latest_comment_at = createdAt;
    }
    metricsByItemId.set(itemId, existing);
  }

  return metricsByItemId;
}

function buildIssueMetricsMap(issueLinks = []) {
  const metricsByItemId = new Map();

  for (const issue of issueLinks) {
    const itemId = issue?.item_id || null;
    if (!itemId) continue;
    const existing = metricsByItemId.get(itemId) || {
      linked_issue_count: 0,
      linked_issue_repo_full_name: null,
      linked_issue_url: null,
      has_linked_issue: false,
    };
    existing.linked_issue_count += 1;
    existing.has_linked_issue = true;

    if (!existing.linked_issue_url && issue?.issue_url) {
      existing.linked_issue_url = issue.issue_url;
    }
    if (!existing.linked_issue_repo_full_name && issue?.repo_full_name) {
      existing.linked_issue_repo_full_name = issue.repo_full_name;
    }

    metricsByItemId.set(itemId, existing);
  }

  return metricsByItemId;
}

function enrichItemsWithActivity(items = [], { commentMetricsByItemId = new Map(), issueMetricsByItemId = new Map() } = {}) {
  return items.map((item) => ({
    ...item,
    ...(commentMetricsByItemId.get(item.id) || {}),
    ...(issueMetricsByItemId.get(item.id) || {}),
  }));
}

function matchesSearchQuery(item, query) {
  const normalizedQuery = normalizeProjectName(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeProjectName(`${item.title || ''} ${item.description || ''}`);
  return haystack.includes(normalizedQuery);
}

function matchesStatus(item, status) {
  if (!status) return true;
  return String(item.status || '').trim() === status;
}

function matchesTags(item, tags = []) {
  if (tags.length === 0) return true;
  const itemTags = new Set((Array.isArray(item.tags) ? item.tags : []).map((tag) => String(tag).trim().toLowerCase()));
  return tags.every((tag) => itemTags.has(tag.toLowerCase()));
}

export function createQuazarProjectLookup({ listProjects }) {
  return async function lookupProjects(payload = {}) {
    const boardType = requireBoardType(payload.boardType);
    const query = normalizeOptionalString(payload.query);
    const limit = normalizeLimit(payload.limit, 50, 100);

    const projects = await listProjects({ boardType });
    const matches = filterProjectsByQuery(projects, query)
      .slice(0, limit)
      .map((project) => ({
        id: project.id,
        title: project.title,
      }));

    return {
      boardType,
      count: matches.length,
      projects: matches,
    };
  };
}

export async function resolveQuazarSection({ payload, listSections }) {
  const validated = validateResolveQuazarSectionInput(payload);
  const sections = await listSections({ boardType: validated.boardType });
  const matches = findMatchingSections(sections, validated.sectionName)
    .map((section) => ({
      sectionId: section.id,
      title: section.title,
      boardType: section.board_type || section.boardType || validated.boardType,
      orderIndex: Number.isInteger(section.order_index) ? section.order_index : null,
    }));

  if (matches.length === 0) {
    return {
      boardType: validated.boardType,
      status: 'NOT_FOUND',
      sectionName: validated.sectionName,
      section: null,
      candidates: [],
    };
  }

  if (matches.length > 1) {
    return {
      boardType: validated.boardType,
      status: 'AMBIGUOUS',
      sectionName: validated.sectionName,
      section: null,
      candidates: matches,
    };
  }

  return {
    boardType: validated.boardType,
    status: 'FOUND',
    sectionName: validated.sectionName,
    section: matches[0],
    candidates: matches,
  };
}

export async function resolveQuazarProject({ payload, listProjects }) {
  const validated = validateResolveQuazarProjectInput(payload);
  const projects = await listProjects({ boardType: validated.boardType });
  const matches = findMatchingProjects(projects, validated.projectName)
    .map((project) => ({
      projectId: project.id,
      title: project.title,
      sectionId: project.section_id || project.sectionId || null,
      isCompleted: Boolean(project.is_completed ?? project.isCompleted),
      boardType: project.board_type || project.boardType || validated.boardType,
    }));

  if (matches.length === 0) {
    return {
      boardType: validated.boardType,
      status: 'NOT_FOUND',
      projectName: validated.projectName,
      project: null,
      candidates: [],
    };
  }

  if (matches.length > 1) {
    return {
      boardType: validated.boardType,
      status: 'AMBIGUOUS',
      projectName: validated.projectName,
      project: null,
      candidates: matches,
    };
  }

  return {
    boardType: validated.boardType,
    status: 'FOUND',
    projectName: validated.projectName,
    project: matches[0],
    candidates: matches,
  };
}

export function createQuazarSectionLookup({ listSections }) {
  return async function lookupSections(payload = {}) {
    const validated = validateListQuazarSectionsInput(payload);
    const sections = await listSections({ boardType: validated.boardType });
    const matches = filterSectionsByQuery(sections, validated.query)
      .slice(0, validated.limit)
      .map((section) => ({
        id: section.id,
        title: section.title,
        boardType: section.board_type || section.boardType || validated.boardType,
        orderIndex: Number.isInteger(section.order_index) ? section.order_index : null,
      }));

    return {
      boardType: validated.boardType,
      count: matches.length,
      sections: matches,
    };
  };
}

export async function createQuazarItem({ payload, listProjects, insertItem }) {
  const validated = validateCreateQuazarItemInput(payload);
  const projects = await listProjects({ boardType: validated.boardType });
  const targetProject = resolveProjectMatch(projects, validated.projectName);
  const item = await insertItem({
    boardType: validated.boardType,
    projectId: targetProject.id,
    title: validated.title,
    description: validated.description,
    tags: validated.tags,
  });

  return {
    itemId: item.id,
    projectId: targetProject.id,
    projectTitle: targetProject.title,
    boardType: validated.boardType,
    title: validated.title,
    tags: validated.tags,
  };
}

export async function createQuazarItemSearch({ payload, listProjects, searchItems }) {
  const validated = validateSearchQuazarItemsInput(payload);
  let projectId = null;

  if (validated.projectName) {
    const projects = await listProjects({ boardType: validated.boardType });
    projectId = resolveProjectMatch(projects, validated.projectName).id;
  }

  const items = await searchItems({
    boardType: validated.boardType,
    query: validated.query,
    status: validated.status,
    tags: validated.tags,
    limit: validated.limit,
    includeCompletedProjects: validated.includeCompletedProjects,
    projectId,
  });

  return {
    boardType: validated.boardType,
    count: items.length,
    items: items.map(formatQuazarItemSummary),
  };
}

export async function getQuazarItemDetail({ payload, getItem }) {
  const validated = validateGetQuazarItemInput(payload);
  const item = await getItem(validated);

  if (!item) {
    throw createError('ITEM_NOT_FOUND', 404, 'Item was not found.');
  }

  return formatQuazarItemDetail(item, validated.boardType);
}

export async function createQuazarItemUpdate({ payload, getItem, updateItem }) {
  const validated = validateUpdateQuazarItemInput(payload);
  const existingItem = await getItem({
    boardType: validated.boardType,
    itemId: validated.itemId,
  });

  if (!existingItem) {
    throw createError('ITEM_NOT_FOUND', 404, 'Item was not found.');
  }

  const updatedItem = await updateItem(validated);
  return formatQuazarItemDetail(updatedItem, validated.boardType);
}

export async function createQuazarItemCommentLookup({ payload, getItem, listComments }) {
  const validated = validateListQuazarItemCommentsInput(payload);
  const item = await getItem(validated);

  if (!item) {
    throw createError('ITEM_NOT_FOUND', 404, 'Item was not found.');
  }

  const comments = await listComments(validated);
  return {
    boardType: validated.boardType,
    itemId: validated.itemId,
    count: comments.length,
    comments: comments.map((comment) => formatQuazarCommentDetail(comment, validated.boardType)),
  };
}

export async function createQuazarComment({ payload, getItem, insertComment }) {
  const validated = validateCreateQuazarCommentInput(payload);
  const item = await getItem({
    boardType: validated.boardType,
    itemId: validated.itemId,
  });

  if (!item) {
    throw createError('ITEM_NOT_FOUND', 404, 'Item was not found.');
  }

  const comment = await insertComment(validated);
  return formatQuazarCommentDetail(comment, validated.boardType);
}

function assertCommentWritable(comment) {
  if (!comment) {
    throw createError('COMMENT_NOT_FOUND', 404, 'Comment was not found.');
  }

  if (comment.source === 'github_review') {
    throw createError('COMMENT_READ_ONLY', 409, 'GitHub review comments are read-only.');
  }
}

export async function createQuazarCommentUpdate({ payload, getItem, getComment, updateComment }) {
  const validated = validateUpdateQuazarCommentInput(payload);
  const item = await getItem({
    boardType: validated.boardType,
    itemId: validated.itemId,
  });

  if (!item) {
    throw createError('ITEM_NOT_FOUND', 404, 'Item was not found.');
  }

  const existingComment = await getComment(validated);
  assertCommentWritable(existingComment);

  const comment = await updateComment(validated);
  return formatQuazarCommentDetail(comment, validated.boardType);
}

export async function deleteQuazarComment({ payload, getItem, getComment, deleteComment }) {
  const validated = validateDeleteQuazarCommentInput(payload);
  const item = await getItem({
    boardType: validated.boardType,
    itemId: validated.itemId,
  });

  if (!item) {
    throw createError('ITEM_NOT_FOUND', 404, 'Item was not found.');
  }

  const existingComment = await getComment(validated);
  assertCommentWritable(existingComment);

  await deleteComment(validated);
  return {
    boardType: validated.boardType,
    itemId: validated.itemId,
    commentId: validated.commentId,
    deleted: true,
  };
}

export async function createQuazarSection({ payload, insertSection }) {
  const validated = validateCreateQuazarSectionInput(payload);
  const section = await insertSection(validated);
  return formatQuazarSectionDetail(section);
}

export async function createQuazarProject({ payload, insertProject, listSections = null }) {
  const validated = validateCreateQuazarProjectInput(payload);
  let sectionId = validated.sectionId;

  if (!sectionId && validated.sectionName) {
    const sections = await listSections?.({ boardType: validated.boardType }) || [];
    sectionId = resolveSectionMatch(sections, validated.sectionName).id;
  }

  const project = await insertProject({
    boardType: validated.boardType,
    title: validated.title,
    sectionId,
    tags: validated.tags,
  });
  return formatQuazarProjectDetail(project, validated.boardType);
}

export async function getQuazarProjectDetail({ payload, getProject }) {
  const validated = validateGetQuazarProjectInput(payload);
  const project = await getProject(validated);

  if (!project) {
    throw createError('PROJECT_NOT_FOUND', 404, 'Project was not found.');
  }

  return formatQuazarProjectDetail(project, validated.boardType);
}

export async function getQuazarProjectActivity({ payload, getProject, listItems, listCommentMetrics, listIssueMetrics }) {
  const validated = validateGetQuazarProjectActivityInput(payload);
  const project = await getProject(validated);

  if (!project) {
    throw createError('PROJECT_NOT_FOUND', 404, 'Project was not found.');
  }

  const items = (await listItems(validated)).map((item) => ({
    ...item,
    project_title: item.project_title || project.title || '',
  }));
  const itemIds = items.map((item) => item.id).filter(Boolean);
  const commentMetricsByItemId = await listCommentMetrics(itemIds);
  const issueMetricsByItemId = await listIssueMetrics(itemIds);
  const enrichedItems = enrichItemsWithActivity(items, {
    commentMetricsByItemId,
    issueMetricsByItemId,
  });

  return {
    project: formatQuazarProjectDetail(project, validated.boardType),
    boardType: validated.boardType,
    count: enrichedItems.length,
    items: enrichedItems.map(formatQuazarItemSummary),
  };
}

export async function createQuazarProjectUpdate({ payload, getProject, updateProject }) {
  const validated = validateUpdateQuazarProjectInput(payload);
  const existingProject = await getProject({
    boardType: validated.boardType,
    projectId: validated.projectId,
  });

  if (!existingProject) {
    throw createError('PROJECT_NOT_FOUND', 404, 'Project was not found.');
  }

  const updatedProject = await updateProject(validated);
  return formatQuazarProjectDetail(updatedProject, validated.boardType);
}

function getProjectsTable(boardType) {
  return boardType === 'main' ? 'roadmap_projects' : 'projects';
}

function getItemsTable(boardType) {
  return boardType === 'main' ? 'roadmap_items' : 'items';
}

function getProjectOrderField(boardType) {
  return boardType === 'main' ? 'order_index' : 'order_index';
}

async function selectProjectsForBoard(supabase, boardType, includeCompletedProjects = true) {
  let query = supabase
    .from(getProjectsTable(boardType))
    .select('id, title, board_type, is_completed')
    .eq('board_type', boardType)
    .order(getProjectOrderField(boardType), { ascending: true });

  if (!includeCompletedProjects) {
    query = query.eq('is_completed', false);
  }

  const { data, error } = await query;
  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return data || [];
}

async function selectSectionsForBoard(supabase, boardType) {
  const { data, error } = await supabase
    .from('sections')
    .select('id, title, board_type, order_index')
    .eq('board_type', boardType)
    .order('order_index', { ascending: true });

  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return data || [];
}

async function getProjectById(supabase, boardType, projectId) {
  const { data, error } = await supabase
    .from(getProjectsTable(boardType))
    .select('id, title, tags, assignees, assignee_user_ids, is_completed, section_id, order_index, created_at, updated_at, board_type')
    .eq('board_type', boardType)
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return data || null;
}

async function selectItemsForBoard(supabase, boardType, projectId = null) {
  let query = supabase
    .from(getItemsTable(boardType))
    .select('id, title, description, status, priority, tags, assignees, assignee_user_ids, project_id, page_type, start_date, end_date, is_ticket, ticket_key, ticket_number, github_linked_branch_name, github_linked_branch_url, github_branch_source, created_at, updated_at, board_type')
    .eq('board_type', boardType)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return data || [];
}

async function getItemById(supabase, boardType, itemId) {
  const { data, error } = await supabase
    .from(getItemsTable(boardType))
    .select('id, title, description, status, priority, tags, assignees, assignee_user_ids, project_id, page_type, start_date, end_date, is_ticket, ticket_key, ticket_number, github_linked_branch_name, github_linked_branch_url, github_branch_source, created_at, updated_at, board_type')
    .eq('board_type', boardType)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return data || null;
}

async function selectCommentsForItem(supabase, itemId) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, item_id, user_id, content, tags, source, source_url, source_metadata, created_at, updated_at, profiles (name, department)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });

  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return data || [];
}

async function selectCommentMetricsForItems(supabase, itemIds = []) {
  if (itemIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('comments')
    .select('item_id, created_at')
    .in('item_id', itemIds);

  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return buildCommentMetricsMap(data || []);
}

async function getCommentById(supabase, itemId, commentId) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, item_id, user_id, content, tags, source, source_url, source_metadata, created_at, updated_at, profiles (name, department)')
    .eq('item_id', itemId)
    .eq('id', commentId)
    .maybeSingle();

  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return data || null;
}

async function selectIssueLinksForItems(supabase, itemIds = []) {
  if (itemIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('item_github_issues')
    .select('item_id, repo_full_name, issue_url')
    .in('item_id', itemIds);

  if (error) {
    throw createError('INTERNAL_ERROR', 500, error.message);
  }

  return buildIssueMetricsMap(data || []);
}

export function createQuazarItemService(supabase) {
  if (!supabase) {
    throw new Error('Supabase admin client is required for MCP item creation.');
  }

  const listProjectsForBoard = async ({ boardType, includeCompletedProjects = true }) =>
    selectProjectsForBoard(supabase, boardType, includeCompletedProjects);
  const listSectionsForBoard = async ({ boardType }) =>
    selectSectionsForBoard(supabase, boardType);

  const hydrateProjectTitle = async (boardType, item) => {
    if (!item) return null;

    const projects = await listProjectsForBoard({ boardType, includeCompletedProjects: true });
    const projectMap = new Map(projects.map((project) => [project.id, project.title]));
    const commentMetricsByItemId = await selectCommentMetricsForItems(supabase, [item.id]);
    const issueMetricsByItemId = await selectIssueLinksForItems(supabase, [item.id]);

    return {
      ...item,
      project_title: projectMap.get(item.project_id) || '',
      ...(commentMetricsByItemId.get(item.id) || {}),
      ...(issueMetricsByItemId.get(item.id) || {}),
    };
  };

  return {
    async resolveSection(payload) {
      return resolveQuazarSection({
        payload,
        listSections: ({ boardType }) => listSectionsForBoard({ boardType }),
      });
    },

    async listSections(payload) {
      return createQuazarSectionLookup({
        listSections: ({ boardType }) => listSectionsForBoard({ boardType }),
      })(payload);
    },

    async createSection(payload) {
      return createQuazarSection({
        payload,
        insertSection: async ({ boardType, title }) => {
          const { data: existingSections, error: existingError } = await supabase
            .from('sections')
            .select('order_index')
            .eq('board_type', boardType)
            .order('order_index', { ascending: false })
            .limit(1);

          if (existingError) {
            throw createError('INTERNAL_ERROR', 500, existingError.message);
          }

          const nextOrder = existingSections?.[0] ? existingSections[0].order_index + 1 : 0;
          const { data, error } = await supabase
            .from('sections')
            .insert([{
              title,
              board_type: boardType,
              order_index: nextOrder,
            }])
            .select('id, title, board_type, order_index')
            .single();

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }

          return data;
        },
      });
    },

    async listProjects(payload) {
      return createQuazarProjectLookup({
        listProjects: ({ boardType }) => listProjectsForBoard({ boardType, includeCompletedProjects: true }),
      })(payload);
    },

    async resolveProject(payload) {
      return resolveQuazarProject({
        payload,
        listProjects: ({ boardType }) => listProjectsForBoard({ boardType, includeCompletedProjects: true }),
      });
    },

    async createItem(payload) {
      return createQuazarItem({
        payload,
        listProjects: ({ boardType }) => listProjectsForBoard({ boardType, includeCompletedProjects: true }),
        insertItem: async ({ boardType, projectId, title, description, tags }) => {
          const itemsTable = getItemsTable(boardType);
          const { data: existingItems, error: existingError } = await supabase
            .from(itemsTable)
            .select('order_index')
            .eq('project_id', projectId)
            .order('order_index', { ascending: false })
            .limit(1);

          if (existingError) {
            throw createError('INTERNAL_ERROR', 500, existingError.message);
          }

          const nextOrder = existingItems?.[0] ? existingItems[0].order_index + 1 : 0;
          const { data, error } = await supabase
            .from(itemsTable)
            .insert([{
              project_id: projectId,
              title,
              description,
              order_index: nextOrder,
              status: 'none',
              created_by: null,
              board_type: boardType,
              teams: [],
              assignees: [],
              assignee_user_ids: [],
              tags,
              related_items: [],
            }])
            .select('id')
            .single();

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }

          return data;
        },
      });
    },

    async searchItems(payload) {
      return createQuazarItemSearch({
        payload,
        listProjects: ({ boardType }) =>
          listProjectsForBoard({
            boardType,
            includeCompletedProjects: normalizeBoolean(payload?.includeCompletedProjects, true),
          }),
        searchItems: async ({ boardType, query, status, tags, limit, includeCompletedProjects, projectId }) => {
          const projects = await listProjectsForBoard({ boardType, includeCompletedProjects });
          const projectMap = new Map(projects.map((project) => [project.id, project.title]));
          const allowedProjectIds = new Set(projects.map((project) => project.id));
          const items = await selectItemsForBoard(supabase, boardType, projectId);
          const itemIds = items.map((item) => item.id).filter(Boolean);
          const commentMetricsByItemId = await selectCommentMetricsForItems(supabase, itemIds);
          const issueMetricsByItemId = await selectIssueLinksForItems(supabase, itemIds);

          return enrichItemsWithActivity(items, {
            commentMetricsByItemId,
            issueMetricsByItemId,
          })
            .filter((item) => item.project_id && allowedProjectIds.has(item.project_id))
            .filter((item) => matchesSearchQuery(item, query))
            .filter((item) => matchesStatus(item, status))
            .filter((item) => matchesTags(item, tags))
            .slice(0, limit)
            .map((item) => ({
              ...item,
              project_title: projectMap.get(item.project_id) || '',
            }));
        },
      });
    },

    async getItem(payload) {
      return getQuazarItemDetail({
        payload,
        getItem: async ({ boardType, itemId }) => {
          const item = await getItemById(supabase, boardType, itemId);
          return hydrateProjectTitle(boardType, item);
        },
      });
    },

    async updateItem(payload) {
      return createQuazarItemUpdate({
        payload,
        getItem: async ({ boardType, itemId }) => getItemById(supabase, boardType, itemId),
        updateItem: async ({ boardType, itemId, patch }) => {
          const updates = { ...patch };

          const { data, error } = await supabase
            .from(getItemsTable(boardType))
            .update(updates)
            .eq('board_type', boardType)
            .eq('id', itemId)
            .select('id, title, description, status, priority, tags, assignees, assignee_user_ids, project_id, page_type, start_date, end_date, is_ticket, ticket_key, ticket_number, github_linked_branch_name, github_linked_branch_url, github_branch_source, created_at, updated_at, board_type')
            .maybeSingle();

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }

          return hydrateProjectTitle(boardType, data || null);
        },
      });
    },

    async getProjectActivity(payload) {
      return getQuazarProjectActivity({
        payload,
        getProject: async ({ boardType, projectId }) => getProjectById(supabase, boardType, projectId),
        listItems: async ({ boardType, projectId }) => {
          const items = await selectItemsForBoard(supabase, boardType, projectId);
          return items.filter((item) => !item.page_type || item.page_type === 'task');
        },
        listCommentMetrics: async (itemIds) => selectCommentMetricsForItems(supabase, itemIds),
        listIssueMetrics: async (itemIds) => selectIssueLinksForItems(supabase, itemIds),
      });
    },

    async listComments(payload) {
      return createQuazarItemCommentLookup({
        payload,
        getItem: async ({ boardType, itemId }) => getItemById(supabase, boardType, itemId),
        listComments: async ({ itemId }) => selectCommentsForItem(supabase, itemId),
      });
    },

    async createComment(payload) {
      return createQuazarComment({
        payload,
        getItem: async ({ boardType, itemId }) => getItemById(supabase, boardType, itemId),
        insertComment: async ({ itemId, content, tags, authorName }) => {
          const { data, error } = await supabase
            .from('comments')
            .insert([{
              item_id: itemId,
              user_id: null,
              content,
              tags,
              source: 'mcp',
              source_metadata: {
                author_name: authorName,
                created_via: 'mcp',
              },
            }])
            .select('id, item_id, user_id, content, tags, source, source_url, source_metadata, created_at, updated_at, profiles (name, department)')
            .single();

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }

          return data;
        },
      });
    },

    async updateComment(payload) {
      return createQuazarCommentUpdate({
        payload,
        getItem: async ({ boardType, itemId }) => getItemById(supabase, boardType, itemId),
        getComment: async ({ itemId, commentId }) => getCommentById(supabase, itemId, commentId),
        updateComment: async ({ itemId, commentId, patch }) => {
          const { data, error } = await supabase
            .from('comments')
            .update(patch)
            .eq('item_id', itemId)
            .eq('id', commentId)
            .select('id, item_id, user_id, content, tags, source, source_url, source_metadata, created_at, updated_at, profiles (name, department)')
            .maybeSingle();

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }

          return data || null;
        },
      });
    },

    async deleteComment(payload) {
      return deleteQuazarComment({
        payload,
        getItem: async ({ boardType, itemId }) => getItemById(supabase, boardType, itemId),
        getComment: async ({ itemId, commentId }) => getCommentById(supabase, itemId, commentId),
        deleteComment: async ({ itemId, commentId }) => {
          const { error } = await supabase
            .from('comments')
            .delete()
            .eq('item_id', itemId)
            .eq('id', commentId);

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }
        },
      });
    },

    async createProject(payload) {
      return createQuazarProject({
        payload,
        listSections: ({ boardType }) => listSectionsForBoard({ boardType }),
        insertProject: async ({ boardType, title, sectionId, tags }) => {
          const { data: existingProjects, error: existingError } = await supabase
            .from(getProjectsTable(boardType))
            .select('order_index')
            .eq('board_type', boardType)
            .order('order_index', { ascending: false })
            .limit(1);

          if (existingError) {
            throw createError('INTERNAL_ERROR', 500, existingError.message);
          }

          const nextOrder = existingProjects?.[0] ? existingProjects[0].order_index + 1 : 0;
          const { data, error } = await supabase
            .from(getProjectsTable(boardType))
            .insert([{
              title,
              order_index: nextOrder,
              board_type: boardType,
              assignees: [],
              assignee_user_ids: [],
              section_id: sectionId,
              is_completed: false,
              tags,
            }])
            .select('id, title, tags, is_completed, section_id, order_index, created_at, board_type')
            .single();

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }

          return data;
        },
      });
    },

    async getProject(payload) {
      return getQuazarProjectDetail({
        payload,
        getProject: async ({ boardType, projectId }) => getProjectById(supabase, boardType, projectId),
      });
    },

    async updateProject(payload) {
      return createQuazarProjectUpdate({
        payload,
        getProject: async ({ boardType, projectId }) => getProjectById(supabase, boardType, projectId),
        updateProject: async ({ boardType, projectId, patch }) => {
          const updates = {};

          if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
            updates.title = patch.title;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'isCompleted')) {
            updates.is_completed = patch.isCompleted;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'tags')) {
            updates.tags = patch.tags;
          }

          const { data, error } = await supabase
            .from(getProjectsTable(boardType))
            .update(updates)
            .eq('board_type', boardType)
            .eq('id', projectId)
            .select('id, title, tags, is_completed, section_id, order_index, created_at, board_type')
            .maybeSingle();

          if (error) {
            throw createError('INTERNAL_ERROR', 500, error.message);
          }

          return data || null;
        },
      });
    },
  };
}
