-- Exclusão de conta pelo próprio usuário (enunciado §24/§32).
-- Remove auth.users; cascatas apagam todos os dados via FKs on delete cascade.
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end; $$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
