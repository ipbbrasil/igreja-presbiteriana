-- =====================================================================
-- 006 — Fechamento do exercício estatístico
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 005_usuarios.sql).
-- Com o exercício fechado, o banco recusa qualquer alteração de relatório
-- e qualquer novo envio daquele ano (inclusive feitos por fora do site).
-- Reabrir exige motivo; fechamentos e reaberturas ficam registrados.
-- =====================================================================

alter table exercicios add column if not exists fechado_em timestamptz;
alter table exercicios add column if not exists fechado_por uuid references auth.users(id);
alter table exercicios add column if not exists comentario text;

create table if not exists exercicio_eventos (
  id uuid primary key default gen_random_uuid(),
  presbiterio_id uuid not null references presbiterios(id),
  ano int not null,
  acao text not null check (acao in ('fechado', 'reaberto')),
  comentario text,
  usuario_id uuid references auth.users(id),
  criado_em timestamptz not null default now()
);
alter table exercicio_eventos enable row level security;
drop policy if exists ler_exercicio_eventos on exercicio_eventos;
create policy ler_exercicio_eventos on exercicio_eventos for select to authenticated using (true);

create or replace function exercicio_fechado(p_presb uuid, p_ano int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from exercicios where presbiterio_id = p_presb and ano = p_ano and situacao = 'fechado');
$$;

-- Trava: relatórios e envios de exercício fechado não podem ser criados nem alterados
create or replace function bloquear_exercicio_fechado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exercicio_fechado(new.presbiterio_id, new.ano) then
    raise exception 'O exercício % está fechado. Para alterar relatórios ou receber envios, o administrador precisa reabri-lo.', new.ano;
  end if;
  return new;
end;
$$;
drop trigger if exists relatorios_exercicio_fechado on relatorios;
create trigger relatorios_exercicio_fechado before insert or update on relatorios
  for each row execute function bloquear_exercicio_fechado();
drop trigger if exists envios_exercicio_fechado on envios;
create trigger envios_exercicio_fechado before insert on envios
  for each row execute function bloquear_exercicio_fechado();

create or replace function fechar_exercicio(p_ano int, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_presb uuid := meu_presbiterio();
begin
  if v_presb is null or not eh_admin_presb(v_presb) then raise exception 'Somente o administrador do presbitério pode fechar o exercício'; end if;
  if exercicio_fechado(v_presb, p_ano) then raise exception 'O exercício % já está fechado', p_ano; end if;
  insert into exercicios (presbiterio_id, ano, situacao, fechado_em, fechado_por, comentario)
  values (v_presb, p_ano, 'fechado', now(), auth.uid(), nullif(trim(p_comentario), ''))
  on conflict (presbiterio_id, ano) do update
    set situacao = 'fechado', fechado_em = now(), fechado_por = auth.uid(), comentario = excluded.comentario;
  insert into exercicio_eventos (presbiterio_id, ano, acao, comentario, usuario_id)
  values (v_presb, p_ano, 'fechado', nullif(trim(p_comentario), ''), auth.uid());
end;
$$;

create or replace function reabrir_exercicio(p_ano int, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_presb uuid := meu_presbiterio();
begin
  if v_presb is null or not eh_admin_presb(v_presb) then raise exception 'Somente o administrador do presbitério pode reabrir o exercício'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo da reabertura'; end if;
  if not exercicio_fechado(v_presb, p_ano) then raise exception 'O exercício % não está fechado', p_ano; end if;
  update exercicios set situacao = 'aberto', fechado_em = null, fechado_por = null, comentario = null
  where presbiterio_id = v_presb and ano = p_ano;
  insert into exercicio_eventos (presbiterio_id, ano, acao, comentario, usuario_id)
  values (v_presb, p_ano, 'reaberto', trim(p_motivo), auth.uid());
end;
$$;

revoke all on function exercicio_fechado(uuid, int) from public, anon;
revoke all on function fechar_exercicio(int, text) from public, anon;
revoke all on function reabrir_exercicio(int, text) from public, anon;
grant execute on function exercicio_fechado(uuid, int), fechar_exercicio(int, text), reabrir_exercicio(int, text) to authenticated;
