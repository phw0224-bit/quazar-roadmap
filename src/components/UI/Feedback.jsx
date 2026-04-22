import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info, Trash2 } from 'lucide-react';
import { TEAMS } from '../../lib/constants';

/**
 * Toast Notification System
 */
export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = type === 'success' ? 'bg-gray-900 dark:bg-white' : 'bg-red-600 dark:bg-red-500';
  const textClass = type === 'success' ? 'text-white dark:text-gray-900' : 'text-white';
  const icon = type === 'success' 
    ? <CheckCircle2 size={20} strokeWidth={3} className={type === 'success' ? 'text-emerald-400' : 'text-white'} /> 
    : <AlertCircle size={20} strokeWidth={3} className="text-white" />;

  return (
    <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-4 rounded-[24px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[2000] flex items-center gap-4 animate-slide-up ${bgClass} pointer-events-auto min-w-[320px] transition-colors duration-200`}>
      <div className="shrink-0">{icon}</div>
      <span className={`${textClass} font-bold text-sm tracking-tight whitespace-nowrap flex-1`}>{message}</span>
      <button onClick={onClose} className={`ml-2 ${textClass} opacity-40 hover:opacity-100 transition-opacity cursor-pointer p-1`}>
        <X size={18} strokeWidth={3} />
      </button>
    </div>
  );
}

/**
 * Confirmation Modal
 */
export function ConfirmModal({ title, message, confirmText = '확인', cancelText = '취소', onConfirm, onCancel, type = 'danger' }) {
  const confirmBtnClass = type === 'danger' 
    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 shadow-black/10';

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel}></div>
      <div className="relative bg-white dark:bg-bg-elevated w-full max-w-[380px] rounded-[40px] shadow-[0_30px_80px_rgba(0,0,0,0.4)] p-10 flex flex-col gap-8 animate-scale-in border border-gray-100 dark:border-border-subtle transition-colors duration-200">
        <div className="flex flex-col gap-4">
          <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-gray-50 dark:bg-bg-base text-gray-400'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <Info size={32} />}
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight text-center mt-2">{title}</h3>
          <p className="text-gray-500 dark:text-text-secondary font-bold text-sm leading-relaxed text-center px-4">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-4 bg-gray-50 dark:bg-bg-base text-gray-400 dark:text-text-tertiary rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-bg-hover transition-all cursor-pointer border border-transparent dark:border-border-subtle">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest transition-all cursor-pointer shadow-xl hover:scale-105 active:scale-95 ${confirmBtnClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Input Modal (Replaces window.prompt)
 */
export function InputModal({ title, placeholder, defaultValue = '', confirmText = '완료', cancelText = '취소', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const [requestForm, setRequestForm] = useState({
    title: '',
    description: '',
    request_team: '',
    priority: '중간',
  });
  const isRequestDocumentFlow = /요청 문서/i.test(title || '');
  const isCreateFlow = /추가|생성|새 메모|하위 페이지|문서/i.test(title || '');
  const flowTitle = isCreateFlow
    ? (isRequestDocumentFlow ? '개발팀 요청 작성'
      : title?.includes('메모') ? '새 메모 추가'
      : title?.includes('문서') ? '새 문서 추가'
      : title?.includes('프로젝트') ? '새 프로젝트 추가'
      : title?.includes('하위 페이지') ? '하위 페이지 추가'
      : '새 항목 추가')
    : '입력';
  const flowCopy = isCreateFlow
    ? (isRequestDocumentFlow
      ? '제목, 본문, 요청팀, 우선순위를 작성하면 개발팀에 바로 요청을 보냅니다.'
      : '제목만 입력하면 바로 생성됩니다.')
    : '값을 입력한 뒤 확인을 누르세요.';
  const canSubmitRequest = requestForm.title.trim()
    && requestForm.description.trim()
    && requestForm.request_team.trim()
    && requestForm.priority.trim();
  const updateRequestField = (field, nextValue) => {
    setRequestForm((current) => ({ ...current, [field]: nextValue }));
  };

  if (isRequestDocumentFlow) {
    return (
      <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
        <div className="relative w-full max-w-[560px] rounded-2xl border border-gray-200 bg-white p-7 shadow-none animate-scale-in dark:border-border-subtle dark:bg-bg-elevated transition-colors duration-200">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-900 dark:bg-white" />
            <span className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400 dark:text-text-tertiary">
              {flowTitle}
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-black tracking-tight text-gray-900 dark:text-text-primary">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-text-secondary">
            {flowCopy}
          </p>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary">제목</span>
              <input
                autoFocus
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary dark:placeholder:text-text-tertiary"
                placeholder={placeholder}
                value={requestForm.title}
                onChange={(event) => updateRequestField('title', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') onCancel();
                }}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary">본문</span>
              <textarea
                className="min-h-[150px] w-full resize-y rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold leading-6 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary dark:placeholder:text-text-tertiary"
                placeholder="요청 배경, 원하는 결과, 검수 기준을 적어주세요."
                value={requestForm.description}
                onChange={(event) => updateRequestField('description', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') onCancel();
                }}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary">요청팀</span>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold text-gray-900 outline-none transition-colors focus:border-gray-300 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary"
                  value={requestForm.request_team}
                  onChange={(event) => updateRequestField('request_team', event.target.value)}
                >
                  <option value="">선택</option>
                  {TEAMS.map((team) => (
                    <option key={team.name} value={team.name}>{team.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-text-tertiary">우선순위</span>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold text-gray-900 outline-none transition-colors focus:border-gray-300 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary"
                  value={requestForm.priority}
                  onChange={(event) => updateRequestField('priority', event.target.value)}
                >
                  {['높음', '중간', '낮음'].map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-border-subtle">
            <button
              onClick={onCancel}
              className="rounded-lg px-3.5 py-2 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              disabled={!canSubmitRequest}
              onClick={() => onConfirm(requestForm)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 cursor-pointer"
            >
              개발팀에 요청 보내기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-[420px] rounded-2xl border border-gray-200 bg-white p-7 shadow-none animate-scale-in dark:border-border-subtle dark:bg-bg-elevated transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-gray-900 dark:bg-white" />
          <span className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400 dark:text-text-tertiary">
            {flowTitle}
          </span>
        </div>

        <h3 className="mt-4 text-2xl font-black tracking-tight text-gray-900 dark:text-text-primary">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-text-secondary">
          {flowCopy}
        </p>

        <div className="mt-6">
          <input
            autoFocus
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 dark:border-border-subtle dark:bg-bg-base dark:text-text-primary dark:placeholder:text-text-tertiary"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(value);
              if (e.key === 'Escape') onCancel();
            }}
          />
        </div>

        <div className="mt-4 text-[11px] font-medium text-gray-400 dark:text-text-tertiary">
          Enter로 확인, ESC로 닫기
        </div>

        <div className="mt-8 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-border-subtle">
          <button
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-text-tertiary dark:hover:bg-bg-hover dark:hover:text-text-primary cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onConfirm(value)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
