-- =====================================================================
-- 014 — Sigilo dos totais agregados (grupos pequenos)
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 013_evolucao_nacional.sql).
-- Um "total" de um grupo com uma ou duas igrejas revela os números dessas igrejas.
-- Agora, nas visões do sínodo e nacional, quem NÃO tem jurisdição sobre o
-- presbitério deixa de ver os números de um grupo com menos de 3 relatórios
-- validados (presbitério + UF no painel; presbitério + ano na evolução).
-- Continua vendo quantas igrejas existem, quantos relatórios foram recebidos e
-- validados. Quem tem jurisdição (o próprio presbitério, o administrador do
-- sínodo dele, o nível nacional) continua vendo tudo, como antes.
-- =====================================================================

-- Mínimo de relatórios validados para um total ser mostrado a quem é de fora
create or replace function sigilo_minimo() returns int language sql immutable as $$ select 3 $$;

create or replace function painel_nacional(p_ano int)
returns table (
  sinodo_sigla text, sinodo_nome text, presbiterio_sigla text, presbiterio_nome text, uf text,
  igrejas int, recebidos int, validados int,
  rol numeric, n_rol int, comungantes numeric, n_comungantes int, nao_comungantes numeric, n_nao_comungantes int,
  alunos_ed numeric, n_alunos_ed int, admissoes numeric, demissoes numeric, n_movimento int, receita numeric, n_receita int
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not exists (select 1 from perfis where user_id = auth.uid()
                 and papel in ('superadmin', 'admin_nacional', 'admin_sinodal', 'admin_presbiterial')) then
    raise exception 'Visão nacional disponível apenas para administradores';
  end if;
  return query
  with fim_ano as (select make_date(p_ano, 12, 31) as d),
  unidades as (
    select v.presbiterio_id, i.id as igreja_id, i.uf
    from igrejas i join vinculos_igreja v on v.igreja_id = i.id, fim_ano
    where i.situacao <> 'inativa' and (i.tipo = 'igreja' or i.igreja_mae_id is null)
      and v.inicio <= fim_ano.d and (v.fim is null or v.fim > fim_ano.d)
    union
    select r.presbiterio_id, r.igreja_id, i.uf
    from relatorios r join igrejas i on i.id = r.igreja_id
    where r.ano = p_ano and r.status <> 'substituido'
  ),
  x as (
    select u.presbiterio_id, u.uf, r.status, r.dados
    from unidades u left join relatorios r
      on r.igreja_id = u.igreja_id and r.presbiterio_id = u.presbiterio_id and r.ano = p_ano and r.status <> 'substituido'
  ),
  g as (
    select s.sigla as g_ss, s.nome as g_sn, p.sigla as g_ps, p.nome as g_pn, p.id as g_pid, coalesce(nullif(x.uf, ''), '—') as g_uf,
      count(*)::int as g_igrejas, count(x.status)::int as g_recebidos, (count(*) filter (where x.status = 'validado'))::int as g_validados,
      sum((x.dados -> 'rol_atual' ->> 2)::numeric) filter (where x.status = 'validado') as g_rol,
      (count(x.dados -> 'rol_atual' ->> 2) filter (where x.status = 'validado'))::int as g_n_rol,
      sum((x.dados -> 'comungantes' -> 'ano_atual' ->> 2)::numeric) filter (where x.status = 'validado') as g_com,
      (count(x.dados -> 'comungantes' -> 'ano_atual' ->> 2) filter (where x.status = 'validado'))::int as g_n_com,
      sum((x.dados -> 'nao_comungantes' -> 'ano_atual' ->> 2)::numeric) filter (where x.status = 'validado') as g_nc,
      (count(x.dados -> 'nao_comungantes' -> 'ano_atual' ->> 2) filter (where x.status = 'validado'))::int as g_n_nc,
      sum((x.dados -> 'estrutura' ->> 'alunos_ed_atual')::numeric) filter (where x.status = 'validado') as g_ed,
      (count(x.dados -> 'estrutura' ->> 'alunos_ed_atual') filter (where x.status = 'validado'))::int as g_n_ed,
      sum(soma_bloco(x.dados -> 'comungantes' -> 'admissao')) filter (where x.status = 'validado') as g_adm,
      sum(soma_bloco(x.dados -> 'comungantes' -> 'demissao')) filter (where x.status = 'validado') as g_dem,
      (count(soma_bloco(x.dados -> 'comungantes' -> 'admissao')) filter (where x.status = 'validado'))::int as g_n_mov,
      sum((x.dados -> 'financeiro' -> 'realizado' ->> 'total_receita')::numeric) filter (where x.status = 'validado') as g_rec,
      (count(x.dados -> 'financeiro' -> 'realizado' ->> 'total_receita') filter (where x.status = 'validado'))::int as g_n_rec
    from x join presbiterios p on p.id = x.presbiterio_id
      join vinculos_presbiterio vp on vp.presbiterio_id = p.id
        and vp.inicio <= make_date(p_ano, 12, 31) and (vp.fim is null or vp.fim > make_date(p_ano, 12, 31))
      join sinodos s on s.id = vp.sinodo_id
    group by s.sigla, s.nome, p.sigla, p.nome, p.id, coalesce(nullif(x.uf, ''), '—')
  ),
  -- "aberto": quem consulta tem jurisdição sobre o presbitério, ou o grupo tem relatórios suficientes
  a as (select g.*, (pode_ver(null, g.g_pid) or g.g_validados >= sigilo_minimo()) as g_aberto from g)
  select a.g_ss, a.g_sn, a.g_ps, a.g_pn, a.g_uf, a.g_igrejas, a.g_recebidos, a.g_validados,
    case when a.g_aberto then a.g_rol end, case when a.g_aberto then a.g_n_rol else 0 end,
    case when a.g_aberto then a.g_com end, case when a.g_aberto then a.g_n_com else 0 end,
    case when a.g_aberto then a.g_nc end, case when a.g_aberto then a.g_n_nc else 0 end,
    case when a.g_aberto then a.g_ed end, case when a.g_aberto then a.g_n_ed else 0 end,
    case when a.g_aberto then a.g_adm end, case when a.g_aberto then a.g_dem end, case when a.g_aberto then a.g_n_mov else 0 end,
    case when a.g_aberto then a.g_rec end, case when a.g_aberto then a.g_n_rec else 0 end
  from a;
end;
$$;

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
  ),
  g as (
    select v.a as g_a, s.sigla as g_ss, p.sigla as g_ps, p.id as g_pid, count(*) as g_n,
      sum(v.v_rol) as s1, count(v.v_rol)::int as c1, sum(v.v_rol_ant) as s2, count(v.v_rol_ant)::int as c2,
      sum(v.v_com) as s3, count(v.v_com)::int as c3, sum(v.v_com_ant) as s4, count(v.v_com_ant)::int as c4,
      sum(v.v_ed) as s5, count(v.v_ed)::int as c5, sum(v.v_ed_ant) as s6, count(v.v_ed_ant)::int as c6,
      sum(v.v_rec) as s7, count(v.v_rec)::int as c7
    from v join presbiterios p on p.id = v.pid
      join vinculos_presbiterio vp on vp.presbiterio_id = p.id
        and vp.inicio <= make_date(v.a, 12, 31) and (vp.fim is null or vp.fim > make_date(v.a, 12, 31))
      join sinodos s on s.id = vp.sinodo_id
    group by v.a, s.sigla, p.sigla, p.id
  ),
  a as (select g.*, (pode_ver(null, g.g_pid) or g.g_n >= sigilo_minimo()) as ok from g)
  select a.g_a, a.g_ss, a.g_ps,
    case when a.ok then a.s1 end, case when a.ok then a.c1 else 0 end, case when a.ok then a.s2 end, case when a.ok then a.c2 else 0 end,
    case when a.ok then a.s3 end, case when a.ok then a.c3 else 0 end, case when a.ok then a.s4 end, case when a.ok then a.c4 else 0 end,
    case when a.ok then a.s5 end, case when a.ok then a.c5 else 0 end, case when a.ok then a.s6 end, case when a.ok then a.c6 else 0 end,
    case when a.ok then a.s7 end, case when a.ok then a.c7 else 0 end
  from a;
end;
$$;

revoke all on function sigilo_minimo() from public, anon;
revoke all on function painel_nacional(int) from public, anon;
revoke all on function evolucao_nacional() from public, anon;
grant execute on function sigilo_minimo(), painel_nacional(int), evolucao_nacional() to authenticated;
