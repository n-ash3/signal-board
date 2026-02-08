import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar';
import ChannelView from '@/components/workspace/ChannelView';
import KanbanBoard from '@/components/workspace/KanbanBoard';
import MembersDirectory from '@/components/workspace/MembersDirectory';
import DirectMessageView from '@/components/workspace/DirectMessageView';
import type { Tables } from '@/integrations/supabase/types';

type Channel = Tables<'channels'>;

interface DMChannelInfo {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
}

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'kanban' | 'members' | 'dm'>('chat');
  const [workspaceName, setWorkspaceName] = useState('');
  const [activeDm, setActiveDm] = useState<DMChannelInfo | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && workspaceId) {
      fetchWorkspace();
      fetchChannels();
    }
  }, [user, workspaceId]);

  const fetchWorkspace = async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();
    if (error) {
      toast.error('Workspace not found');
      navigate('/');
      return;
    }
    setWorkspaceName(data.name);
  };

  const fetchChannels = async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at');
    if (error) {
      toast.error('Failed to load channels');
      return;
    }
    setChannels(data || []);
    if (data && data.length > 0 && !activeChannelId) {
      const defaultChannel = data.find(c => c.is_default) || data[0];
      setActiveChannelId(defaultChannel.id);
    }
  };

  const handleChannelCreated = (channel: Channel) => {
    setChannels(prev => [...prev, channel]);
    setActiveChannelId(channel.id);
    setView('chat');
  };

  const handleSelectDm = (dmChannel: DMChannelInfo) => {
    setActiveDm(dmChannel);
    setView('dm');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !workspaceId) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <WorkspaceSidebar
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        channels={channels}
        activeChannelId={activeChannelId}
        view={view}
        activeDmChannelId={activeDm?.id || null}
        onSelectChannel={(id) => { setActiveChannelId(id); setView('chat'); }}
        onSelectKanban={() => setView('kanban')}
        onSelectMembers={() => setView('members')}
        onSelectDm={handleSelectDm}
        onChannelCreated={handleChannelCreated}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'chat' && activeChannelId && (
          <ChannelView
            key={activeChannelId}
            channelId={activeChannelId}
            channelName={channels.find(c => c.id === activeChannelId)?.name || ''}
            workspaceId={workspaceId}
          />
        )}
        {view === 'kanban' && (
          <KanbanBoard workspaceId={workspaceId} />
        )}
        {view === 'members' && (
          <MembersDirectory workspaceId={workspaceId} />
        )}
        {view === 'dm' && activeDm && (
          <DirectMessageView
            dmChannelId={activeDm.id}
            otherUserName={activeDm.otherUserName}
            otherUserAvatar={activeDm.otherUserAvatar}
          />
        )}
      </main>
    </div>
  );
};

export default WorkspacePage;
