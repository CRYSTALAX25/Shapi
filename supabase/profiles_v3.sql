-- Add subscription fields to profiles (run in Supabase SQL editor)
alter table profiles
  add column if not exists subscription_tier text check (subscription_tier in ('starter', 'growth', 'enterprise')),
  add column if not exists subscription_status text default 'inactive' check (subscription_status in ('inactive', 'active', 'cancelled', 'past_due')),
  add column if not exists stripe_subscription_id text;
