"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { Toast } from '../types/materials';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const borderColor =
    toast.type === 'success' ? 'border-l-emerald-500' :
    toast.type === 'error' ? 'border-l-red-500' :
    'border-l-blue-500';

  const Icon =
    toast.type === 'success' ? CheckCircle :
    toast.type === 'error' ? XCircle :
    Info;

  const iconColor =
    toast.type === 'success' ? 'text-emerald-500' :
    toast.type === 'error' ? 'text-red-500' :
    'text-blue-500';

  return (
    <div className={`toast-enter bg-white border border-slate-200 border-l-4 ${borderColor} rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[320px] max-w-[420px]`}>
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 font-semibold text-sm">{toast.title}</p>
        <p className="text-slate-600 text-sm mt-0.5">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const ToastContainer = ({ toasts, onDismiss }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

export default ToastContainer;
