import { useState } from 'react';
import { Github } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import {
  AVATAR_STYLE_OPTIONS,
  DEFAULT_PROFILE_CUSTOMIZATION,
  MOOD_EMOJI_OPTIONS,
  THEME_COLOR_OPTIONS,
  normalizeProfileCustomization,
} from '../lib/profileAppearance';

export default function ProfileSettingsModal({
  isOpen,
  profileName,
  initialValue,
  gitHubStatus,
  gitHubLoading = false,
  gitHubConnecting = false,
  saving = false,
  onClose,
  onSave,
  onConnectGitHub,
}) {
  const [draft, setDraft] = useState(() => normalizeProfileCustomization(initialValue || DEFAULT_PROFILE_CUSTOMIZATION));

  if (!isOpen) return null;

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-[32px] border border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-elevated shadow-[0_30px_80px_rgba(0,0,0,0.4)] p-8 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.24em]">Customize</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight">내 프로필 꾸미기</h3>
          </div>
          <ProfileAvatar
            name={profileName}
            customization={draft}
            size="lg"
          />
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 dark:border-border-subtle bg-gray-50 dark:bg-bg-base px-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle">
                  <Github size={18} className="text-gray-700 dark:text-text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-text-primary">GitHub 연결</p>
                  <p className="text-xs text-gray-500 dark:text-text-tertiary">
                    {gitHubLoading
                      ? '연결 상태를 확인하는 중...'
                      : gitHubStatus?.connected
                        ? `Connected as @${gitHubStatus.githubLogin}`
                        : '아이템에서 이슈를 만들려면 GitHub 계정을 연결해야 합니다.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onConnectGitHub}
                disabled={gitHubLoading || gitHubConnecting}
                className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black hover:bg-black dark:hover:bg-gray-100 disabled:opacity-60 cursor-pointer"
              >
                {gitHubConnecting
                  ? '연결 중...'
                  : gitHubStatus?.connected
                    ? 'GitHub 재연결'
                    : 'GitHub 연결'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-gray-700 dark:text-text-secondary mb-2">아바타 스타일</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateDraft('avatarStyle', option.value)}
                  className={`rounded-xl border p-2 flex justify-center transition-all cursor-pointer ${
                    draft.avatarStyle === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/25'
                      : 'border-gray-200 dark:border-border-subtle hover:border-gray-300 dark:hover:border-border-strong'
                  }`}
                  title={option.label}
                >
                  <ProfileAvatar
                    name={profileName}
                    customization={{ ...draft, avatarStyle: option.value }}
                    size="sm"
                    showMood={false}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-gray-700 dark:text-text-secondary mb-2">테마 컬러</p>
            <div className="grid grid-cols-6 gap-2">
              {THEME_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateDraft('themeColor', option.value)}
                  className={`h-10 rounded-xl border-2 transition-all cursor-pointer ${option.chip} ${
                    draft.themeColor === option.value
                      ? 'border-white ring-2 ring-blue-400'
                      : 'border-transparent opacity-85 hover:opacity-100'
                  }`}
                  title={option.value}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-gray-700 dark:text-text-secondary mb-2">무드 이모지</p>
            <div className="grid grid-cols-12 gap-2">
              <button
                type="button"
                onClick={() => updateDraft('moodEmoji', '')}
                className={`h-9 rounded-lg border text-[11px] font-bold cursor-pointer ${
                  !draft.moodEmoji
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-300'
                    : 'border-gray-200 dark:border-border-subtle text-gray-500 dark:text-text-tertiary hover:text-gray-700 dark:hover:text-text-secondary'
                }`}
              >
                없음
              </button>
              {MOOD_EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => updateDraft('moodEmoji', emoji)}
                  className={`h-9 rounded-lg border text-lg cursor-pointer ${
                    draft.moodEmoji === emoji
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/25'
                      : 'border-gray-200 dark:border-border-subtle hover:border-gray-300 dark:hover:border-border-strong'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-gray-700 dark:text-text-secondary">상태 메시지</p>
              <p className="text-xs font-medium text-gray-400 dark:text-text-tertiary">{draft.statusMessage.length}/40</p>
            </div>
            <input
              type="text"
              maxLength={40}
              value={draft.statusMessage}
              onChange={(e) => updateDraft('statusMessage', e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-border-subtle bg-gray-50 dark:bg-bg-base px-4 py-2.5 text-sm text-gray-900 dark:text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="예) 오늘은 집중모드 ON"
            />
          </div>
        </div>

        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 dark:text-text-tertiary hover:text-gray-700 dark:hover:text-text-secondary cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black hover:bg-black dark:hover:bg-gray-100 disabled:opacity-60 cursor-pointer"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
