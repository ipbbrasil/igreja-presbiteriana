-- =====================================================================
-- 002 — Envio de relatórios pelo site
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do schema.sql).
-- Cria: tabela envios, pasta privada "relatorios" no Storage e permissões.
-- =====================================================================

create table if not exists envios (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igrejas(id),
  presbiterio_id uuid not null references presbiterios(id),
  ano int not null,
  arquivo_nome text not null,
  caminho text not null unique,                 -- caminho no Storage (bucket relatorios)
  formato text not null check (formato in ('pdf', 'xlsx')),
  tipo_pdf text check (tipo_pdf in ('digital', 'digitalizado')),
  tamanho bigint,
  sha256 text not null,                         -- impede envio duplicado do mesmo arquivo
  verificacao jsonb,                            -- resultado das checagens feitas no envio
  status text not null default 'recebido' check (status in ('recebido', 'em_processamento', 'processado', 'rejeitado')),
  relatorio_id uuid references relatorios(id),  -- preenchido quando os dados forem extraídos
  enviado_por uuid references auth.users(id),
  enviado_em timestamptz not null default now(),
  unique (igreja_id, ano, sha256)
);
create index if not exists envios_igreja_ano on envios (igreja_id, ano);

alter table envios enable row level security;
drop policy if exists ler_envios on envios;
create policy ler_envios on envios for select to authenticated using (pode_ver(igreja_id, presbiterio_id));

-- Quem pode ENVIAR: representante da própria igreja, administrador do presbitério, superadmin
create or replace function pode_enviar(p_igreja uuid, p_presbiterio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis pf
    where pf.user_id = auth.uid() and (
      pf.papel = 'superadmin'
      or (pf.papel = 'admin_presbiterial' and pf.presbiterio_id = p_presbiterio)
      or (pf.papel = 'representante' and pf.igreja_id = p_igreja)
    )
  );
$$;

-- Mesmas regras, a partir do código da igreja (primeira pasta do caminho no Storage)
create or replace function pode_por_codigo(p_codigo text, p_enviar boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from igrejas i
    join vinculos_igreja v on v.igreja_id = i.id and v.fim is null
    where i.codigo = p_codigo
      and case when p_enviar then pode_enviar(i.id, v.presbiterio_id) else pode_ver(i.id, v.presbiterio_id) end
  );
$$;

create or replace function registrar_envio(
  p_igreja text, p_ano int, p_caminho text, p_nome text, p_formato text,
  p_tipo_pdf text, p_tamanho bigint, p_sha256 text, p_verificacao jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_ig uuid; v_presb uuid; v_id uuid;
begin
  select i.id, v.presbiterio_id into v_ig, v_presb
  from igrejas i join vinculos_igreja v on v.igreja_id = i.id and v.fim is null
  where i.codigo = p_igreja;
  if v_ig is null then raise exception 'Igreja não encontrada ou sem presbitério vinculado'; end if;
  if not pode_enviar(v_ig, v_presb) then raise exception 'Sem permissão para enviar relatório desta igreja'; end if;
  if p_caminho not like p_igreja || '/' || p_ano || '/%' then raise exception 'Caminho do arquivo inválido'; end if;
  if exists (select 1 from envios where igreja_id = v_ig and ano = p_ano and sha256 = p_sha256) then
    raise exception 'Este arquivo já foi enviado para esta igreja e exercício';
  end if;
  insert into envios (igreja_id, presbiterio_id, ano, arquivo_nome, caminho, formato, tipo_pdf, tamanho, sha256, verificacao, enviado_por)
  values (v_ig, v_presb, p_ano, p_nome, p_caminho, p_formato, p_tipo_pdf, p_tamanho, p_sha256, p_verificacao, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function pode_enviar(uuid, uuid) from public, anon;
revoke all on function pode_por_codigo(text, boolean) from public, anon;
revoke all on function registrar_envio(text, int, text, text, text, text, bigint, text, jsonb) from public, anon;
grant execute on function pode_enviar(uuid, uuid) to authenticated;
grant execute on function pode_por_codigo(text, boolean) to authenticated;
grant execute on function registrar_envio(text, int, text, text, text, text, bigint, text, jsonb) to authenticated;

-- ---------- Storage: pasta privada para os arquivos originais ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatorios', 'relatorios', false, 10485760,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists relatorios_enviar on storage.objects;
create policy relatorios_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'relatorios' and pode_por_codigo((storage.foldername(name))[1], true));

drop policy if exists relatorios_ler on storage.objects;
create policy relatorios_ler on storage.objects for select to authenticated
  using (bucket_id = 'relatorios' and pode_por_codigo((storage.foldername(name))[1], false));

-- Permite desfazer um upload cujo registro falhou (só quem pode enviar)
drop policy if exists relatorios_remover on storage.objects;
create policy relatorios_remover on storage.objects for delete to authenticated
  using (bucket_id = 'relatorios' and pode_por_codigo((storage.foldername(name))[1], true)
         and not exists (select 1 from public.envios e where e.caminho = objects.name));
