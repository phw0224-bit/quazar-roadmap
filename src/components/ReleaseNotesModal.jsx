/**
 * @fileoverview 내부 배포 변경사항을 카테고리별로 보여주는 릴리즈 노트 모달.
 *
 * 소개형 마케팅 문구 대신 추가/변경/UI 변경/삭제·정리 중심의 변경 로그를
 * 빠르게 스캔할 수 있게 렌더링한다. App에서 현재 릴리즈 데이터를 주입한다.
 */

import { X } from 'lucide-react';

export default function ReleaseNotesModal({ release, onClose }) {
  if (!release) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="relative flex max-h-[min(90vh,860px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-border-subtle dark:bg-bg-base">
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

        <div className="overflow-y-auto bg-gray-50/70 px-4 py-4 dark:bg-bg-elevated/40 sm:px-6 sm:py-6">
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
  );
}
