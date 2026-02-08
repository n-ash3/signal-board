import { useState } from 'react';
<<<<<<< HEAD
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
=======
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
>>>>>>> 006281b (push em)
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

interface InviteMemberDialogProps {
  workspaceId: string;
  workspaceName: string;
}

<<<<<<< HEAD
const InviteMemberDialog = ({ workspaceId, workspaceName }: InviteMemberDialogProps) => {
  const { user } = useAuth();
=======
export default function InviteMemberDialog({ workspaceId, workspaceName }: InviteMemberDialogProps) {
>>>>>>> 006281b (push em)
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
<<<<<<< HEAD
    if (!email.trim() || !user) return;

    const trimmedEmail = email.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (trimmedEmail === user.email) {
      toast.error("You can't invite yourself");
      return;
    }

    setLoading(true);
    try {
      // Check if user already exists and is already a member
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', trimmedEmail);

      // Check by looking up auth user by email via profiles isn't possible directly
      // Instead, just create the invitation - if they're already a member the unique constraint will catch it
      const { error } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspaceId,
          invited_email: trimmedEmail,
          invited_by: user.id,
        });
=======
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('workspace_invitations')
        .insert({ workspace_id: workspaceId, email: email.trim().toLowerCase(), invited_by: (await supabase.auth.getUser()).data.user?.id });
>>>>>>> 006281b (push em)

      if (error) {
        if (error.code === '23505') {
          toast.error('This person has already been invited');
        } else {
          throw error;
        }
<<<<<<< HEAD
        return;
      }

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
        .eq('workspace_id', workspaceId)
        .eq('is_default', true)
        .single();

      if (generalChannel) {
        await supabase.from('messages').insert({
          channel_id: generalChannel.id,
          user_id: user.id,
          content: `📨 Signal: ${userName} invited ${trimmedEmail} to ${workspaceName}`,
          is_signal: true,
        });
      }

      toast.success(`Invitation sent to ${trimmedEmail}!`);
      setEmail('');
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
=======
      } else {
        toast.success(`Invitation sent to ${email}`);
        setEmail('');
        setOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
>>>>>>> 006281b (push em)
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
<<<<<<< HEAD
        <button className="text-muted-foreground hover:text-foreground transition-colors" title="Invite member">
          <UserPlus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Invite to {workspaceName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-foreground">Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="bg-input border-border text-foreground"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">
              They'll see the invitation when they log in. If they don't have an account yet, they'll need to sign up first.
            </p>
          </div>
          <Button onClick={handleInvite} disabled={loading || !email.trim()} className="w-full">
=======
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/10">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Invite to {workspaceName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Email address</Label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          <Button onClick={handleInvite} disabled={loading || !email.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700">
>>>>>>> 006281b (push em)
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
<<<<<<< HEAD
};

export default InviteMemberDialog;
=======
}
>>>>>>> 006281b (push em)
