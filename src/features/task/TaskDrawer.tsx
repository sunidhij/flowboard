import { Dialog, DialogPanel } from '@headlessui/react';
import { ErrorBanner } from '@/components/ui/Feedback';
import { ErrorBoundary, SectionCrash } from '@/components/ui/ErrorBoundary';
import { useAppDispatch, useAppSelector } from '@/store/context';
import { useSession } from '@/store/hooks';
import { selectTask } from '@/store/selectors';
import { drawerClosed, type DrawerState } from '@/store/slices/uiSlice';
import { CreateTaskForm } from './CreateTaskForm';
import { DrawerHeader } from './DrawerHeader';
import { EditTaskForm } from './EditTaskForm';

/** Slide-over for creating / editing a task. Escape and overlay click close it; focus is trapped and restored. */
export function TaskDrawer() {
  const drawer = useAppSelector((s) => s.ui.drawer);
  const dispatch = useAppDispatch();
  const close = () => dispatch(drawerClosed());

  return (
    <Dialog open={drawer !== null} onClose={close} className="relative z-40">
      <div className="fixed inset-0 bg-slate-900/20 transition-opacity" aria-hidden />
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <DialogPanel className="flex h-full w-[34rem] max-w-[100vw] animate-slide-in flex-col bg-white shadow-drawer">
          {drawer && (
            <ErrorBoundary
              resetKeys={[drawerKey(drawer)]}
              fallback={({ reset }) => (
                <>
                  <DrawerHeader title="Task" onClose={close} />
                  <SectionCrash reset={reset} title="This task couldn’t be displayed" />
                </>
              )}
            >
              <DrawerContent key={drawerKey(drawer)} drawer={drawer} onClose={close} />
            </ErrorBoundary>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

const drawerKey = (d: NonNullable<DrawerState>) => (d.mode === 'edit' ? d.taskId : `new:${d.listId}:${d.statusId ?? ''}`);

/** Picks the form: create, edit, or an error if the task is gone / not accessible. */
function DrawerContent({ drawer, onClose }: { drawer: NonNullable<DrawerState>; onClose: () => void }) {
  const { data, userId } = useSession();
  if (drawer.mode === 'create') return <CreateTaskForm listId={drawer.listId} statusId={drawer.statusId} onClose={onClose} />;

  const task = selectTask(data, userId, drawer.taskId);
  if (!task.ok) {
    return (
      <>
        <DrawerHeader title="Task" onClose={onClose} />
        <div className="p-5">
          <ErrorBanner error={task.error} />
        </div>
      </>
    );
  }
  // re-mount the form when the task changes list (statuses differ)
  return <EditTaskForm key={task.data.primaryListId} task={task.data} onClose={onClose} />;
}
