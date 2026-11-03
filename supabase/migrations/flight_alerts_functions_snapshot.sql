-- Snapshot of the flight-alerts functions and the cron job as on production (project nglooelpazkwxybucteo), exported 2026-11-03.
-- Depends on flight_alerts_schema_snapshot.sql and on: public.v_ground_clock, public.flight_expected_events, public.flight_events,
-- public.turnaround_checkins, public.turnaround_milestone_templates, public.aircraft_types (body_class), public.company_ground_time_minimums,
-- private.can_write, private.current_employee. Uses pg_cron.

create or replace function public.acknowledge_flight_alert(p_company_id uuid, p_alert_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare a record; v_emp uuid; v_rep int; v_last timestamptz; v_until timestamptz; v_name text;
begin
  if auth.uid() is null or not private.can_write(p_company_id) then raise exception 'not allowed'; end if;
  v_emp := private.current_employee(p_company_id);
  if v_emp is null then raise exception 'employee profile required'; end if;
  select * into a from public.flight_alerts where id = p_alert_id and company_id = p_company_id for update;
  if not found then raise exception 'alert not found'; end if;
  if a.state = 'resolved' then raise exception 'alert already resolved'; end if;

  select r.repeat_minutes into v_rep from public.flight_alert_rules r where r.id = a.rule_id;
  if v_rep is not null then
    v_last := coalesce((select max(l.occurred_at) from public.flight_alert_log l
                         where l.alert_id = a.id and l.event in ('raised','reminded')), a.created_at);
    v_until := v_last + make_interval(mins => v_rep);
    if v_until <= now() then v_until := null; end if;
  end if;

  update public.flight_alerts
     set state = 'acknowledged', acknowledged_by = v_emp, acknowledged_at = now(),
         snoozed_until = v_until,
         snooze_reason = case when v_until is not null then 'acknowledged: silent until the next reminder' end,
         updated_at = now()
   where id = a.id;

  select e.full_name into v_name from public.employees e where e.id = v_emp;
  insert into public.flight_alert_log (company_id, alert_id, event, actor_employee_id, actor_label, details)
  values (p_company_id, a.id, 'acknowledged', v_emp, v_name, jsonb_build_object('silent_until', v_until));

  return jsonb_build_object('alert_id', a.id, 'acknowledged_by', v_name, 'silent_until', v_until);
end $function$;

create or replace function public.resolve_flight_alert(p_company_id uuid, p_alert_id uuid, p_note text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  a record; v_emp uuid; v_name text;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null or not private.can_write(p_company_id) then raise exception 'not allowed'; end if;
  v_emp := private.current_employee(p_company_id);
  if v_emp is null then raise exception 'employee profile required'; end if;
  if char_length(v_note) < 3 then raise exception 'resolution note required'; end if;

  select * into a from public.flight_alerts where id = p_alert_id and company_id = p_company_id for update;
  if not found then raise exception 'alert not found'; end if;
  if a.state = 'resolved' then raise exception 'alert already resolved'; end if;

  update public.flight_alerts
     set state = 'resolved', resolved_by = v_emp, resolved_at = now(), resolution_note = v_note,
         snoozed_until = null, snooze_reason = null, updated_at = now()
   where id = a.id;

  select e.full_name into v_name from public.employees e where e.id = v_emp;
  insert into public.flight_alert_log (company_id, alert_id, event, actor_employee_id, actor_label, details)
  values (p_company_id, a.id, 'resolved', v_emp, v_name, jsonb_build_object('note', v_note, 'manual', true));

  return jsonb_build_object('alert_id', a.id, 'resolved_by', v_name);
end $function$;

create or replace function public.snooze_flight_alert(p_company_id uuid, p_alert_id uuid, p_minutes integer, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  a record; v_emp uuid; v_name text; v_until timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or not private.can_write(p_company_id) then raise exception 'not allowed'; end if;
  v_emp := private.current_employee(p_company_id);
  if v_emp is null then raise exception 'employee profile required'; end if;
  if char_length(v_reason) < 3 then raise exception 'snooze reason required'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 120 then raise exception 'snooze minutes must be between 5 and 120'; end if;

  select * into a from public.flight_alerts where id = p_alert_id and company_id = p_company_id for update;
  if not found then raise exception 'alert not found'; end if;
  if a.state = 'resolved' then raise exception 'alert already resolved'; end if;
  if a.level = 'L4' then raise exception 'critical alerts cannot be snoozed'; end if;

  v_until := now() + make_interval(mins => p_minutes);
  update public.flight_alerts
     set state = 'snoozed', snoozed_until = v_until, snooze_reason = v_reason, updated_at = now()
   where id = a.id;

  select e.full_name into v_name from public.employees e where e.id = v_emp;
  insert into public.flight_alert_log (company_id, alert_id, event, actor_employee_id, actor_label, details)
  values (p_company_id, a.id, 'snoozed', v_emp, v_name,
          jsonb_build_object('minutes', p_minutes, 'reason', v_reason, 'until', v_until));

  return jsonb_build_object('alert_id', a.id, 'snoozed_until', v_until);
end $function$;

create or replace function private.run_flight_alert_cycle()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  c record;
  a record;
  w record;
  v_raised int := 0;
  v_escalated int := 0;
  v_woken int := 0;
  n int;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  for c in select id from public.companies loop
    begin
      select count(*) into n from public.evaluate_flight_alerts(c.id, now(), false, false) where out_inserted;
      v_raised := v_raised + coalesce(n, 0);
    exception when others then
      null;
    end;
  end loop;

  begin
    for w in
      select fa.id, fa.company_id
        from public.flight_alerts fa
       where fa.state = 'snoozed' and fa.snoozed_until is not null and fa.snoozed_until <= now()
       for update of fa skip locked
    loop
      update public.flight_alerts
         set state = 'open', snoozed_until = null, snooze_reason = null, updated_at = now()
       where id = w.id;
      insert into public.flight_alert_log (company_id, alert_id, event, actor_label, details)
      values (w.company_id, w.id, 'snooze_ended', 'SKYEYE', '{}'::jsonb);
      v_woken := v_woken + 1;
    end loop;
  exception when others then
    null;
  end;

  for a in
    select fa.id, fa.company_id, fa.level, p.escalate_to_level
    from public.flight_alerts fa
    left join public.flight_alert_rules fr on fr.id = fa.rule_id
    join lateral (
      select ep.escalate_to_level, ep.ack_minutes
      from public.escalation_policies ep
      where ep.status = 'approved' and ep.from_level = fa.level
        and (ep.company_id = fa.company_id or ep.company_id is null)
      order by (ep.company_id is null)
      limit 1
    ) p on true
    where fa.state = 'open' and fa.level in ('L2','L3')
      and coalesce(fr.escalates, true)
      and greatest(
            fa.created_at,
            coalesce((select max(l.occurred_at) from public.flight_alert_log l where l.alert_id = fa.id and l.event = 'escalated'), fa.created_at),
            coalesce((select max(l.occurred_at) from public.flight_alert_log l where l.alert_id = fa.id and l.event = 'snooze_ended'), fa.created_at)
          ) + make_interval(mins => p.ack_minutes) <= now()
  loop
    update public.flight_alerts set level = a.escalate_to_level, updated_at = now() where id = a.id;
    insert into public.flight_alert_log(company_id, alert_id, event, actor_label, details)
    values (a.company_id, a.id, 'escalated', 'SKYEYE', jsonb_build_object('from', a.level, 'to', a.escalate_to_level));
    v_escalated := v_escalated + 1;
  end loop;

  return jsonb_build_object('raised', v_raised, 'escalated', v_escalated, 'woken', v_woken);
end $function$;

create or replace function public.evaluate_flight_alerts(p_company_id uuid, p_now timestamp with time zone default now(), p_dry_run boolean default true, p_include_draft boolean default false)
 returns table(out_flight_id uuid, out_flight_number text, out_rule_code text, out_level text, out_reason_ar text, out_action_ar text, out_dedup_key text, out_inserted boolean)
 language plpgsql
 set search_path to 'public'
as $function$
declare
  rec record;
  v_id uuid;
begin
  for rec in
    with r as (
      select distinct on (x.rule_code) x.id, x.rule_code, x.base_level, x.threshold_minutes, x.action_ar
      from flight_alert_rules x
      where (x.company_id = p_company_id or x.company_id is null)
        and (x.status = 'approved' or (p_include_draft and x.status = 'draft'))
      order by x.rule_code, (x.company_id is null)
    ),
    cand as (
      select f.id as fid, f.flight_number as fno, r.id as rid, r.rule_code as rc, r.base_level as lvl, r.action_ar as act,
             'لا توجد رسالة حركة (MVT) بعد إقلاع المنشأ المجدول ' || to_char(f.origin_std at time zone 'UTC','YYYY-MM-DD HH24:MI') || ' UTC للرحلة ' || f.flight_number as reason,
             f.origin_std + make_interval(mins => coalesce(r.threshold_minutes, 15)) as due
      from flights f join r on r.rule_code = 'NO_MVT_AFTER_ORIGIN_ETD'
      where f.company_id = p_company_id and f.direction = 'arrival'
        and f.status not in ('cancelled','completed','closed','arrived')
        and f.origin_std is not null
        and p_now > f.origin_std + make_interval(mins => coalesce(r.threshold_minutes, 15))
        and exists (select 1 from flight_expected_events x where x.company_id = f.company_id and x.flight_id = f.id and x.event_code = 'MVT_AD' and x.state = 'missing')
      union all
      select f.id, f.flight_number, r.id, r.rule_code, r.base_level, r.action_ar,
             'لا توجد معلومة هبوط للرحلة ' || f.flight_number || ' بعد وقت الوصول المجدول ' || to_char(f.scheduled_arrival at time zone 'UTC','YYYY-MM-DD HH24:MI') || ' UTC',
             f.scheduled_arrival + make_interval(mins => coalesce(r.threshold_minutes, 15))
      from flights f join r on r.rule_code = 'NO_LANDING_INFO_AFTER_ETA'
      where f.company_id = p_company_id and f.direction = 'arrival'
        and f.status not in ('cancelled','completed','closed','arrived')
        and f.scheduled_arrival is not null
        and p_now > f.scheduled_arrival + make_interval(mins => coalesce(r.threshold_minutes, 15))
        and not exists (select 1 from flight_events e where e.company_id = f.company_id and e.flight_id = f.id and e.event_type in ('ATA','ON_BLOCK','CHOCKS_ON','AA','EO','ON_BLOCKS','LANDED'))
      union all
      -- SERVICE_NOT_STARTED: a ground service whose target time has passed without confirmation (one alert per flight: the earliest overdue service)
      select x.flight_id, x.flight_number, r.id, r.rule_code, r.base_level, r.action_ar,
             'لم يُؤكَّد اكتمال «' || x.name_ar || '» للرحلة ' || x.flight_number || ' بعد موعدها المستهدف ' || to_char(x.due_at at time zone 'UTC','HH24:MI') || ' UTC',
             x.due_at
      from r join lateral (
        select distinct on (c.flight_id) c.flight_id, f.flight_number, t.name_ar, c.due_at
        from turnaround_checkins c
        join flights f on f.id = c.flight_id and f.company_id = c.company_id
        join turnaround_milestone_templates t on t.id = c.template_id
        where c.company_id = p_company_id
          and c.status in ('asked','late','in_progress','escalated')
          and c.due_at < p_now
          and c.step_code in ('BAGGAGE_OFFLOAD','CLEANING','CATERING','FUEL','BAGGAGE_LOAD')
          and f.status not in ('cancelled','completed','closed','departed','arrived')
        order by c.flight_id, c.due_at
      ) x on true
      where r.rule_code = 'SERVICE_NOT_STARTED'
      union all
      -- ETA_LATE_RESOURCES: arrival later than schedule by the threshold (actual On Block, else latest ETA update); shows the resulting expected departure
      select g.arrival_leg_id, a.flight_number, r.id, r.rule_code, r.base_level, r.action_ar,
             'الرحلة ' || a.flight_number || ' متأخرة نحو ' || round(extract(epoch from (z.eta - g.sta)) / 60)::int || ' دقيقة عن الجدول، والمغادرة المتوقعة ' ||
               to_char(greatest(g.std, z.eta + (g.std - g.sta)) at time zone 'UTC','HH24:MI') || ' UTC (المجدولة ' || to_char(g.std at time zone 'UTC','HH24:MI') || ')',
             z.eta
      from r
      join v_ground_clock g on g.company_id = p_company_id
      join flights a on a.id = g.arrival_leg_id
      join flights d on d.id = g.departure_leg_id
      join lateral (
        select coalesce(g.ground_start_actual,
                        (select e.occurred_at from flight_events e
                          where e.company_id = g.company_id and e.flight_id = g.arrival_leg_id and e.event_type = 'ETA_UPDATE' and e.status <> 'void'
                          order by e.created_at desc limit 1)) as eta
      ) z on z.eta is not null
      where r.rule_code = 'ETA_LATE_RESOURCES'
        and g.sta is not null and g.std is not null
        and d.status not in ('cancelled','completed','closed','departed','arrived')
        and z.eta - g.sta >= make_interval(mins => coalesce(r.threshold_minutes, 15))
      union all
      -- GROUND_TIME_BELOW_MIN: time between aircraft arrival (actual On Block, else scheduled) and scheduled departure is below the owner-approved minimum for the aircraft body class. Unclassified aircraft types are skipped. States facts only, never a cause.
      select g.arrival_leg_id, a.flight_number, r.id, r.rule_code, r.base_level, r.action_ar,
             'زمن الأرضية المتاح للرحلة ' || a.flight_number || ' نحو ' || round(extract(epoch from (g.std - g.clock_start)) / 60)::int ||
               ' دقيقة (من ' || to_char(g.clock_start at time zone 'UTC','HH24:MI') || ' إلى ' || to_char(g.std at time zone 'UTC','HH24:MI') || ' UTC)، وهو أقل من الحد الأدنى ' || m.min_minutes ||
               ' دقيقة لطائرة ' || case m.body_class when 'wide' then 'عريضة البدن' else 'ضيقة البدن' end || '. الإقلاع المتوقع المقترح ' || to_char(greatest(g.std, g.clock_start + make_interval(mins => greatest(g.planned_ground_minutes, m.min_minutes))) at time zone 'UTC','HH24:MI') || ' UTC',
             g.clock_start
      from r
      join v_ground_clock g on g.company_id = p_company_id
      join flights a on a.id = g.arrival_leg_id
      join flights d on d.id = g.departure_leg_id
      join aircraft_types t on t.id = a.aircraft_type_id
      join company_ground_time_minimums m on m.company_id = p_company_id and m.body_class = coalesce(t.body_class, 'narrow') and m.status = 'approved'
      where r.rule_code = 'GROUND_TIME_BELOW_MIN'
        and g.clock_start is not null and g.std is not null
        and d.status not in ('cancelled','completed','closed','departed','arrived')
        and round(extract(epoch from (g.std - g.clock_start)) / 60) < m.min_minutes
    )
    select * from cand
  loop
    out_flight_id := rec.fid; out_flight_number := rec.fno; out_rule_code := rec.rc; out_level := rec.lvl;
    out_reason_ar := rec.reason; out_action_ar := rec.act;
    out_dedup_key := rec.rc || ':' || rec.fid::text;
    out_inserted := false;
    if not p_dry_run then
      insert into flight_alerts(company_id, flight_id, rule_id, level, reason_ar, action_ar, dedup_key, due_at)
      values (p_company_id, rec.fid, rec.rid, rec.lvl, rec.reason, rec.act, out_dedup_key, rec.due)
      on conflict (company_id, dedup_key) where state <> 'resolved' do nothing
      returning id into v_id;
      if v_id is not null then
        insert into flight_alert_log(company_id, alert_id, event, actor_label, details)
        values (p_company_id, v_id, 'raised', 'SKYEYE', jsonb_build_object('rule', rec.rc, 'evaluated_at', p_now));
        out_inserted := true;
      end if;
      v_id := null;
    end if;
    return next;
  end loop;
end;
$function$;

-- Execute grants as on production: the three actions and the evaluator are callable by signed-in users and the service role (not anon).
revoke all on function public.acknowledge_flight_alert(uuid, uuid) from public, anon;
revoke all on function public.resolve_flight_alert(uuid, uuid, text) from public, anon;
revoke all on function public.snooze_flight_alert(uuid, uuid, integer, text) from public, anon;
revoke all on function public.evaluate_flight_alerts(uuid, timestamptz, boolean, boolean) from public, anon;
grant execute on function public.acknowledge_flight_alert(uuid, uuid) to authenticated, service_role;
grant execute on function public.resolve_flight_alert(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.snooze_flight_alert(uuid, uuid, integer, text) to authenticated, service_role;
grant execute on function public.evaluate_flight_alerts(uuid, timestamptz, boolean, boolean) to authenticated, service_role;

-- Cron: every 2 minutes (as on production). Re-scheduling the same job name replaces it.
select cron.schedule('skyeye-flight-alert-cycle', '*/2 * * * *', $$select private.run_flight_alert_cycle()$$);
