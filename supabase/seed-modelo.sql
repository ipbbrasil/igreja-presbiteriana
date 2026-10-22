-- =====================================================================
-- Carga dos relatórios (modelo). NÃO cole este arquivo diretamente:
-- rode scripts\gerar-seed.ps1, que gera supabase\seed.sql com os dados
-- reais (esse arquivo gerado fica fora do git).
-- Status inicial: relatório com alerta de nível "erro" → aguardando correção;
-- demais → validado (simulação da conferência para a apresentação).
-- =====================================================================
do $carga$
declare
  j jsonb := $json$__DADOS__$json$::jsonb;
  v_ano int := (j->'_sobre'->>'exercicio')::int;
  v_sin uuid; v_pres uuid; v_ig uuid; v_rel uuid; ig jsonb; v_status text;
begin
  insert into sinodos (nome, sigla)
  values (j->'_sobre'->'sinodo'->>'nome', j->'_sobre'->'sinodo'->>'sigla')
  on conflict (sigla) do update set nome = excluded.nome
  returning id into v_sin;

  insert into presbiterios (sinodo_id, nome, sigla)
  values (v_sin, j->'_sobre'->'presbiterio'->>'nome', j->'_sobre'->'presbiterio'->>'sigla')
  on conflict (sigla) do update set nome = excluded.nome, sinodo_id = excluded.sinodo_id
  returning id into v_pres;

  insert into exercicios (presbiterio_id, ano) values (v_pres, v_ano) on conflict do nothing;

  for ig in select * from jsonb_array_elements(j->'igrejas') loop
    insert into igrejas (codigo, nome, cidade, uf, organizacao)
    values (ig->>'id', ig->>'nome', ig->>'cidade', ig->>'uf', (ig->>'organizacao')::date)
    on conflict (codigo) do update set nome = excluded.nome, cidade = excluded.cidade, uf = excluded.uf, organizacao = excluded.organizacao
    returning id into v_ig;

    insert into vinculos_igreja (igreja_id, presbiterio_id, inicio)
    select v_ig, v_pres, make_date(v_ano, 1, 1)
    where not exists (select 1 from vinculos_igreja where igreja_id = v_ig and fim is null);

    -- Recarga: versões anteriores do mesmo exercício viram "substituído" (nada é apagado)
    update relatorios set status = 'substituido', atualizado_em = now()
    where igreja_id = v_ig and ano = v_ano and status <> 'substituido';

    v_status := case when exists (select 1 from jsonb_array_elements(ig->'alertas') a where a->>'nivel' = 'erro')
                     then 'aguardando_correcao' else 'validado' end;

    insert into relatorios (igreja_id, presbiterio_id, ano, versao, status, arquivo, tipo_pdf, modelo, dados)
    values (
      v_ig, v_pres, v_ano,
      coalesce((select max(versao) from relatorios where igreja_id = v_ig and ano = v_ano), 0) + 1,
      v_status, ig->>'arquivo', ig->>'tipo_pdf', ig->>'modelo',
      ig - 'id' - 'nome' - 'cidade' - 'uf' - 'organizacao' - 'arquivo' - 'tipo_pdf' - 'modelo' - 'alertas'
    )
    returning id into v_rel;

    insert into alertas (relatorio_id, nivel, campo, mensagem)
    select v_rel, a->>'nivel', a->>'campo', a->>'msg' from jsonb_array_elements(ig->'alertas') a;

    insert into historico_status (relatorio_id, status, comentario)
    values (v_rel, 'aguardando_conferencia', 'Relatório importado do PDF ' || (ig->>'arquivo'));
    insert into historico_status (relatorio_id, status, comentario)
    values (v_rel, v_status, case when v_status = 'validado' then 'Somas conferidas' else 'Divergências encontradas na leitura' end);
  end loop;
end
$carga$;
