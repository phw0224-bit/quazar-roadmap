import { useState, useEffect } from 'react';

/**
 * Toast Notification System
 */
export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = type === 'success' ? 'bg-gray-900' : 'bg-red-600';
  const icon = type === 'success' ? '✅' : '⚠️';

  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.3)] z-[2000] flex items-center gap-3 animate-slide-up ${bgClass} pointer-events-auto`}>
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-white font-black text-[13px] tracking-tight uppercase whitespace-nowrap">{message}</span>
      <button onClick={onClose} className="ml-2 text-white/40 hover:text-white transition-colors cursor-pointer text-lg leading-none p-1">✕</button>
    </div>
  );
}

/**
 * Confirmation Modal
 */
export function ConfirmModal({ title, message, confirmText = '확인', cancelText = '취소', onConfirm, onCancel, type = 'danger' }) {
  const confirmBtnClass = type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-gray-900 hover:bg-black shadow-black/10';

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onCancel}></div>
      <div className="relative bg-white w-full max-w-[340px] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-8 flex flex-col gap-8 animate-scale-in border border-gray-50">
        <div className="flex flex-col gap-3">
          <h3 className="text-2xl font-black text-gray-900 tracking-tighter leading-tight text-center">{title}</h3>
          <p className="text-gray-500 font-bold text-sm leading-relaxed text-center px-2">{message}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-100 transition-all cursor-pointer">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer shadow-xl ${confirmBtnClass}`}>
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
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onCancel}></div>
      <div className="relative bg-white w-full max-w-[380px] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-8 flex flex-col gap-8 animate-scale-in border border-gray-50">
        <div className="flex flex-col gap-5">
          <h3 className="text-2xl font-black text-gray-900 tracking-tighter leading-tight">{title}</h3>
          <input 
            autoFocus
            className="w-full bg-gray-50 border-2 border-transparent p-5 rounded-2xl text-[16px] font-black focus:ring-4 focus:ring-blue-500/10 focus:outline-none focus:border-blue-500/30 focus:bg-white transition-all placeholder:text-gray-300"
            placeholder={placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onConfirm(value)}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-100 transition-all cursor-pointer">
            {cancelText}
          </button>
          <button onClick={() => onConfirm(value)} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all cursor-pointer shadow-xl shadow-black/10">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
