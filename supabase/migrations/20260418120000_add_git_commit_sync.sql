-- Workspace-level Git repository configuration (currently GitHub only)
CREATE TABLE public.workspace_git_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'github' CHECK (provider IN ('github')),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen_commit_sha TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_git_repos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace git repos"
  ON public.workspace_git_repos FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create workspace git repos"
  ON public.workspace_git_repos FOR INSERT
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND auth.uid() = created_by
  );

CREATE POLICY "Members can update workspace git repos"
  ON public.workspace_git_repos FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete workspace git repos"
  ON public.workspace_git_repos FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER update_workspace_git_repos_updated_at
  BEFORE UPDATE ON public.workspace_git_repos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Deduplicated commit events per workspace to prevent duplicate Signal posts
CREATE TABLE public.workspace_commit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  git_repo_id UUID NOT NULL REFERENCES public.workspace_git_repos(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  author_name TEXT NOT NULL,
  commit_url TEXT NOT NULL,
  committed_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, commit_sha)
);

CREATE INDEX workspace_commit_events_workspace_committed_at_idx
  ON public.workspace_commit_events(workspace_id, committed_at DESC);

ALTER TABLE public.workspace_commit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace commit events"
  ON public.workspace_commit_events FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create workspace commit events"
  ON public.workspace_commit_events FOR INSERT
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND auth.uid() = created_by
  );
