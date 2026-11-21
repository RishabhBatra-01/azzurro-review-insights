-- Grant table access to the server role.
--
-- This project's public schema does not carry Supabase's usual default
-- privileges, so the secret key (service_role) is denied by default. RLS is
-- still enabled on every table and no policy exists for anon/authenticated,
-- so this does not open anonymous access — only the server can read or write.

grant usage on schema public to service_role;

grant all privileges on table property       to service_role;
grant all privileges on table review         to service_role;
grant all privileges on table review_topic   to service_role;
grant all privileges on table collection_run to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Apply the same to anything added later by a future migration.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
