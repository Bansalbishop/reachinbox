import React from 'react';
import type { EmailStatus, BatchStatus } from '../types';

interface StatusBadgeProps {
  status: EmailStatus | BatchStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = status.toUpperCase();

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  const styles: Record<string, string> = {
    // Scheduled / queued
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200/80',
    QUEUED: 'bg-blue-50 text-blue-700 border-blue-200/80',
    PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 animate-pulse',
    SENDING: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 animate-pulse',

    // Completed
    SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',

    // Failed
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200/80',
    CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const currentStyle = styles[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';

  const dotColors: Record<string, string> = {
    PENDING: 'bg-amber-500',
    QUEUED: 'bg-blue-500',
    PROCESSING: 'bg-indigo-500',
    SENDING: 'bg-indigo-500',
    SENT: 'bg-emerald-500',
    COMPLETED: 'bg-emerald-500',
    FAILED: 'bg-rose-500',
    CANCELLED: 'bg-slate-400',
  };

  const dotColor = dotColors[normalized] || 'bg-slate-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border shadow-2xs ${sizeClasses} ${currentStyle}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{normalized}</span>
    </span>
  );
};
