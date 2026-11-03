-- 1) Manual ETA: private.record_step_core accepts ETA_UPDATE with a FUTURE time (an ETA is by nature in the future).
--    Every actual time (ATA, ATD, other steps) is still refused if it is in the future.
-- 2) Recording ATD / ATA by hand now moves the flight status (departed / arrived), the same rule review_parsed_message already used.
-- 3) public.v_flights.eta = the LAST ETA entered (by created_at), not the latest time value, so a revised ETA that is earlier wins.
-- Tested in rolled-back transactions on TESTGH: future ETA accepted, last-entered ETA shown, future ATA/ATD refused, duplicate ATA refused,
-- status scheduled -> on_ground -> departed, ground minutes computed, v_flights keeps security_invoker=true, member still reads v_flight_file.
create or replace function private.record_step_core(p_flight_id uuid, p_step text, p_at timestamp with time zone, p_emp uuid, p_note text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  f record; v_arr uuid; v_dep uuid; v_target uuid; v_tpl record; v_ev uuid;
  v_ttype text; v_warn jsonb := '[]'::jsonb; v_code text; v_arrival_track boolean;
begin
  select * into f from public.flights where id = p_flight_id;
  if not found then raise exception 'flight not found'; end if;
  select g.arrival_leg_id, g.departure_leg_id into v_arr, v_dep
    from public.v_ground_clock g where g.company_id = f.company_id and (g.arrival_leg_id = f.id or g.departure_leg_id = f.id);
  if v_arr is null or v_dep is null then raise exception 'flight rotation is incomplete'; end if;

  if p_at is null then raise exception 'actual time is required'; end if;
  -- an expected arrival time (ETA) is by nature in the future; every actual time is not
  if p_step <> 'ETA_UPDATE' and p_at > now() + interval '5 minutes' then raise exception 'time is in the future'; end if;

  v_ttype := case f.operator_type when 'cargo' then 'cargo' when 'private' then 'private' else 'normal' end;
  select * into v_tpl from public.turnaround_milestone_templates
    where turnaround_type = v_ttype and step_code = p_step and status <> 'retired' limit 1;
  if not found and p_step not in ('ATA','ATD','ETA_UPDATE') then raise exception 'unknown step'; end if;

  v_arrival_track := p_step in ('ATA','ETA_UPDATE') or coalesce(v_tpl.track,'') in ('RAMP_ARRIVAL','PAX_ARRIVAL','BAG_ARRIVAL','CARGO_ARRIVAL');
  v_target := case when v_arrival_track then v_arr else v_dep end;

  if p_step <> 'ETA_UPDATE' and exists (
    select 1 from public.flight_events e
    where e.company_id = f.company_id and e.event_type = p_step and e.status <> 'void' and e.flight_id in (v_arr, v_dep)
  ) then raise exception 'already recorded'; end if;

  if v_tpl.after_step_codes is not null then
    foreach v_code in array v_tpl.after_step_codes loop
      if not exists (select 1 from public.flight_events e
                     where e.company_id = f.company_id and e.event_type = v_code and e.status <> 'void' and e.flight_id in (v_arr, v_dep)) then
        v_warn := v_warn || to_jsonb(v_code);
      end if;
    end loop;
  end if;

  insert into public.flight_events (company_id, flight_id, event_type, occurred_at, actor_employee_id, source, status, details)
  values (f.company_id, v_target, p_step, p_at, p_emp, 'employee', 'recorded',
          case when nullif(btrim(coalesce(p_note,'')),'') is null then '{}'::jsonb else jsonb_build_object('note', btrim(p_note)) end)
  returning id into v_ev;

  -- the flight status follows the actual times, same rule as approving a parsed MVT message
  if p_step = 'ATD' then
    update public.flights set status = 'departed', updated_at = now()
     where company_id = f.company_id and id = v_dep and status in ('scheduled','delayed');
  elsif p_step = 'ATA' then
    update public.flights set status = 'arrived', updated_at = now()
     where company_id = f.company_id and id = v_arr and status in ('scheduled','delayed','departed');
  end if;

  update public.turnaround_checkins
     set status = 'confirmed', answer = 'yes', actual_time = p_at, answered_at = now(), answered_by = p_emp,
         note = coalesce(nullif(btrim(coalesce(p_note,'')),''), note)
   where flight_id = v_dep and step_code = p_step and status in ('scheduled','asked','in_progress','late','escalated');

  if p_step in ('ON_BLOCK','CHOCKS_ON') then
    perform private.generate_turnaround_checkins(v_dep);
    perform private.rebase_turnaround_checkins(v_dep);
  end if;

  return jsonb_build_object('event_id', v_ev, 'missing_predecessors', v_warn);
end $function$;

-- v_flights: identical to the previous definition except the ETA lateral (last entered, not max time)
create or replace view public.v_flights with (security_invoker = true) as
 SELECT a.company_id,
    a.rotation_id AS flight_id,
    a.id AS arrival_leg_id,
    d.id AS departure_leg_id,
    a.company_airline_id,
    a.flight_date AS date_in,
    d.flight_date AS date_out,
    to_char(a.flight_date::timestamp with time zone, 'DY'::text) AS weekday_in,
    a.flight_number AS flight_in,
    d.flight_number AS flight_out,
    a.callsign AS callsign_in,
    d.callsign AS callsign_out,
    COALESCE(a.registration, d.registration) AS registration,
    COALESCE(a.aircraft_type_id, d.aircraft_type_id) AS aircraft_type_id,
    org.iata_code AS origin,
    stn.iata_code AS station,
    dst.iata_code AS destination,
    a.scheduled_arrival AS sta,
    d.scheduled_departure AS std,
    eta.t AS eta,
    ata.t AS ata,
    atd.t AS atd,
    round(EXTRACT(epoch FROM d.scheduled_departure - a.scheduled_arrival) / 60::numeric)::integer AS planned_ground_minutes,
    round(EXTRACT(epoch FROM atd.t - ata.t) / 60::numeric)::integer AS actual_ground_minutes,
        CASE
            WHEN a.status = 'cancelled'::text OR d.status = 'cancelled'::text THEN 'cancelled'::text
            WHEN a.status = 'diverted'::text OR d.status = 'diverted'::text THEN 'diverted'::text
            WHEN d.status = 'departed'::text THEN 'departed'::text
            WHEN d.status = 'arrived'::text THEN 'completed'::text
            WHEN a.status = 'arrived'::text THEN 'on_ground'::text
            WHEN a.status = 'departed'::text THEN 'inbound'::text
            WHEN a.status = 'delayed'::text OR d.status = 'delayed'::text THEN 'delayed'::text
            ELSE 'scheduled'::text
        END AS status,
    a.origin_std,
    oatd.t AS origin_atd
   FROM flights a
     JOIN flights d ON d.company_id = a.company_id AND d.rotation_id = a.rotation_id AND d.direction = 'departure'::text
     LEFT JOIN airports org ON org.id = a.origin_airport_id
     LEFT JOIN airports stn ON stn.id = a.destination_airport_id
     LEFT JOIN airports dst ON dst.id = d.destination_airport_id
     -- the ETA is the LAST one entered (a revised ETA may be earlier than the one before it)
     LEFT JOIN LATERAL ( SELECT (array_agg(e.occurred_at ORDER BY e.created_at DESC, e.id DESC))[1] AS t
           FROM flight_events e
          WHERE e.company_id = a.company_id AND e.flight_id = a.id AND e.event_type = 'ETA_UPDATE'::text AND e.status <> 'void'::text) eta ON true
     LEFT JOIN LATERAL ( SELECT min(e.occurred_at) AS t
           FROM flight_events e
          WHERE e.company_id = a.company_id AND e.flight_id = a.id AND e.event_type = 'ATA'::text AND e.status <> 'void'::text) ata ON true
     LEFT JOIN LATERAL ( SELECT min(e.occurred_at) AS t
           FROM flight_events e
          WHERE e.company_id = d.company_id AND e.flight_id = d.id AND e.event_type = 'ATD'::text AND e.status <> 'void'::text) atd ON true
     LEFT JOIN LATERAL ( SELECT min(e.occurred_at) AS t
           FROM flight_events e
          WHERE e.company_id = a.company_id AND e.flight_id = a.id AND e.event_type = 'ATD'::text AND e.status <> 'void'::text) oatd ON true
  WHERE a.direction = 'arrival'::text AND a.rotation_id IS NOT NULL;
