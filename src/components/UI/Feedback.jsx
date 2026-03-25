import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info, Trash2 } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel}></div>
      <div className="relative bg-white dark:bg-bg-elevated w-full max-w-[420px] rounded-[40px] shadow-[0_30px_80px_rgba(0,0,0,0.4)] p-10 flex flex-col gap-8 animate-scale-in border border-gray-100 dark:border-border-subtle transition-colors duration-200">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] ml-1">Action Required</span>
            <h3 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight">{title}</h3>
          </div>
          <input
            autoFocus
            className="w-full bg-gray-50 dark:bg-bg-base border-2 border-transparent dark:border-border-subtle p-5 rounded-[24px] text-lg font-bold text-gray-900 dark:text-text-primary focus:ring-8 focus:ring-blue-500/5 focus:outline-none focus:border-blue-500/30 focus:bg-white dark:focus:bg-bg-base transition-all placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
            placeholder={placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onConfirm(value);
              if (e.key === 'Escape') onCancel();
            }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-4 bg-gray-50 dark:bg-bg-base text-gray-400 dark:text-text-tertiary rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-bg-hover transition-all cursor-pointer border border-transparent dark:border-border-subtle">
            {cancelText}
          </button>
          <button onClick={() => onConfirm(value)} className="flex-1 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-all cursor-pointer shadow-xl shadow-black/10 hover:scale-105 active:scale-95">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
