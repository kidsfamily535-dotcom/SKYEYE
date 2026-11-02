-- Applied live on project nglooelpazkwxybucteo (migration agent_company_chat_v1).
-- Company-wide chat: target_type 'company' with target_id = company id; created_by now filled from auth.uid().
alter table public.agent_commands drop constraint agent_commands_target_type_check;
alter table public.agent_commands add constraint agent_commands_target_type_check
  check (target_type = any (array['email_message','email_triage','reply_draft','request_file','permit','flight','exception','attachment','company']));
-- send_agent_command(...) was replaced: see the function in the database for the full body
-- (adds the 'company' rules: only answer_question, target_id must equal company_id; inserts created_by = auth.uid()).
