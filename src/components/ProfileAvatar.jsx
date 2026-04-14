import { getAvatarThemeStyle, normalizeProfileCustomization } from '../lib/profileAppearance';

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const MOOD_SIZE_CLASSES = {
  sm: 'text-[10px] -bottom-1 -right-1 px-1',
  md: 'text-xs -bottom-1 -right-1 px-1.5',
  lg: 'text-sm -bottom-1 -right-1 px-1.5',
};

function AvatarMark({ styleId, fallbackText }) {
  const baseProps = {
    width: '66%',
    height: '66%',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'text-white',
  };

  switch (styleId) {
    case 'aurora':
      return (
        <svg {...baseProps}>
          <path d="M3 15c2-4 4-6 9-6s7 2 9 6" />
          <path d="M5 10c1-2 3-3 7-3s6 1 7 3" />
        </svg>
      );
    case 'cosmo':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="2.5" />
          <path d="M4 12h3M17 12h3M12 4v3M12 17v3" />
        </svg>
      );
    case 'dawn':
      return (
        <svg {...baseProps}>
          <path d="M4 15h16" />
          <path d="M7 15a5 5 0 0 1 10 0" />
          <path d="M12 6v2M8 8l1 1M16 8l-1 1" />
        </svg>
      );
    case 'ember':
      return (
        <svg {...baseProps}>
          <path d="M12 4c2 3 4 5 4 8a4 4 0 1 1-8 0c0-2 1-4 4-8Z" />
          <path d="M12 10c1 1 1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 .5-2 1.5-3Z" />
        </svg>
      );
    case 'fjord':
      return (
        <svg {...baseProps}>
          <path d="M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          <path d="M3 11c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        </svg>
      );
    case 'glow':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      );
    case 'honey':
      return (
        <svg {...baseProps}>
          <path d="M8 6h8l3 6-3 6H8l-3-6 3-6Z" />
          <path d="M8 6l4 6 4-6M8 18l4-6 4 6" />
        </svg>
      );
    case 'ivy':
      return (
        <svg {...baseProps}>
          <path d="M12 19c0-5 0-7 0-14" />
          <path d="M12 10c-3 0-4-2-4-4 2 0 4 1 4 4Z" />
          <path d="M12 13c3 0 4-2 4-4-2 0-4 1-4 4Z" />
        </svg>
      );
    case 'jelly':
      return (
        <svg {...baseProps}>
          <path d="M7 10a5 5 0 0 1 10 0v1H7v-1Z" />
          <path d="M8 11v5M11 11v6M14 11v6M16 11v5" />
        </svg>
      );
    case 'kiwi':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 5.5v1M12 17.5v1M5.5 12h1M17.5 12h1M7.8 7.8l.7.7M15.5 15.5l.7.7M16.2 7.8l-.7.7M8.5 15.5l-.7.7" />
        </svg>
      );
    case 'luna':
      return (
        <svg {...baseProps}>
          <path d="M16 5a7 7 0 1 0 0 14 6 6 0 1 1 0-14Z" />
          <path d="M8 8h.01M10 6h.01M8.5 10h.01" />
        </svg>
      );
    case 'mint':
      return (
        <svg {...baseProps}>
          <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      );
    default:
      return <span className="text-white font-black uppercase">{(fallbackText || 'U').charAt(0)}</span>;
  }
}

export default function ProfileAvatar({
  name = '익명',
  customization,
  size = 'md',
  title,
  className = '',
  showMood = true,
}) {
  const normalized = normalizeProfileCustomization(customization);

  return (
    <div className={`relative ${className}`} title={title || name}>
      <div
        className={`${SIZE_CLASSES[size] || SIZE_CLASSES.md} rounded-full flex items-center justify-center text-white font-black border-2 border-white dark:border-border-strong uppercase`}
        style={getAvatarThemeStyle(normalized.themeColor)}
      >
        <AvatarMark styleId={normalized.avatarStyle} fallbackText={name} />
      </div>
      {showMood && normalized.moodEmoji && (
        <span
          className={`absolute ${MOOD_SIZE_CLASSES[size] || MOOD_SIZE_CLASSES.md} leading-none rounded-full bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle`}
        >
          {normalized.moodEmoji}
        </span>
      )}
    </div>
  );
}
