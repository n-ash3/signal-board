import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface WorkspaceGitRepo {
  id: string;
  workspace_id: string;
  provider: 'github';
  owner: string;
  repo: string;
  branch: string;
  enabled: boolean;
  last_seen_commit_sha: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceCommitEvent {
  id: string;
  workspace_id: string;
  git_repo_id: string;
  commit_sha: string;
  commit_message: string;
  author_name: string;
  commit_url: string;
  committed_at: string;
  created_by: string;
  created_at: string;
}

interface SaveGitRepoInput {
  owner: string;
  repo: string;
  branch: string;
  enabled: boolean;
}

interface UseWorkspaceGitSignalsOptions {
  autoSync?: boolean;
}

interface GitHubCommit {
  sha: string;
  message: string;
  authorName: string;
  committedAt: string;
  url: string;
}

const GITHUB_COMMITS_PER_SYNC = 10;

function extractCommits(payload: any[]): GitHubCommit[] {
  return payload
    .map((entry) => {
      const sha = typeof entry?.sha === 'string' ? entry.sha : '';
      const message = typeof entry?.commit?.message === 'string' ? entry.commit.message : '';
      const authorName = typeof entry?.commit?.author?.name === 'string' ? entry.commit.author.name : 'Unknown';
      const committedAt = typeof entry?.commit?.author?.date === 'string'
        ? entry.commit.author.date
        : new Date().toISOString();
      const url = typeof entry?.html_url === 'string'
        ? entry.html_url
        : `https://github.com/${entry?.repository?.full_name || ''}/commit/${sha}`;

      return { sha, message, authorName, committedAt, url };
    })
    .filter((commit) => commit.sha && commit.message);
}

function isLikelyUniqueConstraintError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  const code = String(error.code || '');
  return code === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique');
}

export function useWorkspaceGitSignals(
  workspaceId?: string,
  options: UseWorkspaceGitSignalsOptions = {},
) {
  const { user } = useAuth();
  const { autoSync = false } = options;
  const [repoConfig, setRepoConfig] = useState<WorkspaceGitRepo | null>(null);
  const [events, setEvents] = useState<WorkspaceCommitEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const lastManualMessageAtRef = useRef(0);

  const canSync = useMemo(
    () => Boolean(user && workspaceId && repoConfig?.enabled && repoConfig.owner && repoConfig.repo && repoConfig.branch),
    [user, workspaceId, repoConfig],
  );

  const fetchRepoConfig = useCallback(async () => {
    if (!workspaceId) {
      setRepoConfig(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('workspace_git_repos' as any)
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load git repo config:', error);
      setLoading(false);
      return;
    }

    setRepoConfig((data as WorkspaceGitRepo | null) || null);
    setLoading(false);
  }, [workspaceId]);

  const fetchEvents = useCallback(async () => {
    if (!workspaceId) {
      setEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from('workspace_commit_events' as any)
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('committed_at', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Failed to load commit events:', error);
      return;
    }

    setEvents((data as WorkspaceCommitEvent[]) || []);
  }, [workspaceId]);

  useEffect(() => {
    if (!user || !workspaceId) {
      setRepoConfig(null);
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void Promise.all([fetchRepoConfig(), fetchEvents()]).finally(() => {
      setLoading(false);
    });
  }, [user?.id, workspaceId, fetchRepoConfig, fetchEvents]);

  const saveRepoConfig = useCallback(
    async (input: SaveGitRepoInput) => {
      if (!workspaceId || !user) return false;

      const payload = {
        workspace_id: workspaceId,
        provider: 'github',
        owner: input.owner.trim(),
        repo: input.repo.trim(),
        branch: input.branch.trim() || 'main',
        enabled: input.enabled,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('workspace_git_repos' as any)
        .upsert(payload, { onConflict: 'workspace_id' })
        .select('*')
        .single();

      if (error) {
        toast.error(error.message || 'Failed to save repository settings');
        return false;
      }

      setRepoConfig(data as WorkspaceGitRepo);
      toast.success('Repository settings saved');
      return true;
    },
    [workspaceId, user?.id],
  );

  const syncNow = useCallback(
    async (manual = false) => {
      if (!user || !workspaceId || !repoConfig) return { inserted: 0, ok: false };
      if (!repoConfig.enabled) {
        if (manual) toast.info('Enable git sync first');
        return { inserted: 0, ok: false };
      }
      if (syncing) return { inserted: 0, ok: false };
      if (manual) {
        lastManualMessageAtRef.current = Date.now();
      }

      setSyncing(true);

      try {
        const commitsUrl = new URL(`https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/commits`);
        commitsUrl.searchParams.set('sha', repoConfig.branch || 'main');
        commitsUrl.searchParams.set('per_page', String(GITHUB_COMMITS_PER_SYNC));

        const response = await fetch(commitsUrl.toString(), {
          headers: { Accept: 'application/vnd.github+json' },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error (${response.status})`);
        }

        const payload = (await response.json()) as any[];
        const commits = extractCommits(payload);
        if (commits.length === 0) {
          if (manual) toast.info('No commits found');
          return { inserted: 0, ok: true };
        }

        const { data: generalChannel, error: channelError } = await supabase
          .from('channels')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('is_default', true)
          .single();

        if (channelError || !generalChannel) {
          throw new Error('Could not find #general channel');
        }

        let insertedCount = 0;
        const ordered = [...commits].reverse();
        for (const commit of ordered) {
          const { error: insertEventError } = await supabase
            .from('workspace_commit_events' as any)
            .insert({
              workspace_id: workspaceId,
              git_repo_id: repoConfig.id,
              commit_sha: commit.sha,
              commit_message: commit.message,
              author_name: commit.authorName,
              commit_url: commit.url,
              committed_at: commit.committedAt,
              created_by: user.id,
            });

          if (insertEventError) {
            if (isLikelyUniqueConstraintError(insertEventError)) {
              continue;
            }
            throw insertEventError;
          }

          insertedCount += 1;
          const shortSha = commit.sha.slice(0, 7);
          const oneLine = commit.message.split('\n')[0];

          await supabase.from('messages').insert({
            channel_id: generalChannel.id,
            user_id: user.id,
            content: `🔔 Signal: ${commit.authorName} committed ${shortSha} to ${repoConfig.owner}/${repoConfig.repo} (${repoConfig.branch}) — "${oneLine}" ${commit.url}`,
            is_signal: true,
          });
        }

        const latestSha = commits[0].sha;
        if (latestSha && latestSha !== repoConfig.last_seen_commit_sha) {
          const { data: updated } = await supabase
            .from('workspace_git_repos' as any)
            .update({ last_seen_commit_sha: latestSha })
            .eq('id', repoConfig.id)
            .select('*')
            .single();

          if (updated) {
            setRepoConfig(updated as WorkspaceGitRepo);
          }
        }

        await fetchEvents();

        if (manual) {
          if (insertedCount > 0) {
            toast.success(`Synced ${insertedCount} new commit${insertedCount === 1 ? '' : 's'}`);
          } else {
            const elapsed = Date.now() - lastManualMessageAtRef.current;
            if (elapsed < 3000) {
              toast.info('No new commits since last sync');
            }
          }
        }

        return { inserted: insertedCount, ok: true };
      } catch (error: any) {
        console.error('Failed to sync commits:', error);
        if (manual) {
          toast.error(error.message || 'Failed to sync commits');
        }
        return { inserted: 0, ok: false };
      } finally {
        setSyncing(false);
      }
    },
    [user?.id, workspaceId, repoConfig, syncing, fetchEvents],
  );

  useEffect(() => {
    if (!autoSync) return;
    if (!canSync) return;

    void syncNow(false);
    const timer = window.setInterval(() => {
      void syncNow(false);
    }, 45_000);

    return () => window.clearInterval(timer);
  }, [autoSync, canSync, syncNow]);

  return {
    repoConfig,
    events,
    loading,
    syncing,
    saveRepoConfig,
    syncNow,
    refreshConfig: fetchRepoConfig,
    refreshEvents: fetchEvents,
  };
}
