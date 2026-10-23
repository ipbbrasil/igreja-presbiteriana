-- =====================================================================
-- 012 — Transparência: quem mais pode ver os dados do presbitério
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 011_restricao.sql).
-- Lista as contas de nível superior que, pelas regras de acesso, podem consultar
-- os relatórios das igrejas do presbitério: superadministrador, administrador
-- nacional e administrador sinodal do sínodo ao qual o presbitério pertence.
-- Somente leitura: o administrador do presbitério não pode alterar esses acessos.
-- =====================================================================

create or replace function listar_acessos_superiores()
returns table (user_id uuid, nome text, email text, papel text, abrangencia text, ultimo_acesso timestamptz)
language sql stable security definer set search_path = public as $$
  select pf.user_id, pf.nome, u.email::text, pf.papel,
         case pf.papel when 'admin_sinodal' then coalesce(s.nome, 'sínodo') else 'todos os presbitérios' end,
         u.last_sign_in_at
  from perfis pf join auth.users u on u.id = pf.user_id left join sinodos s on s.id = pf.sinodo_id
  where eh_admin_presb(meu_presbiterio()) and (
    pf.papel in ('superadmin', 'admin_nacional')
    or (pf.papel = 'admin_sinodal' and pf.sinodo_id = (select sinodo_id from presbiterios where id = meu_presbiterio()))
  )
  order by case pf.papel when 'superadmin' then 1 when 'admin_nacional' then 2 else 3 end, pf.nome;
$$;

revoke all on function listar_acessos_superiores() from public, anon;
grant execute on function listar_acessos_superiores() to authenticated;
