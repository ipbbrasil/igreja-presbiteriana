-- =====================================================================
-- 009 — Visão nacional (Nacional → Sínodo → Presbitério → Igreja)
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 008_auditoria.sql).
-- Devolve apenas TOTAIS AGREGADOS por presbitério e UF (nunca dados de uma igreja),
-- somente de relatórios validados, com a cobertura de cada número. O detalhe das
-- igrejas continua restrito a quem tem jurisdição (regras de acesso dos relatórios).
-- =====================================================================

-- Soma dos totais de um bloco de movimentação (admissões ou demissões), ignorando linhas de detalhe
create or replace function soma_bloco(b jsonb) returns numeric language sql immutable as $$
  select sum((v ->> 2)::numeric) from jsonb_each(coalesce(b, '{}'::jsonb)) e(k, v)
  where jsonb_typeof(v) = 'array' and k not in ('exclusao_a_pedido', 'exclusao_por_ausencia') and v ->> 2 is not null;
$$;

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
  unidades as (   -- quem deveria enviar relatório naquele exercício (vínculo vigente no fim do ano)
    select v.presbiterio_id, i.id as igreja_id, i.uf
    from igrejas i join vinculos_igreja v on v.igreja_id = i.id, fim_ano
    where i.situacao <> 'inativa' and (i.tipo = 'igreja' or i.igreja_mae_id is null)
      and v.inicio <= fim_ano.d and (v.fim is null or v.fim > fim_ano.d)
    union
    select r.presbiterio_id, r.igreja_id, i.uf   -- e quem enviou, mesmo que o cadastro tenha mudado depois
    from relatorios r join igrejas i on i.id = r.igreja_id
    where r.ano = p_ano and r.status <> 'substituido'
  ),
  x as (
    select u.presbiterio_id, u.uf, r.status, r.dados
    from unidades u left join relatorios r
      on r.igreja_id = u.igreja_id and r.presbiterio_id = u.presbiterio_id and r.ano = p_ano and r.status <> 'substituido'
  )
  select s.sigla, s.nome, p.sigla, p.nome, coalesce(nullif(x.uf, ''), '—'),
    count(*)::int, count(x.status)::int, (count(*) filter (where x.status = 'validado'))::int,
    sum((x.dados -> 'rol_atual' ->> 2)::numeric) filter (where x.status = 'validado'),
    (count(x.dados -> 'rol_atual' ->> 2) filter (where x.status = 'validado'))::int,
    sum((x.dados -> 'comungantes' -> 'ano_atual' ->> 2)::numeric) filter (where x.status = 'validado'),
    (count(x.dados -> 'comungantes' -> 'ano_atual' ->> 2) filter (where x.status = 'validado'))::int,
    sum((x.dados -> 'nao_comungantes' -> 'ano_atual' ->> 2)::numeric) filter (where x.status = 'validado'),
    (count(x.dados -> 'nao_comungantes' -> 'ano_atual' ->> 2) filter (where x.status = 'validado'))::int,
    sum((x.dados -> 'estrutura' ->> 'alunos_ed_atual')::numeric) filter (where x.status = 'validado'),
    (count(x.dados -> 'estrutura' ->> 'alunos_ed_atual') filter (where x.status = 'validado'))::int,
    sum(soma_bloco(x.dados -> 'comungantes' -> 'admissao')) filter (where x.status = 'validado'),
    sum(soma_bloco(x.dados -> 'comungantes' -> 'demissao')) filter (where x.status = 'validado'),
    (count(soma_bloco(x.dados -> 'comungantes' -> 'admissao')) filter (where x.status = 'validado'))::int,
    sum((x.dados -> 'financeiro' -> 'realizado' ->> 'total_receita')::numeric) filter (where x.status = 'validado'),
    (count(x.dados -> 'financeiro' -> 'realizado' ->> 'total_receita') filter (where x.status = 'validado'))::int
  from x join presbiterios p on p.id = x.presbiterio_id join sinodos s on s.id = p.sinodo_id
  group by s.sigla, s.nome, p.sigla, p.nome, coalesce(nullif(x.uf, ''), '—');
end;
$$;

-- Estrutura cadastrada (inclui sínodos e presbitérios ainda sem igrejas)
create or replace function estrutura_nacional()
returns table (sinodo_sigla text, sinodo_nome text, presbiterio_sigla text, presbiterio_nome text)
language sql stable security definer set search_path = public as $$
  select s.sigla, s.nome, p.sigla, p.nome from sinodos s left join presbiterios p on p.sinodo_id = s.id
  where s.situacao = 'ativo' and (p.id is null or p.situacao = 'ativo');
$$;

revoke all on function painel_nacional(int) from public, anon;
revoke all on function estrutura_nacional() from public, anon;
grant execute on function painel_nacional(int), estrutura_nacional() to authenticated;
