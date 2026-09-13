create or replace function public.nrd_set_product_consultation_credentials(p_login text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  login_id uuid;
  password_id uuid;
begin
  if nullif(btrim(p_login), '') is null or nullif(p_password, '') is null then
    raise exception 'Credenciais inválidas';
  end if;

  select id into login_id from vault.secrets where name = 'nrd_product_consultation_login' limit 1;
  if login_id is null then
    perform vault.create_secret(btrim(p_login), 'nrd_product_consultation_login', 'Acesso protegido da consulta de produtos do NRD');
  else
    perform vault.update_secret(login_id, btrim(p_login), 'nrd_product_consultation_login', 'Acesso protegido da consulta de produtos do NRD');
  end if;

  select id into password_id from vault.secrets where name = 'nrd_product_consultation_password' limit 1;
  if password_id is null then
    perform vault.create_secret(p_password, 'nrd_product_consultation_password', 'Senha protegida da consulta de produtos do NRD');
  else
    perform vault.update_secret(password_id, p_password, 'nrd_product_consultation_password', 'Senha protegida da consulta de produtos do NRD');
  end if;
end;
$$;

create or replace function public.nrd_get_product_consultation_credentials()
returns table(login text, password text)
language sql
security definer
set search_path = public, vault
as $$
  select
    max(decrypted_secret) filter (where name = 'nrd_product_consultation_login')::text as login,
    max(decrypted_secret) filter (where name = 'nrd_product_consultation_password')::text as password
  from vault.decrypted_secrets
  where name in ('nrd_product_consultation_login', 'nrd_product_consultation_password');
$$;

revoke all on function public.nrd_set_product_consultation_credentials(text, text) from public, anon, authenticated;
revoke all on function public.nrd_get_product_consultation_credentials() from public, anon, authenticated;
grant execute on function public.nrd_set_product_consultation_credentials(text, text) to service_role;
grant execute on function public.nrd_get_product_consultation_credentials() to service_role;
