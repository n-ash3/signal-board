import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

interface InviteMemberDialogProps {
  workspaceId: string;
  workspaceName: string;
}

export default function InviteMemberDialog({ workspaceId, workspaceName }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('workspace_invitations')
        .insert({ workspace_id: workspaceId, email: email.trim().toLowerCase(), invited_by: (await supabase.auth.getUser()).data.user?.id });

      if (error) {
        if (error.code === '23505') {
          toast.error('This person has already been invited');
        } else {
          throw error;
        }
      } else {
        toast.success(`Invitation sent to ${email}`);
        setEmail('');
        setOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
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
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
