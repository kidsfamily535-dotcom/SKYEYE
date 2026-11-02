-- Applied on project nglooelpazkwxybucteo on 2026-11-02 (migration preferred_language_on_memberships).
alter table public.memberships
  add column if not exists preferred_language text not null default 'ar'
  check (preferred_language in ('ar','en'));

comment on column public.memberships.preferred_language is
  'UI language chosen by the user (ar|en). Only changes the interface; reply drafts stay English, codes and times stay UTC English.';

create or replace function public.set_my_language(p_lang text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_lang is null or p_lang not in ('ar','en') then raise exception 'unsupported language: %', p_lang; end if;
  update public.memberships set preferred_language = p_lang where user_id = auth.uid();
  return p_lang;
end $$;

create or replace function public.get_my_language()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select preferred_language from public.memberships where user_id = auth.uid() limit 1;
$$;

revoke all on function public.set_my_language(text) from public, anon;
revoke all on function public.get_my_language() from public, anon;
grant execute on function public.set_my_language(text) to authenticated;
grant execute on function public.get_my_language() to authenticated;
