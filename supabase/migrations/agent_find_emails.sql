-- Read-only email search for the agent chat. Same pattern as agent_find_files: SECURITY INVOKER (RLS still applies to
-- ordinary users), always filtered by p_company, adds nothing and changes nothing.
create or replace function public.agent_find_emails(
  p_company uuid,
  p_tokens text[] default array[]::text[],
  p_from text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_direction text default null,
  p_limit integer default 5
)
returns table(
  id uuid, thread_id uuid, direction text, from_address text, subject text, sent_at timestamptz,
  has_attachments boolean, snippet text, score integer, attachments jsonb
)
language sql
stable
set search_path to 'public'
as $function$
  with t as (
    select distinct upper(trim(x)) as tok
    from unnest(coalesce(p_tokens, array[]::text[])) x
    where upper(trim(x)) ~ '^[A-Z0-9]{3,}$'
  ),
  m as (
    select e.*,
      regexp_replace(upper(coalesce(e.subject, '')), '[^A-Z0-9]', '', 'g') as csub,
      regexp_replace(upper(coalesce(e.new_text, e.body_text, '')), '[^A-Z0-9]', '', 'g') as cbody,
      coalesce((select string_agg(regexp_replace(upper(a.filename), '[^A-Z0-9]', '', 'g'), ' ')
                  from public.email_attachments a where a.message_id = e.id), '') as catt
    from public.email_messages e
    where e.company_id = p_company
      and (p_direction is null or e.direction = p_direction)
      and (nullif(btrim(p_from), '') is null or e.from_address ilike '%' || btrim(p_from) || '%')
      and (p_date_from is null or coalesce(e.sent_at, e.received_at, e.created_at) >= p_date_from)
      and (p_date_to is null or coalesce(e.sent_at, e.received_at, e.created_at) < p_date_to)
  ),
  h as (
    select m.*,
      (select count(*) from t where m.csub like '%' || t.tok || '%')::int as sh,
      (select count(*) from t where m.cbody like '%' || t.tok || '%')::int as bh,
      (select count(*) from t where m.catt like '%' || t.tok || '%')::int as ah,
      (select count(*) from t)::int as nt
    from m
  )
  select h.id, h.thread_id, h.direction, h.from_address, h.subject,
         coalesce(h.sent_at, h.received_at, h.created_at),
         coalesce(h.has_attachments, false),
         left(coalesce(h.new_text, h.body_text, ''), 600),
         (h.sh * 3 + h.ah * 2 + h.bh)::int,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'attachment_id', a.id, 'filename', a.filename, 'content_type', a.content_type,
                     'size_bytes', a.size_bytes, 'extraction_status', a.extraction_status,
                     'file_id', (select f.id from public.company_files f
                                  where f.company_id = p_company and f.source = 'email' and f.source_attachment_id = a.id limit 1))
                   order by a.created_at)
                    from public.email_attachments a where a.message_id = h.id and a.skipped_reason is null), '[]'::jsonb)
  from h
  where h.nt = 0 or (h.sh + h.bh + h.ah) >= 1
  order by (h.sh * 3 + h.ah * 2 + h.bh) desc, coalesce(h.sent_at, h.received_at, h.created_at) desc
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
$function$;
comment on function public.agent_find_emails(uuid, text[], text, timestamptz, timestamptz, text, integer) is
  'Read-only email lookup for the agent chat: by sender, date range, direction and subject/body/attachment-name tokens, scoped to one company.';
