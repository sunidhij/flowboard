import type { ColorToken, Priority, StatusCategory } from '@/domain/types';

/**
 * Single source of truth for semantic colors so kanban cards, list rows,
 * pills and the drawer always agree. Full class strings so Tailwind's JIT sees them.
 */
export const COLOR_DOT: Record<ColorToken, string> = {
  gray: 'bg-slate-400',
  blue: 'bg-brand-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
};

export const COLOR_SOFT: Record<ColorToken, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
};

export const AVATAR_BG: Record<ColorToken, string> = {
  gray: 'bg-slate-500',
  blue: 'bg-brand-600',
  amber: 'bg-amber-500',
  green: 'bg-emerald-600',
  red: 'bg-red-500',
  violet: 'bg-violet-600',
  pink: 'bg-pink-600',
  teal: 'bg-teal-600',
};

export const PRIORITY_META: Record<Priority, { label: string; text: string; bar: string; soft: string }> = {
  urgent: { label: 'Urgent', text: 'text-priority-urgent', bar: 'bg-priority-urgent', soft: 'bg-red-50 ring-red-200' },
  high: { label: 'High', text: 'text-priority-high', bar: 'bg-priority-high', soft: 'bg-orange-50 ring-orange-200' },
  normal: { label: 'Normal', text: 'text-priority-normal', bar: 'bg-priority-normal', soft: 'bg-brand-50 ring-brand-200' },
  low: { label: 'Low', text: 'text-priority-low', bar: 'bg-priority-low', soft: 'bg-slate-50 ring-slate-200' },
  none: { label: 'No priority', text: 'text-ink-subtle', bar: 'bg-priority-none', soft: 'bg-white ring-surface-border' },
};

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  todo: 'Not started',
  in_progress: 'Active',
  done: 'Completed',
};
