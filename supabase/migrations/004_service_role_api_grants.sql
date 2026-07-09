-- Service role still needs SQL grants when Data API auto-exposure is disabled.
-- RLS bypasses policies for service_role, but PostgREST cannot access tables without privileges.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
