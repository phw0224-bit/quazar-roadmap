/**
 * @fileoverview 개발팀 요청 전용 상위 구획.
 *
 * 일반 문서와 분리된 별도 테이블(team_requests)을 렌더링한다.
 * 임시 요청명세 템플릿을 상단에 노출하고, 요청 카드 목록은 단일 리스트로 보여준다.
 */
import { CheckCircle2, ClipboardList, Plus, Trash2, Clock3, Gauge, PencilLine, ArrowUpRight } from 'lucide-react';
import { DEV_REQUEST_BOARD, DEV_REQUEST_STATUSES } from '../lib/devRequestBoard';

const formatDate = (value) => {
  if (!value) return '날짜 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 미정';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const statusTone = (status) => {
  switch (status) {
    case '접수됨':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200';
    case '검토중':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200';
    case '진행중':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
    case '완료':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-zinc-300';
  }
};

const priorityTone = (priority) => {
  const normalized = (priority || '').toLowerCase();
  if (normalized.includes('높')) {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200';
  }
  if (normalized.includes('중')) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
  }
  if (normalized.includes('낮')) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
  }
  return 'bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-zinc-300';
};

function RequestBoardSection({
  requests = [],
  allProjectItems = [],
  isReadOnly = false,
  onAddRequest,
  onDeleteRequest,
  onOpenRequest,
}) {
  const statusCounts = DEV_REQUEST_STATUSES.reduce((acc, status) => {
    acc[status] = requests.filter((request) => (request.status || '접수됨') === status).length;
    return acc;
  }, {});

  return (
    <section className="rounded-[28px] border border-amber-200/70 bg-gradient-to-b from-amber-50/50 to-white/80 px-4 py-4 shadow-sm dark:border-amber-900/30 dark:from-amber-950/10 dark:to-[#121212]">
      <div className="flex items-start justify-between gap-4 px-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-amber-600 dark:text-amber-300 shrink-0" />
            <h3 className="text-base font-black tracking-tight text-gray-900 dark:text-text-primary">
              {DEV_REQUEST_BOARD.label}
            </h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
              {requests.length}건
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-text-tertiary">
            다른 팀 요청을 모아 검토하고 진행하는 전용 구획입니다.
          </p>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-950/35"
            onClick={onAddRequest}
          >
            <Plus size={16} />
            <span>요청 문서</span>
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-2 px-2 sm:grid-cols-2 xl:grid-cols-4">
        {DEV_REQUEST_STATUSES.map((status) => (
          <div
            key={status}
            className="rounded-2xl border border-amber-200/60 bg-white/70 px-4 py-3 dark:border-amber-900/30 dark:bg-[#17110a]"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700/90 dark:text-amber-300/90">
              {status}
            </p>
            <p className="mt-1 text-lg font-black text-gray-900 dark:text-text-primary">
              {statusCounts[status]}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-200/80 bg-white/70 px-4 py-8 text-center dark:border-amber-900/30 dark:bg-[#15110c]">
            <p className="text-sm font-semibold text-amber-900/80 dark:text-amber-100/80">
              {DEV_REQUEST_BOARD.emptyMessage}
            </p>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/70">
              템플릿을 보고 요청 배경, 영향 범위, 검수 기준을 먼저 채워주세요.
            </p>
          </div>
        ) : (
          requests.map((request) => {
            const requestTeam = request.request_team || '요청한 팀 미지정';
            const status = request.status || '접수됨';
            const priority = request.priority || '중간';
            const isNotified = Boolean(request.notified_at);
            const isSubmitted = Boolean(request.submitted_at);
            const linkedItems = allProjectItems.filter(
              item => Array.isArray(item.related_items) && item.related_items.includes(request.id)
            );
            const visibleLinked = linkedItems.slice(0, 3);
            const overflowCount = linkedItems.length - visibleLinked.length;

            return (
              <article
                key={request.id}
                className="group rounded-3xl border border-amber-200/70 bg-white/85 px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-amber-900/35 dark:bg-[#17110a] dark:hover:border-amber-700/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className={`min-w-0 text-left ${onOpenRequest ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => onOpenRequest?.(request.id)}
                  >
                    <h4 className="truncate text-[15px] font-black tracking-[-0.02em] text-gray-900 dark:text-text-primary">
                      {request.title}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500 dark:text-text-tertiary">
                      {request.description || '요청 내용이 아직 입력되지 않았습니다.'}
                    </p>
                  </button>

                  {!isReadOnly && (
                    <button
                      type="button"
                      className="rounded-xl border border-transparent p-2 text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/40 dark:hover:bg-red-950/20 dark:hover:text-red-300"
                      onClick={() => onDeleteRequest?.(request.id)}
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(status)}`}>
                    {status}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    isNotified
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                      : isSubmitted
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                        : 'bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-zinc-300'
                  }`}
                  >
                    {isNotified ? <CheckCircle2 size={12} /> : <PencilLine size={12} />}
                    {isNotified ? '전송됨' : isSubmitted ? '알림 미전송' : '작성중'}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityTone(priority)}`}>
                    {priority}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-white/8 dark:text-zinc-300">
                    <Gauge size={12} />
                    {requestTeam}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-white/8 dark:text-zinc-300">
                    <Clock3 size={12} />
                    {formatDate(request.updated_at || request.created_at)}
                  </span>
                </div>

                {linkedItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {visibleLinked.map(linked => (
                      <span
                        key={linked.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-brand-800/20 dark:text-brand-300 border border-brand-100 dark:border-brand-700/40"
                      >
                        <ArrowUpRight size={10} strokeWidth={3} />
                        {linked.title || linked.content}
                      </span>
                    ))}
                    {overflowCount > 0 && (
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 dark:bg-white/8 dark:text-zinc-400">
                        +{overflowCount} 더보기
                      </span>
                    )}
                  </div>
                )}

              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default RequestBoardSection;
