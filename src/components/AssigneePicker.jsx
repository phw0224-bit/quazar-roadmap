/**
 * @fileoverview 아이템/프로젝트 담당자 편집을 공통화하는 선택기.
 *
 * profiles.name 기반 추천 목록과 직접 입력을 함께 제공해 assignees string[] 포맷은 유지하면서
 * 사용자는 클릭 선택 또는 자유 입력 중 편한 방식을 쓸 수 있게 한다.
 *
 * value는 현재 선택된 담당자 목록, onChange는 정규화/중복 제거된 string[]를 반환한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const normalizeAssignee = (value) => (value || '').trim().toLowerCase();

const dedupeAssignees = (values = []) => {
  const seen = new Set();

  return values.reduce((acc, rawValue) => {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) return acc;

    const key = normalizeAssignee(trimmed);
    if (seen.has(key)) return acc;

    seen.add(key);
    acc.push(trimmed);
    return acc;
  }, []);
};

export default function AssigneePicker({
  value = [],
  profiles,
  onChange,
  onCancel,
  isReadOnly = false,
  placeholder = '이름 직접 입력',
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

  const selectedAssignees = useMemo(() => dedupeAssignees(value), [value]);

  const profileSuggestions = useMemo(() => {
    return (availableProfiles || [])
      .filter((profile) => (profile.name || '').trim())
      .map((profile) => ({
        ...profile,
        cleanName: profile.name.trim(),
      }));
  }, [availableProfiles]);

  const selectedKeys = useMemo(() => {
    return new Set(selectedAssignees.map(normalizeAssignee));
  }, [selectedAssignees]);

  const applyAssignees = (nextValues) => {
    onChange?.(dedupeAssignees(nextValues));
  };

  const handleToggleProfile = (profileName) => {
    if (isReadOnly) return;

    const key = normalizeAssignee(profileName);
    const nextValues = selectedKeys.has(key)
      ? selectedAssignees.filter((assignee) => normalizeAssignee(assignee) !== key)
      : [...selectedAssignees, profileName];

    applyAssignees(nextValues);
  };

  const handleRemoveAssignee = (assignee) => {
    if (isReadOnly) return;
    applyAssignees(selectedAssignees.filter((value) => normalizeAssignee(value) !== normalizeAssignee(assignee)));
  };

  const handleAddManual = () => {
    if (isReadOnly) return;

    const trimmed = manualInput.trim();
    if (!trimmed) return;

    applyAssignees([...selectedAssignees, trimmed]);
    setManualInput('');
  };

  return (
    <div className={`w-full rounded-2xl border border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-elevated p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {selectedAssignees.length > 0 ? (
            selectedAssignees.map((assignee) => (
              <span
                key={assignee}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-border-subtle bg-gray-50 dark:bg-bg-hover px-3 py-1 text-[13px] font-bold text-gray-700 dark:text-text-secondary"
              >
                <span>@{assignee}</span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignee(assignee)}
                    className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-bg-base hover:text-gray-700 dark:hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={`${assignee} 제거`}
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
                const isSelected = selectedKeys.has(normalizeAssignee(profile.cleanName));

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleToggleProfile(profile.cleanName)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-black transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                        : 'border-gray-200 dark:border-border-subtle bg-white dark:bg-bg-base text-gray-600 dark:text-text-secondary hover:border-blue-200 dark:hover:border-blue-800/40 hover:bg-blue-50 dark:hover:bg-blue-900/15'
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
