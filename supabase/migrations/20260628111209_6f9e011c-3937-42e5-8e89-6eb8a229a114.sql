create table public.coach_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id text not null,
  created_at timestamptz not null default now(),
  unique(user_id, team_id)
);

grant select, insert, update, delete on public.coach_teams to authenticated;
grant all on public.coach_teams to service_role;

alter table public.coach_teams enable row level security;

create policy coach_teams_admin_all on public.coach_teams
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy coach_teams_select_own on public.coach_teams
  for select to authenticated
  using (auth.uid() = user_id);