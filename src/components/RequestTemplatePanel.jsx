import { ClipboardList } from 'lucide-react';
import { DEV_REQUEST_TEMPLATE } from '../lib/devRequestBoard';

export default function RequestTemplatePanel() {
  return (
    <section className="mt-4 rounded-[28px] border border-amber-200/80 bg-amber-50/70 px-5 py-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/15">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-amber-600 dark:text-amber-300 shrink-0" />
            <h3 className="text-lg font-black tracking-tight text-amber-950 dark:text-amber-100">
              {DEV_REQUEST_TEMPLATE.title}
            </h3>
          </div>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
            {DEV_REQUEST_TEMPLATE.subtitle}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/80 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          임시
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {DEV_REQUEST_TEMPLATE.fields.map((field) => (
          <div
            key={field.key}
            className="rounded-2xl border border-amber-200/70 bg-white/70 px-4 py-3 shadow-sm dark:border-amber-900/30 dark:bg-[#1a1208]/50"
          >
            <p className="text-sm font-bold text-amber-950 dark:text-amber-100">
              {field.label}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-amber-800/80 dark:text-amber-200/80">
              {field.hint}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-amber-800/70 dark:text-amber-200/70">
        {DEV_REQUEST_TEMPLATE.note}
      </p>
    </section>
  );
}
