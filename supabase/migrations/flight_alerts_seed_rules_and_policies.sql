-- Seed of the global (company_id null) alert rules and escalation policies as on production, exported 2026-11-03.
-- Idempotent: a row is inserted only if the same (company, rule_code) / (company, from_level) does not exist.
-- The final state of escalates for GROUND_TIME_BELOW_MIN (false) is set by flight_alert_ground_time_no_escalation.sql.

insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'DAMAGE_OR_INCIDENT', 'ضرر على الطائرة أو معدات', 'damage_or_incident', '{scheduled,charter,cargo,private,ferry}'::text[], 'L4', null, 'وقف العمل وإخطار الشركة والسلامة', 'ops_manager', 'draft', 'doc §6 (proposed)', null, true
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'DAMAGE_OR_INCIDENT');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'DOC_OR_PERMIT_GAP', 'وثيقة أو تصريح ناقص قبل الوصول', 'doc_or_permit_gap', '{charter,private,ferry,cargo}'::text[], 'L2', null, 'إكمال الوثيقة أو طلب تمديد', 'ops_officer', 'draft', 'doc §6 (proposed)', null, true
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'DOC_OR_PERMIT_GAP');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'ETA_LATE_RESOURCES', 'تأخر الوصول يغيّر خطة الموارد', 'eta_late_resource_change', '{scheduled,charter,cargo,private}'::text[], 'L2', 15, 'إعادة توزيع الموارد وتحديث ETD المتوقع', 'ramp_supervisor', 'approved', 'PROPOSED 15 min (same as other rules); needs owner approval', null, true
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'ETA_LATE_RESOURCES');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'GROUND_TIME_BELOW_MIN', 'زمن الأرضية المتوقع أقل من الحد الأدنى', 'ground_time_below_min', '{scheduled,charter,cargo,private}'::text[], 'L2', null, 'تحديد ETD جديد وإبلاغ الشركة', 'shift_supervisor', 'approved', 'doc §3, §6 (proposed)', null, false
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'GROUND_TIME_BELOW_MIN');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'NO_LANDING_INFO_AFTER_ETA', 'غياب معلومة الهبوط بعد ETA', 'no_landing_info_after_eta', '{scheduled,charter,cargo,private}'::text[], 'L3', 15, 'التحقق من المنشأ أو برج المراقبة', 'shift_supervisor', 'approved', 'doc §6 (proposed)', null, true
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'NO_LANDING_INFO_AFTER_ETA');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'NO_MVT_AFTER_ORIGIN_ETD', 'لا رسالة MVT بعد إقلاع المنشأ', 'no_mvt_after_origin_dep', '{scheduled,charter,cargo,private}'::text[], 'L2', 15, 'اعتماد وإرسال RQM لمحطة المنشأ', 'ops_officer', 'approved', 'SKYEYE flight rules doc §6; 15 min approved by owner', 15, false
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'NO_MVT_AFTER_ORIGIN_ETD');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'PAX_BOARDING_ISSUE', 'ركاب ناقصون أو مشكلة صعود', 'pax_boarding_issue', '{scheduled,charter}'::text[], 'L2', null, 'قرار الانتظار أو إنزال الأمتعة', 'pax_supervisor', 'draft', 'doc §6 (proposed)', null, true
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'PAX_BOARDING_ISSUE');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'PRIORITY_FLIGHT', 'رحلة بأولوية قصوى (إسعاف/حكومي)', 'priority_flight', '{medevac,government}'::text[], 'L3', null, 'تنبيه مدير المناوبة وتحضير مسبق', 'shift_supervisor', 'draft', 'doc §4, §6 (proposed)', null, true
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'PRIORITY_FLIGHT');
insert into public.flight_alert_rules (company_id, rule_code, name_ar, trigger_kind, applies_to, base_level, threshold_minutes, action_ar, owner_role, status, source_ref, repeat_minutes, escalates)
  select null, 'SERVICE_NOT_STARTED', 'خدمة لم تبدأ في موعدها', 'service_not_started', '{scheduled,charter,cargo,private}'::text[], 'L2', null, 'إرسال فريق الخدمة', 'ramp_supervisor', 'approved', 'doc §6 (proposed)', null, true
  where not exists (select 1 from public.flight_alert_rules x where x.company_id is null and x.rule_code = 'SERVICE_NOT_STARTED');

insert into public.escalation_policies (company_id, from_level, ack_minutes, escalate_to_level, escalate_to_role, status, source_ref)
  select null, 'L2', 10, 'L3', 'shift_supervisor', 'approved', 'doc §6 (proposed)'
  where not exists (select 1 from public.escalation_policies x where x.company_id is null and x.from_level = 'L2');
insert into public.escalation_policies (company_id, from_level, ack_minutes, escalate_to_level, escalate_to_role, status, source_ref)
  select null, 'L3', 10, 'L4', 'ops_manager', 'approved', 'doc §6 (proposed)'
  where not exists (select 1 from public.escalation_policies x where x.company_id is null and x.from_level = 'L3');
