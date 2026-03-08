-- Split worker-specific fields from profiles into worker_profiles

-- 1) Create worker_profiles table
create table if not exists public.worker_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  service_radius_km numeric,
  latitude numeric,
  longitude numeric,
  is_available boolean not null default false,
  is_pro boolean not null default false,
  scheme_eligible boolean not null default false,
  rating numeric not null default 0,
  total_reviews int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_profiles_latitude_longitude_idx
  on public.worker_profiles (latitude, longitude);

-- Reuse updated_at trigger
drop trigger if exists set_updated_at_worker_profiles on public.worker_profiles;
create trigger set_updated_at_worker_profiles
before update on public.worker_profiles
for each row execute function public.set_updated_at();

-- 2) Migrate existing worker-specific data from profiles if columns exist
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'service_radius_km'
  ) then
    insert into public.worker_profiles (
      user_id,
      service_radius_km,
      latitude,
      longitude,
      is_available,
      is_pro,
      scheme_eligible,
      rating,
      total_reviews,
      created_at,
      updated_at
    )
    select
      id,
      service_radius_km,
      latitude,
      longitude,
      coalesce(is_available, false),
      coalesce(is_pro, false),
      coalesce(scheme_eligible, false),
      coalesce(rating, 0),
      coalesce(total_reviews, 0),
      created_at,
      updated_at
    from public.profiles
    on conflict (user_id) do nothing;
  end if;
end $$;

-- 3) Remove worker-only columns from profiles (if present)
alter table public.profiles
  drop column if exists rating,
  drop column if exists total_reviews,
  drop column if exists is_available,
  drop column if exists is_pro,
  drop column if exists service_radius_km,
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists scheme_eligible;

-- 4) Enable RLS on worker_profiles and add policies
alter table public.worker_profiles enable row level security;

-- Worker can read their own worker profile
drop policy if exists "worker_profiles_select_own" on public.worker_profiles;
create policy "worker_profiles_select_own"
on public.worker_profiles
for select
to authenticated
using (user_id = auth.uid());

-- Worker can insert their own worker profile
drop policy if exists "worker_profiles_insert_own" on public.worker_profiles;
create policy "worker_profiles_insert_own"
on public.worker_profiles
for insert
to authenticated
with check (user_id = auth.uid());

-- Worker can update their own worker profile
drop policy if exists "worker_profiles_update_own" on public.worker_profiles;
create policy "worker_profiles_update_own"
on public.worker_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Worker can delete their own worker profile (rare, but symmetric)
drop policy if exists "worker_profiles_delete_own" on public.worker_profiles;
create policy "worker_profiles_delete_own"
on public.worker_profiles
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.worker_profiles to authenticated;

