-- Phase 3: storage object policies for the admin media library.
--
-- Media uploads/edits happen in the admin app with the user's own session
-- (RLS-scoped browser client), not the service role. Buckets are named
-- media-{site_id} (spec §3) and created by the service role (seed now,
-- create-site.ts in Phase 5); site members of any role get full object CRUD
-- in their sites' buckets only. Public read stays as-is: the buckets are
-- public, served via /storage/v1/object/public/... URLs.

-- Map a bucket id back to its site id; null for foreign/malformed buckets so
-- policies fail closed instead of raising on the cast.
create or replace function public.bucket_site_id(p_bucket_id text)
returns uuid
language plpgsql immutable
as $$
begin
  if p_bucket_id not like 'media-%' then
    return null;
  end if;
  begin
    return substring(p_bucket_id from 7)::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;

revoke execute on function bucket_site_id(text) from public, anon;
grant execute on function bucket_site_id(text) to authenticated, service_role;

-- is_site_member(null) is false, so these cover only media-{uuid} buckets.
create policy media_objects_select on storage.objects for select to authenticated
  using (is_site_member(bucket_site_id(bucket_id)));
create policy media_objects_insert on storage.objects for insert to authenticated
  with check (is_site_member(bucket_site_id(bucket_id)));
create policy media_objects_update on storage.objects for update to authenticated
  using (is_site_member(bucket_site_id(bucket_id)))
  with check (is_site_member(bucket_site_id(bucket_id)));
create policy media_objects_delete on storage.objects for delete to authenticated
  using (is_site_member(bucket_site_id(bucket_id)));
