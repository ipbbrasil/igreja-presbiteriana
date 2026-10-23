-- =====================================================================
-- 013 — Evolução histórica nas visões do sínodo e nacional
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 012_acessos_superiores.sql).
-- Devolve, por exercício e por presbitério, somente TOTAIS de relatórios validados
-- (com quantas igrejas informaram cada número), incluindo o "ano anterior" informado
-- nos relatórios. Cada ano é atribuído ao sínodo vigente no fim daquele ano.
-- =====================================================================

create or replace function evolucao_nacional()
returns table (
  ano int, sinodo_sigla text, presbiterio_sigla text,
  rol numeric, n_rol int, rol_ant numeric, n_rol_ant int,
  com numeric, n_com int, com_ant numeric, n_com_ant int,
  ed numeric, n_ed int, ed_ant numeric, n_ed_ant int,
  rec numeric, n_rec int
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not exists (select 1 from perfis where user_id = auth.uid()
                 and papel in ('superadmin', 'admin_nacional', 'admin_sinodal', 'admin_presbiterial')) then
    raise exception 'Evolução nacional disponível apenas para administradores';
  end if;
  return query
  with v as (
    select r.ano as a, r.presbiterio_id as pid,
      (r.dados -> 'rol_atual' ->> 2)::numeric as v_rol,
      (r.dados -> 'comungantes' -> 'ano_anterior' ->> 2)::numeric + (r.dados -> 'nao_comungantes' -> 'ano_anterior' ->> 2)::numeric as v_rol_ant,
      (r.dados -> 'comungantes' -> 'ano_atual' ->> 2)::numeric as v_com,
      (r.dados -> 'comungantes' -> 'ano_anterior' ->> 2)::numeric as v_com_ant,
      (r.dados -> 'estrutura' ->> 'alunos_ed_atual')::numeric as v_ed,
      (r.dados -> 'estrutura' ->> 'alunos_ed_anterior')::numeric as v_ed_ant,
      (r.dados -> 'financeiro' -> 'realizado' ->> 'total_receita')::numeric as v_rec
    from relatorios r where r.status = 'validado'
  )
  select v.a, s.sigla, p.sigla,
    sum(v.v_rol), count(v.v_rol)::int, sum(v.v_rol_ant), count(v.v_rol_ant)::int,
    sum(v.v_com), count(v.v_com)::int, sum(v.v_com_ant), count(v.v_com_ant)::int,
    sum(v.v_ed), count(v.v_ed)::int, sum(v.v_ed_ant), count(v.v_ed_ant)::int,
    sum(v.v_rec), count(v.v_rec)::int
  from v join presbiterios p on p.id = v.pid
    join vinculos_presbiterio vp on vp.presbiterio_id = p.id
      and vp.inicio <= make_date(v.a, 12, 31) and (vp.fim is null or vp.fim > make_date(v.a, 12, 31))
    join sinodos s on s.id = vp.sinodo_id
  group by v.a, s.sigla, p.sigla;
end;
$$;

revoke all on function evolucao_nacional() from public, anon;
grant execute on function evolucao_nacional() to authenticated;
