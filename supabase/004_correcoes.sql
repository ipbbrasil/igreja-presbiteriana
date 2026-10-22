-- =====================================================================
-- 004 — Digitação e correção manual dos dados
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 003_leitura.sql).
-- Cada correção guarda os dados anteriores completos e a lista de campos
-- alterados (de → para). O relatório volta para "Aguardando conferência".
-- =====================================================================

create table if not exists correcoes (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references relatorios(id) on delete cascade,
  usuario_id uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  comentario text,
  alteracoes jsonb not null,        -- [{ campo, de, para }]
  dados_anteriores jsonb not null   -- cópia integral antes da correção
);
create index if not exists correcoes_relatorio on correcoes (relatorio_id);

alter table correcoes enable row level security;
drop policy if exists ler_correcoes on correcoes;
create policy ler_correcoes on correcoes for select to authenticated
  using (exists (select 1 from relatorios r where r.id = relatorio_id and pode_ver(r.igreja_id, r.presbiterio_id)));

create or replace function corrigir_relatorio(p_relatorio uuid, p_dados jsonb, p_alteracoes jsonb, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r relatorios%rowtype; v_n int; v_resumo text;
begin
  select * into r from relatorios where id = p_relatorio for update;
  if r.id is null then raise exception 'Relatório não encontrado'; end if;
  if not exists (
    select 1 from perfis where user_id = auth.uid()
      and (papel = 'superadmin' or (papel = 'admin_presbiterial' and presbiterio_id = r.presbiterio_id))
  ) then raise exception 'Sem permissão para corrigir este relatório'; end if;
  if r.status = 'substituido' then raise exception 'Esta versão foi substituída; corrija a versão atual'; end if;
  if jsonb_typeof(p_dados) <> 'object' or not (p_dados ? 'comungantes' and p_dados ? 'financeiro') then
    raise exception 'Dados inválidos';
  end if;
  if jsonb_typeof(p_alteracoes) <> 'array' or jsonb_array_length(p_alteracoes) = 0 then
    raise exception 'Nenhuma alteração informada';
  end if;
  v_n := jsonb_array_length(p_alteracoes);

  insert into correcoes (relatorio_id, usuario_id, comentario, alteracoes, dados_anteriores)
  values (r.id, auth.uid(), nullif(trim(p_comentario), ''), p_alteracoes, r.dados);

  update relatorios set dados = p_dados, status = 'aguardando_conferencia', atualizado_em = now() where id = r.id;

  select string_agg(format('%s: %s → %s', a->>'campo', coalesce(a->>'de', 'vazio'), coalesce(a->>'para', 'vazio')), '; ')
  into v_resumo from (select a from jsonb_array_elements(p_alteracoes) a limit 6) x;
  insert into historico_status (relatorio_id, status, comentario, usuario_id)
  values (r.id, 'aguardando_conferencia',
          'Correção manual de ' || v_n || ' campo(s)' || coalesce(' — ' || nullif(trim(p_comentario), ''), '')
          || '. ' || v_resumo || case when v_n > 6 then '…' else '' end,
          auth.uid());
end;
$$;

revoke all on function corrigir_relatorio(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function corrigir_relatorio(uuid, jsonb, jsonb, text) to authenticated;
