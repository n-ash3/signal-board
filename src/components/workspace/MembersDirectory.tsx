import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
<<<<<<< HEAD
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Search } from 'lucide-react';
=======
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Search, Circle } from 'lucide-react';
>>>>>>> 006281b (push em)

interface MemberProfile {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
}

const MembersDirectory = ({ workspaceId }: { workspaceId: string }) => {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
<<<<<<< HEAD
=======
  const { isOnline, onlineCount } = useOnlinePresence(workspaceId);
>>>>>>> 006281b (push em)

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const fetchMembers = async () => {
    setLoading(true);
<<<<<<< HEAD

    // Get workspace members
=======
>>>>>>> 006281b (push em)
    const { data: memberData, error: memberError } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId);

    if (memberError || !memberData) {
      setLoading(false);
      return;
    }

    const userIds = memberData.map(m => m.user_id);
    const roleMap = Object.fromEntries(memberData.map(m => [m.user_id, m.role]));

<<<<<<< HEAD
    // Get profiles
=======
>>>>>>> 006281b (push em)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, bio')
      .in('user_id', userIds);

    if (profiles) {
      setMembers(profiles.map(p => ({
        ...p,
        role: roleMap[p.user_id] || 'member',
      })));
    }
<<<<<<< HEAD

=======
>>>>>>> 006281b (push em)
    setLoading(false);
  };

  const filteredMembers = members.filter(m =>
    m.username.toLowerCase().includes(search.toLowerCase())
  );

<<<<<<< HEAD
=======
  // Sort: online first, then alphabetical
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const aOnline = isOnline(a.user_id);
    const bOnline = isOnline(b.user_id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.username.localeCompare(b.username);
  });

>>>>>>> 006281b (push em)
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
      <header className="px-5 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        <span className="text-sm text-muted-foreground ml-1">({members.length})</span>
<<<<<<< HEAD
=======
        <div className="flex items-center gap-1 ml-3">
          <span className="h-2 w-2 bg-green-500 rounded-full" />
          <span className="text-xs text-muted-foreground">{onlineCount} online</span>
        </div>
>>>>>>> 006281b (push em)
      </header>

      {/* Search */}
      <div className="px-5 pt-4 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="bg-input border-border text-foreground pl-9"
            maxLength={100}
          />
        </div>
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
<<<<<<< HEAD
        {filteredMembers.length === 0 ? (
=======
        {sortedMembers.length === 0 ? (
>>>>>>> 006281b (push em)
          <div className="text-center py-12 text-muted-foreground text-sm">
            {search ? 'No members found' : 'No members yet'}
          </div>
        ) : (
<<<<<<< HEAD
          filteredMembers.map((member) => (
            <div
              key={member.user_id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/30 transition-colors"
            >
              <Avatar className="h-10 w-10 shrink-0">
                {member.avatar_url ? (
                  <AvatarImage src={member.avatar_url} alt={member.username} />
                ) : null}
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {member.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{member.username}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    member.role === 'owner'
                      ? 'bg-signal/20 text-signal'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {member.role}
                  </span>
                </div>
                {member.bio && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{member.bio}</p>
                )}
              </div>
            </div>
          ))
=======
          sortedMembers.map((member) => {
            const online = isOnline(member.user_id);
            return (
              <div
                key={member.user_id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/30 transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10 shrink-0">
                    {member.avatar_url ? (
                      <AvatarImage src={member.avatar_url} alt={member.username} />
                    ) : null}
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {member.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                    online ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{member.username}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      member.role === 'owner'
                        ? 'bg-signal/20 text-signal'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {member.role}
                    </span>
                    {online && (
                      <span className="text-[10px] text-green-500 font-medium">Online</span>
                    )}
                  </div>
                  {member.bio && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{member.bio}</p>
                  )}
                </div>
              </div>
            );
          })
>>>>>>> 006281b (push em)
        )}
      </div>
    </div>
  );
};

export default MembersDirectory;
