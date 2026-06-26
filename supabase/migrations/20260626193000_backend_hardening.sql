-- Backend support for secure Edge Functions and API token validation.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_tokens' and column_name = 'token_hash'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_tokens' and column_name = 'ativo'
  ) then
    create index if not exists api_tokens_active_hash_idx
    on public.api_tokens (token_hash)
    where ativo = true;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'whatsapp'
  ) then
    create index if not exists leads_whatsapp_idx
    on public.leads (whatsapp)
    where whatsapp is not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follow_ups' and column_name = 'agendado_para'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follow_ups' and column_name = 'realizado'
  ) then
    create index if not exists follow_ups_pending_schedule_idx
    on public.follow_ups (agendado_para)
    where realizado = false;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interacoes' and column_name = 'lead_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interacoes' and column_name = 'criado_em'
  ) then
    create index if not exists interacoes_lead_created_idx
    on public.interacoes (lead_id, criado_em);
  end if;
end $$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
