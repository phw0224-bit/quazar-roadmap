/**
 * @fileoverview 아이템/프로젝트 담당자 편집을 공통화하는 선택기.
 *
 * 선택 결과는 이름과 사용자 id를 함께 유지해 assignees / assignee_user_ids를
 * 동시에 저장할 수 있도록 만든다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const normalizeAssignee = (value) => (value || '').trim().toLowerCase();

const dedupeAssigneeEntries = (values = []) => {
  const seenIds = new Set();
  const seenNames = new Set();

  return values.reduce((acc, rawValue) => {
    const id = rawValue?.id || null;
    const name = (rawValue?.name || '').trim();
    if (!name) return acc;

    if (id) {
      if (seenIds.has(id)) return acc;
      seenIds.add(id);
      acc.push({ id, name });
      return acc;
    }

    const key = normalizeAssignee(name);
    if (seenNames.has(key)) return acc;
    seenNames.add(key);
    acc.push({ id: null, name });
    return acc;
  }, []);
};

export default function AssigneePicker({
  value = [],
  selectedUserIds = [],
  profiles,
  onChange,
  onCancel,
  onInvalidAssignee,
  isReadOnly = false,
  placeholder = '등록된 이름 입력',
  emptyLabel = '비어 있음',
  className = '',
}) {
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    if (Array.isArray(profiles)) {
      setAvailableProfiles(profiles);
      return;
    }

    let isMounted = true;

    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, department')
        .order('name', { ascending: true });

      if (!isMounted || error) return;
      setAvailableProfiles(data || []);
    };

    fetchProfiles();

    return () => {
      isMounted = false;
    };
  }, [profiles]);

  const profileSuggestions = useMemo(() => {
    return (availableProfiles || [])
      .filter((profile) => (profile.name || '').trim())
      .map((profile) => ({
        ...profile,
        cleanName: profile.name.trim(),
      }));
  }, [availableProfiles]);

  const profilesById = useMemo(
    () => new Map(profileSuggestions.map((profile) => [profile.id, profile])),
    [profileSuggestions]
  );

  const selectedEntries = useMemo(() => {
    const entriesFromIds = (selectedUserIds || [])
      .map((userId) => {
        const profile = profilesById.get(userId);
        if (!profile) return null;
        return { id: profile.id, name: profile.cleanName };
      })
      .filter(Boolean);

    const entriesFromNames = (value || [])
      .map((rawName) => {
        const trimmed = (rawName || '').trim();
        if (!trimmed) return null;

        const matchedProfile = profileSuggestions.find(
          (profile) => normalizeAssignee(profile.cleanName) === normalizeAssignee(trimmed)
        );

        if (matchedProfile && !(selectedUserIds || []).includes(matchedProfile.id)) {
          return { id: matchedProfile.id, name: matchedProfile.cleanName };
        }

        if (matchedProfile) return null;
        return { id: null, name: trimmed };
      })
      .filter(Boolean);

    return dedupeAssigneeEntries([...entriesFromIds, ...entriesFromNames]);
  }, [profileSuggestions, profilesById, selectedUserIds, value]);

  const selectedIdSet = useMemo(
    () => new Set(selectedEntries.map((entry) => entry.id).filter(Boolean)),
    [selectedEntries]
  );

  const applyAssignees = (nextValues) => {
    const normalizedEntries = dedupeAssigneeEntries(nextValues);
    onChange?.(
      normalizedEntries.map((entry) => entry.name),
      normalizedEntries.map((entry) => entry.id).filter(Boolean),
    );
  };

  const handleToggleProfile = (profile) => {
    if (isReadOnly) return;

    const nextValues = selectedIdSet.has(profile.id)
      ? selectedEntries.filter((entry) => entry.id !== profile.id)
      : [...selectedEntries, { id: profile.id, name: profile.cleanName }];

    applyAssignees(nextValues);
  };

  const handleRemoveAssignee = (assignee) => {
    if (isReadOnly) return;

    applyAssignees(selectedEntries.filter((entry) => {
      if (assignee.id && entry.id) {
        return entry.id !== assignee.id;
      }
      return normalizeAssignee(entry.name) !== normalizeAssignee(assignee.name);
    }));
  };

  const handleAddManual = () => {
    if (isReadOnly) return;

    const trimmed = manualInput.trim();
    if (!trimmed) return;

    const matchedProfile = profileSuggestions.find(
      (profile) => normalizeAssignee(profile.cleanName) === normalizeAssignee(trimmed)
    );

    if (!matchedProfile) {
      onInvalidAssignee?.('담당자는 등록된 프로필만 지정할 수 있습니다.');
      return;
    }

    applyAssignees([...selectedEntries, { id: matchedProfile.id, name: matchedProfile.cleanName }]);
    setManualInput('');
  };

  return (
    <div className={`w-full rounded-2xl border border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-elevated p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {selectedEntries.length > 0 ? (
            selectedEntries.map((assignee) => (
              <span
                key={assignee.id || assignee.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-border-subtle bg-gray-50 dark:bg-bg-hover px-3 py-1 text-[13px] font-bold text-gray-700 dark:text-text-secondary"
              >
                <span>@{assignee.name}</span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignee(assignee)}
                    className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-bg-base hover:text-gray-700 dark:hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={`${assignee.name} 제거`}
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="flex items-center text-[13px] font-bold italic text-gray-300 dark:text-text-tertiary/60">
              {emptyLabel}
            </span>
          )}
        </div>
        {onCancel && !isReadOnly && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-700 dark:hover:text-text-secondary transition-colors cursor-pointer"
          >
            닫기
          </button>
        )}
      </div>

      {!isReadOnly && (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-border-subtle bg-gray-50/80 dark:bg-bg-hover/60 px-3 py-2">
            <UserPlus size={15} className="shrink-0 text-gray-400 dark:text-text-tertiary" />
            <input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManual();
                }
                if (e.key === 'Escape') {
                  setManualInput('');
                  onCancel?.();
                }
              }}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm font-bold text-gray-800 dark:text-text-primary placeholder:text-gray-400 dark:placeholder:text-text-tertiary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddManual}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <Plus size={12} strokeWidth={3} />
              추가
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {profileSuggestions.length > 0 ? (
              profileSuggestions.map((profile) => {
                const isSelected = selectedIdSet.has(profile.id);

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleToggleProfile(profile)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-black transition-all cursor-pointer ${
                      isSelected
                        ? 'border-brand-200 dark:border-brand-700/50 bg-brand-50 dark:bg-brand-800/25 text-brand-600 dark:text-brand-400'
                        : 'border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-base text-gray-600 dark:text-text-secondary hover:border-brand-200 dark:hover:border-brand-700/40 hover:bg-brand-50 dark:hover:bg-brand-800/15'
                    }`}
                  >
                    {isSelected ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                    <span>{profile.cleanName}</span>
                  </button>
                );
              })
            ) : (
              <span className="text-[12px] font-bold text-gray-400 dark:text-text-tertiary">
                추천할 유저가 없습니다.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
