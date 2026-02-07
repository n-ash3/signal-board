import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TaskCard from './TaskCard';
import CreateTaskDialog from './CreateTaskDialog';
import { toast } from 'sonner';
import { LayoutDashboard } from 'lucide-react';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Task = Tables<'tasks'>;
type TaskStatus = Enums<'task_status'>;

interface TaskWithProfile extends Task {
  creatorName?: string;
  assigneeName?: string;
}

const COLUMNS: { status: TaskStatus; label: string; colorClass: string }[] = [
  { status: 'todo', label: 'To Do', colorClass: 'bg-kanban-todo' },
  { status: 'in_progress', label: 'In Progress', colorClass: 'bg-kanban-progress' },
  { status: 'done', label: 'Done', colorClass: 'bg-kanban-done' },
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const KanbanBoard = ({ workspaceId }: { workspaceId: string }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTasks();

    // Subscribe to task changes
    const channel = supabase
      .channel(`tasks:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load tasks');
      setLoading(false);
      return;
    }

    // Fetch profiles
    const userIds = [...new Set([
      ...data.map(t => t.created_by),
      ...data.filter(t => t.assigned_to).map(t => t.assigned_to!),
    ])];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);

      if (profiles) {
        const map = Object.fromEntries(profiles.map(p => [p.user_id, p.username]));
        setProfileMap(map);
        setTasks(data.map(t => ({
          ...t,
          creatorName: map[t.created_by] || 'Unknown',
          assigneeName: t.assigned_to ? map[t.assigned_to] || 'Unknown' : undefined,
        })));
      } else {
        setTasks(data);
      }
    } else {
      setTasks(data);
    }

    setLoading(false);
  };

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus || !user) return;

    const oldStatus = task.status;
    const oldLabel = STATUS_LABELS[oldStatus];
    const newLabel = STATUS_LABELS[newStatus];
    const userName = profileMap[user.id] || user.email?.split('@')[0] || 'Someone';

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to move task');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: oldStatus } : t));
      return;
    }

    // Send Signal notification to #general channel
    const emoji = newStatus === 'done' ? '✅' : newStatus === 'in_progress' ? '🔄' : '📋';
    const signalContent = `${emoji} Signal: ${userName} moved "${task.title}" from ${oldLabel} → ${newLabel}`;

    // Find the default (general) channel
    const { data: generalChannel } = await supabase
      .from('channels')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .single();

    if (generalChannel) {
      await supabase.from('messages').insert({
        channel_id: generalChannel.id,
        user_id: user.id,
        content: signalContent,
        is_signal: true,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Kanban Board</h2>
        </div>
        <CreateTaskDialog workspaceId={workspaceId} onTaskCreated={fetchTasks} />
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-5">
        <div className="flex gap-4 h-full min-w-[720px]">
          {COLUMNS.map(({ status, label, colorClass }) => {
            const columnTasks = tasks.filter(t => t.status === status);
            return (
              <div key={status} className="flex-1 kanban-column flex flex-col min-w-[240px]">
                {/* Column header */}
                <div className="px-3 py-2.5 flex items-center gap-2 border-b border-border">
                  <div className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{columnTasks.length}</span>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {columnTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onMove={moveTask}
                      currentStatus={status}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;
