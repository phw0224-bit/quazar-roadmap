import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const SlashCommandMenu = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex];
        if (item) { command(item); return true; }
      }
      return false;
    },
  }));

  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!items.length) return null;

  return (
    <div
      ref={containerRef}
      className="
        z-50 w-64 max-h-72 overflow-y-auto
        bg-white dark:bg-bg-elevated
        border border-gray-200 dark:border-border-subtle
        rounded-xl shadow-xl py-1
      "
    >
      {items.map((item, index) => (
        <button
          key={item.title}
          data-index={index}
          type="button"
          onClick={() => command(item)}
          className={`
            w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
            ${index === selectedIndex
              ? 'bg-gray-100 dark:bg-bg-hover text-gray-900 dark:text-text-primary'
              : 'text-gray-700 dark:text-text-secondary hover:bg-gray-50 dark:hover:bg-bg-hover'
            }
          `}
        >
          <span className="w-8 h-8 flex items-center justify-center text-sm bg-gray-100 dark:bg-bg-hover rounded-lg flex-shrink-0 font-mono font-bold text-gray-600 dark:text-text-secondary">
            {item.icon}
          </span>
          <div>
            <div className="text-sm font-medium leading-tight">{item.title}</div>
            {item.description && (
              <div className="text-xs text-gray-400 dark:text-text-tertiary mt-0.5">{item.description}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';
export default SlashCommandMenu;
