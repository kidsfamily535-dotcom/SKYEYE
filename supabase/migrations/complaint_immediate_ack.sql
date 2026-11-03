-- Applied to production 2026-11-03 (Supabase project nglooelpazkwxybucteo).
-- Owner decision: a complaint's first (immediate) reply is receipt + "investigation started" only.
-- Removes the rule that forced complaints to have a substantive reply; keeps "complaint must be urgent".
do $m$
declare
  d text;
  d2 text;
  needle text := E'  if cat = ''complaint'' and rkind <> ''substantive'' then\n    bad := bad || to_jsonb(''a complaint or incident needs a substantive reply, not only a receipt''::text); end if;\n';
begin
  d := pg_get_functiondef('public.save_email_triage(uuid,uuid,jsonb)'::regprocedure);
  d2 := replace(d, needle, '');
  if d2 = d then
    raise exception 'needle not found: save_email_triage was not changed';
  end if;
  execute d2;
end
$m$;
