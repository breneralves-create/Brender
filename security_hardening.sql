-- Security hardening baseline for the Brender dashboard.
-- Run this in Supabase SQL Editor after rotating leaked keys and testing in staging.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text from public.users where id = auth.uid()),
    'vendedor'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.interacoes enable row level security;
alter table public.follow_ups enable row level security;
alter table public.company_config enable row level security;
alter table public.business_hours enable row level security;
alter table public.lead_score_config enable row level security;
alter table public.api_tokens enable row level security;

drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin"
on public.users
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "users_admin_manage" on public.users;
create policy "users_admin_manage"
on public.users
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "leads_authenticated_select" on public.leads;
create policy "leads_authenticated_select"
on public.leads
for select
to authenticated
using (true);

drop policy if exists "leads_authenticated_insert" on public.leads;
create policy "leads_authenticated_insert"
on public.leads
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "leads_authenticated_update" on public.leads;
create policy "leads_authenticated_update"
on public.leads
for update
to authenticated
using (true)
with check (true);

drop policy if exists "leads_admin_delete" on public.leads;
create policy "leads_admin_delete"
on public.leads
for delete
to authenticated
using (public.is_admin());

drop policy if exists "interacoes_authenticated_select" on public.interacoes;
create policy "interacoes_authenticated_select"
on public.interacoes
for select
to authenticated
using (true);

drop policy if exists "interacoes_authenticated_insert" on public.interacoes;
create policy "interacoes_authenticated_insert"
on public.interacoes
for insert
to authenticated
with check (true);

drop policy if exists "interacoes_admin_delete" on public.interacoes;
create policy "interacoes_admin_delete"
on public.interacoes
for delete
to authenticated
using (public.is_admin());

drop policy if exists "followups_authenticated_select" on public.follow_ups;
create policy "followups_authenticated_select"
on public.follow_ups
for select
to authenticated
using (true);

drop policy if exists "followups_authenticated_insert" on public.follow_ups;
create policy "followups_authenticated_insert"
on public.follow_ups
for insert
to authenticated
with check (true);

drop policy if exists "followups_authenticated_update" on public.follow_ups;
create policy "followups_authenticated_update"
on public.follow_ups
for update
to authenticated
using (true)
with check (true);

drop policy if exists "followups_admin_delete" on public.follow_ups;
create policy "followups_admin_delete"
on public.follow_ups
for delete
to authenticated
using (public.is_admin());

drop policy if exists "company_config_authenticated_select" on public.company_config;
create policy "company_config_authenticated_select"
on public.company_config
for select
to authenticated
using (true);

drop policy if exists "company_config_admin_write" on public.company_config;
create policy "company_config_admin_write"
on public.company_config
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "business_hours_authenticated_select" on public.business_hours;
create policy "business_hours_authenticated_select"
on public.business_hours
for select
to authenticated
using (true);

drop policy if exists "business_hours_admin_write" on public.business_hours;
create policy "business_hours_admin_write"
on public.business_hours
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "lead_score_config_authenticated_select" on public.lead_score_config;
create policy "lead_score_config_authenticated_select"
on public.lead_score_config
for select
to authenticated
using (true);

drop policy if exists "lead_score_config_admin_write" on public.lead_score_config;
create policy "lead_score_config_admin_write"
on public.lead_score_config
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "api_tokens_admin_only" on public.api_tokens;
create policy "api_tokens_admin_only"
on public.api_tokens
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on public.api_tokens from anon;
revoke all on public.users from anon;
revoke all on public.leads from anon;
revoke all on public.interacoes from anon;
revoke all on public.follow_ups from anon;
revoke all on public.company_config from anon;
revoke all on public.business_hours from anon;
revoke all on public.lead_score_config from anon;
