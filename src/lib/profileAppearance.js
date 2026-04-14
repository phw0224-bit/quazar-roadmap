/**
 * @fileoverview 프로필 꾸미기 기본값/옵션/헬퍼.
 */

export const REACTION_TYPES = ['thumbs_up', 'fire', 'clap', 'joy'];

export const REACTION_META = {
  thumbs_up: { emoji: '👍', label: '좋아요' },
  fire: { emoji: '🔥', label: '멋져요' },
  clap: { emoji: '👏', label: '응원해요' },
  joy: { emoji: '😂', label: '재밌어요' },
};

export const AVATAR_STYLE_OPTIONS = [
  { value: 'aurora', glyph: 'A', label: 'Aurora' },
  { value: 'cosmo', glyph: 'C', label: 'Cosmo' },
  { value: 'dawn', glyph: 'D', label: 'Dawn' },
  { value: 'ember', glyph: 'E', label: 'Ember' },
  { value: 'fjord', glyph: 'F', label: 'Fjord' },
  { value: 'glow', glyph: 'G', label: 'Glow' },
  { value: 'honey', glyph: 'H', label: 'Honey' },
  { value: 'ivy', glyph: 'I', label: 'Ivy' },
  { value: 'jelly', glyph: 'J', label: 'Jelly' },
  { value: 'kiwi', glyph: 'K', label: 'Kiwi' },
  { value: 'luna', glyph: 'L', label: 'Luna' },
  { value: 'mint', glyph: 'M', label: 'Mint' },
];

export const THEME_COLOR_OPTIONS = [
  { value: 'slate', bg: '#1f2937', glow: '#334155', chip: 'bg-slate-700' },
  { value: 'ocean', bg: '#1d4ed8', glow: '#0ea5e9', chip: 'bg-blue-600' },
  { value: 'berry', bg: '#be185d', glow: '#ec4899', chip: 'bg-pink-600' },
  { value: 'leaf', bg: '#15803d', glow: '#22c55e', chip: 'bg-green-600' },
  { value: 'sunset', bg: '#c2410c', glow: '#f97316', chip: 'bg-orange-600' },
  { value: 'violet', bg: '#6d28d9', glow: '#8b5cf6', chip: 'bg-violet-600' },
];

export const MOOD_EMOJI_OPTIONS = ['🙂', '😎', '🤓', '🚀', '🔥', '💡', '🌈', '🎯', '🧠', '🫶', '😺', '🦄'];

export const DEFAULT_PROFILE_CUSTOMIZATION = {
  avatarStyle: 'aurora',
  themeColor: 'slate',
  statusMessage: '',
  moodEmoji: '',
};

function pickTheme(themeColor) {
  return THEME_COLOR_OPTIONS.find((option) => option.value === themeColor) || THEME_COLOR_OPTIONS[0];
}

export function normalizeProfileCustomization(rawValue) {
  const raw = rawValue || {};
  return {
    avatarStyle: raw.avatarStyle || raw.avatar_style || DEFAULT_PROFILE_CUSTOMIZATION.avatarStyle,
    themeColor: raw.themeColor || raw.theme_color || DEFAULT_PROFILE_CUSTOMIZATION.themeColor,
    statusMessage: `${raw.statusMessage || raw.status_message || ''}`.slice(0, 40),
    moodEmoji: raw.moodEmoji || raw.mood_emoji || '',
  };
}

export function toCustomizationPayload(customization) {
  const normalized = normalizeProfileCustomization(customization);
  return {
    avatar_style: normalized.avatarStyle,
    theme_color: normalized.themeColor,
    status_message: normalized.statusMessage,
    mood_emoji: normalized.moodEmoji,
  };
}

export function getAvatarGlyph(avatarStyle, fallbackName = '') {
  const selected = AVATAR_STYLE_OPTIONS.find((option) => option.value === avatarStyle);
  if (selected) return selected.glyph;
  return (fallbackName || 'U').charAt(0).toUpperCase();
}

export function getAvatarThemeStyle(themeColor) {
  const theme = pickTheme(themeColor);
  return {
    background: `linear-gradient(135deg, ${theme.bg}, ${theme.glow})`,
    boxShadow: `0 8px 20px -10px ${theme.glow}`,
  };
}
