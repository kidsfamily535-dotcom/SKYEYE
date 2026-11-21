-- Applied to the project as migration "otp_radar_wrapper" (2026-11-21). Read-only, membership-checked, no direct table access for the app.
create or replace function public.otp_radar()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_company uuid;
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  select m.company_id into v_company from public.memberships m where m.user_id = auth.uid() limit 1;
  if v_company is null or not private.is_member(v_company) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'now', now(), 'company_id', v_company,
    'turns', coalesce((select jsonb_agg(s.x order by s.ib) from (
        select jsonb_build_object('turn_id', t.id, 'flight_in', t.flight_in, 'flight_out', t.flight_out, 'registration', t.registration,
          'stand', t.stand, 'body_class', t.body_class, 'is_demo', t.is_demo, 'in_block_at', t.in_block_at, 'std', t.std,
          'snapshot', otp.turn_snapshot_v2(t.id, now())) x, t.in_block_at ib
        from otp.turns t
        where t.company_id = v_company and t.in_block_at is not null and t.in_block_at > now() - interval '8 hours'
        order by t.in_block_at desc limit 12) s), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'turn_id', n.turn_id, 'milestone_code', n.milestone_code,
        'kind', n.kind, 'severity', n.severity, 'title', n.title, 'body', n.body, 'status', n.status, 'created_at', n.created_at) order by n.created_at desc)
      from (select * from otp.notifications where company_id = v_company and created_at > now() - interval '24 hours' order by created_at desc limit 40) n), '[]'::jsonb));
end $$;
revoke execute on function public.otp_radar() from public, anon;
grant execute on function public.otp_radar() to authenticated, service_role;
