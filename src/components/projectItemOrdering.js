export function sortProjectItemsByCompletion(items = [], options = {}) {
  const { groupCompletedAtBottom = true } = options;

  return [...items].sort((left, right) => {
    const leftDone = left?.status === 'done';
    const rightDone = right?.status === 'done';

    if (groupCompletedAtBottom && leftDone !== rightDone) {
      return leftDone ? 1 : -1;
    }

    const leftCreatedAt = left?.created_at ? new Date(left.created_at).getTime() : null;
    const rightCreatedAt = right?.created_at ? new Date(right.created_at).getTime() : null;

    if (leftCreatedAt !== null && rightCreatedAt !== null && leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    if (leftCreatedAt !== null || rightCreatedAt !== null) {
      return rightCreatedAt === null ? 1 : -1;
    }

    return (right?.order_index ?? 0) - (left?.order_index ?? 0);
  });
}
