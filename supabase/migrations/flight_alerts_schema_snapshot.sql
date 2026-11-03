-- Snapshot of the flight-alerts schema as it exists on the SKYEYE production database (project nglooelpazkwxybucteo), exported 2026-11-03.
-- These objects were created by earlier sessions directly on the database and were not in the repository until now.
-- Idempotent: safe to run on a database that already has them. Depends on: public.companies, public.flights, public.employees, public.station_trips, private.is_member / can_write / is_admin.

create table if not exists public.flight_alert_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  rule_code text not null,
  name_ar text not null,
  trigger_kind text not null,
  applies_to text[] not null default '{}'::text[],
  base_level text not null check (base_level in ('L1','L2','L3','L4')),
  threshold_minutes integer,
  action_ar text not null,
  owner_role text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  approved_by uuid,
  approved_at timestamptz,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  repeat_minutes integer check (repeat_minutes is null or repeat_minutes > 0),
  escalates boolean not null default true
);
create unique index if not exists flight_alert_rules_uq on public.flight_alert_rules (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_code);

create table if not exists public.escalation_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  from_level text not null check (from_level in ('L2','L3','L4')),
  ack_minutes integer not null check (ack_minutes > 0),
  escalate_to_level text not null check (escalate_to_level in ('L3','L4')),
  escalate_to_role text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  approved_by uuid,
  approved_at timestamptz,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists escalation_policies_uq on public.escalation_policies (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), from_level);

create table if not exists public.flight_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  flight_id uuid references public.flights(id) on delete cascade,
  trip_id uuid references public.station_trips(id) on delete set null,
  rule_id uuid references public.flight_alert_rules(id) on delete set null,
  level text not null check (level in ('L1','L2','L3','L4')),
  state text not null default 'open' check (state in ('open','acknowledged','snoozed','resolved')),
  reason_ar text not null,
  action_ar text not null,
  owner_employee_id uuid references public.employees(id),
  due_at timestamptz,
  dedup_key text not null,
  acknowledged_by uuid references public.employees(id),
  acknowledged_at timestamptz,
  resolved_by uuid references public.employees(id),
  resolved_at timestamptz,
  resolution_note text,
  snoozed_until timestamptz,
  snooze_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists flight_alerts_open_dedup on public.flight_alerts (company_id, dedup_key) where (state <> 'resolved');
create index if not exists flight_alerts_flight_idx on public.flight_alerts (company_id, flight_id);

create table if not exists public.flight_alert_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  alert_id uuid not null references public.flight_alerts(id) on delete cascade,
  event text not null,
  actor_employee_id uuid references public.employees(id),
  actor_label text,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index if not exists flight_alert_log_alert_idx on public.flight_alert_log (alert_id);

alter table public.flight_alert_rules enable row level security;
alter table public.escalation_policies enable row level security;
alter table public.flight_alerts enable row level security;
alter table public.flight_alert_log enable row level security;

drop policy if exists flight_alert_rules_select on public.flight_alert_rules;
create policy flight_alert_rules_select on public.flight_alert_rules for select using ((company_id is null) or private.is_member(company_id));
drop policy if exists flight_alert_rules_insert on public.flight_alert_rules;
create policy flight_alert_rules_insert on public.flight_alert_rules for insert with check ((company_id is not null) and private.can_write(company_id) and ((status <> 'approved') or private.is_admin(company_id)));
drop policy if exists flight_alert_rules_update on public.flight_alert_rules;
create policy flight_alert_rules_update on public.flight_alert_rules for update using ((company_id is not null) and private.can_write(company_id)) with check ((company_id is not null) and private.can_write(company_id) and ((status <> 'approved') or private.is_admin(company_id)));
drop policy if exists flight_alert_rules_delete on public.flight_alert_rules;
create policy flight_alert_rules_delete on public.flight_alert_rules for delete using ((company_id is not null) and private.is_admin(company_id));

drop policy if exists escalation_policies_select on public.escalation_policies;
create policy escalation_policies_select on public.escalation_policies for select using ((company_id is null) or private.is_member(company_id));
drop policy if exists escalation_policies_insert on public.escalation_policies;
create policy escalation_policies_insert on public.escalation_policies for insert with check ((company_id is not null) and private.can_write(company_id) and ((status <> 'approved') or private.is_admin(company_id)));
drop policy if exists escalation_policies_update on public.escalation_policies;
create policy escalation_policies_update on public.escalation_policies for update using ((company_id is not null) and private.can_write(company_id)) with check ((company_id is not null) and private.can_write(company_id) and ((status <> 'approved') or private.is_admin(company_id)));
drop policy if exists escalation_policies_delete on public.escalation_policies;
create policy escalation_policies_delete on public.escalation_policies for delete using ((company_id is not null) and private.is_admin(company_id));

drop policy if exists flight_alerts_select on public.flight_alerts;
create policy flight_alerts_select on public.flight_alerts for select using (private.is_member(company_id));
drop policy if exists flight_alerts_insert on public.flight_alerts;
create policy flight_alerts_insert on public.flight_alerts for insert with check (private.can_write(company_id));
drop policy if exists flight_alerts_update on public.flight_alerts;
create policy flight_alerts_update on public.flight_alerts for update using (private.can_write(company_id)) with check (private.can_write(company_id));
drop policy if exists flight_alerts_delete on public.flight_alerts;
create policy flight_alerts_delete on public.flight_alerts for delete using (private.is_admin(company_id));

drop policy if exists flight_alert_log_select on public.flight_alert_log;
create policy flight_alert_log_select on public.flight_alert_log for select using (private.is_member(company_id));
drop policy if exists flight_alert_log_insert on public.flight_alert_log;
create policy flight_alert_log_insert on public.flight_alert_log for insert with check (private.can_write(company_id));
