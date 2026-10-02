-- GitHubble: the repository galaxy.
--
-- Written by the importer (scripts/import.ts) with the service-role key.
-- Read by the app with the anon/publishable key: row-level security exposes
-- only the repositories currently placed in the galaxy.
--
-- Allowed category values mirror lib/taxonomy.ts (kept in sync by a unit test).

create table if not exists public.repositories (
  github_id            bigint primary key,
  owner                text not null,
  name                 text not null,
  full_name            text not null unique,
  description          text not null default '',
  github_url           text not null,
  homepage_url         text,
  stars                integer not null check (stars >= 0),
  forks                integer not null default 0 check (forks >= 0),
  primary_language     text not null default 'Other',
  topics               text[] not null default '{}',

  problem_category     text not null check (problem_category in (
    'AI / LLM', 'Database', 'Authentication', 'UI Components', 'Web Framework', 'Developer Tools',
    'Testing', 'Automation', 'Search', 'Observability', 'Deployment', 'Scraping', 'Media',
    'Networking', 'Security', 'Data Processing'
  )),
  platform_category    text not null check (platform_category in (
    'Web', 'Server', 'CLI', 'iOS', 'Android', 'Desktop', 'Browser Extension', 'Embedded', 'Cross-platform'
  )),
  cluster_id           text not null check (cluster_id in (
    'devtools', 'web', 'apps', 'media', 'ai', 'data', 'infra', 'security'
  )),
  is_software          boolean not null default true,
  -- Model id that produced the classification, or 'heuristic'.
  classification_model text not null,

  -- Placement: repositories in the galaxy have coordinates from the spiral-arm
  -- layout (x/z span the disc, y is height above it).
  in_galaxy            boolean not null default false,
  x                    real not null default 0,
  y                    real not null default 0,
  z                    real not null default 0,

  created_at_github    timestamptz,
  updated_at_github    timestamptz,
  pushed_at            timestamptz,
  -- When the importer last wrote this row.
  indexed_at           timestamptz not null default now()
);

create index if not exists repositories_in_galaxy_stars_idx
  on public.repositories (stars desc)
  where in_galaxy;

-- Explicit grants, for projects that don't grant new tables to the API roles automatically.
grant select on table public.repositories to anon, authenticated;
grant select, insert, update, delete on table public.repositories to service_role;

alter table public.repositories enable row level security;

drop policy if exists "Galaxy repositories are public" on public.repositories;
create policy "Galaxy repositories are public"
  on public.repositories
  for select
  to anon, authenticated
  using (in_galaxy);
