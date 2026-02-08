import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Search } from 'lucide-react';

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

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const fetchMembers = async () => {
    setLoading(true);

    // Get workspace members
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

    // Get profiles
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

    setLoading(false);
  };

  const filteredMembers = members.filter(m =>
    m.username.toLowerCase().includes(search.toLowerCase())
  );

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
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {search ? 'No members found' : 'No members yet'}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default MembersDirectory;
