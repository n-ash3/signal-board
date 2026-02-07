import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { Enums } from '@/integrations/supabase/types';

type TaskPriority = Enums<'task_priority'>;

interface CreateTaskDialogProps {
  workspaceId: string;
  onTaskCreated: () => void;
}

const CreateTaskDialog = ({ workspaceId, onTaskCreated }: CreateTaskDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !user) return;
    setIsCreating(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        created_by: user.id,
        status: 'todo',
      });

      if (error) throw error;

      // Send Signal notification for new task
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();

      const userName = profile?.username || user.email?.split('@')[0] || 'Someone';

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
          content: `📋 Signal: ${userName} created task "${title.trim()}"`,
          is_signal: true,
        });
      }

      toast.success('Task created!');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setOpen(false);
      onTaskCreated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fix login bug"
              className="bg-input border-border text-foreground"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              className="bg-input border-border text-foreground resize-none"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={isCreating || !title.trim()} className="w-full">
            {isCreating ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
