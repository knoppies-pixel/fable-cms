-- Phase 1 hardening follow-up:
-- 1. Hide sites.api_key_hash from admin-panel logins via column-level grants.
-- 2. Make the guard-before-updated_at trigger ordering explicit.
-- 3. Lock the RLS helper functions down to the roles that need them.

-- 1. authenticated may read every sites column except api_key_hash. Credential
-- material stays server-side: only service_role (the content API route) reads
-- the hash. Note: `select *` on sites now fails for authenticated — admin-app
-- queries must name their columns.
revoke select on sites from authenticated;
grant select (id, slug, name, domain, tokens, settings, created_at)
  on sites to authenticated;

-- 2. Multiple BEFORE UPDATE triggers on one table fire in alphabetical order.
-- The column guards must inspect OLD/NEW before any other trigger mutates the
-- row, and previously won that race only by accident of naming. The a_ prefix
-- pins them first; keep it if these triggers are ever renamed again.
alter trigger pages_editor_column_guard on pages
  rename to a_pages_editor_column_guard;
alter trigger sections_editor_column_guard on sections
  rename to a_sections_editor_column_guard;

-- 3. The membership helpers exist for RLS policies and the column-guard
-- triggers, which execute as the querying role (authenticated/service_role).
-- anon has no business probing them — page_site_id() would otherwise let
-- unauthenticated callers map page UUIDs to site UUIDs.
revoke execute on function is_site_member(uuid) from public, anon;
revoke execute on function has_site_role(uuid, text) from public, anon;
revoke execute on function page_site_id(uuid) from public, anon;
grant execute on function is_site_member(uuid) to authenticated, service_role;
grant execute on function has_site_role(uuid, text) to authenticated, service_role;
grant execute on function page_site_id(uuid) to authenticated, service_role;
