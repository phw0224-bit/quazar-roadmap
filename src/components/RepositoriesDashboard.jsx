import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FolderGit2,
  GitCommitHorizontal,
  GitPullRequest,
  Github,
  Link2,
  RefreshCw,
  CircleDot,
} from 'lucide-react';
import {
  getGitHubRepositoryDashboardEntities,
  getGitHubRepositoryDashboardList,
  getGitHubRepositoryDashboardOverview,
  linkGitHubRepositoryEntityToItem,
  saveGitHubRepositorySettings,
} from '../api/githubAPI';
import { timeAgo } from '../lib/timeUtils';

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'pulls', label: 'PR' },
  { id: 'issues', label: '이슈' },
  { id: 'commits', label: '커밋' },
];

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LinkBadge({ linkedItem }) {
  if (!linkedItem) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:border-border-strong dark:text-text-tertiary">
        <Link2 size={11} />
        연결 없음
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
      <Link2 size={11} />
      {linkedItem.ticketKey || linkedItem.title}
    </span>
  );
}

function SummaryCard({ label, value, sublabel }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-border-subtle dark:bg-bg-elevated">
      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400 dark:text-text-tertiary">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-text-primary">{value}</div>
      {sublabel ? (
        <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-text-secondary">{sublabel}</div>
      ) : null}
    </div>
  );
}

function RepoListItem({ repo, selected, onClick }) {
  const pullCountLabel = Number.isFinite(repo.openPullRequests) ? repo.openPullRequests : '-';
  const commitLabel = repo.latestCommit?.committedAt ? timeAgo(repo.latestCommit.committedAt) : (repo.pushedAt ? timeAgo(repo.pushedAt) : '활동 없음');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer ${
        selected
          ? 'border-brand-300 bg-brand-50/70 dark:border-brand-600 dark:bg-brand-500/10'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-border-subtle dark:bg-bg-elevated dark:hover:border-border-strong'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-gray-900 dark:text-text-primary">{repo.name}</div>
          <div className="truncate text-xs font-semibold text-gray-500 dark:text-text-secondary">{repo.owner}</div>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:bg-bg-base dark:text-text-tertiary">
          {repo.private ? 'private' : 'public'}
        </span>
      </div>
      <div className="mt-2 line-clamp-2 min-h-9 text-xs font-medium text-gray-500 dark:text-text-secondary">
        {repo.description || '설명 없음'}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-gray-400 dark:text-text-tertiary">
        <span>PR {pullCountLabel}</span>
        <span>•</span>
        <span>이슈 {repo.openIssues}</span>
        <span>•</span>
        <span>{commitLabel}</span>
      </div>
    </button>
  );
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white/70 px-6 py-12 text-center dark:border-border-subtle dark:bg-bg-elevated/40">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-bg-base dark:text-text-secondary">
          <FolderGit2 size={24} />
        </div>
        <h3 className="mt-4 text-lg font-black tracking-tight text-gray-900 dark:text-text-primary">{title}</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-gray-500 dark:text-text-secondary">{description}</p>
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white dark:bg-white dark:text-gray-900 cursor-pointer"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OverviewTab({ detail }) {
  const referenceTime = detail.summary?.lastSyncedAt
    ? new Date(detail.summary.lastSyncedAt).getTime()
    : 0;
  const stalePulls = detail.overviewPulls.filter((pr) => pr.state === 'open' && pr.updatedAt && (referenceTime - new Date(pr.updatedAt).getTime()) > 7 * 24 * 60 * 60 * 1000);
  const staleIssues = detail.overviewIssues.filter((issue) => issue.state === 'open' && issue.updatedAt && (referenceTime - new Date(issue.updatedAt).getTime()) > 7 * 24 * 60 * 60 * 1000);
  const unlinkedPulls = detail.overviewPulls.filter((pr) => !pr.linkedItem && pr.state === 'open');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-border-subtle dark:bg-bg-elevated">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 dark:text-text-secondary">주의 필요</h3>
          </div>
          <div className="mt-4 space-y-3">
            {stalePulls.length === 0 && staleIssues.length === 0 && unlinkedPulls.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-500 dark:bg-bg-base dark:text-text-secondary">
                현재 바로 정리할 경고 항목은 없습니다.
              </div>
            ) : (
              <>
                {stalePulls.length > 0 ? (
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    7일 이상 업데이트되지 않은 열린 PR이 {stalePulls.length}개 있습니다.
                  </div>
                ) : null}
                {staleIssues.length > 0 ? (
                  <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                    7일 이상 업데이트되지 않은 열린 이슈가 {staleIssues.length}개 있습니다.
                  </div>
                ) : null}
                {unlinkedPulls.length > 0 ? (
                  <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    로드맵과 연결되지 않은 열린 PR이 {unlinkedPulls.length}개 있습니다.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-border-subtle dark:bg-bg-elevated">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-brand-500" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 dark:text-text-secondary">로드맵 연결</h3>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.linkedItems.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-500 dark:bg-bg-base dark:text-text-secondary">
                연결된 로드맵 아이템이 없습니다.
              </div>
            ) : (
              detail.linkedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 px-3 py-2 dark:border-border-subtle"
                >
                  <div className="text-sm font-bold text-gray-900 dark:text-text-primary">{item.title}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-text-tertiary">
                    {item.ticketKey || item.boardType}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-border-subtle dark:bg-bg-elevated">
        <div className="flex items-center gap-2">
          <GitCommitHorizontal size={16} className="text-gray-500" />
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 dark:text-text-secondary">최근 활동</h3>
        </div>
        <div className="mt-4 space-y-2">
          {detail.activity.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-500 dark:bg-bg-base dark:text-text-secondary">
              최근 활동이 없습니다.
            </div>
          ) : (
            detail.activity.map((entry, index) => (
              <a
                key={`${entry.type}-${entry.number || entry.sha || index}`}
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 hover:bg-gray-50 dark:hover:bg-bg-base"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900 dark:text-text-primary">{entry.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-text-secondary">
                    <span>{entry.type === 'commit' ? `커밋 ${entry.sha}` : `${entry.type === 'pull_request' ? 'PR' : '이슈'} ${entry.number}`}</span>
                    <span>•</span>
                    <span>{entry.actor}</span>
                    <span>•</span>
                    <span>{timeAgo(entry.at)}</span>
                  </div>
                </div>
                <ExternalLink size={14} className="shrink-0 text-gray-400 dark:text-text-tertiary" />
              </a>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function RoadmapLinkPicker({ entity, allItems, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const results = allItems
    .filter((item) => {
      if (!item?.id) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        item.title,
        item.content,
        item.ticket_key,
        item.board_type,
        ...(Array.isArray(item.tags) ? item.tags : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .slice(0, 20);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 px-4 pt-[14vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-border-strong dark:bg-bg-elevated"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-5 py-4 dark:border-border-subtle">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">로드맵 연결</div>
          <div className="mt-1 text-lg font-black text-gray-900 dark:text-text-primary">
            #{entity.number} {entity.title}
          </div>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="아이템 제목, 티켓키, 태그로 검색..."
            className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-brand-300 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary"
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto p-3">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-gray-400 dark:text-text-tertiary">
              검색 결과가 없습니다.
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-bg-base cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900 dark:text-text-primary">
                    {item.title || item.content || '제목 없음'}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-text-secondary">
                    <span>{item.ticket_key || item.board_type || 'main'}</span>
                    {item.status ? (
                      <>
                        <span>•</span>
                        <span>{item.status}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:bg-bg-base dark:text-text-tertiary">
                  연결
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-gray-100 px-5 py-3 text-right dark:border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-600 dark:border-border-strong dark:text-text-secondary cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function EntityTable({ items, type, onLinkEntity, onOpenRoadmapItem }) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm font-semibold text-gray-500 dark:border-border-subtle dark:bg-bg-elevated dark:text-text-secondary">
        표시할 {type === 'commit' ? '커밋' : type === 'pull' ? 'PR' : '이슈'}가 없습니다.
      </div>
    );
  }

  if (type === 'commit') {
    return (
      <div className="space-y-2">
        {items.map((commit) => (
          <a
            key={commit.sha}
            href={commit.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 dark:border-border-subtle dark:bg-bg-elevated dark:hover:border-border-strong"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-gray-900 dark:text-text-primary">{commit.message}</div>
              <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-text-secondary">
                <span>{commit.shortSha}</span>
                <span>•</span>
                <span>{commit.authorName}</span>
                <span>•</span>
                <span>{timeAgo(commit.committedAt)}</span>
              </div>
            </div>
            <ExternalLink size={14} className="shrink-0 text-gray-400 dark:text-text-tertiary" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((entity) => (
        <div
          key={entity.number}
          className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-border-subtle dark:bg-bg-elevated"
        >
          <div className="min-w-0 flex-1">
            <a
              href={entity.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:underline"
            >
              {type === 'pull' ? (
                <GitPullRequest size={15} className="shrink-0 text-gray-400 dark:text-text-tertiary" />
              ) : (
                <CircleDot size={15} className="shrink-0 text-gray-400 dark:text-text-tertiary" />
              )}
              <div className="truncate text-sm font-bold text-gray-900 dark:text-text-primary">
                {entity.title}
              </div>
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 dark:text-text-secondary">
              <span>#{entity.number}</span>
              <span>•</span>
              <span>{entity.author}</span>
              <span>•</span>
              <span>{timeAgo(entity.updatedAt || entity.createdAt)}</span>
              {type === 'pull' && entity.headRef ? (
                <>
                  <span>•</span>
                  <span>{entity.headRef}</span>
                </>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:bg-bg-base dark:text-text-tertiary">
                {entity.state}
              </span>
              {entity.linkedItem ? (
                <button
                  type="button"
                  onClick={() => onOpenRoadmapItem?.(entity.linkedItem.id)}
                  className="cursor-pointer"
                >
                  <LinkBadge linkedItem={entity.linkedItem} />
                </button>
              ) : (
                <LinkBadge linkedItem={entity.linkedItem} />
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onLinkEntity?.(entity, type === 'pull' ? 'pulls' : 'issues')}
              className="rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:border-brand-300 hover:text-brand-600 dark:border-border-strong dark:text-text-secondary cursor-pointer"
            >
              {entity.linkedItem ? '연결 변경' : '로드맵 연결'}
            </button>
            <a href={entity.url} target="_blank" rel="noreferrer" className="rounded-xl p-2 text-gray-400 hover:text-gray-600 dark:text-text-tertiary dark:hover:text-text-secondary">
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RepositoriesDashboard({
  selectedRepoFullName,
  onSelectRepo,
  gitHubStatus,
  onManageGitHubSettings,
  allItems = [],
  onOpenRoadmapItem,
  onShowToast,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [repositories, setRepositories] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);
  const [tabData, setTabData] = useState({ pulls: null, issues: null, commits: null });
  const [tabError, setTabError] = useState('');
  const [linkTarget, setLinkTarget] = useState(null);
  const [linking, setLinking] = useState(false);
  const [ticketPrefixDraft, setTicketPrefixDraft] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadRepositories = async () => {
      setListLoading(true);
      setListError('');
      try {
        const nextRepositories = await getGitHubRepositoryDashboardList();
        if (!active) return;
        setRepositories(nextRepositories);
      } catch (error) {
        if (!active) return;
        setListError(error.message || '레포지토리 목록을 불러오지 못했습니다.');
      } finally {
        if (active) setListLoading(false);
      }
    };

    if (gitHubStatus?.connected) {
      loadRepositories();
    }

    return () => {
      active = false;
    };
  }, [gitHubStatus?.connected]);

  useEffect(() => {
    if (repositories.length === 0) return;

    const hasSelectedRepo = selectedRepoFullName
      ? repositories.some((repo) => repo.fullName === selectedRepoFullName)
      : false;

    if (!hasSelectedRepo) {
      onSelectRepo?.(repositories[0].fullName);
    }
  }, [repositories, selectedRepoFullName, onSelectRepo]);

  useEffect(() => {
    if (!selectedRepoFullName) {
      setDetail(null);
      return;
    }

    let active = true;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError('');
      try {
        const nextDetail = await getGitHubRepositoryDashboardOverview(selectedRepoFullName);
        if (!active) return;
        setDetail(nextDetail);
        setTicketPrefixDraft(nextDetail?.repositorySettings?.ticket_prefix || '');
        setTabData({ pulls: null, issues: null, commits: null });
        setTabError('');
        setActiveTab('overview');
      } catch (error) {
        if (!active) return;
        setDetail(null);
        setDetailError(error.message || '레포지토리 상세 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setDetailLoading(false);
      }
    };

    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedRepoFullName]);

  useEffect(() => {
    if (!selectedRepoFullName || activeTab === 'overview') return;
    if (tabData[activeTab]) return;

    let active = true;
    const loadTab = async () => {
      setTabLoading(true);
      setTabError('');
      try {
        const response = await getGitHubRepositoryDashboardEntities(selectedRepoFullName, activeTab);
        if (!active) return;
        setTabData((current) => ({
          ...current,
          [activeTab]: response?.items || [],
        }));
      } catch (error) {
        if (!active) return;
        setTabError(error.message || '탭 데이터를 불러오지 못했습니다.');
      } finally {
        if (active) setTabLoading(false);
      }
    };

    loadTab();
    return () => {
      active = false;
    };
  }, [selectedRepoFullName, activeTab, tabData]);

  const selectedRepository = useMemo(
    () => repositories.find((repo) => repo.fullName === selectedRepoFullName) || null,
    [repositories, selectedRepoFullName]
  );

  const handleRefresh = async () => {
    if (!gitHubStatus?.connected) return;
    setDetail(null);
    setRepositories([]);
    setActiveTab('overview');
    setListError('');
    setDetailError('');
    setTabError('');
    setTabData({ pulls: null, issues: null, commits: null });
    try {
      setListLoading(true);
      const nextRepositories = await getGitHubRepositoryDashboardList();
      setRepositories(nextRepositories);
      const nextRepoFullName = selectedRepoFullName && nextRepositories.some((repo) => repo.fullName === selectedRepoFullName)
        ? selectedRepoFullName
        : nextRepositories[0]?.fullName || null;
      if (nextRepoFullName) {
        onSelectRepo?.(nextRepoFullName);
      }
    } catch (error) {
      setListError(error.message || '레포지토리 목록을 불러오지 못했습니다.');
    } finally {
      setListLoading(false);
    }
  };

  const handleSelectLinkItem = async (item) => {
    if (!linkTarget || linking) return;
    setLinking(true);
    try {
      const response = await linkGitHubRepositoryEntityToItem({
        repoFullName: selectedRepoFullName,
        type: linkTarget.type,
        number: linkTarget.entity.number,
        itemId: item.id,
      });
      const linkedItem = response?.linkedItem || {
        id: item.id,
        title: item.title || item.content || '제목 없음',
        boardType: item.board_type || 'main',
        status: item.status || 'none',
        ticketKey: item.ticket_key || null,
      };
      setTabData((current) => ({
        ...current,
        [linkTarget.type]: (current[linkTarget.type] || []).map((entity) => (
          entity.number === linkTarget.entity.number ? { ...entity, linkedItem } : entity
        )),
      }));
      setDetail((current) => {
        if (!current) return current;
        const overviewKey = linkTarget.type === 'pulls' ? 'overviewPulls' : 'overviewIssues';
        const nextOverview = (current[overviewKey] || []).map((entity) => (
          entity.number === linkTarget.entity.number ? { ...entity, linkedItem } : entity
        ));
        const linkedItems = [
          ...new Map([...(current.linkedItems || []), linkedItem].map((linked) => [linked.id, linked])).values(),
        ];
        return {
          ...current,
          [overviewKey]: nextOverview,
          linkedItems,
          summary: {
            ...current.summary,
            linkedItems: linkedItems.length,
          },
        };
      });
      setLinkTarget(null);
      onShowToast?.('로드맵 아이템과 연결되었습니다.', 'success');
    } catch (error) {
      onShowToast?.(error.message || '로드맵 연결에 실패했습니다.', 'error');
    } finally {
      setLinking(false);
    }
  };

  const handleSaveTicketPrefix = async () => {
    if (!selectedRepoFullName || settingsSaving) return;
    const normalizedPrefix = ticketPrefixDraft.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(normalizedPrefix)) {
      onShowToast?.('티켓 약어는 대문자 영문/숫자 2~8자여야 합니다.', 'error');
      return;
    }

    setSettingsSaving(true);
    try {
      const settings = await saveGitHubRepositorySettings(selectedRepoFullName, normalizedPrefix);
      setDetail((current) => current ? { ...current, repositorySettings: settings } : current);
      setTicketPrefixDraft(settings?.ticket_prefix || normalizedPrefix);
      onShowToast?.('레포지토리 티켓 약어가 저장되었습니다.', 'success');
    } catch (error) {
      onShowToast?.(error.message || '티켓 약어 저장에 실패했습니다.', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!gitHubStatus?.connected) {
    return (
      <div className="flex-1 overflow-y-auto px-10 py-10">
        <EmptyState
          title="GitHub 연결이 필요합니다"
          description="레포지토리 페이지는 연결된 GitHub 레포의 PR, 이슈, 커밋을 운영 대시보드로 보여줍니다. 먼저 프로필에서 GitHub를 연결하세요."
          actionLabel="프로필에서 연결"
          onAction={onManageGitHubSettings}
        />
      </div>
    );
  }

  const detailContent = (() => {
    if (detailLoading) {
      return (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-gray-200 bg-white dark:border-border-subtle dark:bg-bg-elevated">
          <div className="flex items-center gap-3 text-sm font-semibold text-gray-500 dark:text-text-secondary">
            <RefreshCw size={16} className="animate-spin" />
            레포지토리 데이터를 불러오는 중...
          </div>
        </div>
      );
    }

    if (detailError) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {detailError}
        </div>
      );
    }

    if (!detail) {
      return (
        <EmptyState
          title="레포지토리를 선택하세요"
          description="좌측 목록에서 레포를 고르면 최신 PR, 이슈, 커밋을 바로 확인할 수 있습니다."
        />
      );
    }

    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-border-subtle dark:bg-bg-elevated">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Github size={18} className="text-gray-500 dark:text-text-secondary" />
                <h2 className="truncate text-2xl font-black tracking-tight text-gray-900 dark:text-text-primary">
                  {detail.repository.fullName}
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-gray-500 dark:text-text-secondary">
                {detail.repository.description || '설명 없음'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 dark:text-text-secondary">
                <span>기본 브랜치 {detail.repository.defaultBranch}</span>
                <span>•</span>
                <span>최근 푸시 {detail.repository.pushedAt ? timeAgo(detail.repository.pushedAt) : '-'}</span>
                <span>•</span>
                <span>동기화 {formatDateTime(detail.summary.lastSyncedAt)}</span>
              </div>
            </div>
            <a
              href={detail.repository.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 dark:border-border-strong dark:text-text-primary"
            >
              GitHub에서 열기
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Open PR" value={detail.summary.openPullRequests} sublabel="현재 열려 있는 PR" />
            <SummaryCard label="Open Issues" value={detail.summary.openIssues} sublabel="현재 열려 있는 이슈" />
            <SummaryCard
              label="Latest Activity"
              value={detail.summary.latestCommitAt ? timeAgo(detail.summary.latestCommitAt) : '-'}
              sublabel="최근 푸시 기준"
            />
            <SummaryCard label="Linked Items" value={detail.summary.linkedItems} sublabel="로드맵과 연결된 항목" />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-border-subtle dark:bg-bg-elevated">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 dark:text-text-secondary">
                티켓 약어
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-500 dark:text-text-secondary">
                GitHub 이슈 생성 시 <span className="font-black text-gray-900 dark:text-text-primary">QZR-{detail.repositorySettings?.ticket_prefix || ticketPrefixDraft || 'PREFIX'}-1</span> 형식으로 발급됩니다.
              </div>
              {detail.repositorySettings?.prefix_locked ? (
                <div className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  이미 티켓이 발급되어 약어를 변경할 수 없습니다.
                </div>
              ) : (
                <div className="mt-2 text-xs font-bold text-gray-400 dark:text-text-tertiary">
                  첫 티켓 발급 전까지만 변경할 수 있습니다. 대문자 영문/숫자 2~8자.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={ticketPrefixDraft}
                onChange={(event) => setTicketPrefixDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                disabled={Boolean(detail.repositorySettings?.prefix_locked) || settingsSaving}
                placeholder="QR"
                className="w-32 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-black uppercase tracking-widest text-gray-900 outline-none focus:border-brand-300 disabled:opacity-50 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary"
              />
              <button
                type="button"
                onClick={handleSaveTicketPrefix}
                disabled={Boolean(detail.repositorySettings?.prefix_locked) || settingsSaving}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 cursor-pointer"
              >
                {settingsSaving ? '저장 중...' : detail.repositorySettings?.ticket_prefix ? '저장' : '설정'}
              </button>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-black uppercase tracking-widest cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-white text-gray-500 border border-gray-200 dark:bg-bg-elevated dark:border-border-subtle dark:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' ? <OverviewTab detail={detail} /> : null}
        {activeTab !== 'overview' && tabError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {tabError}
          </div>
        ) : null}
        {activeTab !== 'overview' && tabLoading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-gray-200 bg-white dark:border-border-subtle dark:bg-bg-elevated">
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-500 dark:text-text-secondary">
              <RefreshCw size={16} className="animate-spin" />
              탭 데이터를 불러오는 중...
            </div>
          </div>
        ) : null}
        {activeTab === 'pulls' && !tabLoading && !tabError ? (
          <EntityTable
            items={tabData.pulls || []}
            type="pull"
            onLinkEntity={(entity, linkType) => setLinkTarget({ entity, type: linkType })}
            onOpenRoadmapItem={onOpenRoadmapItem}
          />
        ) : null}
        {activeTab === 'issues' && !tabLoading && !tabError ? (
          <EntityTable
            items={tabData.issues || []}
            type="issue"
            onLinkEntity={(entity, linkType) => setLinkTarget({ entity, type: linkType })}
            onOpenRoadmapItem={onOpenRoadmapItem}
          />
        ) : null}
        {activeTab === 'commits' && !tabLoading && !tabError ? <EntityTable items={tabData.commits || []} type="commit" /> : null}
      </div>
    );
  })();

  return (
    <div className="flex-1 overflow-y-auto bg-white px-10 py-10 dark:bg-bg-base">
      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-border-subtle dark:bg-bg-elevated">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">레포지토리</div>
                <div className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-text-primary">
                  연결된 개발 허브
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-xl border border-gray-200 p-2 text-gray-500 dark:border-border-strong dark:text-text-secondary cursor-pointer"
                title="새로고침"
              >
                <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="mt-3 text-sm font-medium leading-6 text-gray-500 dark:text-text-secondary">
              연결된 레포지토리의 PR, 이슈, 커밋을 한 화면에서 확인합니다.
            </div>
          </section>

          {listError ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {listError}
            </div>
          ) : null}

          <div className="space-y-3">
            {repositories.map((repo) => (
              <RepoListItem
                key={repo.fullName}
                repo={repo}
                selected={repo.fullName === selectedRepoFullName}
                onClick={() => onSelectRepo?.(repo.fullName)}
              />
            ))}
          </div>

          {!listLoading && repositories.length === 0 && !listError ? (
            <EmptyState
              title="연결된 레포가 없습니다"
              description="프로필에서 GitHub를 연결하고, GitHub App이 설치된 레포를 추가하면 이곳에서 최근 활동을 볼 수 있습니다."
              actionLabel="프로필 열기"
              onAction={onManageGitHubSettings}
            />
          ) : null}
        </aside>

        <main className="min-w-0">
          {selectedRepository && !detail ? (
            <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-text-tertiary">
              선택됨: {selectedRepository.fullName}
            </div>
          ) : null}
          {detailContent}
        </main>
      </div>
      {linkTarget ? (
        <RoadmapLinkPicker
          entity={linkTarget.entity}
          allItems={allItems}
          onClose={() => {
            if (!linking) setLinkTarget(null);
          }}
          onSelect={handleSelectLinkItem}
        />
      ) : null}
    </div>
  );
}
