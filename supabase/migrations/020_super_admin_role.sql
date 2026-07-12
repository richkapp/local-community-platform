-- PostgreSQL enum values must be committed before later migrations can use them.
alter type public.member_role add value if not exists 'super_admin';
