-- Phase 7: hardening — props revisions, activity log, form submissions.
--
-- Three additive tables. Grants are explicit per the Phase 1 convention
-- (default privileges give the API roles nothing), and every policy goes
-- through the security-definer membership helpers from Phase 1.

-- 1. section_revisions ------------------------------------------------------
-- Lightweight revision history: a BEFORE-image of a section's props captured
-- by trigger on every UPDATE that changes props (or section_type). Trigger-
-- based on purpose: no admin/service write path can forget to snapshot.
-- Deleting a section (or its page/site) cascades its history away — the
-- activity log keeps a copy of deleted sections' props for manual rescue.

create table section_revisions (
  id             bigint generated always as identity primary key,
  section_id     uuid not null references sections(id) on delete cascade,
  page_id        uuid not null,
  site_id        uuid not null references sites(id) on delete cascade,
  section_type   text not null,
  props          jsonb not null,
  saved_by       uuid,               -- auth.uid() of the editor; null = service/tooling
  saved_by_email text,               -- display convenience from the JWT; saved_by is authoritative
  created_at     timestamptz not null default now()
);

create index section_revisions_section_idx on section_revisions (section_id, id desc);
create index section_revisions_site_idx on section_revisions (site_id);

alter table section_revisions enable row level security;

-- Members read their site's history; nobody authenticated writes it directly —
-- rows are inserted by the trigger below (security definer) and pruned there.
create policy section_revisions_select on section_revisions for select to authenticated
  using (is_site_member(site_id));

grant select on section_revisions to authenticated;
grant select, insert, update, delete on section_revisions to service_role;

-- Keep the last N revisions per section. 20 saves of history is plenty for
-- "undo a bad edit" and keeps the table self-maintaining.
create or replace function public.tg_sections_snapshot_revision()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.props is distinct from old.props
     or new.section_type is distinct from old.section_type then
    insert into section_revisions
      (section_id, page_id, site_id, section_type, props, saved_by, saved_by_email)
    values
      (old.id, old.page_id, page_site_id(old.page_id), old.section_type,
       old.props, auth.uid(), nullif(auth.jwt() ->> 'email', ''));
    delete from section_revisions
      where section_id = old.id
        and id not in (
          select id from section_revisions
          where section_id = old.id
          order by id desc
          limit 20
        );
  end if;
  return null;
end;
$$;

revoke execute on function tg_sections_snapshot_revision() from public, anon;

-- AFTER trigger: fires only once the row change (and the a_-prefixed column
-- guards) have succeeded, so a rejected edit never leaves a phantom revision.
create trigger zz_sections_snapshot_revision
  after update on sections
  for each row execute function tg_sections_snapshot_revision();

-- 2. activity_log -----------------------------------------------------------
-- Who changed what, when — intent-level events written by the admin app
-- (server actions and media helpers), not by trigger: a reorder is one event,
-- not N row updates, and a seed/import run doesn't flood the log (those tools
-- keep their own committed artifacts as audit trail).

create table activity_log (
  id          bigint generated always as identity primary key,
  site_id     uuid not null references sites(id) on delete cascade,
  actor_id    uuid,                  -- null = system/tooling
  actor_email text,                  -- display convenience; actor_id is authoritative
  action      text not null,         -- 'section.save', 'page.publish', 'media.upload', ...
  entity_type text not null check (entity_type in ('site', 'page', 'section', 'media', 'submission')),
  entity_id   uuid,
  summary     text not null,         -- human sentence shown in the activity feed
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index activity_log_site_idx on activity_log (site_id, id desc);

alter table activity_log enable row level security;

-- Members read their site's log and may append events about themselves —
-- actor_id must be the caller, so nobody can forge entries as someone else.
-- No update/delete policies: the log is append-only for admin users.
create policy activity_log_select on activity_log for select to authenticated
  using (is_site_member(site_id));
create policy activity_log_insert on activity_log for insert to authenticated
  with check (is_site_member(site_id) and actor_id = auth.uid());

grant select, insert on activity_log to authenticated;
grant select, insert, update, delete on activity_log to service_role;

-- 3. form_submissions -------------------------------------------------------
-- Contact-form submissions, persisted. Site runtimes never talk to Supabase
-- (hard rule) — the site's /api/contact forwards to the admin's
-- /api/forms/[siteSlug] route (site-API-key authenticated), which inserts via
-- service role. Members read + delete through the admin; spam is stored but
-- flagged so nothing silently disappears.

create table form_submissions (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  page_slug  text,
  name       text not null,
  email      text not null,
  phone      text,
  message    text not null,
  spam       boolean not null default false,
  meta       jsonb not null default '{}',  -- ip, user agent, token age, email delivery result
  created_at timestamptz not null default now()
);

create index form_submissions_site_idx on form_submissions (site_id, created_at desc);

alter table form_submissions enable row level security;

create policy form_submissions_select on form_submissions for select to authenticated
  using (is_site_member(site_id));
create policy form_submissions_delete on form_submissions for delete to authenticated
  using (is_site_member(site_id));

grant select, delete on form_submissions to authenticated;
grant select, insert, update, delete on form_submissions to service_role;
