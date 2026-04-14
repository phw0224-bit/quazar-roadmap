import { buildProjectMovePlan } from '../api/projectMove.js';

function normalizeSectionId(sectionId) {
  return sectionId ?? null;
}

export function cloneProjectsSnapshot(projects) {
  return (projects || []).map((project) => ({
    ...project,
    items: (project.items || []).map((item) => ({ ...item })),
  }));
}

export function applySidebarItemMove(projects, payload) {
  const {
    sourceProjectId,
    targetProjectId,
    itemId,
    targetIndex,
    targetParentId = undefined,
  } = payload;

  const allItems = (projects || []).flatMap((project) => project.items || []);
  const plan = buildProjectMovePlan({
    allItems,
    sourceProjectId,
    targetProjectId,
    itemId,
    targetIndex,
    targetParentId,
  });

  const updatesById = new Map(plan.updates.map((entry) => [entry.id, entry.updates]));
  const movedItems = allItems.map((item) => {
    const updates = updatesById.get(item.id);
    return updates ? { ...item, ...updates } : item;
  });
  const itemsByProjectId = new Map();
  movedItems.forEach((item) => {
    const bucket = itemsByProjectId.get(item.project_id) || [];
    bucket.push(item);
    itemsByProjectId.set(item.project_id, bucket);
  });

  return (projects || []).map((project) => ({
    ...project,
    items: (itemsByProjectId.get(project.id) || []).sort((a, b) => a.order_index - b.order_index),
  }));
}

export function applySidebarProjectMove(projects, payload) {
  const { projectId, targetSectionId, targetIndex } = payload;
  const normalizedTargetSectionId = normalizeSectionId(targetSectionId);
  const movingProject = (projects || []).find((project) => project.id === projectId);
  if (!movingProject) return projects;

  const sourceSectionId = normalizeSectionId(movingProject.section_id);
  const isSameSection = sourceSectionId === normalizedTargetSectionId;

  const sourceSectionProjects = (projects || [])
    .filter((project) => normalizeSectionId(project.section_id) === sourceSectionId)
    .sort((a, b) => a.order_index - b.order_index);

  const targetSectionProjects = isSameSection
    ? sourceSectionProjects
    : (projects || [])
      .filter((project) => normalizeSectionId(project.section_id) === normalizedTargetSectionId)
      .sort((a, b) => a.order_index - b.order_index);

  const nextSourceProjects = sourceSectionProjects.filter((project) => project.id !== projectId);
  const insertAt = Math.max(0, Math.min(targetIndex, isSameSection ? nextSourceProjects.length : targetSectionProjects.length));
  const nextTargetProjects = isSameSection ? nextSourceProjects : targetSectionProjects.filter((project) => project.id !== projectId);
  nextTargetProjects.splice(insertAt, 0, movingProject);

  const updatesById = new Map();
  nextSourceProjects.forEach((project, index) => {
    updatesById.set(project.id, { order_index: index });
  });
  nextTargetProjects.forEach((project, index) => {
    updatesById.set(project.id, {
      ...(updatesById.get(project.id) || {}),
      order_index: index,
      section_id: project.id === projectId ? normalizedTargetSectionId : normalizeSectionId(project.section_id),
    });
  });

  return (projects || []).map((project) => {
    const updates = updatesById.get(project.id);
    return updates ? { ...project, ...updates } : project;
  });
}
