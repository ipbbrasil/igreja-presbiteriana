-- =====================================================================
-- Teste de segurança das permissões (pode rodar quantas vezes quiser)
-- Cole no SQL Editor do Supabase e clique em "Run".
-- Simula três contas: o primeiro REPRESENTANTE cadastrado, o primeiro
-- ADMINISTRADOR DO PRESBITÉRIO e uma conta logada SEM PERFIL. Cada uma tenta
-- ações que não deveria conseguir.
-- NADA É GRAVADO: o script termina com um "erro" proposital que mostra o
-- resultado e desfaz qualquer alteração. Leia a mensagem de erro:
--   "ok"           = a proteção funcionou
--   "⚠ PERMITIDO"  ou "⚠ VAZOU" = falha de segurança (avise o responsável técnico)
-- =====================================================================

do $teste$
declare
  zero uuid := '00000000-0000-0000-0000-000000000000';
  v_rep uuid; v_rep_ig uuid; v_rep_cod text; v_rel_meu uuid; v_rel_outro uuid; v_envio_outro uuid;
  v_admin uuid; v_admin_presb uuid; v_presb_sigla text; v_sin_sigla text;
  n_alertas bigint; n_hist bigint; n_corr bigint;
  testes text[]; t text[]; atual text := ''; n bigint; saida text := '';
begin
  -- ---------- Preparação (como dono do banco) ----------
  select user_id, igreja_id into v_rep, v_rep_ig from perfis where papel = 'representante' order by user_id limit 1;
  select user_id, presbiterio_id into v_admin, v_admin_presb from perfis where papel = 'admin_presbiterial' order by user_id limit 1;
  if v_rep is null or v_admin is null then raise exception 'É preciso ter ao menos um representante e um administrador do presbitério cadastrados.'; end if;
  select codigo into v_rep_cod from igrejas where id = v_rep_ig;
  select id into v_rel_meu from relatorios where igreja_id = v_rep_ig and status <> 'substituido' limit 1;
  select id into v_rel_outro from relatorios where igreja_id <> v_rep_ig and status <> 'substituido' limit 1;
  select id into v_envio_outro from envios where igreja_id <> v_rep_ig limit 1;
  select p.sigla, s.sigla into v_presb_sigla, v_sin_sigla from presbiterios p join sinodos s on s.id = p.sinodo_id where p.id = v_admin_presb;
  select count(*) into n_alertas from alertas a join relatorios r on r.id = a.relatorio_id where r.igreja_id = v_rep_ig;
  select count(*) into n_hist from historico_status h join relatorios r on r.id = h.relatorio_id where r.igreja_id = v_rep_ig;
  select count(*) into n_corr from correcoes c join relatorios r on r.id = c.relatorio_id where r.igreja_id = v_rep_ig;
  v_rel_meu := coalesce(v_rel_meu, zero); v_rel_outro := coalesce(v_rel_outro, zero); v_envio_outro := coalesce(v_envio_outro, zero);

  -- [conta, tipo, descrição, comando]. tipo "falha": o comando precisa ser recusado.
  -- tipo "zero": o comando devolve um número que precisa ser 0 (ou ser recusado).
  testes := array[
    -- Representante: só a própria igreja, sem poder de decisão
    ['rep', 'zero', 'ler relatórios de outras igrejas', format('select count(*) from relatorios where igreja_id <> %L', v_rep_ig)],
    ['rep', 'zero', 'ler envios de outras igrejas', format('select count(*) from envios where igreja_id <> %L', v_rep_ig)],
    ['rep', 'zero', 'ler alertas de outras igrejas', format('select (select count(*) from alertas) - %s', n_alertas)],
    ['rep', 'zero', 'ler histórico de outras igrejas', format('select (select count(*) from historico_status) - %s', n_hist)],
    ['rep', 'zero', 'ler correções de outras igrejas', format('select (select count(*) from correcoes) - %s', n_corr)],
    ['rep', 'zero', 'ler arquivos de outras igrejas', format('select count(*) from storage.objects where bucket_id = ''relatorios'' and (storage.foldername(name))[1] <> %L', v_rep_cod)],
    ['rep', 'zero', 'ler convites', 'select count(*) from convites'],
    ['rep', 'zero', 'ler o registro de ações', 'select count(*) from auditoria'],
    ['rep', 'zero', 'ler perfis de outras pessoas', 'select count(*) from perfis where user_id <> auth.uid()'],
    ['rep', 'zero', 'listar usuários do presbitério', 'select count(*) from listar_usuarios()'],
    ['rep', 'zero', 'listar acessos superiores', 'select count(*) from listar_acessos_superiores()'],
    ['rep', 'falha', 'validar o próprio relatório', format('select definir_status(%L, ''validado'')', v_rel_meu)],
    ['rep', 'falha', 'validar relatório de outra igreja', format('select definir_status(%L, ''validado'')', v_rel_outro)],
    ['rep', 'falha', 'corrigir dados do próprio relatório', format('select corrigir_relatorio(%L, ''{"comungantes":{},"financeiro":{}}'', ''[{"campo":"x"}]'', ''teste'')', v_rel_meu)],
    ['rep', 'falha', 'processar envio de outra igreja', format('select processar_envio(%L, ''{"comungantes":{},"financeiro":{}}'', ''[]'', ''x'')', v_envio_outro)],
    ['rep', 'falha', 'registrar envio para outra igreja', format('select registrar_envio(i.codigo, 2025, i.codigo || ''/2025/x.pdf'', ''x.pdf'', ''pdf'', ''digital'', 1, md5(random()::text), null) from igrejas i where i.id <> %L limit 1', v_rep_ig)],
    ['rep', 'falha', 'criar convite', 'select criar_convite(''teste@exemplo.com'', ''x'', ''admin_presbiterial'', null)'],
    ['rep', 'falha', 'remover acesso do administrador', format('select remover_acesso(%L)', v_admin)],
    ['rep', 'falha', 'fechar o exercício', 'select fechar_exercicio(2025, ''teste'')'],
    ['rep', 'falha', 'alterar cadastro da igreja', format('select salvar_igreja(false, %L, ''Teste'', ''igreja'', null, null, null, null, ''ativa'')', v_rep_cod)],
    ['rep', 'falha', 'transferir a igreja', format('select transferir_igreja(%L, %L, current_date + 1, ''teste'')', v_rep_cod, v_presb_sigla)],
    ['rep', 'falha', 'ver a visão nacional', 'select count(*) from painel_nacional(2025)'],
    ['rep', 'falha', 'ver a evolução nacional', 'select count(*) from evolucao_nacional()'],
    ['rep', 'falha', 'gravar direto no registro de ações', 'select aud(null, ''teste'', ''x'', ''x'')'],
    ['rep', 'falha', 'criar perfil de superadmin direto na tabela', 'insert into perfis (user_id, papel) values (gen_random_uuid(), ''superadmin'')'],
    ['rep', 'zero', 'promover-se a superadmin', 'with u as (update perfis set papel = ''superadmin'' where user_id = auth.uid() returning 1) select count(*) from u'],
    ['rep', 'zero', 'validar relatórios direto na tabela', 'with u as (update relatorios set status = ''validado'' returning 1) select count(*) from u'],
    ['rep', 'zero', 'apagar o registro de ações', 'with d as (delete from auditoria returning 1) select count(*) from d'],
    -- Administrador do presbitério: nada fora do próprio presbitério nem do nível superior
    ['admin', 'zero', 'ler relatórios de outros presbitérios', format('select count(*) from relatorios where presbiterio_id <> %L', v_admin_presb)],
    ['admin', 'zero', 'ler convites de outros presbitérios', format('select count(*) from convites where presbiterio_id <> %L', v_admin_presb)],
    ['admin', 'zero', 'ler registro de ações de outros presbitérios', format('select count(*) from auditoria where presbiterio_id is distinct from %L', v_admin_presb)],
    ['admin', 'falha', 'convidar com papel de superadmin', 'select criar_convite(''teste@exemplo.com'', ''x'', ''superadmin'', null)'],
    ['admin', 'falha', 'criar convite de administrador para outro presbitério', format('select criar_convite_admin(''teste@exemplo.com'', ''x'', %L)', v_presb_sigla)],
    ['admin', 'falha', 'alterar sínodo', format('select salvar_sinodo(false, %L, ''Teste'', ''ativo'')', v_sin_sigla)],
    ['admin', 'falha', 'alterar presbitério', format('select salvar_presbiterio(false, %L, ''Teste'', null, ''ativo'')', v_presb_sigla)],
    ['admin', 'falha', 'mover presbitério de sínodo', format('select mover_presbiterio(%L, %L, current_date + 1, ''teste'')', v_presb_sigla, v_sin_sigla)],
    ['admin', 'falha', 'gravar direto no registro de ações', 'select aud(null, ''teste'', ''x'', ''x'')'],
    ['admin', 'falha', 'criar convite direto na tabela', format('insert into convites (email, papel, presbiterio_id) values (''t@e.com'', ''admin_presbiterial'', %L)', v_admin_presb)],
    ['admin', 'zero', 'promover-se a superadmin', 'with u as (update perfis set papel = ''superadmin'' where user_id = auth.uid() returning 1) select count(*) from u'],
    ['admin', 'zero', 'alterar relatórios direto na tabela', 'with u as (update relatorios set status = ''validado'' returning 1) select count(*) from u'],
    ['admin', 'zero', 'apagar o registro de ações', 'with d as (delete from auditoria returning 1) select count(*) from d'],
    -- Conta logada sem perfil (alguém que só criou uma conta): não vê nada
    ['sem', 'zero', 'ler igrejas', 'select count(*) from igrejas'],
    ['sem', 'zero', 'ler presbitérios e sínodos', 'select (select count(*) from presbiterios) + (select count(*) from sinodos)'],
    ['sem', 'zero', 'ler relatórios', 'select count(*) from relatorios'],
    ['sem', 'zero', 'ler arquivos enviados', 'select count(*) from storage.objects where bucket_id = ''relatorios'''],
    ['sem', 'zero', 'ler estrutura nacional', 'select count(*) from estrutura_nacional()'],
    ['sem', 'falha', 'ver a visão nacional', 'select count(*) from painel_nacional(2025)'],
    ['sem', 'falha', 'criar convite', 'select criar_convite(''teste@exemplo.com'', ''x'', ''representante'', null)']
  ];

  foreach t slice 1 in array testes loop
    if t[1] <> atual then -- troca de conta simulada
      execute 'reset role';
      perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
        case t[1] when 'rep' then v_rep when 'admin' then v_admin else gen_random_uuid() end)::text, true);
      execute 'set local role authenticated';
      atual := t[1];
      saida := saida || E'\n' || case t[1] when 'rep' then '— REPRESENTANTE (' || v_rep_cod || ')' when 'admin' then '— ADMINISTRADOR DO PRESBITÉRIO (' || v_presb_sigla || ')' else '— CONTA SEM PERFIL' end || E'\n';
    end if;
    if t[2] = 'falha' then
      begin
        execute t[4];
        saida := saida || '⚠ PERMITIDO  ' || t[3] || E'\n';
      exception when others then
        saida := saida || 'ok  ' || t[3] || ' (recusado)' || E'\n';
      end;
    else
      begin
        execute t[4] into n;
        saida := saida || case when n = 0 then 'ok  ' else '⚠ VAZOU  ' end || t[3] || ': ' || n || E'\n';
      exception when others then
        saida := saida || 'ok  ' || t[3] || ' (recusado)' || E'\n';
      end;
    end if;
  end loop;
  execute 'reset role';

  raise exception E'RESULTADO DO TESTE DE SEGURANÇA — nada foi gravado.\n% de % verificações com falha.\n%',
    (length(saida) - length(replace(saida, '⚠', ''))), array_length(testes, 1), saida;
end
$teste$;
