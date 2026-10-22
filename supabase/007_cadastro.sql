-- =====================================================================
-- 007 — Cadastro institucional pela tela: igrejas, congregações e transferências
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 006_exercicio.sql).
-- O administrador do presbitério cadastra e edita igrejas e congregações do
-- próprio presbitério e transfere igrejas para outro presbitério. A transferência
-- encerra o vínculo atual e abre um novo: o histórico estatístico não muda.
-- Toda ação fica no registro de auditoria.
-- =====================================================================

alter table igrejas drop constraint if exists igrejas_situacao_check;
alter table igrejas add constraint igrejas_situacao_check check (situacao in ('ativa', 'inativa'));

create table if not exists auditoria (
  id uuid primary key default gen_random_uuid(),
  presbiterio_id uuid references presbiterios(id),
  acao text not null,
  alvo text,
  detalhe text,
  usuario_id uuid references auth.users(id),
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_presb on auditoria (presbiterio_id, criado_em desc);
alter table auditoria enable row level security;
drop policy if exists ler_auditoria on auditoria;
create policy ler_auditoria on auditoria for select to authenticated using (eh_admin_presb(presbiterio_id));

-- Igreja com vínculo aberto no presbitério do administrador
create or replace function igreja_do_meu_presbiterio(p_codigo text)
returns uuid language sql stable security definer set search_path = public as $$
  select i.id from igrejas i join vinculos_igreja v on v.igreja_id = i.id and v.fim is null
  where i.codigo = p_codigo and v.presbiterio_id = meu_presbiterio();
$$;

create or replace function salvar_igreja(
  p_novo boolean, p_codigo text, p_nome text, p_tipo text, p_cidade text, p_uf text,
  p_organizacao date, p_igreja_mae text, p_situacao text
) returns void language plpgsql security definer set search_path = public as $$
declare v_presb uuid := meu_presbiterio(); v_id uuid; v_mae uuid; v_cod text := upper(trim(p_codigo));
begin
  if v_presb is null or not eh_admin_presb(v_presb) then raise exception 'Somente o administrador do presbitério pode alterar o cadastro'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome'; end if;
  if p_tipo not in ('igreja', 'congregacao') then raise exception 'Tipo inválido'; end if;
  if p_situacao not in ('ativa', 'inativa') then raise exception 'Situação inválida'; end if;
  if p_uf is not null and p_uf !~ '^[A-Za-z]{2}$' then raise exception 'UF deve ter 2 letras'; end if;
  if p_tipo = 'congregacao' and nullif(trim(p_igreja_mae), '') is not null then
    v_mae := igreja_do_meu_presbiterio(upper(trim(p_igreja_mae)));
    if v_mae is null then raise exception 'Igreja-mãe não encontrada neste presbitério'; end if;
  end if;

  if p_novo then
    if v_cod !~ '^[A-Z0-9-]{2,20}$' then raise exception 'Código inválido: use de 2 a 20 letras, números ou hífen (ex.: 4IPC)'; end if;
    if exists (select 1 from igrejas where codigo = v_cod) then raise exception 'Já existe uma unidade com o código %', v_cod; end if;
    insert into igrejas (codigo, nome, tipo, igreja_mae_id, cidade, uf, organizacao, situacao)
    values (v_cod, trim(p_nome), p_tipo, v_mae, nullif(trim(p_cidade), ''), upper(nullif(trim(p_uf), '')), p_organizacao, p_situacao)
    returning id into v_id;
    insert into vinculos_igreja (igreja_id, presbiterio_id, inicio) values (v_id, v_presb, current_date);
    insert into auditoria (presbiterio_id, acao, alvo, detalhe, usuario_id)
    values (v_presb, 'cadastro', v_cod, (case when p_tipo = 'igreja' then 'Igreja' else 'Congregação' end) || ' cadastrada: ' || trim(p_nome), auth.uid());
  else
    v_id := igreja_do_meu_presbiterio(v_cod);
    if v_id is null then raise exception 'Unidade não encontrada neste presbitério'; end if;
    if v_mae = v_id then raise exception 'Uma congregação não pode ser a própria igreja-mãe'; end if;
    insert into auditoria (presbiterio_id, acao, alvo, detalhe, usuario_id)
    select v_presb, 'alteracao', v_cod, concat_ws('; ',
        case when i.nome is distinct from trim(p_nome) then format('nome: %s → %s', i.nome, trim(p_nome)) end,
        case when i.tipo is distinct from p_tipo then format('tipo: %s → %s', i.tipo, p_tipo) end,
        case when i.cidade is distinct from nullif(trim(p_cidade), '') then format('cidade: %s → %s', coalesce(i.cidade, '—'), coalesce(nullif(trim(p_cidade), ''), '—')) end,
        case when i.uf is distinct from upper(nullif(trim(p_uf), '')) then format('UF: %s → %s', coalesce(i.uf, '—'), coalesce(upper(nullif(trim(p_uf), '')), '—')) end,
        case when i.organizacao is distinct from p_organizacao then format('organização: %s → %s', coalesce(i.organizacao::text, '—'), coalesce(p_organizacao::text, '—')) end,
        case when i.igreja_mae_id is distinct from v_mae then 'igreja-mãe alterada' end,
        case when i.situacao is distinct from p_situacao then format('situação: %s → %s', i.situacao, p_situacao) end), auth.uid()
    from igrejas i where i.id = v_id;
    update igrejas set nome = trim(p_nome), tipo = p_tipo, igreja_mae_id = case when p_tipo = 'congregacao' then v_mae end,
      cidade = nullif(trim(p_cidade), ''), uf = upper(nullif(trim(p_uf), '')), organizacao = p_organizacao, situacao = p_situacao
    where id = v_id;
  end if;
end;
$$;

-- Transferência de jurisdição: encerra o vínculo atual e abre outro (o passado não é reescrito)
create or replace function transferir_igreja(p_codigo text, p_destino text, p_data date, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_presb uuid := meu_presbiterio(); v_id uuid; v_dest uuid; v_inicio date; v_cod text := upper(trim(p_codigo));
begin
  if v_presb is null or not eh_admin_presb(v_presb) then raise exception 'Somente o administrador do presbitério pode transferir'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo / ato da transferência'; end if;
  v_id := igreja_do_meu_presbiterio(v_cod);
  if v_id is null then raise exception 'Unidade não encontrada neste presbitério'; end if;
  select id into v_dest from presbiterios where sigla = p_destino;
  if v_dest is null then raise exception 'Presbitério de destino não encontrado'; end if;
  if v_dest = v_presb then raise exception 'A igreja já pertence a este presbitério'; end if;
  select inicio into v_inicio from vinculos_igreja where igreja_id = v_id and fim is null;
  if p_data is null or p_data <= v_inicio then raise exception 'A data da transferência deve ser posterior a % (início do vínculo atual)', to_char(v_inicio, 'DD/MM/YYYY'); end if;
  update vinculos_igreja set fim = p_data where igreja_id = v_id and fim is null;
  insert into vinculos_igreja (igreja_id, presbiterio_id, inicio) values (v_id, v_dest, p_data);
  -- congregações ligadas a ela acompanham a igreja-mãe
  update vinculos_igreja v set fim = p_data from igrejas c
  where c.igreja_mae_id = v_id and v.igreja_id = c.id and v.fim is null and v.presbiterio_id = v_presb and v.inicio < p_data;
  insert into vinculos_igreja (igreja_id, presbiterio_id, inicio)
  select c.id, v_dest, p_data from igrejas c where c.igreja_mae_id = v_id
    and not exists (select 1 from vinculos_igreja v where v.igreja_id = c.id and v.fim is null);
  insert into auditoria (presbiterio_id, acao, alvo, detalhe, usuario_id)
  values (v_presb, 'transferencia', v_cod, format('Transferida para %s em %s. Motivo: %s', p_destino, to_char(p_data, 'DD/MM/YYYY'), trim(p_motivo)), auth.uid()),
         (v_dest, 'transferencia', v_cod, format('Recebida de %s em %s. Motivo: %s', (select sigla from presbiterios where id = v_presb), to_char(p_data, 'DD/MM/YYYY'), trim(p_motivo)), auth.uid());
end;
$$;

revoke all on function igreja_do_meu_presbiterio(text) from public, anon;
revoke all on function salvar_igreja(boolean, text, text, text, text, text, date, text, text) from public, anon;
revoke all on function transferir_igreja(text, text, date, text) from public, anon;
grant execute on function igreja_do_meu_presbiterio(text), salvar_igreja(boolean, text, text, text, text, text, date, text, text),
  transferir_igreja(text, text, date, text) to authenticated;
