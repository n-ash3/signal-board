import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, User, Flag } from 'lucide-react';
import type { Enums } from '@/integrations/supabase/types';

type TaskStatus = Enums<'task_status'>;
type TaskPriority = Enums<'task_priority'>;

interface TaskWithProfile {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  creatorName?: string;
  assigneeName?: string;
}

interface TaskCardProps {
  task: TaskWithProfile;
  onMove: (taskId: string, newStatus: TaskStatus) => void;
  currentStatus: TaskStatus;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'text-priority-low' },
  medium: { label: 'Med', className: 'text-priority-medium' },
  high: { label: 'High', className: 'text-priority-high' },
  urgent: { label: 'Urgent', className: 'text-priority-urgent' },
};

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done'];

const TaskCard = ({ task, onMove, currentStatus }: TaskCardProps) => {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < STATUS_ORDER.length - 1;
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <div className="p-3 rounded-md bg-card border border-border hover:border-primary/30 transition-all group animate-fade-in-up">
      {/* Title */}
      <h4 className="text-sm font-medium text-foreground leading-snug mb-1">{task.title}</h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex items-center gap-1 text-xs ${priorityConfig.className}`}>
          <Flag className="h-3 w-3" />
          {priorityConfig.label}
        </span>
        {task.assigneeName && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {task.assigneeName}
          </span>
        )}
      </div>

      {/* Move controls */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canMoveLeft && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(task.id, STATUS_ORDER[currentIndex - 1])}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Move Left
          </Button>
        )}
        {canMoveRight && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(task.id, STATUS_ORDER[currentIndex + 1])}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            Move Right
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
