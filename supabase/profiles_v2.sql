-- Run this in Supabase SQL editor to add WhatsApp and CV fields to profiles
-- (Only needed if profiles table already exists from profiles.sql)

alter table profiles
  add column if not exists whatsapp_number text,
  add column if not exists cv_storage_path text,
  add column if not exists cv_parsed bool default false,
  add column if not exists whatsapp_conversation_active bool default false;
