export function buildProjectMovePlan({
  allItems,
  sourceProjectId,
  targetProjectId,
  itemId,
  targetIndex,
  targetParentId = undefined,
}) {
  const movingItem = allItems.find((item) => item.id === itemId);
  if (!movingItem) {
    throw new Error(`Item not found: ${itemId}`);
  }

  const sourceParentId = movingItem.parent_item_id ?? null;
  const nextParentId = targetParentId === undefined ? sourceParentId : targetParentId;
  const isSameLevel =
    sourceProjectId === targetProjectId &&
    sourceParentId === nextParentId;

  const getLevelItems = (projectId, parentItemId) =>
    allItems
      .filter((item) => item.project_id === projectId && (item.parent_item_id ?? null) === parentItemId)
      .sort((a, b) => a.order_index - b.order_index);

  const sourceLevelItems = getLevelItems(sourceProjectId, sourceParentId);
  const targetLevelItems = isSameLevel
    ? sourceLevelItems
    : getLevelItems(targetProjectId, nextParentId);

  const nextSourceLevel = sourceLevelItems.filter((item) => item.id !== itemId);
  const insertionIndex = Math.max(0, Math.min(targetIndex, isSameLevel ? nextSourceLevel.length : targetLevelItems.length));
  const nextTargetLevel = isSameLevel
    ? nextSourceLevel
    : targetLevelItems.filter((item) => item.id !== itemId);

  nextTargetLevel.splice(insertionIndex, 0, movingItem);

  const updatesById = new Map();

  nextSourceLevel.forEach((item, orderIndex) => {
    updatesById.set(item.id, { order_index: orderIndex });
  });

  nextTargetLevel.forEach((item, orderIndex) => {
    const updates = {
      project_id: item.id === itemId ? targetProjectId : item.project_id,
      order_index: orderIndex,
    };

    if (item.id === itemId && targetParentId !== undefined) {
      updates.parent_item_id = nextParentId;
    }

    updatesById.set(item.id, {
      ...(updatesById.get(item.id) || {}),
      ...updates,
    });
  });

  return {
    sourceParentId,
    targetParentId: nextParentId,
    isSameLevel,
    updates: Array.from(updatesById.entries()).map(([id, updates]) => ({ id, updates })),
  };
}
