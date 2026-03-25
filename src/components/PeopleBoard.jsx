import { useState } from 'react';
import { User, Briefcase, ChevronRight, AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_MAP } from '../lib/constants';

const CATEGORY_LABEL = '분류';

export default function PeopleBoard({ teams, loading, error, onOpenItem, projectAssignees = {} }) {
  const [expandedMembers, setExpandedMembers] = useState({});
  const toggleMember = (memberId) =>
    setExpandedMembers(prev => ({ ...prev, [memberId]: !prev[memberId] }));
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-bg-base transition-colors duration-200">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-gray-100 dark:border-border-subtle border-t-gray-900 dark:border-t-white rounded-full animate-spin"></div>
          <span className="text-label text-gray-400 dark:text-text-secondary tracking-[0.2em]">인원 데이터 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-10 bg-white dark:bg-bg-base">
        <div className="max-w-md w-full rounded-3xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 p-8 text-center animate-scale-in">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-black text-red-900 dark:text-red-400 mb-2">데이터 로드 실패</h3>
          <p className="text-sm font-bold text-red-700 dark:text-red-300 opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-bg-base transition-colors duration-200">
        <div className="flex flex-col items-center text-center animate-fade-in">
          <div className="w-20 h-20 bg-gray-50 dark:bg-bg-hover rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-inner ring-1 ring-gray-100 dark:ring-border-subtle">👥</div>
          <p className="text-xl font-black text-gray-400 dark:text-text-tertiary tracking-tight uppercase tracking-widest">표시할 직원 정보가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto p-10 custom-scrollbar bg-white dark:bg-bg-base flex flex-col gap-16 transition-colors duration-200">
      {teams.map((team) => (
        <section key={team.teamName} className="flex flex-col gap-8 animate-fade-in">
          <div className="flex items-center gap-4 px-2">
            <div className="w-12 h-12 bg-gray-900 dark:bg-brand-accent rounded-2xl flex items-center justify-center text-white shadow-lg border-2 border-white dark:border-border-strong">
              <Users size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight leading-tight">
                {team.teamName}
              </h2>
              <span className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.2em] mt-1 tabular-nums">
                {team.members.length} Active Members
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {team.members.map((member) => (
              <article
                key={member.id}
                className="group rounded-[32px] border border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-elevated p-6 flex flex-col gap-6 shadow-sm hover:shadow-2xl hover:border-blue-200 dark:hover:border-blue-900/30 transition-all duration-300 ease-notion"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-bg-base flex items-center justify-center text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-500 transition-colors duration-300 border border-gray-100 dark:border-border-subtle shadow-inner">
                      <User size={28} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-black text-gray-900 dark:text-text-primary leading-tight truncate">
                        {member.name}
                      </h3>
                      <p className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-widest mt-1">
                        {member.department}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-widest bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md">
                      {member.tasks.length} Tasks
                    </span>
                  </div>
                </div>

                {/* 요약 섹션 */}
                {(() => {
                  const PREVIEW_LIMIT = 3;
                  const projectCounts = member.tasks.reduce((acc, t) => {
                    const key = (t.projectTitle || '미지정').trim();
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {});
                  // 프로젝트 레벨 담당자인 프로젝트도 포함 (아이템 배정 없어도)
                  const projectLevelProjects = Object.keys(projectAssignees).filter(
                    proj => (projectAssignees[proj] || []).includes(member.name)
                  );
                  const allProjectKeys = [...new Set([...Object.keys(projectCounts), ...projectLevelProjects])];
                  const previewItems = member.tasks.slice(0, PREVIEW_LIMIT);
                  const remainCount = member.tasks.length - PREVIEW_LIMIT;
                  const isExpanded = !!expandedMembers[member.id];

                  return (
                    <div className="flex flex-col gap-4">
                      {/* 담당 프로젝트 */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-gray-300 dark:text-text-tertiary uppercase tracking-[0.2em]">담당 프로젝트</span>
                        {allProjectKeys.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {allProjectKeys.map((proj) => {
                              const count = projectCounts[proj] || 0;
                              const isAll = (projectAssignees[proj] || []).includes(member.name);
                              return (
                                <span
                                  key={proj}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/40"
                                >
                                  <Briefcase size={10} />
                                  {proj}
                                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${isAll ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-200'}`}>
                                    {isAll ? 'ALL' : count}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[12px] font-black text-gray-300 dark:text-text-tertiary">없음</span>
                        )}
                      </div>

                      {/* 담당 아이템 */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-gray-300 dark:text-text-tertiary uppercase tracking-[0.2em]">담당 아이템</span>
                        {member.tasks.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {previewItems.map((task) => (
                              <div key={task.id} className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.status === 'done' ? 'bg-emerald-500' : task.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                                <span className="text-[12px] font-bold text-gray-700 dark:text-text-secondary truncate flex-1">{task.title}</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border shrink-0 ${STATUS_MAP[task.status || 'none'].color}`}>
                                  {STATUS_MAP[task.status || 'none'].label}
                                </span>
                              </div>
                            ))}
                            {remainCount > 0 && (
                              <button
                                onClick={() => toggleMember(member.id)}
                                className="text-left text-[11px] font-black text-gray-400 dark:text-text-tertiary hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-150 pl-3.5"
                              >
                                + {remainCount}개 더
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] font-black text-gray-300 dark:text-text-tertiary">배정된 업무 없음</span>
                        )}
                      </div>

                      {/* 상세 보기 토글 */}
                      {member.tasks.length > 0 && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => toggleMember(member.id)}
                            className="flex items-center gap-1 text-[11px] font-black text-gray-400 dark:text-text-tertiary hover:text-gray-700 dark:hover:text-text-secondary transition-colors duration-150"
                          >
                            {isExpanded ? (
                              <><ChevronUp size={12} /> 접기</>
                            ) : (
                              <><ChevronDown size={12} /> 상세 보기</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 상세 목록 (접힘/펼침) */}
                {expandedMembers[member.id] && (
                <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                  {member.tasks.length > 0 ? (() => {
                    const groupedByCategory = member.tasks.reduce((acc, task) => {
                      const categoryKey = (task.projectTitle || '미지정 분류').trim() || '미지정 분류';
                      if (!acc[categoryKey]) acc[categoryKey] = [];
                      acc[categoryKey].push(task);
                      return acc;
                    }, {});

                    return Object.entries(groupedByCategory)
                      .sort(([a], [b]) => a.localeCompare(b, 'ko-KR'))
                      .map(([categoryName, tasks]) => (
                        <div
                          key={`${member.id}-${categoryName}`}
                          className="rounded-2xl border border-gray-50 dark:border-border-subtle bg-gray-50/50 dark:bg-bg-hover/30 p-4 flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between gap-2 px-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <Briefcase size={14} className="text-gray-300 dark:text-text-tertiary shrink-0" />
                              <span className="text-[13px] font-black text-gray-700 dark:text-text-secondary truncate">
                                {categoryName}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-lg text-[11px] font-black bg-white dark:bg-bg-base border border-gray-100 dark:border-border-subtle text-gray-400 dark:text-text-tertiary tabular-nums shadow-sm uppercase">
                              {tasks.length} Items
                            </span>
                          </div>

                          <div className="flex flex-col gap-2">
                            {tasks.map((task) => (
                              <button
                                key={`${member.id}-${categoryName}-${task.id}`}
                                onClick={() => onOpenItem(task.id)}
                                className="w-full text-left rounded-xl border border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-elevated px-4 py-3 hover:bg-white dark:hover:bg-bg-hover hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500/50 hover:scale-[1.02] transition-all duration-200 cursor-pointer group/task"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`w-2 h-2 rounded-full ${task.status === 'done' ? 'bg-emerald-500' : task.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm ${STATUS_MAP[task.status || 'none'].color}`}
                                  >
                                    {STATUS_MAP[task.status || 'none'].label}
                                  </span>
                                </div>
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-bold text-gray-900 dark:text-text-primary leading-tight line-clamp-2">
                                    {task.title}
                                  </p>
                                  <ChevronRight size={14} className="text-gray-300 dark:text-text-tertiary opacity-0 group-hover/task:opacity-100 transform translate-x-2 group-hover/task:translate-x-0 transition-all duration-200 shrink-0 mt-0.5" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ));
                  })() : (
                    <div className="rounded-2xl border-2 border-dashed border-gray-100 dark:border-border-strong bg-gray-50/30 dark:bg-bg-base px-4 py-10 text-center flex flex-col items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-bg-elevated rounded-xl flex items-center justify-center text-xl shadow-sm border border-gray-100 dark:border-border-subtle">☕</div>
                      <p className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-widest">현재 배정된 업무가 없습니다.</p>
                    </div>
                  )}
                </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
