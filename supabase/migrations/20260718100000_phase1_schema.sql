-- Phase 1: full schema (spec §4), RLS policies, and column-restriction triggers.
--
-- Roles model:
--   studio_admin  — full CRUD on their sites' rows.
--   client_editor — read all rows of their site; update sections.props and pages.seo
--                   only; full media CRUD. Cannot create/delete pages or sections,
--                   cannot change section_type (enforced by trigger).
--   service_role  — bypasses RLS (seed scripts, content API route).

-- Tenancy ------------------------------------------------------------------

create table sites (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 'acme-plumbing'
  name          text not null,
  domain        text,                          -- 'acmeplumbing.co.za'
  tokens        jsonb not null default '{}',   -- design tokens (colors, type scale)
  settings      jsonb not null default '{}',   -- analytics IDs, social links, etc.
  api_key_hash  text not null,                 -- sha256 hex of the site's read-only content key
  created_at    timestamptz default now()
);

create table site_members (
  site_id   uuid references sites(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  role      text not null check (role in ('studio_admin','client_editor')),
  primary key (site_id, user_id)
);

-- Content ------------------------------------------------------------------

create table pages (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,
  slug         text not null,                  -- '/', '/about', '/services/gutters'
  title        text not null,
  seo          jsonb not null default '{}',    -- meta description, og image, noindex
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  sort_order   int not null default 0,         -- nav ordering
  updated_at   timestamptz default now(),
  unique (site_id, slug)
);

create table sections (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references pages(id) on delete cascade,
  section_type text not null,                  -- 'hero', 'feature_grid', 'testimonials'...
  props        jsonb not null default '{}',    -- validated against the registry's Zod schema
  sort_order   int not null,
  status       text not null default 'published' check (status in ('draft','published')),
  updated_at   timestamptz default now()
);

create table media (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  path       text not null,                    -- storage path
  alt        text default '',
  width      int, height int,
  created_at timestamptz default now()
);

create index site_members_user_id_idx on site_members (user_id);
create index pages_site_id_idx on pages (site_id);
create index sections_page_id_idx on sections (page_id);
create index media_site_id_idx on media (site_id);

-- Grants --------------------------------------------------------------------
-- This local stack's default privileges don't include DML for the API roles.
-- authenticated is constrained by the RLS policies below; service_role
-- bypasses RLS (seed, content API). anon gets nothing: all public content is
-- served via the API-key-checked /api/content route, not direct PostgREST.

grant select, insert, update, delete
  on sites, site_members, pages, sections, media
  to authenticated, service_role;

-- Membership helpers -------------------------------------------------------
-- security definer so policies on other tables can consult site_members
-- without tripping site_members' own RLS.

create or replace function public.is_site_member(p_site_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from site_members
    where site_id = p_site_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_site_role(p_site_id uuid, p_role text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from site_members
    where site_id = p_site_id and user_id = auth.uid() and role = p_role
  );
$$;

-- Sections hang off pages; resolve their site without invoking pages' RLS.
create or replace function public.page_site_id(p_page_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select site_id from pages where id = p_page_id;
$$;

-- RLS policies -------------------------------------------------------------

alter table sites        enable row level security;
alter table site_members enable row level security;
alter table pages        enable row level security;
alter table sections     enable row level security;
alter table media        enable row level security;

-- sites: members read; studio_admin update/delete. No insert policy —
-- sites are registered via service role (create-site.ts in Phase 5).
create policy sites_select on sites for select to authenticated
  using (is_site_member(id));
create policy sites_update on sites for update to authenticated
  using (has_site_role(id, 'studio_admin'))
  with check (has_site_role(id, 'studio_admin'));
create policy sites_delete on sites for delete to authenticated
  using (has_site_role(id, 'studio_admin'));

-- site_members: members see who else is on their site; only studio_admin manages.
create policy site_members_select on site_members for select to authenticated
  using (is_site_member(site_id));
create policy site_members_insert on site_members for insert to authenticated
  with check (has_site_role(site_id, 'studio_admin'));
create policy site_members_update on site_members for update to authenticated
  using (has_site_role(site_id, 'studio_admin'))
  with check (has_site_role(site_id, 'studio_admin'));
create policy site_members_delete on site_members for delete to authenticated
  using (has_site_role(site_id, 'studio_admin'));

-- pages: members read; both roles may UPDATE at the row level (the trigger below
-- restricts client_editor to the seo column); create/delete is studio_admin only.
create policy pages_select on pages for select to authenticated
  using (is_site_member(site_id));
create policy pages_insert on pages for insert to authenticated
  with check (has_site_role(site_id, 'studio_admin'));
create policy pages_update on pages for update to authenticated
  using (is_site_member(site_id))
  with check (is_site_member(site_id));
create policy pages_delete on pages for delete to authenticated
  using (has_site_role(site_id, 'studio_admin'));

-- sections: same shape as pages (trigger restricts client_editor to props).
create policy sections_select on sections for select to authenticated
  using (is_site_member(page_site_id(page_id)));
create policy sections_insert on sections for insert to authenticated
  with check (has_site_role(page_site_id(page_id), 'studio_admin'));
create policy sections_update on sections for update to authenticated
  using (is_site_member(page_site_id(page_id)))
  with check (is_site_member(page_site_id(page_id)));
create policy sections_delete on sections for delete to authenticated
  using (has_site_role(page_site_id(page_id), 'studio_admin'));

-- media: full CRUD for every member of the site (client_editor included).
create policy media_select on media for select to authenticated
  using (is_site_member(site_id));
create policy media_insert on media for insert to authenticated
  with check (is_site_member(site_id));
create policy media_update on media for update to authenticated
  using (is_site_member(site_id))
  with check (is_site_member(site_id));
create policy media_delete on media for delete to authenticated
  using (is_site_member(site_id));

-- Column-restriction triggers ----------------------------------------------
-- RLS is row-level only; these enforce the column-level part of the policy
-- intent. auth.uid() is null for service_role and direct psql — skip those.

create or replace function public.tg_pages_editor_column_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or has_site_role(old.site_id, 'studio_admin') then
    return new;
  end if;
  if new.site_id      is distinct from old.site_id
  or new.slug         is distinct from old.slug
  or new.title        is distinct from old.title
  or new.status       is distinct from old.status
  or new.published_at is distinct from old.published_at
  or new.sort_order   is distinct from old.sort_order then
    raise exception 'client_editor may only update pages.seo'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger pages_editor_column_guard
  before update on pages
  for each row execute function tg_pages_editor_column_guard();

create or replace function public.tg_sections_editor_column_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or has_site_role(page_site_id(old.page_id), 'studio_admin') then
    return new;
  end if;
  if new.page_id      is distinct from old.page_id
  or new.section_type is distinct from old.section_type
  or new.sort_order   is distinct from old.sort_order
  or new.status       is distinct from old.status then
    raise exception 'client_editor may only update sections.props'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sections_editor_column_guard
  before update on sections
  for each row execute function tg_sections_editor_column_guard();

-- updated_at maintenance ----------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pages_set_updated_at
  before update on pages
  for each row execute function tg_set_updated_at();

create trigger sections_set_updated_at
  before update on sections
  for each row execute function tg_set_updated_at();
