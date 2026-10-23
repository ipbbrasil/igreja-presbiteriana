-- =====================================================================
-- 008 — Registro geral de ações (auditoria) e registro de cópias de segurança
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 007_cadastro.sql).
-- Gatilhos no banco registram automaticamente: convites, acessos, envios,
-- mudanças de situação dos relatórios (leitura, validação, correção) e
-- fechamento/reabertura do exercício. Cadastro e transferência já registram (007).
-- =====================================================================

-- Usuário que fez a ação (nulo = SQL Editor / sistema)
create or replace function aud(p_presb uuid, p_acao text, p_alvo text, p_detalhe text)
returns void language sql security definer set search_path = public as $$
  insert into auditoria (presbiterio_id, acao, alvo, detalhe, usuario_id) values (p_presb, p_acao, p_alvo, p_detalhe, auth.uid());
$$;
revoke all on function aud(uuid, text, text, text) from public, anon, authenticated;

create or replace function rotulo_papel(p text) returns text language sql immutable as $$
  select case p when 'representante' then 'representante' when 'admin_presbiterial' then 'administrador do presbitério'
    when 'admin_sinodal' then 'administrador sinodal' when 'admin_nacional' then 'administrador nacional' when 'superadmin' then 'superadministrador' else p end;
$$;
create or replace function rotulo_status(s text) returns text language sql immutable as $$
  select case s when 'recebido' then 'recebido' when 'em_processamento' then 'em processamento' when 'aguardando_conferencia' then 'aguardando conferência'
    when 'aguardando_correcao' then 'correção solicitada' when 'validado' then 'validado' when 'substituido' then 'substituído' else s end;
$$;

-- ---------- Convites ----------
create or replace function audit_convites() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform aud(new.presbiterio_id, 'convite', new.email, 'Convite criado para ' || rotulo_papel(new.papel) || coalesce(' — ' || (select nome from igrejas where id = new.igreja_id), ''));
  elsif tg_op = 'UPDATE' and new.usado_em is not null and old.usado_em is null then
    perform aud(new.presbiterio_id, 'convite', new.email, 'Convite aceito');
  elsif tg_op = 'DELETE' and old.usado_em is null then
    perform aud(old.presbiterio_id, 'convite', old.email, 'Convite cancelado ou substituído por outro');
  end if;
  return null; -- gatilho AFTER: o retorno é ignorado
end;
$$;
drop trigger if exists auditoria_convites on convites;
create trigger auditoria_convites after insert or update or delete on convites for each row execute function audit_convites();

-- ---------- Acessos (perfis) ----------
create or replace function audit_perfis() returns trigger language plpgsql security definer set search_path = public as $$
declare r perfis%rowtype; v_presb uuid; v_email text; v_igreja text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  v_presb := coalesce(r.presbiterio_id, (select presbiterio_id from vinculos_igreja where igreja_id = r.igreja_id and fim is null));
  select email into v_email from auth.users where id = r.user_id;
  select nome into v_igreja from igrejas where id = r.igreja_id;
  if tg_op = 'INSERT' then
    perform aud(v_presb, 'acesso', v_email, 'Acesso concedido: ' || rotulo_papel(r.papel) || coalesce(' — ' || v_igreja, ''));
  elsif tg_op = 'UPDATE' and (old.papel is distinct from new.papel or old.igreja_id is distinct from new.igreja_id or old.presbiterio_id is distinct from new.presbiterio_id) then
    perform aud(v_presb, 'acesso', v_email, 'Acesso alterado: ' || rotulo_papel(old.papel) || ' → ' || rotulo_papel(new.papel) || coalesce(' — ' || v_igreja, ''));
  elsif tg_op = 'DELETE' then
    perform aud(v_presb, 'acesso', v_email, 'Acesso removido (' || rotulo_papel(r.papel) || coalesce(' — ' || v_igreja, '') || ')');
  end if;
  return null; -- gatilho AFTER: o retorno é ignorado
end;
$$;
drop trigger if exists auditoria_perfis on perfis;
create trigger auditoria_perfis after insert or update or delete on perfis for each row execute function audit_perfis();

-- ---------- Situação dos relatórios (leitura, validação, correção) ----------
create or replace function audit_historico() returns trigger language plpgsql security definer set search_path = public as $$
declare v_presb uuid; v_cod text; v_ano int; v_versao int;
begin
  select r.presbiterio_id, i.codigo, r.ano, r.versao into v_presb, v_cod, v_ano, v_versao
  from relatorios r join igrejas i on i.id = r.igreja_id where r.id = new.relatorio_id;
  perform aud(v_presb, 'situacao', v_cod, format('Relatório %s (versão %s): %s%s', v_ano, v_versao, rotulo_status(new.status), coalesce(' — ' || new.comentario, '')));
  return new;
end;
$$;
drop trigger if exists auditoria_historico on historico_status;
create trigger auditoria_historico after insert on historico_status for each row execute function audit_historico();

-- ---------- Envios de arquivo ----------
create or replace function audit_envios() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform aud(new.presbiterio_id, 'envio', (select codigo from igrejas where id = new.igreja_id),
    format('Arquivo recebido (%s, exercício %s): %s', upper(new.formato), new.ano, new.arquivo_nome));
  return new;
end;
$$;
drop trigger if exists auditoria_envios on envios;
create trigger auditoria_envios after insert on envios for each row execute function audit_envios();

-- ---------- Exercício ----------
create or replace function audit_exercicio() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform aud(new.presbiterio_id, 'exercicio', 'Exercício ' || new.ano,
    case new.acao when 'fechado' then 'Exercício fechado' else 'Exercício reaberto' end || coalesce(' — ' || new.comentario, ''));
  return new;
end;
$$;
drop trigger if exists auditoria_exercicio on exercicio_eventos;
create trigger auditoria_exercicio after insert on exercicio_eventos for each row execute function audit_exercicio();

-- ---------- Cópia de segurança (registrada pelo site) ----------
create or replace function registrar_backup(p_detalhe text)
returns void language plpgsql security definer set search_path = public as $$
declare v_presb uuid := meu_presbiterio();
begin
  if v_presb is null or not eh_admin_presb(v_presb) then raise exception 'Somente o administrador do presbitério'; end if;
  perform aud(v_presb, 'backup', 'Cópia de segurança', left(p_detalhe, 300));
end;
$$;
revoke all on function registrar_backup(text) from public, anon;
grant execute on function registrar_backup(text) to authenticated;
