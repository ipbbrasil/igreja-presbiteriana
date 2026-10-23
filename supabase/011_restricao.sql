-- =====================================================================
-- 011 — Contas sem perfil não veem nada
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 010_estrutura.sql).
-- Antes: qualquer conta logada lia a estrutura institucional (nomes e cidades de
-- igrejas, presbitérios, sínodos, vínculos e exercícios). Agora só quem tem um
-- perfil de acesso (criado por convite ou pelo responsável técnico) lê essas tabelas.
-- O convite continua funcionando: ver_convite e aceitar_convite não dependem disso.
-- =====================================================================

create or replace function tem_perfil() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where user_id = auth.uid());
$$;
revoke all on function tem_perfil() from public, anon;
grant execute on function tem_perfil() to authenticated;

drop policy if exists ler_sinodos on sinodos;
create policy ler_sinodos on sinodos for select to authenticated using (tem_perfil());
drop policy if exists ler_presbiterios on presbiterios;
create policy ler_presbiterios on presbiterios for select to authenticated using (tem_perfil());
drop policy if exists ler_igrejas on igrejas;
create policy ler_igrejas on igrejas for select to authenticated using (tem_perfil());
drop policy if exists ler_vinculos on vinculos_igreja;
create policy ler_vinculos on vinculos_igreja for select to authenticated using (tem_perfil());
drop policy if exists ler_vinculos_presb on vinculos_presbiterio;
create policy ler_vinculos_presb on vinculos_presbiterio for select to authenticated using (tem_perfil());
drop policy if exists ler_exercicios on exercicios;
create policy ler_exercicios on exercicios for select to authenticated using (tem_perfil());
drop policy if exists ler_exercicio_eventos on exercicio_eventos;
create policy ler_exercicio_eventos on exercicio_eventos for select to authenticated using (tem_perfil());

-- Estrutura usada pela visão nacional: também exige perfil
create or replace function estrutura_nacional()
returns table (sinodo_sigla text, sinodo_nome text, presbiterio_sigla text, presbiterio_nome text)
language sql stable security definer set search_path = public as $$
  select s.sigla, s.nome, p.sigla, p.nome from sinodos s left join presbiterios p on p.sinodo_id = s.id
  where tem_perfil() and s.situacao = 'ativo' and (p.id is null or p.situacao = 'ativo');
$$;

-- ---------- Conferência (opcional): simula uma conta logada SEM perfil ----------
-- Rode as 4 linhas abaixo juntas. Todas as contagens devem dar 0.
-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
-- select (select count(*) from igrejas) as igrejas, (select count(*) from presbiterios) as presbiterios, (select count(*) from sinodos) as sinodos, (select count(*) from relatorios) as relatorios, (select count(*) from estrutura_nacional()) as estrutura; rollback;
