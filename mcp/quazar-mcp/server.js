#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import process from 'node:process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'url';
import { z } from 'zod';

import {
  createQuazarSectionViaApi,
  createQuazarItemGitHubBranchViaApi,
  createQuazarItemGitHubIssueViaApi,
  createQuazarItemGitHubPullRequestViaApi,
  createQuazarItemCommentViaApi,
  createQuazarProjectViaApi,
  createQuazarItemViaApi,
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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run the Quazar MCP server.`);
  }
  return value;
}

function resolveExecutablePath(pathname) {
  try {
    return realpathSync(pathname);
  } catch {
    return pathname;
  }
}

export function isDirectExecution(argv1 = process.argv[1], moduleUrl = import.meta.url) {
  if (!argv1) return false;

  return resolveExecutablePath(fileURLToPath(moduleUrl)) === resolveExecutablePath(argv1);
}

export async function runCreateQuazarItemTool(args, { createItem }) {
  const result = await createItem(args);
  return {
    content: [{
      type: 'text',
      text: `Created Quazar item ${result.itemId} in ${result.projectTitle} (${result.boardType}).`,
    }],
    structuredContent: result,
  };
}

export async function runListQuazarSectionsTool(args, { listSections }) {
  const result = await listSections(args);
  const sectionLines = result.sections.map((section) => `- ${section.title} (${section.id})`);

  return {
    content: [{
      type: 'text',
      text: sectionLines.length > 0
        ? `Found ${result.count} Quazar sections in ${result.boardType}:\n${sectionLines.join('\n')}`
        : `No Quazar sections matched in ${result.boardType}.`,
    }],
    structuredContent: result,
  };
}

export async function runCreateQuazarSectionTool(args, { createSection }) {
  const result = await createSection(args);
  return {
    content: [{
      type: 'text',
      text: `Created Quazar section ${result.sectionId}: ${result.title} (${result.boardType}).`,
    }],
    structuredContent: result,
  };
}

export async function runResolveQuazarSectionTool(args, { resolveSection }) {
  const result = await resolveSection(args);
  return {
    content: [{
      type: 'text',
      text: result.status === 'FOUND'
        ? `Resolved Quazar section ${result.section.title} (${result.section.sectionId}) in ${result.boardType}.`
        : result.status === 'AMBIGUOUS'
          ? `Multiple Quazar sections matched "${result.sectionName}" in ${result.boardType}.`
          : `No Quazar section matched "${result.sectionName}" in ${result.boardType}.`,
    }],
    structuredContent: result,
  };
}

export async function runCreateQuazarProjectTool(args, { createProject }) {
  const result = await createProject(args);
  return {
    content: [{
      type: 'text',
      text: `Created Quazar project ${result.projectId}: ${result.title} (${result.boardType}).`,
    }],
    structuredContent: result,
  };
}

export async function runListQuazarProjectsTool(args, { listProjects }) {
  const result = await listProjects(args);
  const projectLines = result.projects.map((project) => `- ${project.title} (${project.id})`);

  return {
    content: [{
      type: 'text',
      text: projectLines.length > 0
        ? `Found ${result.count} Quazar projects in ${result.boardType}:\n${projectLines.join('\n')}`
        : `No Quazar projects matched in ${result.boardType}.`,
    }],
    structuredContent: result,
  };
}

export async function runResolveQuazarProjectTool(args, { resolveProject }) {
  const result = await resolveProject(args);
  return {
    content: [{
      type: 'text',
      text: result.status === 'FOUND'
        ? `Resolved Quazar project ${result.project.title} (${result.project.projectId}) in ${result.boardType}.`
        : result.status === 'AMBIGUOUS'
          ? `Multiple Quazar projects matched "${result.projectName}" in ${result.boardType}.`
          : `No Quazar project matched "${result.projectName}" in ${result.boardType}.`,
    }],
    structuredContent: result,
  };
}

export async function runSearchQuazarItemsTool(args, { searchItems }) {
  const result = await searchItems(args);
  const itemLines = result.items.map((item) => `- ${item.title} [${item.itemStatus || 'none'}] (${item.projectTitle})`);

  return {
    content: [{
      type: 'text',
      text: itemLines.length > 0
        ? `Found ${result.count} Quazar items in ${result.boardType}:\n${itemLines.join('\n')}`
        : `No Quazar items matched in ${result.boardType}.`,
    }],
    structuredContent: result,
  };
}

export async function runGetQuazarItemTool(args, { getItem }) {
  const result = await getItem(args);
  return {
    content: [{
      type: 'text',
      text: `Quazar item ${result.itemId}: ${result.title} in ${result.projectTitle} (${result.boardType}, status: ${result.itemStatus || 'none'}).`,
    }],
    structuredContent: result,
  };
}

export async function runListQuazarItemCommentsTool(args, { listComments }) {
  const result = await listComments(args);
  const commentLines = result.comments.map((comment) => `- ${comment.authorName}: ${comment.content}`);

  return {
    content: [{
      type: 'text',
      text: commentLines.length > 0
        ? `Found ${result.count} comments on Quazar item ${result.itemId}:\n${commentLines.join('\n')}`
        : `No comments found on Quazar item ${result.itemId}.`,
    }],
    structuredContent: result,
  };
}

export async function runCreateQuazarItemCommentTool(args, { createComment }) {
  const result = await createComment(args);
  return {
    content: [{
      type: 'text',
      text: `Created Quazar comment ${result.commentId} on item ${result.itemId}.`,
    }],
    structuredContent: result,
  };
}

export async function runUpdateQuazarItemCommentTool(args, { updateComment }) {
  const result = await updateComment(args);
  return {
    content: [{
      type: 'text',
      text: `Updated Quazar comment ${result.commentId} on item ${result.itemId}.`,
    }],
    structuredContent: result,
  };
}

export async function runDeleteQuazarItemCommentTool(args, { deleteComment }) {
  const result = await deleteComment(args);
  return {
    content: [{
      type: 'text',
      text: `Deleted Quazar comment ${result.commentId} from item ${result.itemId}.`,
    }],
    structuredContent: result,
  };
}

export async function runUpdateQuazarItemTool(args, { updateItem }) {
  const result = await updateItem(args);
  return {
    content: [{
      type: 'text',
      text: `Updated Quazar item ${result.itemId}: ${result.title} (${result.itemStatus || 'none'}) in ${result.projectTitle}.`,
    }],
    structuredContent: result,
  };
}

export async function runGetQuazarProjectTool(args, { getProject }) {
  const result = await getProject(args);
  return {
    content: [{
      type: 'text',
      text: `Quazar project ${result.projectId}: ${result.title} (${result.boardType}, completed: ${result.isCompleted}).`,
    }],
    structuredContent: result,
  };
}

export async function runGetQuazarProjectActivityTool(args, { getProjectActivity }) {
  const result = await getProjectActivity(args);
  const itemLines = result.items.map((item) => `- ${item.title}${item.ticketKey ? ` [${item.ticketKey}]` : ''}`);

  return {
    content: [{
      type: 'text',
      text: itemLines.length > 0
        ? `Quazar project ${result.project.projectId} has ${result.count} items:\n${itemLines.join('\n')}`
        : `Quazar project ${result.project.projectId} does not have any items yet.`,
    }],
    structuredContent: result,
  };
}

export async function runUpdateQuazarProjectTool(args, { updateProject }) {
  const result = await updateProject(args);
  return {
    content: [{
      type: 'text',
      text: `Updated Quazar project ${result.projectId}: ${result.title} (${result.boardType}).`,
    }],
    structuredContent: result,
  };
}

export function inferRepoFullNameFromGitRemote(remoteUrl) {
  const normalized = String(remoteUrl || '').trim();
  if (!normalized) return null;

  const sshMatch = normalized.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch?.[1]) {
    return sshMatch[1].replace(/^\/+/, '');
  }

  const httpsMatch = normalized.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?$/i);
  if (httpsMatch?.[1]) {
    return httpsMatch[1].replace(/^\/+/, '');
  }

  return null;
}

export function getSuggestedRepoFullNameFromWorkspace(cwd = process.cwd()) {
  try {
    const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return inferRepoFullNameFromGitRemote(remoteUrl);
  } catch {
    return null;
  }
}

export function buildSuggestedCheckoutCommands(branchName) {
  const normalizedBranchName = String(branchName || '').trim();
  if (!normalizedBranchName) return null;
  return [
    `git fetch origin ${normalizedBranchName}`,
    `git switch ${normalizedBranchName} || git switch --track -c ${normalizedBranchName} origin/${normalizedBranchName}`,
  ];
}

function mapGitHubIssueToolResult(result, repoSource) {
  return {
    ok: result?.ok ?? true,
    status: result?.status || 'CREATED',
    itemId: result?.issue?.item_id || null,
    repoFullName: result?.issue?.repo_full_name || null,
    repoSource,
    issueNumber: result?.issue?.issue_number || null,
    issueUrl: result?.issue?.issue_url || null,
    ticketKey: result?.ticket?.ticket_key || null,
    ticketNumber: result?.ticket?.ticket_number || null,
    labelSync: result?.labelSync || null,
  };
}

function mapGitHubBranchToolResult(result) {
  const branchName = result?.branchName || result?.branch?.branchName || null;
  return {
    ok: result?.ok ?? true,
    status: result?.status || (result?.created ? 'CREATED' : 'FOUND'),
    itemId: result?.itemId || null,
    repoFullName: result?.repoFullName || result?.issue?.repoFullName || null,
    issueNumber: result?.issueNumber || result?.issue?.issueNumber || null,
    issueUrl: result?.issueUrl || result?.issue?.issueUrl || null,
    hasLinkedIssue: Boolean(result?.hasLinkedIssue ?? result?.issue),
    hasLinkedBranch: Boolean(result?.hasLinkedBranch ?? result?.branch),
    branchName,
    branchUrl: result?.branchUrl || result?.branch?.branchUrl || null,
    created: Boolean(result?.created),
    branchSource: result?.branchSource || null,
    fromCache: Boolean(result?.fromCache),
    suggestedCheckoutCommand: buildSuggestedCheckoutCommands(branchName),
  };
}

export async function runCreateQuazarItemGitHubIssueTool(args, { createGitHubIssue, getSuggestedRepoFullName = getSuggestedRepoFullNameFromWorkspace }) {
  const repoFullName = typeof args.repoFullName === 'string' && args.repoFullName.trim()
    ? args.repoFullName.trim()
    : getSuggestedRepoFullName();

  if (!repoFullName) {
    throw new Error('repoFullName을 명시하거나 현재 워크스페이스의 origin remote를 GitHub로 설정해야 합니다.');
  }

  const repoSource = typeof args.repoFullName === 'string' && args.repoFullName.trim() ? 'explicit' : 'workspace';
  const result = await createGitHubIssue({
    itemId: args.itemId,
    repoFullName,
  });
  const structuredContent = mapGitHubIssueToolResult(result, repoSource);

  return {
    content: [{
      type: 'text',
      text: structuredContent.status === 'ALREADY_EXISTS'
        ? `Reused existing GitHub issue ${structuredContent.issueNumber} for Quazar item ${structuredContent.itemId} in ${structuredContent.repoFullName}.`
        : `Created GitHub issue ${structuredContent.issueNumber} for Quazar item ${structuredContent.itemId} in ${structuredContent.repoFullName} (${structuredContent.ticketKey}).`,
    }],
    structuredContent,
  };
}

export async function runCreateQuazarItemGitHubBranchTool(args, { createGitHubBranch }) {
  const result = await createGitHubBranch(args);
  const structuredContent = mapGitHubBranchToolResult(result);

  return {
    content: [{
      type: 'text',
      text: structuredContent.status === 'ALREADY_EXISTS'
        ? `Reused GitHub branch ${structuredContent.branchName || 'unknown'} for Quazar item ${structuredContent.itemId} in ${structuredContent.repoFullName}.`
        : `Prepared GitHub branch ${structuredContent.branchName || 'unknown'} for Quazar item ${structuredContent.itemId} in ${structuredContent.repoFullName}.`,
    }],
    structuredContent,
  };
}

export async function runGetQuazarItemGitHubBranchTool(args, { getGitHubBranch }) {
  const result = await getGitHubBranch(args);
  const structuredContent = mapGitHubBranchToolResult(result);

  return {
    content: [{
      type: 'text',
      text: structuredContent.branchName
        ? `Quazar item ${args.itemId} is linked to branch ${structuredContent.branchName} in ${structuredContent.repoFullName}.`
        : `Quazar item ${args.itemId} does not have a linked GitHub branch yet.`,
    }],
    structuredContent,
  };
}

export async function runCreateQuazarItemGitHubPullRequestTool(args, { createGitHubPullRequest }) {
  const result = await createGitHubPullRequest(args);
  const pullRequest = result?.pullRequest || {};
  const issue = result?.issue || {};
  const branch = result?.branch || {};
  const structuredContent = {
    ok: Boolean(result?.ok),
    status: result?.status || 'CREATED',
    itemId: result?.itemId || args.itemId,
    repoFullName: result?.repoFullName || null,
    issueNumber: issue.issueNumber || null,
    issueUrl: issue.issueUrl || null,
    ticketKey: result?.ticket?.ticket_key || result?.ticket?.ticketKey || null,
    ticketNumber: result?.ticket?.ticket_number || result?.ticket?.ticketNumber || null,
    branchName: branch.branchName || null,
    branchUrl: branch.branchUrl || null,
    pullNumber: pullRequest.pull_number || null,
    pullUrl: pullRequest.pull_url || null,
    pullState: pullRequest.pull_state_snapshot || null,
    created: Boolean(result?.created),
    body: result?.body || null,
  };

  return {
    content: [{
      type: 'text',
      text: structuredContent.status === 'ALREADY_EXISTS'
        ? `Reused existing GitHub PR ${structuredContent.pullNumber || 'unknown'} for Quazar item ${structuredContent.itemId} in ${structuredContent.repoFullName}.`
        : `Created GitHub PR ${structuredContent.pullNumber || 'unknown'} for Quazar item ${structuredContent.itemId} in ${structuredContent.repoFullName} (${structuredContent.ticketKey || 'no-ticket'}).`,
    }],
    structuredContent,
  };
}

export function createQuazarMcpServer({
  createSection,
  resolveSection,
  createProject,
  getProject,
  getProjectActivity,
  updateProject,
  createItem,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  listSections,
  listProjects,
  resolveProject,
  searchItems,
  getItem,
  updateItem,
  createGitHubIssue,
  createGitHubBranch,
  createGitHubPullRequest,
  getGitHubBranch,
  getSuggestedRepoFullName = getSuggestedRepoFullNameFromWorkspace,
}) {
  const server = new McpServer({
    name: 'quazar-item-mcp',
    version: '1.8.0',
  });

  server.registerTool('create_quazar_item', {
    title: 'Create Quazar Item',
    description: 'Create a Quazar item inside an existing Quazar project column.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      projectName: z.string().min(1).describe('Target Quazar project column title'),
      title: z.string().min(1).describe('Item title'),
      description: z.string().optional().describe('Optional item body content'),
      tags: z.array(z.string()).optional().describe('Optional tags'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      itemId: z.string(),
      projectId: z.string(),
      projectTitle: z.string(),
      boardType: z.string(),
      title: z.string(),
      tags: z.array(z.string()),
    },
  }, async (args) => runCreateQuazarItemTool(args, { createItem }));

  server.registerTool('list_quazar_sections', {
    title: 'List Quazar Sections',
    description: 'List Quazar board sections, optionally filtered by query.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      query: z.string().optional().describe('Optional partial section title filter'),
      limit: z.number().int().positive().max(100).optional().describe('Maximum number of sections to return'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      boardType: z.string(),
      count: z.number().int(),
      sections: z.array(z.object({
        id: z.string(),
        title: z.string(),
        boardType: z.string(),
        orderIndex: z.number().int(),
      })),
    },
  }, async (args) => runListQuazarSectionsTool(args, { listSections }));

  server.registerTool('create_quazar_section', {
    title: 'Create Quazar Section',
    description: 'Create a Quazar section in a board.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      title: z.string().min(1).describe('Section title'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      sectionId: z.string(),
      title: z.string(),
      boardType: z.string(),
      orderIndex: z.number().int(),
    },
  }, async (args) => runCreateQuazarSectionTool(args, { createSection }));

  server.registerTool('resolve_quazar_section', {
    title: 'Resolve Quazar Section',
    description: 'Resolve one Quazar section by exact normalized title match without creating anything.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      sectionName: z.string().min(1).describe('Exact section title to resolve after normalization'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.enum(['FOUND', 'NOT_FOUND', 'AMBIGUOUS']),
      boardType: z.string(),
      sectionName: z.string(),
      section: z.object({
        sectionId: z.string(),
        title: z.string(),
        boardType: z.string(),
        orderIndex: z.number().int().nullable(),
      }).nullable(),
      candidates: z.array(z.object({
        sectionId: z.string(),
        title: z.string(),
        boardType: z.string(),
        orderIndex: z.number().int().nullable(),
      })),
    },
  }, async (args) => runResolveQuazarSectionTool(args, { resolveSection }));

  server.registerTool('create_quazar_project', {
    title: 'Create Quazar Project',
    description: 'Create a Quazar project column in a board.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      title: z.string().min(1).describe('Project title'),
      tags: z.array(z.string()).optional().describe('Optional project tags'),
      sectionId: z.string().optional().nullable().describe('Optional target section id'),
      sectionName: z.string().optional().describe('Optional target section title resolved by exact normalized match'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      projectId: z.string(),
      title: z.string(),
      tags: z.array(z.string()).optional(),
      isCompleted: z.boolean(),
      sectionId: z.string().nullable(),
      boardType: z.string(),
      orderIndex: z.number().int().nullable(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable().optional(),
    },
  }, async (args) => runCreateQuazarProjectTool(args, { createProject }));

  server.registerTool('list_quazar_projects', {
    title: 'List Quazar Projects',
    description: 'List Quazar project column names for a board, optionally filtered by query.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      query: z.string().optional().describe('Optional partial project title filter'),
      limit: z.number().int().positive().max(100).optional().describe('Maximum number of projects to return'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      boardType: z.string(),
      count: z.number().int(),
      projects: z.array(z.object({
        id: z.string(),
        title: z.string(),
      })),
    },
  }, async (args) => runListQuazarProjectsTool(args, { listProjects }));

  server.registerTool('resolve_quazar_project', {
    title: 'Resolve Quazar Project',
    description: 'Resolve one Quazar project by exact normalized title match without creating anything.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      projectName: z.string().min(1).describe('Exact project title to resolve after normalization'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.enum(['FOUND', 'NOT_FOUND', 'AMBIGUOUS']),
      boardType: z.string(),
      projectName: z.string(),
      project: z.object({
        projectId: z.string(),
        title: z.string(),
        sectionId: z.string().nullable(),
        isCompleted: z.boolean(),
        boardType: z.string(),
      }).nullable(),
      candidates: z.array(z.object({
        projectId: z.string(),
        title: z.string(),
        sectionId: z.string().nullable(),
        isCompleted: z.boolean(),
        boardType: z.string(),
      })),
    },
  }, async (args) => runResolveQuazarProjectTool(args, { resolveProject }));

  server.registerTool('search_quazar_items', {
    title: 'Search Quazar Items',
    description: 'Search Quazar items by project, text, status, and tags.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      query: z.string().optional().describe('Optional text query across title and description'),
      projectName: z.string().optional().describe('Optional project title to scope the search'),
      status: z.string().optional().describe('Optional status filter'),
      tags: z.array(z.string()).optional().describe('Optional tags that all must match'),
      limit: z.number().int().positive().max(100).optional().describe('Maximum number of items to return'),
      includeCompletedProjects: z.boolean().optional().describe('Whether completed projects should be included'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      boardType: z.string(),
      count: z.number().int(),
      items: z.array(z.object({
        itemId: z.string(),
        title: z.string(),
        description: z.string(),
        itemStatus: z.string(),
        priority: z.string(),
        tags: z.array(z.string()),
        assignees: z.array(z.string()).optional(),
        projectId: z.string().nullable(),
        projectTitle: z.string(),
        pageType: z.string().nullable().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        ticketKey: z.string().nullable().optional(),
        ticketNumber: z.number().int().nullable().optional(),
        hasLinkedIssue: z.boolean().optional(),
        linkedIssueCount: z.number().int().optional(),
        hasLinkedBranch: z.boolean().optional(),
        linkedBranchName: z.string().nullable().optional(),
        commentCount: z.number().int().optional(),
        latestCommentAt: z.string().nullable().optional(),
        updatedAt: z.string().nullable().optional(),
      })),
    },
  }, async (args) => runSearchQuazarItemsTool(args, { searchItems }));

  server.registerTool('get_quazar_item', {
    title: 'Get Quazar Item',
    description: 'Get full detail for one Quazar item.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      itemId: z.string().min(1).describe('Quazar item id'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      itemId: z.string(),
      title: z.string(),
      description: z.string(),
      itemStatus: z.string(),
      priority: z.string(),
      tags: z.array(z.string()),
      assignees: z.array(z.string()).optional(),
      assigneeUserIds: z.array(z.string()).optional(),
      projectId: z.string().nullable(),
      projectTitle: z.string(),
      pageType: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      isTicket: z.boolean().optional(),
      ticketKey: z.string().nullable().optional(),
      ticketNumber: z.number().int().nullable().optional(),
      hasLinkedIssue: z.boolean().optional(),
      linkedIssueCount: z.number().int().optional(),
      linkedIssueRepoFullName: z.string().nullable().optional(),
      linkedIssueUrl: z.string().nullable().optional(),
      hasLinkedBranch: z.boolean().optional(),
      linkedBranchName: z.string().nullable().optional(),
      linkedBranchUrl: z.string().nullable().optional(),
      linkedBranchSource: z.string().nullable().optional(),
      commentCount: z.number().int().optional(),
      latestCommentAt: z.string().nullable().optional(),
      boardType: z.string(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable().optional(),
    },
  }, async (args) => runGetQuazarItemTool(args, { getItem }));

  server.registerTool('list_quazar_item_comments', {
    title: 'List Quazar Item Comments',
    description: 'List comments for one Quazar item.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      itemId: z.string().min(1).describe('Quazar item id'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      boardType: z.string(),
      itemId: z.string(),
      count: z.number().int(),
      comments: z.array(z.object({
        commentId: z.string(),
        itemId: z.string(),
        boardType: z.string(),
        content: z.string(),
        tags: z.array(z.string()),
        source: z.string(),
        sourceUrl: z.string().nullable(),
        sourceMetadata: z.any().nullable(),
        authorUserId: z.string().nullable(),
        authorName: z.string(),
        authorDepartment: z.string(),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
      })),
    },
  }, async (args) => runListQuazarItemCommentsTool(args, { listComments }));

  server.registerTool('create_quazar_item_comment', {
    title: 'Create Quazar Item Comment',
    description: 'Create a comment on one Quazar item.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      itemId: z.string().min(1).describe('Quazar item id'),
      content: z.string().min(1).describe('Comment content'),
      tags: z.array(z.string()).optional().describe('Optional comment tags'),
      authorName: z.string().optional().describe('Optional display name stored in comment metadata'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      commentId: z.string(),
      itemId: z.string(),
      boardType: z.string(),
      content: z.string(),
      tags: z.array(z.string()),
      source: z.string(),
      sourceUrl: z.string().nullable(),
      sourceMetadata: z.any().nullable(),
      authorUserId: z.string().nullable(),
      authorName: z.string(),
      authorDepartment: z.string(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable(),
    },
  }, async (args) => runCreateQuazarItemCommentTool(args, { createComment }));

  server.registerTool('update_quazar_item_comment', {
    title: 'Update Quazar Item Comment',
    description: 'Update mutable Quazar comment fields: content and tags.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      itemId: z.string().min(1).describe('Quazar item id'),
      commentId: z.string().min(1).describe('Quazar comment id'),
      content: z.string().optional().describe('Optional replacement comment content'),
      tags: z.array(z.string()).optional().describe('Optional replacement tags'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      commentId: z.string(),
      itemId: z.string(),
      boardType: z.string(),
      content: z.string(),
      tags: z.array(z.string()),
      source: z.string(),
      sourceUrl: z.string().nullable(),
      sourceMetadata: z.any().nullable(),
      authorUserId: z.string().nullable(),
      authorName: z.string(),
      authorDepartment: z.string(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable(),
    },
  }, async (args) => runUpdateQuazarItemCommentTool(args, { updateComment }));

  server.registerTool('delete_quazar_item_comment', {
    title: 'Delete Quazar Item Comment',
    description: 'Delete one mutable Quazar item comment.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      itemId: z.string().min(1).describe('Quazar item id'),
      commentId: z.string().min(1).describe('Quazar comment id'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      boardType: z.string(),
      itemId: z.string(),
      commentId: z.string(),
      deleted: z.boolean(),
    },
  }, async (args) => runDeleteQuazarItemCommentTool(args, { deleteComment }));

  server.registerTool('get_quazar_project', {
    title: 'Get Quazar Project',
    description: 'Get full detail for one Quazar project.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      projectId: z.string().min(1).describe('Quazar project id'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      projectId: z.string(),
      title: z.string(),
      tags: z.array(z.string()).optional(),
      isCompleted: z.boolean(),
      sectionId: z.string().nullable(),
      boardType: z.string(),
      orderIndex: z.number().int().nullable(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable().optional(),
    },
  }, async (args) => runGetQuazarProjectTool(args, { getProject }));

  server.registerTool('get_quazar_project_activity', {
    title: 'Get Quazar Project Activity',
    description: 'Get one Quazar project with its current item activity summaries.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      projectId: z.string().min(1).describe('Quazar project id'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      boardType: z.string(),
      project: z.object({
        projectId: z.string(),
        title: z.string(),
        tags: z.array(z.string()).optional(),
        isCompleted: z.boolean(),
        sectionId: z.string().nullable(),
        boardType: z.string(),
        orderIndex: z.number().int().nullable(),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable().optional(),
      }),
      count: z.number().int(),
      items: z.array(z.object({
        itemId: z.string(),
        title: z.string(),
        description: z.string(),
        itemStatus: z.string(),
        priority: z.string(),
        tags: z.array(z.string()),
        assignees: z.array(z.string()).optional(),
        projectId: z.string().nullable(),
        projectTitle: z.string(),
        pageType: z.string().nullable().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        ticketKey: z.string().nullable().optional(),
        ticketNumber: z.number().int().nullable().optional(),
        hasLinkedIssue: z.boolean().optional(),
        linkedIssueCount: z.number().int().optional(),
        hasLinkedBranch: z.boolean().optional(),
        linkedBranchName: z.string().nullable().optional(),
        commentCount: z.number().int().optional(),
        latestCommentAt: z.string().nullable().optional(),
        updatedAt: z.string().nullable().optional(),
      })),
    },
  }, async (args) => runGetQuazarProjectActivityTool(args, { getProjectActivity }));

  server.registerTool('update_quazar_item', {
    title: 'Update Quazar Item',
    description: 'Update safe-core Quazar item fields: status, priority, description, and tags.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      itemId: z.string().min(1).describe('Quazar item id'),
      status: z.string().optional().describe('Optional status value'),
      priority: z.string().optional().describe('Optional priority value'),
      description: z.string().optional().describe('Optional replacement description'),
      tags: z.array(z.string()).optional().describe('Optional replacement tags'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      itemId: z.string(),
      title: z.string(),
      description: z.string(),
      itemStatus: z.string(),
      priority: z.string(),
      tags: z.array(z.string()),
      assignees: z.array(z.string()).optional(),
      assigneeUserIds: z.array(z.string()).optional(),
      projectId: z.string().nullable(),
      projectTitle: z.string(),
      pageType: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      isTicket: z.boolean().optional(),
      ticketKey: z.string().nullable().optional(),
      ticketNumber: z.number().int().nullable().optional(),
      hasLinkedIssue: z.boolean().optional(),
      linkedIssueCount: z.number().int().optional(),
      linkedIssueRepoFullName: z.string().nullable().optional(),
      linkedIssueUrl: z.string().nullable().optional(),
      hasLinkedBranch: z.boolean().optional(),
      linkedBranchName: z.string().nullable().optional(),
      linkedBranchUrl: z.string().nullable().optional(),
      linkedBranchSource: z.string().nullable().optional(),
      commentCount: z.number().int().optional(),
      latestCommentAt: z.string().nullable().optional(),
      boardType: z.string(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable().optional(),
    },
  }, async (args) => runUpdateQuazarItemTool(args, { updateItem }));

  server.registerTool('update_quazar_project', {
    title: 'Update Quazar Project',
    description: 'Update safe-core Quazar project fields: title and completion state.',
    inputSchema: {
      boardType: z.enum(['main', '개발팀', 'AI팀', '지원팀']).describe('Quazar board type'),
      projectId: z.string().min(1).describe('Quazar project id'),
      title: z.string().optional().describe('Optional replacement title'),
      tags: z.array(z.string()).optional().describe('Optional replacement tags'),
      isCompleted: z.boolean().optional().describe('Optional completion state'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      projectId: z.string(),
      title: z.string(),
      tags: z.array(z.string()).optional(),
      isCompleted: z.boolean(),
      sectionId: z.string().nullable(),
      boardType: z.string(),
      orderIndex: z.number().int().nullable(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable().optional(),
    },
  }, async (args) => runUpdateQuazarProjectTool(args, { updateProject }));

  server.registerTool('create_quazar_item_github_issue', {
    title: 'Create Quazar Item GitHub Issue',
    description: 'Create a GitHub issue linked to one Quazar item. If repoFullName is omitted, the current workspace origin remote is used as a suggestion.',
    inputSchema: {
      itemId: z.string().min(1).describe('Quazar item id'),
      repoFullName: z.string().optional().describe('Optional GitHub owner/repo. Falls back to the current workspace origin remote.'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      itemId: z.string().nullable(),
      repoFullName: z.string().nullable(),
      repoSource: z.enum(['explicit', 'workspace']),
      issueNumber: z.number().int().nullable(),
      issueUrl: z.string().nullable(),
      ticketKey: z.string().nullable(),
      ticketNumber: z.number().int().nullable(),
      labelSync: z.object({
        requested: z.array(z.string()),
        applied: z.array(z.string()),
        success: z.boolean(),
        message: z.string(),
      }).nullable(),
    },
  }, async (args) => runCreateQuazarItemGitHubIssueTool(args, {
    createGitHubIssue,
    getSuggestedRepoFullName,
  }));

  server.registerTool('create_quazar_item_github_branch', {
    title: 'Create Quazar Item GitHub Branch',
    description: 'Create or discover the linked GitHub branch for one Quazar item and return checkout guidance.',
    inputSchema: {
      itemId: z.string().min(1).describe('Quazar item id'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      itemId: z.string().nullable(),
      repoFullName: z.string().nullable(),
      issueNumber: z.number().int().nullable(),
      issueUrl: z.string().nullable(),
      hasLinkedIssue: z.boolean(),
      hasLinkedBranch: z.boolean(),
      branchName: z.string().nullable(),
      branchUrl: z.string().nullable(),
      created: z.boolean(),
      branchSource: z.string().nullable(),
      fromCache: z.boolean(),
      suggestedCheckoutCommand: z.array(z.string()).nullable(),
    },
  }, async (args) => runCreateQuazarItemGitHubBranchTool(args, { createGitHubBranch }));

  server.registerTool('get_quazar_item_github_branch', {
    title: 'Get Quazar Item GitHub Branch',
    description: 'Get linked GitHub branch details for one Quazar item and return checkout guidance.',
    inputSchema: {
      itemId: z.string().min(1).describe('Quazar item id'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      itemId: z.string().nullable(),
      repoFullName: z.string().nullable(),
      issueNumber: z.number().int().nullable(),
      issueUrl: z.string().nullable(),
      hasLinkedIssue: z.boolean(),
      hasLinkedBranch: z.boolean(),
      branchName: z.string().nullable(),
      branchUrl: z.string().nullable(),
      created: z.boolean(),
      branchSource: z.string().nullable(),
      fromCache: z.boolean(),
      suggestedCheckoutCommand: z.array(z.string()).nullable(),
    },
  }, async (args) => runGetQuazarItemGitHubBranchTool(args, { getGitHubBranch }));

  server.registerTool('create_quazar_item_github_pull_request', {
    title: 'Create Quazar Item GitHub Pull Request',
    description: 'Create a GitHub pull request for one Quazar item using the same ticket-based draft flow as the Quazar roadmap UI.',
    inputSchema: {
      itemId: z.string().min(1).describe('Quazar item id'),
      title: z.string().optional().describe('Optional PR title override. Defaults to the roadmap draft title.'),
      body: z.string().optional().describe('Optional PR body override. Defaults to the roadmap draft body.'),
      base: z.string().optional().describe('Optional base branch override. Defaults to the repository default branch.'),
      draft: z.boolean().optional().describe('Whether to create the PR as draft. Defaults to the roadmap draft setting.'),
    },
    outputSchema: {
      ok: z.boolean(),
      status: z.string(),
      itemId: z.string().nullable(),
      repoFullName: z.string().nullable(),
      issueNumber: z.number().int().nullable(),
      issueUrl: z.string().nullable(),
      ticketKey: z.string().nullable(),
      ticketNumber: z.number().int().nullable(),
      branchName: z.string().nullable(),
      branchUrl: z.string().nullable(),
      pullNumber: z.number().int().nullable(),
      pullUrl: z.string().nullable(),
      pullState: z.string().nullable(),
      created: z.boolean(),
      body: z.string().nullable(),
    },
  }, async (args) => runCreateQuazarItemGitHubPullRequestTool(args, { createGitHubPullRequest }));

  return server;
}

export async function main() {
  const baseUrl = requireEnv('QUAZAR_API_BASE_URL');
  const token = requireEnv('MCP_SHARED_TOKEN');
  const server = createQuazarMcpServer({
    createSection: (payload) => createQuazarSectionViaApi({ baseUrl, token }, payload),
    resolveSection: (payload) => resolveQuazarSectionViaApi({ baseUrl, token }, payload),
    createProject: (payload) => createQuazarProjectViaApi({ baseUrl, token }, payload),
    getProject: (payload) => getQuazarProjectViaApi({ baseUrl, token }, payload),
    getProjectActivity: (payload) => getQuazarProjectActivityViaApi({ baseUrl, token }, payload),
    updateProject: (payload) => updateQuazarProjectViaApi({ baseUrl, token }, payload),
    createItem: (payload) => createQuazarItemViaApi({ baseUrl, token }, payload),
    listComments: (payload) => listQuazarItemCommentsViaApi({ baseUrl, token }, payload),
    createComment: (payload) => createQuazarItemCommentViaApi({ baseUrl, token }, payload),
    updateComment: (payload) => updateQuazarItemCommentViaApi({ baseUrl, token }, payload),
    deleteComment: (payload) => deleteQuazarItemCommentViaApi({ baseUrl, token }, payload),
    listSections: (payload) => listQuazarSectionsViaApi({ baseUrl, token }, payload),
    listProjects: (payload) => listQuazarProjectsViaApi({ baseUrl, token }, payload),
    resolveProject: (payload) => resolveQuazarProjectViaApi({ baseUrl, token }, payload),
    searchItems: (payload) => searchQuazarItemsViaApi({ baseUrl, token }, payload),
    getItem: (payload) => getQuazarItemViaApi({ baseUrl, token }, payload),
    updateItem: (payload) => updateQuazarItemViaApi({ baseUrl, token }, payload),
    createGitHubIssue: (payload) => createQuazarItemGitHubIssueViaApi({ baseUrl, token }, payload),
    createGitHubBranch: (payload) => createQuazarItemGitHubBranchViaApi({ baseUrl, token }, payload),
    createGitHubPullRequest: (payload) => createQuazarItemGitHubPullRequestViaApi({ baseUrl, token }, payload),
    getGitHubBranch: (payload) => getQuazarItemGitHubBranchViaApi({ baseUrl, token }, payload),
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Quazar MCP server running on stdio');
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error('Quazar MCP server failed:', error);
    process.exit(1);
  });
}
