/**
 * @fileoverview 내부 배포 변경사항을 카테고리별로 보여주는 릴리즈 노트 모달.
 *
 * 좌측 버전 목록에서 버전을 선택하면 우측에 해당 릴리즈 상세 내용이 표시된다.
 * App에서 RELEASE_NOTES 전체 배열을 주입하고 initialId로 초기 선택 버전을 지정한다.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

export default function ReleaseNotesModal({ releases, initialId, onClose }) {
  const [selectedId, setSelectedId] = useState(initialId ?? releases?.[0]?.id ?? null);

  if (!releases || releases.length === 0) return null;

  const release = releases.find(r => r.id === selectedId) ?? releases[0];
  const latestId = releases[0]?.id;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="relative flex max-h-[min(90vh,860px)] w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-border-subtle dark:bg-bg-base">

        {/* Left: version list */}
        <aside className="flex w-52 shrink-0 flex-col border-r border-gray-100 bg-gray-50/80 dark:border-border-subtle dark:bg-bg-elevated">
          <div className="px-4 py-5 border-b border-gray-100 dark:border-border-subtle">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-text-tertiary">버전 히스토리</p>
          </div>
          <ul className="flex-1 overflow-y-auto py-2">
            {releases.map(r => {
              const isSelected = r.id === selectedId;
              const isLatest = r.id === latestId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-bg-base text-gray-900 dark:text-text-primary'
                        : 'text-gray-500 dark:text-text-secondary hover:bg-white/60 dark:hover:bg-bg-base/60 hover:text-gray-700 dark:hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${isSelected ? 'text-gray-900 dark:text-text-primary' : 'text-gray-500 dark:text-text-tertiary'}`}>
                        {r.version}
                      </span>
                      {isLatest && (
                        <span className="rounded-full bg-brand-100 dark:bg-brand-800/40 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                          최신
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 text-xs leading-snug line-clamp-2 ${isSelected ? 'text-gray-600 dark:text-text-secondary' : 'text-gray-400 dark:text-text-tertiary'}`}>
                      {r.title}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Right: release detail */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="relative border-b border-gray-100 px-6 py-5 dark:border-border-subtle sm:px-8 sm:py-6">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-bg-hover dark:hover:text-text-primary transition-colors cursor-pointer"
              aria-label="업데이트 내역 닫기"
            >
              <X size={20} />
            </button>

            <div className="pr-10">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-text-tertiary">
                Release Notes
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-text-primary sm:text-3xl">
                {release.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-text-secondary">
                <span className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-700 dark:border-border-subtle dark:text-text-primary">
                  {release.version}
                </span>
                <span>{release.description}</span>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-y-auto bg-gray-50/70 px-4 py-4 dark:bg-bg-elevated/40 sm:px-6 sm:py-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {release.sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-border-subtle dark:bg-bg-base"
                >
                  <h3 className="text-sm font-black tracking-[0.18em] text-gray-500 dark:text-text-secondary">
                    {section.title}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm leading-6 text-gray-700 dark:text-text-secondary"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-text-tertiary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end border-t border-gray-100 bg-white px-6 py-4 dark:border-border-subtle dark:bg-bg-base sm:px-8">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
