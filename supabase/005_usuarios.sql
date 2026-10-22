-- =====================================================================
-- 005 — Cadastro de usuários por convite
-- Cole no SQL Editor do Supabase e clique em "Run" (depois do 004_correcoes.sql).
-- O administrador cria um convite (e-mail + papel + igreja) e envia o link.
-- A pessoa abre o link, cria a senha e o perfil é ligado automaticamente.
-- A chave secreta (service_role) nunca é usada no site.
-- =====================================================================

create table if not exists convites (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  email text not null,
  nome text,
  papel text not null check (papel in ('representante', 'admin_presbiterial')),
  presbiterio_id uuid not null references presbiterios(id),
  igreja_id uuid references igrejas(id),
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '14 days',
  usado_em timestamptz,
  usado_por uuid references auth.users(id),
  check (papel <> 'representante' or igreja_id is not null)
);

-- Administrador do presbitério (ou superadmin)?
create or replace function eh_admin_presb(p_presb uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where user_id = auth.uid()
    and (papel = 'superadmin' or (papel = 'admin_presbiterial' and presbiterio_id = p_presb)));
$$;

alter table convites enable row level security;
drop policy if exists ler_convites on convites;
create policy ler_convites on convites for select to authenticated using (eh_admin_presb(presbiterio_id));

-- Presbitério do administrador que está usando o site
create or replace function meu_presbiterio()
returns uuid language sql stable security definer set search_path = public as $$
  select presbiterio_id from perfis where user_id = auth.uid() and papel = 'admin_presbiterial';
$$;

create or replace function criar_convite(p_email text, p_nome text, p_papel text, p_igreja text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_presb uuid := meu_presbiterio(); v_ig uuid; v_cod text; v_email text := lower(trim(p_email));
begin
  if v_presb is null or not eh_admin_presb(v_presb) then raise exception 'Somente o administrador do presbitério pode convidar usuários'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  if p_papel not in ('representante', 'admin_presbiterial') then raise exception 'Papel inválido'; end if;
  if p_papel = 'representante' then
    select i.id into v_ig from igrejas i join vinculos_igreja v on v.igreja_id = i.id and v.fim is null
    where i.codigo = p_igreja and v.presbiterio_id = v_presb;
    if v_ig is null then raise exception 'Igreja não encontrada neste presbitério'; end if;
  end if;
  -- Um convite pendente por e-mail: o novo substitui o anterior
  delete from convites where email = v_email and presbiterio_id = v_presb and usado_em is null;
  insert into convites (email, nome, papel, presbiterio_id, igreja_id, criado_por)
  values (v_email, nullif(trim(p_nome), ''), p_papel, v_presb, v_ig, auth.uid())
  returning codigo into v_cod;
  return v_cod;
end;
$$;

create or replace function cancelar_convite(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from convites where id = p_id and usado_em is null and eh_admin_presb(presbiterio_id);
  if not found then raise exception 'Convite não encontrado'; end if;
end;
$$;

-- Consultado pela pessoa convidada, antes de ter conta (por isso liberado para "anon")
create or replace function ver_convite(p_codigo text)
returns table (email text, nome text, papel text, igreja text, presbiterio text, situacao text)
language sql stable security definer set search_path = public as $$
  select c.email, c.nome, c.papel, i.nome, p.nome,
         case when c.usado_em is not null then 'usado' when c.expira_em < now() then 'expirado' else 'valido' end
  from convites c join presbiterios p on p.id = c.presbiterio_id left join igrejas i on i.id = c.igreja_id
  where c.codigo = p_codigo;
$$;

-- Liga o usuário logado ao perfil do convite (o e-mail da conta precisa ser o do convite)
create or replace function aceitar_convite(p_codigo text, p_nome text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c convites%rowtype; v_email text;
begin
  select * into c from convites where codigo = p_codigo for update;
  if c.id is null then raise exception 'Convite não encontrado'; end if;
  if c.usado_em is not null then raise exception 'Este convite já foi usado'; end if;
  if c.expira_em < now() then raise exception 'Este convite expirou. Peça um novo ao administrador'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from c.email then raise exception 'Este convite é para %, mas você entrou com %', c.email, v_email; end if;
  insert into perfis (user_id, nome, papel, presbiterio_id, igreja_id)
  values (auth.uid(), coalesce(nullif(trim(p_nome), ''), c.nome), c.papel, c.presbiterio_id, c.igreja_id)
  on conflict (user_id) do update set nome = coalesce(excluded.nome, perfis.nome), papel = excluded.papel,
    sinodo_id = null, presbiterio_id = excluded.presbiterio_id, igreja_id = excluded.igreja_id;
  update convites set usado_em = now(), usado_por = auth.uid() where id = c.id;
end;
$$;

-- Usuários com acesso ao presbitério do administrador
create or replace function listar_usuarios()
returns table (user_id uuid, nome text, email text, papel text, igreja_codigo text, igreja_nome text, ultimo_acesso timestamptz)
language sql stable security definer set search_path = public as $$
  select pf.user_id, pf.nome, u.email::text, pf.papel, i.codigo, i.nome, u.last_sign_in_at
  from perfis pf join auth.users u on u.id = pf.user_id left join igrejas i on i.id = pf.igreja_id
  where eh_admin_presb(meu_presbiterio()) and (
    pf.presbiterio_id = meu_presbiterio()
    or pf.igreja_id in (select igreja_id from vinculos_igreja where fim is null and presbiterio_id = meu_presbiterio())
  )
  order by pf.papel, i.nome nulls first, pf.nome;
$$;

-- Remove o acesso (o perfil); a conta de login continua existindo, mas não vê nada
create or replace function remover_acesso(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_presb uuid := meu_presbiterio();
begin
  if v_presb is null or not eh_admin_presb(v_presb) then raise exception 'Sem permissão'; end if;
  if p_user = auth.uid() then raise exception 'Você não pode remover o seu próprio acesso'; end if;
  delete from perfis pf where pf.user_id = p_user and pf.papel in ('representante', 'admin_presbiterial') and (
    pf.presbiterio_id = v_presb
    or pf.igreja_id in (select igreja_id from vinculos_igreja where fim is null and presbiterio_id = v_presb));
  if not found then raise exception 'Usuário não encontrado neste presbitério'; end if;
end;
$$;

revoke all on function eh_admin_presb(uuid) from public, anon;
revoke all on function meu_presbiterio() from public, anon;
revoke all on function criar_convite(text, text, text, text) from public, anon;
revoke all on function cancelar_convite(uuid) from public, anon;
revoke all on function ver_convite(text) from public;
revoke all on function aceitar_convite(text, text) from public, anon;
revoke all on function listar_usuarios() from public, anon;
revoke all on function remover_acesso(uuid) from public, anon;
grant execute on function eh_admin_presb(uuid), meu_presbiterio(), criar_convite(text, text, text, text), cancelar_convite(uuid),
  aceitar_convite(text, text), listar_usuarios(), remover_acesso(uuid) to authenticated;
grant execute on function ver_convite(text) to anon, authenticated;

-- O administrador já existente passa a ter o presbitério preenchido (necessário para convidar)
update perfis set presbiterio_id = (select id from presbiterios where sigla = 'PTAN')
where papel = 'admin_presbiterial' and presbiterio_id is null;
-- Representantes antigos também ganham o presbitério (para aparecerem na lista)
update perfis pf set presbiterio_id = v.presbiterio_id
from vinculos_igreja v where pf.papel = 'representante' and pf.presbiterio_id is null and v.igreja_id = pf.igreja_id and v.fim is null;
