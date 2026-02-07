import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Hash, Plus, LayoutDashboard, ArrowLeft, Zap, LogOut } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Channel = Tables<'channels'>;

interface WorkspaceSidebarProps {
  workspaceId: string;
  workspaceName: string;
  channels: Channel[];
  activeChannelId: string | null;
  view: 'chat' | 'kanban';
  onSelectChannel: (id: string) => void;
  onSelectKanban: () => void;
  onChannelCreated: (channel: Channel) => void;
}

const WorkspaceSidebar = ({
  workspaceId,
  workspaceName,
  channels,
  activeChannelId,
  view,
  onSelectChannel,
  onSelectKanban,
  onChannelCreated,
}: WorkspaceSidebarProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [newChannelName, setNewChannelName] = useState('');
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const createChannel = async () => {
    if (!newChannelName.trim() || !user) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          workspace_id: workspaceId,
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      onChannelCreated(data);
      setNewChannelName('');
      setChannelDialogOpen(false);
      toast.success('Channel created!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create channel');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <aside className="w-60 bg-sidebar flex flex-col border-r border-sidebar-border shrink-0">
      {/* Workspace header */}
      <div className="p-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="text-sidebar-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {workspaceName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-foreground truncate">{workspaceName}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Kanban */}
        <button
          onClick={onSelectKanban}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
            view === 'kanban'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span>Kanban Board</span>
        </button>

        {/* Channels section */}
        <div className="pt-3">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</span>
            <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
              <DialogTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Create Channel</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-foreground">Channel Name</Label>
                    <Input
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="design-team"
                      className="bg-input border-border text-foreground"
                      onKeyDown={(e) => e.key === 'Enter' && createChannel()}
                    />
                  </div>
                  <Button onClick={createChannel} disabled={isCreating || !newChannelName.trim()} className="w-full">
                    {isCreating ? 'Creating...' : 'Create Channel'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                view === 'chat' && activeChannelId === channel.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{channel.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-medium shrink-0">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-sidebar-foreground truncate">{user?.email}</span>
        </div>
        <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
};

export default WorkspaceSidebar;
