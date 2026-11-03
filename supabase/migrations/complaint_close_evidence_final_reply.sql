-- Complaint files close on evidence that the FINAL reply was sent after the file entered final_reply_pending (permits keep reply_pending).
-- Tested inside a rolled-back transaction: no evidence rejected, old ack draft rejected, outbound after entry closes, permit regression unchanged.
create or replace function public.advance_request_stage(p_file_id uuid, p_to_stage text, p_note text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare f public.request_files%rowtype; s public.request_stages%rowtype; emp uuid; evidence boolean; t_rp timestamptz; v_entry text;
begin
  select * into f from public.request_files where id = p_file_id for update;
  if not found or not private.can_write(f.company_id) then raise exception 'not allowed'; end if;
  if f.status <> 'open' then raise exception 'request is already closed'; end if;
  if not exists (select 1 from public.request_stage_transitions where request_type = f.request_type and from_stage = f.current_stage and to_stage = p_to_stage) then raise exception 'transition not allowed'; end if;
  select * into s from public.request_stages where request_type = f.request_type and stage_code = p_to_stage;
  if p_to_stage = 'closed' then
    -- the stage whose entry time starts the evidence window: the final reply for a complaint, the reply to the authority for a permit
    v_entry := case f.request_type when 'complaint' then 'final_reply_pending' else 'reply_pending' end;
    select max(occurred_at) into t_rp from public.request_file_events where company_id = f.company_id and request_file_id = f.id and to_stage = v_entry;
    select exists (select 1 from public.request_file_messages rm join public.email_messages m on m.id = rm.message_id and m.company_id = rm.company_id
        where rm.request_file_id = f.id and rm.link_status = 'confirmed' and m.direction = 'outbound' and coalesce(m.sent_at, m.received_at) >= t_rp)
      or exists (select 1 from public.request_file_messages rm join public.email_reply_drafts d on d.message_id = rm.message_id and d.company_id = rm.company_id
        where rm.request_file_id = f.id and rm.link_status = 'confirmed' and d.status = 'approved' and d.sent_at is not null and d.sent_at >= t_rp)
      into evidence;
    if not coalesce(evidence, false) then
      if f.request_type = 'complaint' then
        raise exception 'closing a complaint needs evidence that the final reply was sent after the file reached final_reply_pending';
      else
        raise exception 'closing needs evidence that the reply was sent after the authority answered';
      end if;
    end if;
  end if;
  if p_to_stage = 'cancelled' and coalesce(trim(p_note),'') = '' then raise exception 'a reason is required to cancel'; end if;
  select e.id into emp from public.employees e join public.memberships m on m.id = e.membership_id
    where m.user_id = (select auth.uid()) and e.company_id = f.company_id and e.active limit 1;
  update public.request_files set current_stage = p_to_stage, last_event_at = now(), last_event_summary = s.label_en, next_action = s.next_action_en, updated_at = now(),
    status = case when p_to_stage = 'closed' then 'closed' when p_to_stage = 'cancelled' then 'cancelled' else 'open' end,
    closed_at = case when s.is_terminal then now() else null end where id = f.id;
  insert into public.request_file_events(company_id, request_file_id, from_stage, to_stage, actor_kind, actor_employee_id, note) values (f.company_id, f.id, f.current_stage, p_to_stage, 'employee', emp, nullif(trim(p_note),''));
  update public.exceptions set status = 'resolved', resolved_at = now(), updated_at = now()
   where company_id = f.company_id and source_id = f.id and status in ('open','acknowledged')
     and (source_type = 'request_stalled' or (s.is_terminal and source_type = 'request_due'));
end $function$;
