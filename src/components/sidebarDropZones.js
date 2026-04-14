export const SIDEBAR_INSIDE_START = 0.25;
export const SIDEBAR_INSIDE_END = 0.75;

export function getDragCenterY(rect, fallbackY = 0) {
  if (!rect) return fallbackY;
  return rect.top + rect.height / 2;
}

export function getDropTypeFromRelativeY(relativeY) {
  if (relativeY <= SIDEBAR_INSIDE_START) return 'before';
  if (relativeY >= SIDEBAR_INSIDE_END) return 'after';
  return 'inside';
}

export function getRelativeY({ overRect, draggedRect, fallbackY = 0 }) {
  if (!overRect || overRect.height <= 0) return 0.5;
  const pointerY = getDragCenterY(draggedRect, fallbackY);
  return (pointerY - overRect.top) / overRect.height;
}
