-- Gig Matcher: core schema + RLS policies

-- UUID generation
create extension if not exists "pgcrypto";

-- Keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- 1) profiles
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('worker', 'customer')),
  full_name text,
  phone text,
  language text,
  profile_photo_url text,
  rating numeric not null default 0,
  total_reviews int not null default 0,
  is_available boolean not null default false,
  is_pro boolean not null default false,
  service_radius_km numeric,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_latitude_longitude_idx on public.profiles (latitude, longitude);

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- User can read own profile
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- User can update own profile
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Public can read worker profiles only
drop policy if exists "profiles_public_read_workers" on public.profiles;
create policy "profiles_public_read_workers"
on public.profiles
for select
to anon, authenticated
using (role = 'worker');

grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

-- =========================
-- 2) service_categories
-- =========================
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at_service_categories on public.service_categories;
create trigger set_updated_at_service_categories
before update on public.service_categories
for each row execute function public.set_updated_at();

alter table public.service_categories enable row level security;

-- Read-only lookup
drop policy if exists "service_categories_read_all" on public.service_categories;
create policy "service_categories_read_all"
on public.service_categories
for select
to anon, authenticated
using (true);

grant select on public.service_categories to anon, authenticated;

-- =========================
-- 3) worker_skills
-- =========================
create table if not exists public.worker_skills (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.service_categories(id),
  experience_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_skills_worker_id_idx on public.worker_skills (worker_id);
create index if not exists worker_skills_category_id_idx on public.worker_skills (category_id);

drop trigger if exists set_updated_at_worker_skills on public.worker_skills;
create trigger set_updated_at_worker_skills
before update on public.worker_skills
for each row execute function public.set_updated_at();

alter table public.worker_skills enable row level security;

-- Worker can manage their own entries
drop policy if exists "worker_skills_select_own" on public.worker_skills;
create policy "worker_skills_select_own"
on public.worker_skills
for select
to authenticated
using (worker_id = auth.uid());

drop policy if exists "worker_skills_insert_own" on public.worker_skills;
create policy "worker_skills_insert_own"
on public.worker_skills
for insert
to authenticated
with check (worker_id = auth.uid());

drop policy if exists "worker_skills_update_own" on public.worker_skills;
create policy "worker_skills_update_own"
on public.worker_skills
for update
to authenticated
using (worker_id = auth.uid())
with check (worker_id = auth.uid());

drop policy if exists "worker_skills_delete_own" on public.worker_skills;
create policy "worker_skills_delete_own"
on public.worker_skills
for delete
to authenticated
using (worker_id = auth.uid());

grant select, insert, update, delete on public.worker_skills to authenticated;

-- =========================
-- 4) worker_tools
-- =========================
create table if not exists public.worker_tools (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  tool_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_tools_worker_id_idx on public.worker_tools (worker_id);

drop trigger if exists set_updated_at_worker_tools on public.worker_tools;
create trigger set_updated_at_worker_tools
before update on public.worker_tools
for each row execute function public.set_updated_at();

alter table public.worker_tools enable row level security;

-- Worker can manage their own entries
drop policy if exists "worker_tools_select_own" on public.worker_tools;
create policy "worker_tools_select_own"
on public.worker_tools
for select
to authenticated
using (worker_id = auth.uid());

drop policy if exists "worker_tools_insert_own" on public.worker_tools;
create policy "worker_tools_insert_own"
on public.worker_tools
for insert
to authenticated
with check (worker_id = auth.uid());

drop policy if exists "worker_tools_update_own" on public.worker_tools;
create policy "worker_tools_update_own"
on public.worker_tools
for update
to authenticated
using (worker_id = auth.uid())
with check (worker_id = auth.uid());

drop policy if exists "worker_tools_delete_own" on public.worker_tools;
create policy "worker_tools_delete_own"
on public.worker_tools
for delete
to authenticated
using (worker_id = auth.uid());

grant select, insert, update, delete on public.worker_tools to authenticated;

-- =========================
-- 5) jobs
-- =========================
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  worker_id uuid references public.profiles(id),
  category_id uuid not null references public.service_categories(id),
  description text,
  required_tools text[],
  urgency text,
  scheduled_time timestamptz,
  latitude numeric,
  longitude numeric,
  address text,
  status text,
  estimated_price numeric,
  final_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_customer_id_idx on public.jobs (customer_id);
create index if not exists jobs_worker_id_idx on public.jobs (worker_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_category_id_idx on public.jobs (category_id);

drop trigger if exists set_updated_at_jobs on public.jobs;
create trigger set_updated_at_jobs
before update on public.jobs
for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

-- Customer can create job
drop policy if exists "jobs_customer_create" on public.jobs;
create policy "jobs_customer_create"
on public.jobs
for insert
to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'customer'
  )
);

-- Customer can read their jobs
drop policy if exists "jobs_customer_read_own" on public.jobs;
create policy "jobs_customer_read_own"
on public.jobs
for select
to authenticated
using (customer_id = auth.uid());

-- Worker can read jobs assigned to them
drop policy if exists "jobs_worker_read_assigned" on public.jobs;
create policy "jobs_worker_read_assigned"
on public.jobs
for select
to authenticated
using (worker_id = auth.uid());

grant select, insert on public.jobs to authenticated;

-- =========================
-- 6) job_status_history
-- =========================
create table if not exists public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_status_history_job_id_idx on public.job_status_history (job_id);

drop trigger if exists set_updated_at_job_status_history on public.job_status_history;
create trigger set_updated_at_job_status_history
before update on public.job_status_history
for each row execute function public.set_updated_at();

alter table public.job_status_history enable row level security;

-- (No explicit policy specified in PRD list; keep locked by default)

-- =========================
-- 7) reviews
-- =========================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  reviewer_id uuid not null references public.profiles(id),
  reviewee_id uuid not null references public.profiles(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_reviewee_id_idx on public.reviews (reviewee_id);
create index if not exists reviews_job_id_idx on public.reviews (job_id);

drop trigger if exists set_updated_at_reviews on public.reviews;
create trigger set_updated_at_reviews
before update on public.reviews
for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

-- Anyone can read reviews
drop policy if exists "reviews_read_all" on public.reviews;
create policy "reviews_read_all"
on public.reviews
for select
to anon, authenticated
using (true);

-- Only participants of job can insert review
drop policy if exists "reviews_insert_participants" on public.reviews;
create policy "reviews_insert_participants"
on public.reviews
for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1
    from public.jobs j
    where j.id = job_id
      and (j.customer_id = auth.uid() or j.worker_id = auth.uid())
      and (reviewee_id = j.customer_id or reviewee_id = j.worker_id)
      and reviewee_id <> reviewer_id
  )
);

grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

-- =========================
-- 8) earnings
-- =========================
create table if not exists public.earnings (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id),
  job_id uuid not null references public.jobs(id),
  amount numeric,
  commission numeric,
  payout_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists earnings_worker_id_idx on public.earnings (worker_id);
create index if not exists earnings_job_id_idx on public.earnings (job_id);

drop trigger if exists set_updated_at_earnings on public.earnings;
create trigger set_updated_at_earnings
before update on public.earnings
for each row execute function public.set_updated_at();

alter table public.earnings enable row level security;

-- Worker can read only their earnings
drop policy if exists "earnings_worker_read_own" on public.earnings;
create policy "earnings_worker_read_own"
on public.earnings
for select
to authenticated
using (worker_id = auth.uid());

grant select on public.earnings to authenticated;

-- =========================
-- 9) subscriptions
-- =========================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id),
  plan_type text,
  start_date timestamptz,
  end_date timestamptz,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_worker_id_idx on public.subscriptions (worker_id);

drop trigger if exists set_updated_at_subscriptions on public.subscriptions;
create trigger set_updated_at_subscriptions
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Worker can read own subscription
drop policy if exists "subscriptions_worker_read_own" on public.subscriptions;
create policy "subscriptions_worker_read_own"
on public.subscriptions
for select
to authenticated
using (worker_id = auth.uid());

grant select on public.subscriptions to authenticated;

-- =========================
-- 10) notifications
-- =========================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

drop trigger if exists set_updated_at_notifications on public.notifications;
create trigger set_updated_at_notifications
before update on public.notifications
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

-- User can read only their notifications
drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

grant select on public.notifications to authenticated;

-- =========================
-- 11) messages
-- =========================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id),
  sender_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists messages_job_id_idx on public.messages (job_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_receiver_id_idx on public.messages (receiver_id);

drop trigger if exists set_updated_at_messages on public.messages;
create trigger set_updated_at_messages
before update on public.messages
for each row execute function public.set_updated_at();

alter table public.messages enable row level security;

-- Only sender/receiver can read messages
drop policy if exists "messages_read_participants" on public.messages;
create policy "messages_read_participants"
on public.messages
for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

grant select on public.messages to authenticated;

-- =========================
-- 12) demand_predictions
-- =========================
create table if not exists public.demand_predictions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id),
  area_name text,
  predicted_demand_score numeric,
  prediction_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demand_predictions_category_id_idx on public.demand_predictions (category_id);
create index if not exists demand_predictions_prediction_date_idx on public.demand_predictions (prediction_date);

drop trigger if exists set_updated_at_demand_predictions on public.demand_predictions;
create trigger set_updated_at_demand_predictions
before update on public.demand_predictions
for each row execute function public.set_updated_at();

alter table public.demand_predictions enable row level security;

-- Read-only analytics
drop policy if exists "demand_predictions_read_all" on public.demand_predictions;
create policy "demand_predictions_read_all"
on public.demand_predictions
for select
to anon, authenticated
using (true);

grant select on public.demand_predictions to anon, authenticated;

