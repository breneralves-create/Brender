-- Backend support for secure Edge Functions and API token validation.

create index if not exists api_tokens_active_hash_idx
on public.api_tokens (token_hash)
where ativo = true;

create index if not exists leads_whatsapp_idx
on public.leads (whatsapp)
where whatsapp is not null;

create index if not exists follow_ups_pending_schedule_idx
on public.follow_ups (agendado_para)
where realizado = false;

create index if not exists interacoes_lead_created_idx
on public.interacoes (lead_id, criado_em);

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
