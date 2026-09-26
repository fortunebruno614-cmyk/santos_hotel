-- ============================================================
-- FCM device tokens table for Santos Hotel
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

create table if not exists public.fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  device_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists fcm_tokens_user_idx on public.fcm_tokens (user_id);
create index if not exists fcm_tokens_token_idx on public.fcm_tokens (token);

-- Enable RLS
alter table public.fcm_tokens enable row level security;

-- Users can only insert their own tokens
create policy "Users can insert their own fcm_tokens"
  on public.fcm_tokens for insert
  with check (auth.uid() = user_id);

-- Users can view their own tokens
create policy "Users can view their own fcm_tokens"
  on public.fcm_tokens for select
  using (auth.uid() = user_id);

-- Users can update their own tokens
create policy "Users can update their own fcm_tokens"
  on public.fcm_tokens for update
  using (auth.uid() = user_id);

-- Users can delete their own tokens
create policy "Users can delete their own fcm_tokens"
  on public.fcm_tokens for delete
  using (auth.uid() = user_id);

-- NOTE: Server-side notification sending may need a service role key
-- to look up tokens of ALL users. If you want an admin broadcast feature,
-- add a service-role policy instead, or query via the service role client.