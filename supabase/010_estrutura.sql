-- =====================================================================
-- 010 — Cadastro de sínodos e presbitérios pela tela (superadministrador)
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 009_nacional.sql).
-- Cria o histórico de vínculos presbitério → sínodo (com início e fim), para que
-- a mudança de um presbitério para outro sínodo não reescreva os anos anteriores.
-- A visão nacional passa a usar o sínodo vigente no fim de cada exercício.
-- =====================================================================

create table if not exists vinculos_presbiterio (
  id uuid primary key default gen_random_uuid(),
  presbiterio_id uuid not null references presbiterios(id),
  sinodo_id uuid not null references sinodos(id),
  inicio date not null,
  fim date,
  check (fim is null or fim > inicio)
);
create unique index if not exists vinculo_presb_aberto on vinculos_presbiterio (presbiterio_id) where fim is null;
alter table vinculos_presbiterio enable row level security;
drop policy if exists ler_vinculos_presb on vinculos_presbiterio;
create policy ler_vinculos_presb on vinculos_presbiterio for select to authenticated using (true);

-- Presbitérios já existentes: vínculo desde sempre com o sínodo atual
insert into vinculos_presbiterio (presbiterio_id, sinodo_id, inicio)
select p.id, p.sinodo_id, date '1900-01-01' from presbiterios p
where not exists (select 1 from vinculos_presbiterio v where v.presbiterio_id = p.id);

alter table sinodos drop constraint if exists sinodos_situacao_check;
alter table sinodos add constraint sinodos_situacao_check check (situacao in ('ativo', 'inativo'));
alter table presbiterios drop constraint if exists presbiterios_situacao_check;
alter table presbiterios add constraint presbiterios_situacao_check check (situacao in ('ativo', 'inativo'));

create or replace function eh_superadmin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where user_id = auth.uid() and papel = 'superadmin');
$$;

create or replace function salvar_sinodo(p_novo boolean, p_sigla text, p_nome text, p_situacao text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sigla text := upper(trim(p_sigla)); v_antes sinodos%rowtype;
begin
  if not eh_superadmin() then raise exception 'Somente o superadministrador pode alterar sínodos'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome do sínodo'; end if;
  if p_situacao not in ('ativo', 'inativo') then raise exception 'Situação inválida'; end if;
  if p_novo then
    if v_sigla !~ '^[A-Z0-9-]{2,12}$' then raise exception 'Sigla inválida: use de 2 a 12 letras ou números (ex.: STG)'; end if;
    if exists (select 1 from sinodos where sigla = v_sigla) then raise exception 'Já existe um sínodo com a sigla %', v_sigla; end if;
    insert into sinodos (nome, sigla, situacao) values (trim(p_nome), v_sigla, p_situacao);
    perform aud(null, 'estrutura', v_sigla, 'Sínodo cadastrado: ' || trim(p_nome));
  else
    select * into v_antes from sinodos where sigla = v_sigla;
    if v_antes.id is null then raise exception 'Sínodo não encontrado'; end if;
    update sinodos set nome = trim(p_nome), situacao = p_situacao where id = v_antes.id;
    perform aud(null, 'estrutura', v_sigla, concat_ws('; ', 'Sínodo alterado',
      case when v_antes.nome <> trim(p_nome) then format('nome: %s → %s', v_antes.nome, trim(p_nome)) end,
      case when v_antes.situacao <> p_situacao then format('situação: %s → %s', v_antes.situacao, p_situacao) end));
  end if;
end;
$$;

create or replace function salvar_presbiterio(p_novo boolean, p_sigla text, p_nome text, p_sinodo text, p_situacao text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sigla text := upper(trim(p_sigla)); v_sin uuid; v_id uuid; v_antes presbiterios%rowtype;
begin
  if not eh_superadmin() then raise exception 'Somente o superadministrador pode alterar presbitérios'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome do presbitério'; end if;
  if p_situacao not in ('ativo', 'inativo') then raise exception 'Situação inválida'; end if;
  if p_novo then
    select id into v_sin from sinodos where sigla = upper(trim(p_sinodo));
    if v_sin is null then raise exception 'Sínodo não encontrado'; end if;
    if v_sigla !~ '^[A-Z0-9-]{2,12}$' then raise exception 'Sigla inválida: use de 2 a 12 letras ou números (ex.: PTAN)'; end if;
    if exists (select 1 from presbiterios where sigla = v_sigla) then raise exception 'Já existe um presbitério com a sigla %', v_sigla; end if;
    insert into presbiterios (sinodo_id, nome, sigla, situacao) values (v_sin, trim(p_nome), v_sigla, p_situacao) returning id into v_id;
    insert into vinculos_presbiterio (presbiterio_id, sinodo_id, inicio) values (v_id, v_sin, current_date);
    perform aud(v_id, 'estrutura', v_sigla, format('Presbitério cadastrado: %s (sínodo %s)', trim(p_nome), upper(trim(p_sinodo))));
  else
    select * into v_antes from presbiterios where sigla = v_sigla;
    if v_antes.id is null then raise exception 'Presbitério não encontrado'; end if;
    update presbiterios set nome = trim(p_nome), situacao = p_situacao where id = v_antes.id;
    perform aud(v_antes.id, 'estrutura', v_sigla, concat_ws('; ', 'Presbitério alterado',
      case when v_antes.nome <> trim(p_nome) then format('nome: %s → %s', v_antes.nome, trim(p_nome)) end,
      case when v_antes.situacao <> p_situacao then format('situação: %s → %s', v_antes.situacao, p_situacao) end));
  end if;
end;
$$;

-- Reorganização: presbitério passa a outro sínodo a partir de uma data (o passado não muda)
create or replace function mover_presbiterio(p_sigla text, p_sinodo text, p_data date, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sin uuid; v_inicio date; v_de text;
begin
  if not eh_superadmin() then raise exception 'Somente o superadministrador pode mover presbitérios'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo / ato da reorganização'; end if;
  select id into v_id from presbiterios where sigla = upper(trim(p_sigla));
  select id into v_sin from sinodos where sigla = upper(trim(p_sinodo));
  if v_id is null or v_sin is null then raise exception 'Presbitério ou sínodo não encontrado'; end if;
  select v.inicio, s.sigla into v_inicio, v_de from vinculos_presbiterio v join sinodos s on s.id = v.sinodo_id where v.presbiterio_id = v_id and v.fim is null;
  if v_de = upper(trim(p_sinodo)) then raise exception 'O presbitério já pertence a este sínodo'; end if;
  if p_data is null or p_data <= v_inicio then raise exception 'A data deve ser posterior a % (início do vínculo atual)', to_char(v_inicio, 'DD/MM/YYYY'); end if;
  update vinculos_presbiterio set fim = p_data where presbiterio_id = v_id and fim is null;
  insert into vinculos_presbiterio (presbiterio_id, sinodo_id, inicio) values (v_id, v_sin, p_data);
  update presbiterios set sinodo_id = v_sin where id = v_id; -- sínodo atual (o histórico fica nos vínculos)
  perform aud(v_id, 'estrutura', upper(trim(p_sigla)), format('Presbitério passou do sínodo %s para %s em %s. Motivo: %s', v_de, upper(trim(p_sinodo)), to_char(p_data, 'DD/MM/YYYY'), trim(p_motivo)));
end;
$$;

-- Primeiro administrador de um presbitério (o convite é aceito pela tela de convite, como os demais)
create or replace function criar_convite_admin(p_email text, p_nome text, p_presbiterio text)
returns text language plpgsql security definer set search_path = public as $$
declare v_presb uuid; v_cod text; v_email text := lower(trim(p_email));
begin
  if not eh_superadmin() then raise exception 'Somente o superadministrador'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  select id into v_presb from presbiterios where sigla = upper(trim(p_presbiterio));
  if v_presb is null then raise exception 'Presbitério não encontrado'; end if;
  delete from convites where email = v_email and presbiterio_id = v_presb and usado_em is null;
  insert into convites (email, nome, papel, presbiterio_id, criado_por)
  values (v_email, nullif(trim(p_nome), ''), 'admin_presbiterial', v_presb, auth.uid()) returning codigo into v_cod;
  return v_cod;
end;
$$;

-- Visão nacional: cada exercício é somado pelo sínodo vigente no fim daquele ano
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
  from x join presbiterios p on p.id = x.presbiterio_id
    join vinculos_presbiterio vp on vp.presbiterio_id = p.id
      and vp.inicio <= make_date(p_ano, 12, 31) and (vp.fim is null or vp.fim > make_date(p_ano, 12, 31))
    join sinodos s on s.id = vp.sinodo_id
  group by s.sigla, s.nome, p.sigla, p.nome, coalesce(nullif(x.uf, ''), '—');
end;
$$;

revoke all on function eh_superadmin() from public, anon;
revoke all on function salvar_sinodo(boolean, text, text, text) from public, anon;
revoke all on function salvar_presbiterio(boolean, text, text, text, text) from public, anon;
revoke all on function mover_presbiterio(text, text, date, text) from public, anon;
revoke all on function criar_convite_admin(text, text, text) from public, anon;
grant execute on function eh_superadmin(), salvar_sinodo(boolean, text, text, text), salvar_presbiterio(boolean, text, text, text, text),
  mover_presbiterio(text, text, date, text), criar_convite_admin(text, text, text) to authenticated;
