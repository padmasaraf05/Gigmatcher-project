-- Add scheme_eligible flag to profiles and configure storage for worker profile photos

alter table public.profiles
  add column if not exists scheme_eligible boolean default false;

-- Ensure pgcrypto for uuid helpers (safe if already present)
create extension if not exists "pgcrypto";

-- Create public bucket for worker profile photos
insert into storage.buckets (id, name, public)
values ('worker-profile-photos', 'worker-profile-photos', true)
on conflict (id) do nothing;

-- Allow public read access to worker profile photos
create policy if not exists "Public read access for worker profile photos"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'worker-profile-photos');

-- Allow authenticated users to upload/modify their worker profile photos
create policy if not exists "Authenticated upload for worker profile photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'worker-profile-photos');

