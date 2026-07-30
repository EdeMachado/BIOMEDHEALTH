-- SUP-B03.1: persistencia runtime de jornada e progresso do titular.
-- Escopo:
-- - unicidade estrutural para progresso por atividade da jornada do usuario;
-- - garantia transacional de criacao/retomada da jornada ativa;
-- - RLS e privilegios minimos para leitura do catalogo e escrita do progresso proprio.
-- Fora de escopo:
-- - mudanca de migrations anteriores;
-- - deduplicacao automatica de dados preexistentes.

begin;

-- 0) Baseline estrutural minimo esperado.
do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.health_journeys'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1: tabela public.health_journeys ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.journey_versions'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1: tabela public.journey_versions ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.journey_steps'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1: tabela public.journey_steps ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.journey_activities'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1: tabela public.journey_activities ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.user_journeys'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1: tabela public.user_journeys ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.user_activity_progress'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1: tabela public.user_activity_progress ausente.';
  end if;
end $$;

-- 1) Evitar assumir ownership de objetos homonimos preexistentes.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname = 'user_activity_progress_user_journey_activity_unique_idx'
  ) then
    raise exception 'SUP-B03.1: indice user_activity_progress_user_journey_activity_unique_idx ja existe.';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname = 'user_journeys_one_active_per_user_idx'
  ) then
    raise exception 'SUP-B03.1: indice user_journeys_one_active_per_user_idx ja existe.';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_or_get_active_user_journey'
      and p.pronargs = 3
  ) then
    raise exception 'SUP-B03.1: funcao public.create_or_get_active_user_journey(uuid, uuid, text) ja existe.';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid in (
      'public.health_journeys'::regclass,
      'public.journey_versions'::regclass,
      'public.journey_steps'::regclass,
      'public.journey_activities'::regclass,
      'public.user_journeys'::regclass,
      'public.user_activity_progress'::regclass
    )
      and polname in (
        'health_journeys_select_eligible_self',
        'journey_versions_select_eligible_self',
        'journey_steps_select_eligible_self',
        'journey_activities_select_eligible_self',
        'user_journeys_select_self',
        'user_journeys_update_self',
        'user_activity_progress_select_self',
        'user_activity_progress_insert_self',
        'user_activity_progress_update_self'
      )
  ) then
    raise exception 'SUP-B03.1: ao menos uma policy nova ja existe; abortando para evitar sobrescrita.';
  end if;
end $$;

-- 2) Pre-checagens de duplicidade (sem deduplicacao silenciosa).
do $$
begin
  if exists (
    select 1
    from public.user_activity_progress uap
    group by uap.user_journey_id, uap.journey_activity_id
    having count(*) > 1
  ) then
    raise exception
      'SUP-B03.1: duplicidades detectadas em user_activity_progress para (user_journey_id, journey_activity_id).';
  end if;

  if exists (
    select 1
    from public.user_journeys uj
    where uj.status = 'ativo'
      and uj.completed_at is null
    group by uj.organization_id, uj.user_id
    having count(*) > 1
  ) then
    raise exception
      'SUP-B03.1: duplicidades detectadas em user_journeys ativos para (organization_id, user_id).';
  end if;
end $$;

-- 3) Unicidade estrutural.
create unique index user_activity_progress_user_journey_activity_unique_idx
  on public.user_activity_progress (user_journey_id, journey_activity_id);

create unique index user_journeys_one_active_per_user_idx
  on public.user_journeys (organization_id, user_id)
  where status = 'ativo'
    and completed_at is null;

-- 4) RPC transacional para criacao/retomada concorrente da jornada ativa.
create function public.create_or_get_active_user_journey(
  p_organization_id uuid,
  p_journey_version_id uuid,
  p_initial_status text default 'ativo'
)
returns public.user_journeys
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid;
  v_result public.user_journeys%rowtype;
  v_version_org uuid;
  v_version_status text;
  v_journey_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise insufficient_privilege using message = 'SUP-B03.1: sessao autenticada obrigatoria para jornada.';
  end if;

  if p_initial_status is distinct from 'ativo' then
    raise exception 'SUP-B03.1: p_initial_status invalido (%).', p_initial_status;
  end if;

  if not app_auth.has_active_org_link(p_organization_id) then
    raise insufficient_privilege using message = 'SUP-B03.1: usuario sem vinculo organizacional ativo.';
  end if;

  select jv.organization_id, jv.status, hj.status
    into v_version_org, v_version_status, v_journey_status
    from public.journey_versions jv
    join public.health_journeys hj on hj.id = jv.journey_id
   where jv.id = p_journey_version_id;

  if v_version_org is null then
    raise exception 'SUP-B03.1: journey_version_id % inexistente.', p_journey_version_id;
  end if;

  if v_version_org is distinct from p_organization_id then
    raise exception 'SUP-B03.1: journey_version_id % pertence a outro tenant.', p_journey_version_id;
  end if;

  if v_version_status <> 'ativo' or v_journey_status <> 'ativo' then
    raise exception
      'SUP-B03.1: journey_version_id % nao esta elegivel (status_version=%; status_journey=%).',
      p_journey_version_id,
      v_version_status,
      v_journey_status;
  end if;

  select uj.*
    into v_result
    from public.user_journeys uj
   where uj.organization_id = p_organization_id
     and uj.user_id = v_uid
     and uj.status = 'ativo'
     and uj.completed_at is null
   order by uj.updated_at desc
   limit 1;
  if found then
    return v_result;
  end if;

  begin
    insert into public.user_journeys (
      organization_id,
      user_id,
      journey_version_id,
      status
    ) values (
      p_organization_id,
      v_uid,
      p_journey_version_id,
      p_initial_status
    )
    returning * into v_result;
  exception
    when unique_violation then
      select uj.*
        into v_result
        from public.user_journeys uj
       where uj.organization_id = p_organization_id
         and uj.user_id = v_uid
         and uj.status = 'ativo'
         and uj.completed_at is null
       order by uj.updated_at desc
       limit 1;
      if not found then
        raise exception
          'SUP-B03.1: unique_violation sem registro vencedor recuperavel em user_journeys.';
      end if;
  end;

  return v_result;
end;
$$;

do $$
begin
  execute 'revoke all on function public.create_or_get_active_user_journey(uuid, uuid, text) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.create_or_get_active_user_journey(uuid, uuid, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.create_or_get_active_user_journey(uuid, uuid, text) to authenticated';
  end if;
end $$;

-- 5) RLS por titular e tenant.
alter table public.health_journeys enable row level security;
alter table public.journey_versions enable row level security;
alter table public.journey_steps enable row level security;
alter table public.journey_activities enable row level security;
alter table public.user_journeys enable row level security;
alter table public.user_activity_progress enable row level security;

create policy health_journeys_select_eligible_self on public.health_journeys
for select to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and (
    status = 'ativo'
    or exists (
      select 1
      from public.user_journeys uj
      join public.journey_versions jv on jv.id = uj.journey_version_id
      where uj.organization_id = health_journeys.organization_id
        and uj.user_id = auth.uid()
        and jv.journey_id = health_journeys.id
    )
  )
);

create policy journey_versions_select_eligible_self on public.journey_versions
for select to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and (
    status = 'ativo'
    or exists (
      select 1
      from public.user_journeys uj
      where uj.organization_id = journey_versions.organization_id
        and uj.user_id = auth.uid()
        and uj.journey_version_id = journey_versions.id
    )
  )
);

create policy journey_steps_select_eligible_self on public.journey_steps
for select to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and status = 'ativo'
  and (
    exists (
      select 1
      from public.journey_versions jv
      where jv.id = journey_steps.journey_version_id
        and jv.organization_id = journey_steps.organization_id
        and jv.status = 'ativo'
    )
    or exists (
      select 1
      from public.user_journeys uj
      where uj.organization_id = journey_steps.organization_id
        and uj.user_id = auth.uid()
        and uj.journey_version_id = journey_steps.journey_version_id
    )
  )
);

create policy journey_activities_select_eligible_self on public.journey_activities
for select to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and status = 'ativo'
  and (
    exists (
      select 1
      from public.journey_steps js
      join public.journey_versions jv on jv.id = js.journey_version_id
      where js.id = journey_activities.journey_step_id
        and js.organization_id = journey_activities.organization_id
        and js.status = 'ativo'
        and jv.status = 'ativo'
    )
    or exists (
      select 1
      from public.journey_steps js
      join public.user_journeys uj on uj.journey_version_id = js.journey_version_id
      where js.id = journey_activities.journey_step_id
        and js.organization_id = journey_activities.organization_id
        and uj.organization_id = journey_activities.organization_id
        and uj.user_id = auth.uid()
    )
  )
);

create policy user_journeys_select_self on public.user_journeys
for select to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

create policy user_journeys_update_self on public.user_journeys
for update to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
)
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

create policy user_activity_progress_select_self on public.user_activity_progress
for select to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and uj.user_id = auth.uid()
      and app_auth.has_active_org_link(uj.organization_id)
  )
);

create policy user_activity_progress_insert_self on public.user_activity_progress
for insert to authenticated
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    join public.journey_activities ja on ja.id = user_activity_progress.journey_activity_id
    join public.journey_steps js on js.id = ja.journey_step_id
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and uj.user_id = auth.uid()
      and ja.organization_id = user_activity_progress.organization_id
      and js.journey_version_id = uj.journey_version_id
      and app_auth.has_active_org_link(uj.organization_id)
  )
);

create policy user_activity_progress_update_self on public.user_activity_progress
for update to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and uj.user_id = auth.uid()
      and app_auth.has_active_org_link(uj.organization_id)
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    join public.journey_activities ja on ja.id = user_activity_progress.journey_activity_id
    join public.journey_steps js on js.id = ja.journey_step_id
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and uj.user_id = auth.uid()
      and ja.organization_id = user_activity_progress.organization_id
      and js.journey_version_id = uj.journey_version_id
      and app_auth.has_active_org_link(uj.organization_id)
  )
);

-- 6) Privilegios minimos para chamadas do frontend autenticado.
revoke all on table public.health_journeys from public;
revoke all on table public.journey_versions from public;
revoke all on table public.journey_steps from public;
revoke all on table public.journey_activities from public;
revoke all on table public.user_journeys from public;
revoke all on table public.user_activity_progress from public;

revoke all on table public.health_journeys from anon;
revoke all on table public.journey_versions from anon;
revoke all on table public.journey_steps from anon;
revoke all on table public.journey_activities from anon;
revoke all on table public.user_journeys from anon;
revoke all on table public.user_activity_progress from anon;

revoke all on table public.health_journeys from authenticated;
revoke all on table public.journey_versions from authenticated;
revoke all on table public.journey_steps from authenticated;
revoke all on table public.journey_activities from authenticated;
revoke all on table public.user_journeys from authenticated;
revoke all on table public.user_activity_progress from authenticated;

grant select on table public.health_journeys to authenticated;
grant select on table public.journey_versions to authenticated;
grant select on table public.journey_steps to authenticated;
grant select on table public.journey_activities to authenticated;
grant select on table public.user_journeys to authenticated;
grant select on table public.user_activity_progress to authenticated;
grant update (completed_at, status, version, updated_at) on table public.user_journeys to authenticated;
grant insert (organization_id, user_journey_id, journey_activity_id, progress_percent, status, version)
  on table public.user_activity_progress to authenticated;
grant update (progress_percent, status, version, updated_at)
  on table public.user_activity_progress to authenticated;
revoke delete on table public.user_activity_progress from authenticated;
revoke delete on table public.user_journeys from authenticated;

commit;
