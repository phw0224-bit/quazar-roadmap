import { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronRight, AlertCircle, Users, ChevronDown, ChevronUp, X } from 'lucide-react';
import { STATUS_MAP } from '../lib/constants';
import API from '../api/kanbanAPI';
import ProfileAvatar from './ProfileAvatar';
import { DEFAULT_PROFILE_CUSTOMIZATION, REACTION_META, REACTION_TYPES } from '../lib/profileAppearance';

const CATEGORY_LABEL = '분류';

export default function PeopleBoard({
  teams,
  loading,
  error,
  onOpenItem,
  projectAssignees = {},
  currentUserId = null,
  onShowToast,
}) {
  const [expandedMembers, setExpandedMembers] = useState({});
  const [profileDirectoryById, setProfileDirectoryById] = useState({});
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [reactingType, setReactingType] = useState('');

  const toggleMember = (memberId) => {
    setExpandedMembers((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  useEffect(() => {
    let mounted = true;
    const loadDirectory = async () => {
      try {
        const directory = await API.getProfileDirectory();
        if (!mounted) return;
        setProfileDirectoryById(Object.fromEntries((directory || []).map((profile) => [profile.id, profile])));
      } catch (fetchError) {
        onShowToast?.(`프로필 목록 로드 실패: ${fetchError.message}`, 'error');
      }
    };
    loadDirectory();
    return () => {
      mounted = false;
    };
  }, [onShowToast]);

  const memberById = useMemo(() => {
    const result = {};
    (teams || []).forEach((team) => {
      (team.members || []).forEach((member) => {
        result[member.id] = member;
      });
    });
    return result;
  }, [teams]);

  const selectedMember = selectedMemberId ? memberById[selectedMemberId] || null : null;
  const selectedProfile = selectedMemberId ? profileDirectoryById[selectedMemberId] || null : null;

  const openProfileModal = async (memberId) => {
    setSelectedMemberId(memberId);
    setLoadingSummary(true);
    try {
      const summary = await API.getProfileReactionSummary(memberId, 24);
      setSelectedSummary(summary);
    } catch (fetchError) {
      onShowToast?.(`반응 불러오기 실패: ${fetchError.message}`, 'error');
      setSelectedSummary({
        counts: Object.fromEntries(REACTION_TYPES.map((type) => [type, 0])),
        myReactions: {},
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const closeProfileModal = () => {
    setSelectedMemberId(null);
    setSelectedSummary(null);
    setLoadingSummary(false);
    setReactingType('');
  };

  const handleReaction = async (reactionType) => {
    if (!selectedMemberId || selectedMemberId === currentUserId) return;
    try {
      setReactingType(reactionType);
      const summary = await API.toggleProfileReaction(selectedMemberId, reactionType);
      setSelectedSummary(summary);
    } catch (updateError) {
      onShowToast?.(`반응 전송 실패: ${updateError.message}`, 'error');
    } finally {
      setReactingType('');
    }
  };

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
              <h2 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight leading-tight">{team.teamName}</h2>
              <span className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-[0.2em] mt-1 tabular-nums">
                {team.members.length} Active Members
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {team.members.map((member) => {
              const customization = profileDirectoryById[member.id]?.customization || DEFAULT_PROFILE_CUSTOMIZATION;
              const statusMessage = customization.statusMessage || '상태 메시지가 없습니다.';

              return (
                <article
                  key={member.id}
                  className="group rounded-[32px] border border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-elevated p-6 flex flex-col gap-6 shadow-sm hover:shadow-2xl hover:border-blue-200 dark:hover:border-blue-900/30 transition-all duration-300 ease-notion"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => openProfileModal(member.id)}
                      className="flex items-center gap-4 min-w-0 cursor-pointer"
                      title="프로필 보기"
                    >
                      <ProfileAvatar
                        name={member.name}
                        customization={customization}
                        size="lg"
                      />
                      <div className="min-w-0 text-left">
                        <h3 className="text-xl font-black text-gray-900 dark:text-text-primary leading-tight truncate">{member.name}</h3>
                        <p className="text-[13px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-widest mt-1">{member.department}</p>
                        <p className="text-[11px] font-medium text-gray-500 dark:text-text-tertiary truncate mt-1 max-w-[210px]">{statusMessage}</p>
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-widest bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md">
                        {member.tasks.length} Tasks
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const PREVIEW_LIMIT = 3;
                    const projectCounts = member.tasks.reduce((acc, t) => {
                      const key = (t.projectTitle || '미지정').trim();
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {});
                    const projectLevelProjects = Object.keys(projectAssignees).filter(
                      (proj) => (projectAssignees[proj] || []).includes(member.name)
                    );
                    const allProjectKeys = [...new Set([...Object.keys(projectCounts), ...projectLevelProjects])];
                    const previewItems = member.tasks.slice(0, PREVIEW_LIMIT);
                    const remainCount = member.tasks.length - PREVIEW_LIMIT;
                    const isExpanded = !!expandedMembers[member.id];

                    return (
                      <div className="flex flex-col gap-4">
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
                                  <span className="text-[13px] font-black text-gray-700 dark:text-text-secondary truncate">{categoryName}</span>
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
                                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm ${STATUS_MAP[task.status || 'none'].color}`}>
                                        {STATUS_MAP[task.status || 'none'].label}
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="text-sm font-bold text-gray-900 dark:text-text-primary leading-tight line-clamp-2">{task.title}</p>
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
              );
            })}
          </div>
        </section>
      ))}

      {selectedMember && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeProfileModal} />
          <div className="relative w-full max-w-md rounded-[28px] border border-gray-100 dark:border-border-subtle bg-white dark:bg-bg-elevated p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <button
              type="button"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 dark:text-text-tertiary dark:hover:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover transition-colors cursor-pointer"
              onClick={closeProfileModal}
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <ProfileAvatar
                name={selectedMember.name}
                customization={selectedProfile?.customization || DEFAULT_PROFILE_CUSTOMIZATION}
                size="lg"
              />
              <div className="min-w-0">
                <h3 className="text-xl font-black text-gray-900 dark:text-text-primary truncate">{selectedMember.name}</h3>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary">{selectedMember.department}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-text-secondary bg-gray-50 dark:bg-bg-base border border-gray-100 dark:border-border-subtle rounded-xl px-3 py-2">
              {selectedProfile?.customization?.statusMessage || '상태 메시지가 없습니다.'}
            </p>

            <div className="mt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-text-tertiary mb-2">24시간 반응</p>
              <div className="grid grid-cols-4 gap-2">
                {REACTION_TYPES.map((type) => {
                  const meta = REACTION_META[type];
                  const count = selectedSummary?.counts?.[type] || 0;
                  const mine = Boolean(selectedSummary?.myReactions?.[type]);
                  const disabled = selectedMember.id === currentUserId;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleReaction(type)}
                      disabled={disabled || loadingSummary || reactingType === type}
                      className={`rounded-xl border px-2 py-2 flex flex-col items-center gap-1 transition-colors ${
                        mine
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/25'
                          : 'border-gray-200 dark:border-border-subtle'
                      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-hover'}`}
                      title={meta.label}
                    >
                      <span className="text-base leading-none">{meta.emoji}</span>
                      <span className="text-xs font-bold text-gray-600 dark:text-text-secondary">{count}</span>
                    </button>
                  );
                })}
              </div>
              {selectedMember.id === currentUserId && (
                <p className="text-[11px] text-gray-400 dark:text-text-tertiary mt-2">내 프로필에는 반응할 수 없어요.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
