import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Mail, Check, X } from 'lucide-react';

interface Invitation {
  id: string;
  workspace_id: string;
  invited_email: string;
  invited_by: string;
  status: string;
  created_at: string;
  workspaceName?: string;
}

const PendingInvitations = ({ onAccepted }: { onAccepted: () => void }) => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchInvitations();
  }, [user]);

  const fetchInvitations = async () => {
    if (!user?.email) return;
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('invited_email', user.email)
      .eq('status', 'pending');

    if (!error && data) {
      // Fetch workspace names
      const wsIds = [...new Set(data.map(i => i.workspace_id))];
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name')
        .in('id', wsIds);

      const wsMap = Object.fromEntries((workspaces || []).map(w => [w.id, w.name]));
      setInvitations(data.map(i => ({ ...i, workspaceName: wsMap[i.workspace_id] || 'Unknown' })));
    }
    setLoading(false);
  };

  const handleAccept = async (invitation: Invitation) => {
    if (!user) return;
    try {
      // Add user as workspace member
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: invitation.workspace_id, user_id: user.id });

      if (memberError) throw memberError;

      // Update invitation status
      await supabase
        .from('workspace_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      // Send Signal notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();

      const userName = profile?.username || user.email?.split('@')[0] || 'Someone';

      const { data: generalChannel } = await supabase
        .from('channels')
        .select('id')
        .eq('workspace_id', invitation.workspace_id)
        .eq('is_default', true)
        .single();

      if (generalChannel) {
        await supabase.from('messages').insert({
          channel_id: generalChannel.id,
          user_id: user.id,
          content: `👋 Signal: ${userName} joined the workspace!`,
          is_signal: true,
        });
      }

      toast.success(`Joined ${invitation.workspaceName}!`);
      setInvitations(prev => prev.filter(i => i.id !== invitation.id));
      onAccepted();
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invitation');
    }
  };

  const handleDecline = async (invitation: Invitation) => {
    await supabase
      .from('workspace_invitations')
      .update({ status: 'declined' })
      .eq('id', invitation.id);

    setInvitations(prev => prev.filter(i => i.id !== invitation.id));
    toast.info('Invitation declined');
  };

  if (loading || invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Mail className="h-4 w-4 text-signal" />
        Pending Invitations
      </h3>
      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="p-3 rounded-lg bg-card border border-signal/20 space-y-2"
        >
          <p className="text-sm text-foreground">
            You've been invited to <span className="font-semibold">{inv.workspaceName}</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleAccept(inv)} className="flex-1">
              <Check className="h-3.5 w-3.5 mr-1" />
              Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleDecline(inv)} className="text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingInvitations;
