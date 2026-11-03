-- Owner decision (2026-11-03): GROUND_TIME_BELOW_MIN is a planning alert, not an emergency. It never escalates on a timer.
-- Applied to production the same day. This file is the repeatable version.
-- 1) the rule stops escalating, 2) any open alert of that rule that was escalated is put back to its base level with a log line.
-- The old 'escalated' log rows are kept. Alerts stay open: closing them is a human decision.

update public.flight_alert_rules set escalates = false, updated_at = now()
 where rule_code = 'GROUND_TIME_BELOW_MIN' and escalates is distinct from false;

with reset as (
  update public.flight_alerts a
     set level = r.base_level, updated_at = now()
    from public.flight_alert_rules r
   where r.id = a.rule_id and r.rule_code = 'GROUND_TIME_BELOW_MIN'
     and a.state <> 'resolved' and a.level <> r.base_level
  returning a.id, a.company_id, a.level
)
insert into public.flight_alert_log (company_id, alert_id, event, actor_label, details)
select company_id, id, 'level_reset', 'SKYEYE', jsonb_build_object('to', level, 'reason', 'owner decision: planning alert, no timer escalation')
  from reset;
