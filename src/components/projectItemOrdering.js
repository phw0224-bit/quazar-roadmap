export function sortProjectItemsByCompletion(items = []) {
  return [...items].sort((left, right) => {
    const leftDone = left?.status === 'done';
    const rightDone = right?.status === 'done';

    if (leftDone !== rightDone) {
      return leftDone ? 1 : -1;
    }

    return (left?.order_index ?? 0) - (right?.order_index ?? 0);
  });
}
