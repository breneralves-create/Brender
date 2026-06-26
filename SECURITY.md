# Security Checklist

This project is a browser-based SaaS dashboard. Production security depends on the frontend code, Supabase RLS policies, and secret handling in the deployment platform.

## Required Before Production

1. Rotate any exposed Supabase secret keys in the Supabase dashboard.
2. Keep only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in frontend deployment environment variables.
3. Never commit `.env`, `.env.production`, service credentials, raw API tokens, webhook secrets, or test scripts with secrets.
4. Run `security_hardening.sql` in Supabase SQL Editor after testing it in staging.
5. Verify RLS is enabled for `users`, `leads`, `interacoes`, `follow_ups`, `company_config`, `business_hours`, `lead_score_config`, and `api_tokens`.
6. Keep destructive actions such as deletes admin-only in both UI and RLS.
7. Put privileged automation behind Supabase Edge Functions or another backend. The browser must not hold server-only credentials.
8. Store `BOT_CONTROL_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, and `INVITE_REDIRECT_URL` as Supabase Edge Function secrets, not Vite variables.

## Token Rules

- API tokens are generated once and displayed once.
- Store only a one-way hash in `api_tokens.token_hash`.
- Revoke old tokens after any incident or team member departure.
- Do not show token hashes in normal list screens.

## Webhook Rules

- Prefer an authenticated Edge Function over direct public N8N webhooks.
- Validate the authenticated user and role before changing bot state.
- Keep webhook URLs in deployment environment variables, not source code.

## Dependency Checks

Run these before every release:

```bash
npm audit --omit=dev
npm run build
```

## Incident Response

If any secret is committed or exposed:

1. Rotate it immediately in the provider dashboard.
2. Revoke tokens created before the incident.
3. Remove the secret from the repository and history before publishing.
4. Review Supabase logs for unexpected reads, writes, or deletes.
