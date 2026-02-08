import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Hash, Plus, LayoutDashboard, ArrowLeft, LogOut, Users, Search } from 'lucide-react';
import ProfileDialog from './ProfileDialog';
import InviteMemberDialog from './InviteMemberDialog';
import type { Tables } from '@/integrations/supabase/types';

type Channel = Tables<'channels'>;

interface DMChannelInfo {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
}

interface UnreadCounts {
  [channelId: string]: number;
}

interface WorkspaceSidebarProps {
  workspaceId: string;
  workspaceName: string;
  channels: Channel[];
  activeChannelId: string | null;
  view: 'chat' | 'kanban' | 'members' | 'dm';
  activeDmChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onSelectKanban: () => void;
  onSelectMembers: () => void;
  onSelectDm: (dmChannel: DMChannelInfo) => void;
  onChannelCreated: (channel: Channel) => void;
}

const WorkspaceSidebar = ({
  workspaceId,
  workspaceName,
  channels,
  activeChannelId,
  view,
  activeDmChannelId,
  onSelectChannel,
  onSelectKanban,
  onSelectMembers,
  onSelectDm,
  onChannelCreated,
}: WorkspaceSidebarProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isOnline, onlineCount } = useOnlinePresence(workspaceId);
  const [newChannelName, setNewChannelName] = useState('');
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [dmChannels, setDmChannels] = useState<DMChannelInfo[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [dmDialogOpen, setDmDialogOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (user && workspaceId) {
      fetchDmChannels();
      fetchWorkspaceMembers();
      fetchUnreadCounts();
    }
  }, [user, workspaceId]);

  // Clear unread count when a channel is selected
  useEffect(() => {
    if (activeChannelId && unreadCounts[activeChannelId]) {
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[activeChannelId];
        return next;
      });
    }
  }, [activeChannelId]);

  // Refresh unread counts periodically
  useEffect(() => {
    const interval = setInterval(fetchUnreadCounts, 10000);
    return () => clearInterval(interval);
  }, [channels]);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user || channels.length === 0) return;

    const { data: reads } = await supabase
      .from('channel_reads')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id)
      .in('channel_id', channels.map(c => c.id));

    const readMap: Record<string, string> = {};
    (reads || []).forEach(r => { readMap[r.channel_id] = r.last_read_at; });

    const counts: UnreadCounts = {};
    for (const ch of channels) {
      const lastRead = readMap[ch.id];
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .is('parent_id', null);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      // Don't count own messages
      query = query.neq('user_id', user.id);

      const { count } = await query;
      if (count && count > 0) {
        counts[ch.id] = count;
      }
    }
    setUnreadCounts(counts);
  }, [user, channels]);

  const fetchWorkspaceMembers = async () => {
    if (!user) return;
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId);

    if (members) {
      const otherIds = members.filter(m => m.user_id !== user.id).map(m => m.user_id);
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', otherIds);
        setWorkspaceMembers(profiles || []);
      }
    }
  };

  const fetchDmChannels = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('direct_message_channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (!error && data) {
      const otherUserIds = data.map(d => d.user1_id === user.id ? d.user2_id : d.user1_id);
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', otherUserIds);

        const pMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

        setDmChannels(data.map(d => {
          const otherId = d.user1_id === user.id ? d.user2_id : d.user1_id;
          const profile = pMap[otherId];
          return {
            id: d.id,
            otherUserId: otherId,
            otherUserName: profile?.username || 'Unknown',
            otherUserAvatar: profile?.avatar_url || null,
          };
        }));
      }
    }
  };

  const startDm = async (targetUserId: string) => {
    if (!user) return;

    const existing = dmChannels.find(d => d.otherUserId === targetUserId);
    if (existing) {
      onSelectDm(existing);
      setDmDialogOpen(false);
      return;
    }

    const [u1, u2] = user.id < targetUserId ? [user.id, targetUserId] : [targetUserId, user.id];

    const { data, error } = await supabase
      .from('direct_message_channels')
      .insert({ workspace_id: workspaceId, user1_id: u1, user2_id: u2 })
      .select()
      .single();

    if (error) {
      const { data: existing2 } = await supabase
        .from('direct_message_channels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`);

      if (existing2 && existing2.length > 0) {
        const profile = workspaceMembers.find(m => m.user_id === targetUserId);
        const dmInfo: DMChannelInfo = {
          id: existing2[0].id,
          otherUserId: targetUserId,
          otherUserName: profile?.username || 'Unknown',
          otherUserAvatar: profile?.avatar_url || null,
        };
        setDmChannels(prev => [...prev, dmInfo]);
        onSelectDm(dmInfo);
        setDmDialogOpen(false);
        return;
      }
      toast.error('Failed to start conversation');
      return;
    }

    const profile = workspaceMembers.find(m => m.user_id === targetUserId);
    const newDm: DMChannelInfo = {
      id: data.id,
      otherUserId: targetUserId,
      otherUserName: profile?.username || 'Unknown',
      otherUserAvatar: profile?.avatar_url || null,
    };
    setDmChannels(prev => [...prev, newDm]);
    onSelectDm(newDm);
    setDmDialogOpen(false);
  };

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

  // Filter channels and DMs by search
  const filteredChannels = searchQuery
    ? channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : channels;
  const filteredDms = searchQuery
    ? dmChannels.filter(d => d.otherUserName.toLowerCase().includes(searchQuery.toLowerCase()))
    : dmChannels;

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
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground truncate">{workspaceName}</span>
              <span className="text-[10px] text-muted-foreground">{onlineCount} online</span>
            </div>
          </div>
          <InviteMemberDialog workspaceId={workspaceId} workspaceName={workspaceName} />
        </div>
      </div>

      {/* Search bar */}
      <div className="px-2 pt-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-sidebar-accent/50 border border-sidebar-border rounded px-2 py-1 pl-7 text-xs text-sidebar-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
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

        {/* Members */}
        <button
          onClick={onSelectMembers}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
            view === 'members'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
          }`}
        >
          <Users className="h-4 w-4 shrink-0" />
          <span>Members</span>
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

          {filteredChannels.map((channel) => {
            const unread = unreadCounts[channel.id] || 0;
            return (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  view === 'chat' && activeChannelId === channel.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : unread > 0
                    ? 'text-foreground font-semibold hover:bg-sidebar-accent/50'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
              >
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1 text-left">{channel.name}</span>
                {unread > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Direct Messages section */}
        <div className="pt-3">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</span>
            <Dialog open={dmDialogOpen} onOpenChange={setDmDialogOpen}>
              <DialogTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">New Direct Message</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 pt-2 max-h-[300px] overflow-y-auto">
                  {workspaceMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No other members in this workspace</p>
                  ) : (
                    workspaceMembers.map((member) => (
                      <button
                        key={member.user_id}
                        onClick={() => startDm(member.user_id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors text-left"
                      >
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            {member.avatar_url ? (
                              <AvatarImage src={member.avatar_url} alt={member.username} />
                            ) : null}
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {member.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline(member.user_id) && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-card" />
                          )}
                        </div>
                        <span className="text-sm text-foreground">{member.username}</span>
                        {isOnline(member.user_id) && (
                          <span className="text-[10px] text-green-500 ml-auto">online</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {filteredDms.map((dm) => (
            <button
              key={dm.id}
              onClick={() => onSelectDm(dm)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                view === 'dm' && activeDmChannelId === dm.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <div className="relative shrink-0">
                <Avatar className="h-5 w-5">
                  {dm.otherUserAvatar ? (
                    <AvatarImage src={dm.otherUserAvatar} alt={dm.otherUserName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {dm.otherUserName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOnline(dm.otherUserId) && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full border border-sidebar" />
                )}
              </div>
              <span className="truncate">{dm.otherUserName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border flex items-center justify-between">
        <ProfileDialog />
        <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
};

export default WorkspaceSidebar;
