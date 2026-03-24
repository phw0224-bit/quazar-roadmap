const STATUS_STYLE = {
  done: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'in-progress': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  none: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

const STATUS_LABEL = {
  done: '완료',
  'in-progress': '진행 중',
  none: '미지정',
};

const formatStatus = (status) => STATUS_LABEL[status] || '미지정';
const getStatusClass = (status) => STATUS_STYLE[status] || STATUS_STYLE.none;
const CATEGORY_LABEL = '분류';

export default function PeopleBoard({ teams, loading, error, onOpenItem }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">
        Loading People...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-6 py-5 text-sm font-bold text-red-700 dark:text-red-300">
          인원관리 데이터를 불러오지 못했습니다: {error}
        </div>
      </div>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 font-bold">
        표시할 직원 정보가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto p-10 custom-scrollbar bg-white dark:bg-[#191919] flex flex-col gap-10">
      {teams.map((team) => (
        <section key={team.teamName} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-gray-900 dark:text-[#E3E3E3] tracking-tight">
              {team.teamName}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-[#343434]">
              {team.members.length} Members
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
            {team.members.map((member) => (
              <article
                key={member.id}
                className="rounded-2xl border border-gray-200 dark:border-[#2f2f2f] bg-white dark:bg-[#222222] p-5 flex flex-col gap-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[18px] font-black text-gray-900 dark:text-gray-100 leading-tight">
                      {member.name}
                    </h3>
                    <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mt-1">
                      {member.department}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-gray-100 dark:bg-[#2e2e2e] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#3b3b3b]">
                    {member.tasks.length}개 업무
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                  {member.tasks.length > 0 ? (() => {
                    const groupedByCategory = member.tasks.reduce((acc, task) => {
                      const categoryKey = (task.phaseTitle || '미지정 분류').trim() || '미지정 분류';
                      if (!acc[categoryKey]) acc[categoryKey] = [];
                      acc[categoryKey].push(task);
                      return acc;
                    }, {});

                    return Object.entries(groupedByCategory)
                      .sort(([a], [b]) => a.localeCompare(b, 'ko-KR'))
                      .map(([categoryName, tasks]) => (
                        <div
                          key={`${member.id}-${categoryName}`}
                          className="rounded-xl border border-gray-200 dark:border-[#363636] bg-gray-50/80 dark:bg-[#262626] p-2.5 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2 px-1">
                            <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              {CATEGORY_LABEL}
                            </span>
                            <span className="text-[12px] font-black text-gray-800 dark:text-gray-200 truncate">
                              {categoryName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-white dark:bg-[#2f2f2f] border border-gray-200 dark:border-[#3b3b3b] text-gray-500 dark:text-gray-300">
                              {tasks.length}개
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            {tasks.map((task) => (
                              <button
                                key={`${member.id}-${categoryName}-${task.id}`}
                                onClick={() => onOpenItem(task.id)}
                                className="w-full text-left rounded-lg border border-gray-200 dark:border-[#3b3b3b] bg-white dark:bg-[#2d2d2d] px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#333333] transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-end mb-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${getStatusClass(task.status)}`}
                                  >
                                    {formatStatus(task.status)}
                                  </span>
                                </div>
                                <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                                  {task.title}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      ));
                  })() : (
                    <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#363636] bg-gray-50/70 dark:bg-[#262626] px-3 py-4 text-center text-[13px] font-medium text-gray-400 dark:text-gray-500">
                      현재 배정된 업무가 없습니다.
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
