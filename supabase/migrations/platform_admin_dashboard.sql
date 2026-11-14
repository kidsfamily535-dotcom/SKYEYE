-- Applied to production 2026-11-10 (migrations platform_admin_dashboard + am_i_platform_admin).
-- Platform owner key, separate from the per-company "admin" role.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- no policies on purpose: the table cannot be read or written from the API.
-- Seed the owner (replace the id): insert into public.platform_admins (user_id) values ('<owner auth user id>');

create or replace function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins p where p.user_id = (select auth.uid()))
$$;

-- Functions used by /admin (all refuse anyone who is not the platform owner):
--   public.admin_overview()                        health numbers per company
--   public.admin_members()                         memberships + employee record + login email
--   public.admin_recent_activity(p_limit int)      latest audit_log rows across companies
--   public.admin_set_employee_active(uuid, bool)   suspend/activate an employee, logged in audit_log
--   public.am_i_platform_admin()                   boolean, used to show the owner link
-- Full bodies live in the database (see pg_get_functiondef).
