import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Github, Link as LinkIcon } from 'lucide-react';
import { useWorkspaceGitSignals } from '@/hooks/useWorkspaceGitSignals';

interface GitSyncCardProps {
  workspaceId: string;
}

const GitSyncCard = ({ workspaceId }: GitSyncCardProps) => {
  const { repoConfig, events, loading, syncing, saveRepoConfig, syncNow } = useWorkspaceGitSignals(workspaceId);

  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOwner(repoConfig?.owner || '');
    setRepo(repoConfig?.repo || '');
    setBranch(repoConfig?.branch || 'main');
    setEnabled(repoConfig?.enabled ?? true);
  }, [repoConfig?.id, repoConfig?.owner, repoConfig?.repo, repoConfig?.branch, repoConfig?.enabled]);

  const hasValidRepo = useMemo(
    () => Boolean(owner.trim() && repo.trim() && branch.trim()),
    [owner, repo, branch],
  );

  const handleSave = async () => {
    if (!hasValidRepo) return;
    setSaving(true);
    const ok = await saveRepoConfig({
      owner: owner.trim(),
      repo: repo.trim(),
      branch: branch.trim(),
      enabled,
    });
    setSaving(false);
    if (ok) {
      await syncNow(true);
    }
  };

  const handleSyncNow = async () => {
    await syncNow(true);
  };

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Github className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Git Commit Signals</CardTitle>
        </div>
        <CardDescription>
          Connect a GitHub repo so new commits automatically post as Signal notifications in #general.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading git sync settings...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="git-owner">Owner / Org</Label>
                <Input
                  id="git-owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="octocat"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="git-repo">Repository</Label>
                <Input
                  id="git-repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="signal"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="git-branch">Branch</Label>
                <Input
                  id="git-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
              <div className="flex items-center gap-2 py-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-sm text-foreground">Enable sync</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving || syncing || !hasValidRepo}>
                {saving ? 'Saving...' : 'Save repo'}
              </Button>
              <Button variant="outline" onClick={handleSyncNow} disabled={syncing || !repoConfig?.enabled || !repoConfig?.id}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync now'}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent commit activity</p>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No commit events yet. Save repo settings and run Sync now.
                </p>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => {
                    const shortSha = event.commit_sha.slice(0, 7);
                    const line = event.commit_message.split('\n')[0];
                    return (
                      <div key={event.id} className="rounded-md border border-border/70 px-3 py-2 bg-background/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-primary">{shortSha}</span>
                          <a
                            href={event.commit_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            title="Open commit"
                          >
                            <LinkIcon className="h-3 w-3" />
                            commit
                          </a>
                        </div>
                        <p className="text-sm text-foreground mt-1">{line}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.author_name} • {new Date(event.committed_at).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GitSyncCard;
