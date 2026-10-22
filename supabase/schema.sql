-- =====================================================================
-- Painel Estatístico — esquema do banco (Supabase / PostgreSQL)
-- Cole no SQL Editor do Supabase e clique em "Run". Pode ser executado
-- mais de uma vez (usa IF NOT EXISTS / OR REPLACE).
-- Hierarquia: Sínodo → Presbitério → Igreja (→ Congregação)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Estrutura conciliar ----------
create table if not exists sinodos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text not null unique,
  situacao text not null default 'ativo',
  criado_em timestamptz not null default now()
);

create table if not exists presbiterios (
  id uuid primary key default gen_random_uuid(),
  sinodo_id uuid not null references sinodos(id),
  nome text not null,
  sigla text not null unique,
  situacao text not null default 'ativo',
  criado_em timestamptz not null default now()
);

create table if not exists igrejas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null default 'igreja' check (tipo in ('igreja', 'congregacao')),
  igreja_mae_id uuid references igrejas(id),       -- para congregações
  cidade text,
  uf text,
  organizacao date,
  situacao text not null default 'ativa',
  criado_em timestamptz not null default now()
);

-- Jurisdição histórica: uma igreja muda de presbitério sem reescrever o passado
create table if not exists vinculos_igreja (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igrejas(id),
  presbiterio_id uuid not null references presbiterios(id),
  inicio date not null,
  fim date,
  check (fim is null or fim > inicio)
);
create unique index if not exists vinculo_aberto_unico on vinculos_igreja (igreja_id) where fim is null;

create table if not exists exercicios (
  id uuid primary key default gen_random_uuid(),
  presbiterio_id uuid not null references presbiterios(id),
  ano int not null,
  situacao text not null default 'aberto' check (situacao in ('aberto', 'fechado')),
  unique (presbiterio_id, ano)
);

-- ---------- Relatórios ----------
create table if not exists relatorios (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igrejas(id),
  presbiterio_id uuid not null references presbiterios(id),  -- jurisdição NO exercício
  ano int not null,
  versao int not null default 1,
  status text not null default 'recebido' check (status in
    ('nao_enviado', 'recebido', 'em_processamento', 'aguardando_conferencia', 'aguardando_correcao', 'validado', 'substituido')),
  arquivo text,
  tipo_pdf text,
  modelo text,
  dados jsonb not null,            -- valores extraídos (null = não informado, nunca zero)
  extraido_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (igreja_id, ano, versao)
);
create index if not exists relatorios_presb_ano on relatorios (presbiterio_id, ano);

create table if not exists alertas (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references relatorios(id) on delete cascade,
  nivel text not null check (nivel in ('erro', 'aviso')),
  campo text,
  mensagem text not null,
  resolvido boolean not null default false
);

create table if not exists historico_status (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references relatorios(id) on delete cascade,
  status text not null,
  comentario text,
  usuario_id uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

-- ---------- Usuários e perfis ----------
create table if not exists perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  papel text not null check (papel in ('superadmin', 'admin_nacional', 'admin_sinodal', 'admin_presbiterial', 'representante')),
  sinodo_id uuid references sinodos(id),
  presbiterio_id uuid references presbiterios(id),
  igreja_id uuid references igrejas(id)
);

-- ---------- Regras de acesso ----------
create or replace function pode_ver(p_igreja uuid, p_presbiterio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis pf
    where pf.user_id = auth.uid() and (
      pf.papel in ('superadmin', 'admin_nacional')
      or (pf.papel = 'admin_presbiterial' and pf.presbiterio_id = p_presbiterio)
      or (pf.papel = 'admin_sinodal' and pf.sinodo_id = (select sinodo_id from presbiterios where id = p_presbiterio))
      or (pf.papel = 'representante' and pf.igreja_id = p_igreja)
    )
  );
$$;

alter table sinodos enable row level security;
alter table presbiterios enable row level security;
alter table igrejas enable row level security;
alter table vinculos_igreja enable row level security;
alter table exercicios enable row level security;
alter table relatorios enable row level security;
alter table alertas enable row level security;
alter table historico_status enable row level security;
alter table perfis enable row level security;

-- Estrutura institucional: visível a qualquer usuário logado (não contém dados pessoais)
drop policy if exists ler_sinodos on sinodos;
create policy ler_sinodos on sinodos for select to authenticated using (true);
drop policy if exists ler_presbiterios on presbiterios;
create policy ler_presbiterios on presbiterios for select to authenticated using (true);
drop policy if exists ler_igrejas on igrejas;
create policy ler_igrejas on igrejas for select to authenticated using (true);
drop policy if exists ler_vinculos on vinculos_igreja;
create policy ler_vinculos on vinculos_igreja for select to authenticated using (true);
drop policy if exists ler_exercicios on exercicios;
create policy ler_exercicios on exercicios for select to authenticated using (true);

-- Relatórios e derivados: só quem tem jurisdição/permissão
drop policy if exists ler_relatorios on relatorios;
create policy ler_relatorios on relatorios for select to authenticated using (pode_ver(igreja_id, presbiterio_id));
drop policy if exists ler_alertas on alertas;
create policy ler_alertas on alertas for select to authenticated
  using (exists (select 1 from relatorios r where r.id = relatorio_id and pode_ver(r.igreja_id, r.presbiterio_id)));
drop policy if exists ler_historico on historico_status;
create policy ler_historico on historico_status for select to authenticated
  using (exists (select 1 from relatorios r where r.id = relatorio_id and pode_ver(r.igreja_id, r.presbiterio_id)));

-- Cada usuário lê apenas o próprio perfil
drop policy if exists ler_proprio_perfil on perfis;
create policy ler_proprio_perfil on perfis for select to authenticated using (user_id = auth.uid());

-- Nenhuma política de escrita: alterações passam por funções controladas.

-- ---------- Ação: validar / solicitar correção ----------
create or replace function definir_status(p_relatorio uuid, p_status text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_presb uuid;
begin
  select presbiterio_id into v_presb from relatorios where id = p_relatorio;
  if v_presb is null then raise exception 'Relatório não encontrado'; end if;
  if not exists (
    select 1 from perfis
    where user_id = auth.uid()
      and (papel = 'superadmin' or (papel = 'admin_presbiterial' and presbiterio_id = v_presb))
  ) then
    raise exception 'Sem permissão para alterar este relatório';
  end if;
  if p_status not in ('aguardando_conferencia', 'aguardando_correcao', 'validado') then
    raise exception 'Situação inválida: %', p_status;
  end if;
  if p_status = 'aguardando_correcao' and coalesce(trim(p_comentario), '') = '' then
    raise exception 'Informe o que precisa ser corrigido';
  end if;
  update relatorios set status = p_status, atualizado_em = now() where id = p_relatorio;
  insert into historico_status (relatorio_id, status, comentario, usuario_id)
  values (p_relatorio, p_status, p_comentario, auth.uid());
end;
$$;

revoke all on function definir_status(uuid, text, text) from public, anon;
grant execute on function definir_status(uuid, text, text) to authenticated;
revoke all on function pode_ver(uuid, uuid) from public, anon;
grant execute on function pode_ver(uuid, uuid) to authenticated;
