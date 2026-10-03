import { useState } from 'react';
import type { AppError } from '@/domain/errors';
import type { Task } from '@/domain/types';
import type { FormState } from './TaskForm';

export const fromTask = (t: Task): FormState => ({
  title: t.title,
  description: t.description,
  statusId: t.statusId,
  priority: t.priority,
  assigneeIds: t.assigneeIds,
  dueDate: t.dueDate,
});

/**
 * Form state shared by the create and edit task forms: field values, per-field errors from the
 * store's validation (`error.fields`), a banner for non-field errors, and dirty tracking.
 */
export function useTaskForm(initial: FormState) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<AppError | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  /** update fields and clear their errors */
  const onChange = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  /** field errors go inline; anything else (e.g. CONFLICT, NETWORK) to the banner */
  const handleError = (error: AppError) => {
    if (error.fields) setErrors(error.fields);
    else setBannerError(error);
  };

  const clearError = (key: string) =>
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });

  return { form, setForm, errors, onChange, clearError, dirty, bannerError, setBannerError, handleError };
}
