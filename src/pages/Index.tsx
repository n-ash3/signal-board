import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, Zap, LogOut, Hash, MoreHorizontal, Trash2 } from 'lucide-react';
import PendingInvitations from '@/components/workspace/PendingInvitations';
import type { Tables } from '@/integrations/supabase/types';

type Workspace = Tables<'workspaces'>;

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchWorkspaces();
  }, [user]);

  // Close menu on click outside
  useEffect(() => {
    const handler = () => setMenuOpenId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const fetchWorkspaces = async () => {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load workspaces');
      return;
    }
    setWorkspaces(data || []);
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim() || !user) return;
    setIsCreating(true);
    try {
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({ name: newWorkspaceName.trim(), created_by: user.id })
        .select()
        .single();

      if (wsError) throw wsError;

      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

      if (memberError) throw memberError;

      const { error: channelError } = await supabase
        .from('channels')
        .insert({
          workspace_id: workspace.id,
          name: 'general',
          is_default: true,
          created_by: user.id,
        });

      if (channelError) throw channelError;

      toast.success('Workspace created!');
      setNewWorkspaceName('');
      setDialogOpen(false);
      navigate(`/workspace/${workspace.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteWorkspace = async (wsId: string) => {
    if (!user) return;
    setDeleting(true);
    try {
      // Delete workspace (cascades to channels, messages, members, etc.)
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', wsId);

      if (error) throw error;

      setWorkspaces(prev => prev.filter(w => w.id !== wsId));
      setConfirmDeleteId(null);
      setMenuOpenId(null);
      toast.success('Workspace deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Signal</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Pending Invitations */}
          <PendingInvitations onAccepted={fetchWorkspaces} />

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Your Workspaces</h2>
              <p className="text-muted-foreground mt-1">Select a workspace or create a new one</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Workspace
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Create Workspace</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-foreground">Workspace Name</Label>
                    <Input
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="My Team"
                      className="bg-input border-border text-foreground"
                      onKeyDown={(e) => e.key === 'Enter' && createWorkspace()}
                    />
                  </div>
                  <Button onClick={createWorkspace} disabled={isCreating || !newWorkspaceName.trim()} className="w-full">
                    {isCreating ? 'Creating...' : 'Create Workspace'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {workspaces.length === 0 ? (
            <div className="text-center py-16 rounded-lg border border-dashed border-border">
              <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No workspaces yet</h3>
              <p className="text-muted-foreground mb-4">Create your first workspace to get started</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {workspaces.map((ws, i) => (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative group"
                >
                  <button
                    onClick={() => navigate(`/workspace/${ws.id}`)}
                    className="w-full text-left p-4 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-accent transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">{ws.name}</p>
                        <p className="text-xs text-muted-foreground">Created {new Date(ws.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </button>

                  {/* Three dots menu */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === ws.id ? null : ws.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-accent/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {/* Dropdown */}
                    {menuOpenId === ws.id && (
                      <div
                        className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {confirmDeleteId === ws.id ? (
                          <div className="px-3 py-2 space-y-2">
                            <p className="text-xs text-muted-foreground">Delete <span className="font-semibold text-foreground">{ws.name}</span>?</p>
                            <p className="text-[10px] text-red-400">This will delete all channels, messages, and data.</p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => deleteWorkspace(ws.id)}
                                disabled={deleting}
                                className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 transition-colors disabled:opacity-50"
                              >
                                {deleting ? 'Deleting...' : 'Delete'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 text-xs bg-accent hover:bg-accent/80 text-foreground rounded px-2 py-1 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(ws.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-accent/50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Workspace
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
