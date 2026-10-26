'use client';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card flex max-h-[90vh] w-full flex-col !p-0 ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2>{title}</h2>
          <button className="secondary !p-2" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}
