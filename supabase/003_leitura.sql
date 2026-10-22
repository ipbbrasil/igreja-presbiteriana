-- =====================================================================
-- 003 — Leitura automática dos relatórios enviados pelo site
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 002_envios.sql).
-- Cria a função que transforma um envio lido em uma nova versão do relatório,
-- com situação "Aguardando conferência". A versão anterior vira "Substituído"
-- (nada é apagado) e o histórico registra a troca.
-- =====================================================================

create or replace function processar_envio(p_envio uuid, p_dados jsonb, p_alertas jsonb, p_modelo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e envios%rowtype; v_versao int; v_rel uuid; v_ant uuid;
begin
  select * into e from envios where id = p_envio for update;
  if e.id is null then raise exception 'Envio não encontrado'; end if;
  if not pode_enviar(e.igreja_id, e.presbiterio_id) then raise exception 'Sem permissão para processar este envio'; end if;
  if e.status not in ('recebido', 'em_processamento') then raise exception 'Este envio já foi processado'; end if;
  if jsonb_typeof(p_dados) <> 'object' or not (p_dados ? 'comungantes' and p_dados ? 'financeiro') then
    raise exception 'Dados lidos inválidos';
  end if;
  if jsonb_typeof(coalesce(p_alertas, '[]'::jsonb)) <> 'array' then raise exception 'Alertas inválidos'; end if;

  select coalesce(max(versao), 0) + 1 into v_versao from relatorios where igreja_id = e.igreja_id and ano = e.ano;

  -- Versão anterior (se houver) vira "substituído"
  for v_ant in select id from relatorios where igreja_id = e.igreja_id and ano = e.ano and status <> 'substituido' loop
    update relatorios set status = 'substituido', atualizado_em = now() where id = v_ant;
    insert into historico_status (relatorio_id, status, comentario, usuario_id)
    values (v_ant, 'substituido', 'Substituído pela versão ' || v_versao || ' (arquivo ' || e.arquivo_nome || ' enviado pelo site)', auth.uid());
  end loop;

  insert into relatorios (igreja_id, presbiterio_id, ano, versao, status, arquivo, tipo_pdf, modelo, dados, extraido_em)
  values (e.igreja_id, e.presbiterio_id, e.ano, v_versao, 'aguardando_conferencia', e.arquivo_nome, e.tipo_pdf, p_modelo, p_dados, now())
  returning id into v_rel;

  insert into alertas (relatorio_id, nivel, campo, mensagem)
  select v_rel, a->>'nivel', a->>'campo', a->>'msg'
  from jsonb_array_elements(coalesce(p_alertas, '[]'::jsonb)) a
  where a->>'nivel' in ('erro', 'aviso') and coalesce(a->>'msg', '') <> '';

  insert into historico_status (relatorio_id, status, comentario, usuario_id)
  values (v_rel, 'aguardando_conferencia', 'Versão ' || v_versao || ' lida automaticamente do arquivo ' || e.arquivo_nome, auth.uid());

  update envios set status = 'processado', relatorio_id = v_rel where id = e.id;
  return v_rel;
end;
$$;

revoke all on function processar_envio(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function processar_envio(uuid, jsonb, jsonb, text) to authenticated;
