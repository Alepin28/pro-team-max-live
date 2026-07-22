-- =========================================================
-- PRO TEAM MAX
-- 01_SQL_SEGURIDAD_RLS_COMPLETA.sql
--
-- SEGURIDAD REAL — FASE 2
--
-- IMPORTANTE:
-- 1. NO ejecutar hasta reemplazar los archivos frontend indicados.
-- 2. El respaldo requerido es:
--    ptm_backup_seguridad_20260719_01
-- 3. Conserva todos los datos reales.
-- 4. No ejecuta seed.
-- 5. No resetea tablas.
-- 6. Si algo falla después de aplicarlo, ejecutar:
--    02_SQL_REVERTIR_SEGURIDAD.sql
-- =========================================================

begin;

-- =========================================================
-- 1. COMPROBACIONES PREVIAS
-- =========================================================

do $$
declare
  v_owner_count integer;
  v_linked_owner_count integer;
begin
  if not exists (
    select 1
    from pg_namespace
    where nspname = 'ptm_backup_seguridad_20260719_01'
  ) then
    raise exception
      'No existe el respaldo ptm_backup_seguridad_20260719_01.';
  end if;

  if to_regclass(
    'ptm_backup_seguridad_20260719_01._estado_rls'
  ) is null then
    raise exception
      'El respaldo está incompleto: falta _estado_rls.';
  end if;

  if to_regclass(
    'ptm_backup_seguridad_20260719_01._politicas_actuales'
  ) is null then
    raise exception
      'El respaldo está incompleto: falta _politicas_actuales.';
  end if;

  if to_regclass(
    'ptm_backup_seguridad_20260719_01._funciones_ptm'
  ) is null then
    raise exception
      'El respaldo está incompleto: falta _funciones_ptm.';
  end if;

  select count(*)
  into v_owner_count
  from public.staff_members_demo
  where lower(coalesce(role, '')) = 'owner'
    and active is true;

  if v_owner_count < 1 then
    raise exception
      'No existe un dueño activo en staff_members_demo.';
  end if;

  select count(*)
  into v_linked_owner_count
  from public.staff_members_demo
  where lower(coalesce(role, '')) = 'owner'
    and active is true
    and auth_user_id is not null;

  if v_linked_owner_count < 1 then
    raise exception
      'El dueño activo no está vinculado a Supabase Auth.';
  end if;
end;
$$;

-- =========================================================
-- 2. MANIFIESTO DE OBJETOS NUEVOS PARA REVERSIÓN
-- =========================================================

create table if not exists
  ptm_backup_seguridad_20260719_01._seguridad_objetos_nuevos (
    object_name text primary key,
    object_type text not null,
    drop_sql text not null,
    drop_order integer not null default 100,
    created_at timestamptz not null default now()
  );

truncate table
  ptm_backup_seguridad_20260719_01._seguridad_objetos_nuevos;

-- =========================================================
-- 3. FUNCIONES INTERNAS DE IDENTIDAD Y PERMISOS
-- =========================================================

create or replace function public.ptm_staff_is_enabled_v1(
  p_auth_status text
)
returns boolean
language sql
immutable
as $function$
  select lower(
    trim(
      coalesce(
        p_auth_status,
        'activo'
      )
    )
  ) in (
    'activo',
    'enabled',
    'habilitado'
  );
$function$;

create or replace function public.ptm_current_account_id_v1()
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select staff.account_id
  from public.staff_members_demo staff
  where staff.auth_user_id = auth.uid()
    and staff.active is true
    and public.ptm_staff_is_enabled_v1(
      staff.auth_status
    )
  limit 1;
$function$;

create or replace function public.ptm_current_staff_id_v1()
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select staff.id
  from public.staff_members_demo staff
  where staff.auth_user_id = auth.uid()
    and staff.active is true
    and public.ptm_staff_is_enabled_v1(
      staff.auth_status
    )
  limit 1;
$function$;

create or replace function public.ptm_current_staff_role_v1()
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select lower(coalesce(staff.role, ''))
  from public.staff_members_demo staff
  where staff.auth_user_id = auth.uid()
    and staff.active is true
    and public.ptm_staff_is_enabled_v1(
      staff.auth_status
    )
  limit 1;
$function$;

create or replace function public.ptm_is_active_staff_v1()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.staff_members_demo staff
    where staff.auth_user_id = auth.uid()
      and staff.active is true
      and public.ptm_staff_is_enabled_v1(
        staff.auth_status
      )
  );
$function$;

create or replace function public.ptm_is_owner_v1()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    public.ptm_current_staff_role_v1() = 'owner',
    false
  );
$function$;

create or replace function public.ptm_is_owner_admin_v1()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    public.ptm_current_staff_role_v1()
      in ('owner', 'admin'),
    false
  );
$function$;

create or replace function public.ptm_has_permission_v1(
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    (
      select
        case
          when lower(coalesce(staff.role, ''))
            in ('owner', 'admin')
            then true
          else coalesce(
            (staff.permissions ->> p_permission)::boolean,
            false
          )
        end
      from public.staff_members_demo staff
      where staff.auth_user_id = auth.uid()
        and staff.active is true
        and public.ptm_staff_is_enabled_v1(
          staff.auth_status
        )
      limit 1
    ),
    false
  );
$function$;

create or replace function public.ptm_has_community_access_v1(
  p_community_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    (
      select
        case
          when lower(coalesce(staff.role, ''))
            in ('owner', 'admin')
            then true
          when p_community_id is null
            then false
          else p_community_id::text = any(
            coalesce(
              staff.allowed_community_ids,
              array[]::text[]
            )
          )
        end
      from public.staff_members_demo staff
      where staff.auth_user_id = auth.uid()
        and staff.active is true
        and public.ptm_staff_is_enabled_v1(
          staff.auth_status
        )
      limit 1
    ),
    false
  );
$function$;

create or replace function public.ptm_has_venue_access_v1(
  p_venue_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    (
      select
        case
          when lower(coalesce(staff.role, ''))
            in ('owner', 'admin')
            then true
          when p_venue_id is null
            then false
          else p_venue_id::text = any(
            coalesce(
              staff.allowed_venue_ids,
              array[]::text[]
            )
          )
        end
      from public.staff_members_demo staff
      where staff.auth_user_id = auth.uid()
        and staff.active is true
        and public.ptm_staff_is_enabled_v1(
          staff.auth_status
        )
      limit 1
    ),
    false
  );
$function$;

create or replace function public.ptm_has_category_access_v1(
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    (
      select
        case
          when lower(coalesce(staff.role, ''))
            in ('owner', 'admin')
            then true
          when nullif(trim(coalesce(p_category, '')), '')
            is null
            then true
          else upper(trim(p_category)) = any(
            coalesce(
              staff.allowed_categories,
              array[]::text[]
            )
          )
        end
      from public.staff_members_demo staff
      where staff.auth_user_id = auth.uid()
        and staff.active is true
        and public.ptm_staff_is_enabled_v1(
          staff.auth_status
        )
      limit 1
    ),
    false
  );
$function$;

create or replace function public.ptm_has_gender_access_v1(
  p_gender text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    (
      select
        case
          when lower(coalesce(staff.role, ''))
            in ('owner', 'admin')
            then true

          when nullif(
            lower(trim(coalesce(p_gender, ''))),
            ''
          ) is null
            then true

          when lower(trim(p_gender))
            in ('hombre', 'hombres', 'masculino')
            then 'hombre' = any(
              coalesce(
                staff.allowed_genders,
                array[]::text[]
              )
            )

          when lower(trim(p_gender))
            in ('mujer', 'mujeres', 'femenino')
            then 'mujer' = any(
              coalesce(
                staff.allowed_genders,
                array[]::text[]
              )
            )

          when lower(trim(p_gender))
            in ('mixto', 'libre')
            then
              'hombre' = any(
                coalesce(
                  staff.allowed_genders,
                  array[]::text[]
                )
              )
              and
              'mujer' = any(
                coalesce(
                  staff.allowed_genders,
                  array[]::text[]
                )
              )

          else false
        end
      from public.staff_members_demo staff
      where staff.auth_user_id = auth.uid()
        and staff.active is true
        and public.ptm_staff_is_enabled_v1(
          staff.auth_status
        )
      limit 1
    ),
    false
  );
$function$;

create or replace function public.ptm_can_access_event_row_v1(
  p_account_id uuid,
  p_community_id uuid,
  p_venue_id uuid,
  p_category text,
  p_gender_mode text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select
    public.ptm_is_active_staff_v1()
    and p_account_id =
      public.ptm_current_account_id_v1()
    and public.ptm_has_community_access_v1(
      p_community_id
    )
    and public.ptm_has_venue_access_v1(
      p_venue_id
    )
    and public.ptm_has_category_access_v1(
      p_category
    )
    and public.ptm_has_gender_access_v1(
      p_gender_mode
    );
$function$;

create or replace function public.ptm_can_access_event_v1(
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.events event_record
    where event_record.id = p_event_id
      and public.ptm_can_access_event_row_v1(
        event_record.account_id,
        event_record.community_id,
        event_record.venue_id,
        event_record.category::text,
        event_record.gender_mode
      )
  );
$function$;

create or replace function public.ptm_can_access_player_v1(
  p_player_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_player public.players%rowtype;
  v_role text;
  v_has_community boolean;
  v_has_venue boolean;
begin
  select *
  into v_player
  from public.players player_record
  where player_record.id = p_player_id;

  if v_player.id is null then
    return false;
  end if;

  if v_player.account_id
    <> public.ptm_current_account_id_v1()
  then
    return false;
  end if;

  v_role := public.ptm_current_staff_role_v1();

  if v_role in ('owner', 'admin') then
    return true;
  end if;

  if not public.ptm_has_category_access_v1(
    coalesce(
      v_player.validated_category::text,
      v_player.declared_category::text
    )
  ) then
    return false;
  end if;

  if not public.ptm_has_gender_access_v1(
    v_player.gender
  ) then
    return false;
  end if;

  select exists (
    select 1
    from public.player_communities pc
    where pc.player_id = p_player_id
      and public.ptm_has_community_access_v1(
        pc.community_id
      )
  )
  into v_has_community;

  select exists (
    select 1
    from public.player_venues pv
    where pv.player_id = p_player_id
      and public.ptm_has_venue_access_v1(
        pv.venue_id
      )
  )
  into v_has_venue;

  return v_has_community and v_has_venue;
end;
$function$;

create or replace function public.ptm_can_view_payments_v1()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.ptm_has_permission_v1(
    'viewPayments'
  );
$function$;

create or replace function public.ptm_can_edit_payments_v1()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.ptm_has_permission_v1(
    'editPayments'
  );
$function$;

-- =========================================================
-- 4. FUNCIONES INTERNAS DE VALIDACIÓN
-- =========================================================

create or replace function public.ptm_assert_active_staff_v1()
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception
      'Debes iniciar sesión para continuar.';
  end if;

  if not public.ptm_is_active_staff_v1() then
    raise exception
      'Tu acceso interno está deshabilitado o no está vinculado.';
  end if;
end;
$function$;

create or replace function public.ptm_assert_account_v1(
  p_account_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.ptm_assert_active_staff_v1();

  if p_account_id is null
     or p_account_id
       <> public.ptm_current_account_id_v1()
  then
    raise exception
      'La cuenta enviada no corresponde a tu sesión.';
  end if;
end;
$function$;

create or replace function public.ptm_assert_permission_v1(
  p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.ptm_assert_active_staff_v1();

  if not public.ptm_has_permission_v1(
    p_permission
  ) then
    raise exception
      'No tienes permiso para esta acción: %.',
      p_permission;
  end if;
end;
$function$;

create or replace function public.ptm_assert_owner_admin_v1(
  p_account_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.ptm_assert_account_v1(
    p_account_id
  );

  if not public.ptm_is_owner_admin_v1() then
    raise exception
      'Esta acción requiere rol de dueño o administrador.';
  end if;
end;
$function$;

create or replace function public.ptm_assert_event_action_v1(
  p_account_id uuid,
  p_event_id uuid,
  p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.ptm_assert_account_v1(
    p_account_id
  );

  perform public.ptm_assert_permission_v1(
    p_permission
  );

  if not exists (
    select 1
    from public.events event_record
    where event_record.id = p_event_id
      and event_record.account_id = p_account_id
  ) then
    raise exception
      'No se encontró el partido en tu cuenta.';
  end if;

  if not public.ptm_can_access_event_v1(
    p_event_id
  ) then
    raise exception
      'No tienes acceso a la sede, comunidad, categoría o género de este partido.';
  end if;
end;
$function$;

create or replace function public.ptm_assert_player_action_v1(
  p_account_id uuid,
  p_player_id uuid,
  p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.ptm_assert_account_v1(
    p_account_id
  );

  perform public.ptm_assert_permission_v1(
    p_permission
  );

  if not exists (
    select 1
    from public.players player_record
    where player_record.id = p_player_id
      and player_record.account_id = p_account_id
  ) then
    raise exception
      'No se encontró el jugador en tu cuenta.';
  end if;

  if not public.ptm_can_access_player_v1(
    p_player_id
  ) then
    raise exception
      'No tienes acceso al jugador por su categoría, género, comunidad o sede.';
  end if;
end;
$function$;

create or replace function public.ptm_assert_save_player_v1(
  p_account_id uuid,
  p_player_id uuid,
  p_primary_category text,
  p_secondary_category text,
  p_gender text,
  p_community_ids jsonb
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_item jsonb;
  v_community_id uuid;
begin
  perform public.ptm_assert_account_v1(
    p_account_id
  );

  perform public.ptm_assert_permission_v1(
    'managePlayers'
  );

  if p_player_id is not null
     and not public.ptm_can_access_player_v1(
       p_player_id
     )
  then
    raise exception
      'No tienes acceso para editar este jugador.';
  end if;

  if not public.ptm_has_category_access_v1(
    p_primary_category
  ) then
    raise exception
      'La categoría principal está fuera de tu alcance.';
  end if;

  if nullif(
    trim(coalesce(p_secondary_category, '')),
    ''
  ) is not null
     and not public.ptm_has_category_access_v1(
       p_secondary_category
     )
  then
    raise exception
      'La categoría secundaria está fuera de tu alcance.';
  end if;

  if not public.ptm_has_gender_access_v1(
    p_gender
  ) then
    raise exception
      'El género del jugador está fuera de tu alcance.';
  end if;

  if jsonb_typeof(
    coalesce(p_community_ids, '[]'::jsonb)
  ) <> 'array' then
    raise exception
      'La lista de comunidades no tiene formato válido.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(
      coalesce(p_community_ids, '[]'::jsonb)
    )
  loop
    begin
      v_community_id :=
        trim(both '"' from v_item::text)::uuid;
    exception
      when others then
        raise exception
          'Una comunidad enviada no tiene un ID válido.';
    end;

    if not public.ptm_has_community_access_v1(
      v_community_id
    ) then
      raise exception
        'Una de las comunidades está fuera de tu alcance.';
    end if;
  end loop;
end;
$function$;

create or replace function public.ptm_assert_event_edit_v1(
  p_account_id uuid,
  p_event_id uuid,
  p_community_id uuid,
  p_venue_id uuid,
  p_category text,
  p_gender_mode text,
  p_organizer_staff_id text,
  p_commission_amount numeric,
  p_commission_notes text
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_existing_commission numeric;
  v_existing_notes text;
begin
  perform public.ptm_assert_event_action_v1(
    p_account_id,
    p_event_id,
    'createMatches'
  );

  if not public.ptm_can_access_event_row_v1(
    p_account_id,
    p_community_id,
    p_venue_id,
    p_category,
    p_gender_mode
  ) then
    raise exception
      'Los nuevos datos del partido están fuera de tu alcance.';
  end if;

  if not public.ptm_is_owner_admin_v1()
     and nullif(
       trim(coalesce(p_organizer_staff_id, '')),
       ''
     ) is distinct from
       public.ptm_current_staff_id_v1()::text
  then
    raise exception
      'Un asistente solo puede dejarse a sí mismo como organizador.';
  end if;

  select
    coalesce(event_record.commission_amount, 0),
    event_record.commission_notes
  into
    v_existing_commission,
    v_existing_notes
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = p_account_id;

  if (
    coalesce(p_commission_amount, 0)
      is distinct from
      coalesce(v_existing_commission, 0)
    or
    coalesce(p_commission_notes, '')
      is distinct from
      coalesce(v_existing_notes, '')
  )
  and not public.ptm_can_edit_payments_v1()
  then
    raise exception
      'No tienes permiso para cambiar la comisión.';
  end if;
end;
$function$;

-- =========================================================
-- 5. PERFIL DE SESIÓN SEGURO
-- =========================================================

create or replace function public.ptm_current_staff_profile_v1()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'id',
      staff.id,
    'account_id',
      staff.account_id,
    'auth_user_id',
      staff.auth_user_id,
    'full_name',
      staff.full_name,
    'email',
      staff.email,
    'phone',
      staff.phone,
    'role',
      staff.role,
    'active',
      staff.active,
    'auth_status',
      staff.auth_status,
    'must_change_password',
      staff.must_change_password,
    'allowed_categories',
      coalesce(
        staff.allowed_categories,
        array[]::text[]
      ),
    'allowed_community_ids',
      coalesce(
        staff.allowed_community_ids,
        array[]::text[]
      ),
    'allowed_venue_ids',
      coalesce(
        staff.allowed_venue_ids,
        array[]::text[]
      ),
    'allowed_genders',
      coalesce(
        staff.allowed_genders,
        array[]::text[]
      ),
    'permissions',
      coalesce(
        staff.permissions,
        '{}'::jsonb
      ),
    'notes',
      staff.notes,
    'last_login_at',
      staff.last_login_at,
    'can_view_payments',
      public.ptm_can_view_payments_v1(),
    'can_edit_payments',
      public.ptm_can_edit_payments_v1()
  )
  from public.staff_members_demo staff
  where staff.auth_user_id = auth.uid()
    and staff.active is true
    and public.ptm_staff_is_enabled_v1(
      staff.auth_status
    )
  limit 1;
$function$;

create or replace function public.ptm_mark_current_login_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_staff_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Debes iniciar sesión.';
  end if;

  update public.staff_members_demo
  set
    last_login_at = now(),
    auth_status = case
      when lower(
        trim(
          coalesce(
            auth_status,
            'activo'
          )
        )
      ) in (
        'deshabilitado',
        'disabled',
        'inactivo'
      )
        then auth_status
      else 'activo'
    end
  where auth_user_id = auth.uid()
    and active is true
    and lower(
      trim(
        coalesce(
          auth_status,
          'activo'
        )
      )
    ) not in (
      'deshabilitado',
      'disabled',
      'inactivo'
    )
  returning id
  into v_staff_id;

  if v_staff_id is null then
    raise exception
      'Este acceso está deshabilitado o no está vinculado a un usuario interno.';
  end if;

  return jsonb_build_object(
    'ok',
      true,
    'staff_id',
      v_staff_id
  );
end;
$function$;

-- =========================================================
-- 6. RPC SEGURAS PARA OPERACIÓN Y FINANZAS
-- =========================================================

create or replace function public.ptm_create_event_v1(
  p_community_id uuid,
  p_venue_id uuid,
  p_sport_id uuid,
  p_title text,
  p_event_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_courts_count integer,
  p_players_needed integer,
  p_category text,
  p_custom_message text,
  p_payment_default_amount numeric,
  p_payment_default_notes text,
  p_gender_mode text default 'libre'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_account_id uuid;
  v_staff_id uuid;
  v_staff_name text;
  v_commission_enabled boolean;
  v_commission_amount numeric;
  v_sport_id uuid;
  v_category public.category;
  v_event_id uuid;
  v_payment_amount numeric;
  v_payment_notes text;
  v_gender text;
begin
  perform public.ptm_assert_active_staff_v1();
  perform public.ptm_assert_permission_v1(
    'createMatches'
  );

  v_account_id :=
    public.ptm_current_account_id_v1();
  v_staff_id :=
    public.ptm_current_staff_id_v1();

  select
    staff.full_name,
    coalesce(staff.commission_enabled, false),
    greatest(
      coalesce(staff.commission_per_match, 0),
      0
    )
  into
    v_staff_name,
    v_commission_enabled,
    v_commission_amount
  from public.staff_members_demo staff
  where staff.id = v_staff_id
    and staff.account_id = v_account_id;

  if p_community_id is null
     or not public.ptm_has_community_access_v1(
       p_community_id
     )
  then
    raise exception
      'No tienes acceso a la comunidad seleccionada.';
  end if;

  if p_venue_id is null
     or not public.ptm_has_venue_access_v1(
       p_venue_id
     )
  then
    raise exception
      'No tienes acceso a la sede seleccionada.';
  end if;

  if not exists (
    select 1
    from public.communities community_record
    where community_record.id = p_community_id
      and community_record.account_id = v_account_id
      and community_record.active is true
  ) then
    raise exception
      'La comunidad no pertenece a tu cuenta o está inactiva.';
  end if;

  if not exists (
    select 1
    from public.venues venue_record
    where venue_record.id = p_venue_id
      and venue_record.account_id = v_account_id
      and venue_record.active is true
  ) then
    raise exception
      'La sede no pertenece a tu cuenta o está inactiva.';
  end if;

  if not public.ptm_has_category_access_v1(
    p_category
  ) then
    raise exception
      'La categoría está fuera de tu alcance.';
  end if;

  v_gender :=
    lower(
      trim(
        coalesce(
          p_gender_mode,
          'libre'
        )
      )
    );

  if v_gender not in (
    'hombres',
    'mujeres',
    'mixto',
    'libre'
  ) then
    raise exception
      'El género del partido no es válido.';
  end if;

  if not public.ptm_has_gender_access_v1(
    v_gender
  ) then
    raise exception
      'El género del partido está fuera de tu alcance.';
  end if;

  if p_event_date is null then
    raise exception
      'La fecha del partido es obligatoria.';
  end if;

  if p_start_time is null then
    raise exception
      'La hora del partido es obligatoria.';
  end if;

  if p_duration_minutes is null
     or p_duration_minutes < 30
     or p_duration_minutes > 480
  then
    raise exception
      'La duración debe estar entre 30 y 480 minutos.';
  end if;

  if p_courts_count is null
     or p_courts_count < 1
     or p_courts_count > 20
  then
    raise exception
      'La cantidad de canchas debe estar entre 1 y 20.';
  end if;

  if p_players_needed is null
     or p_players_needed < 2
     or p_players_needed > 100
  then
    raise exception
      'La cantidad de jugadores debe estar entre 2 y 100.';
  end if;

  begin
    v_category :=
      upper(trim(p_category))::public.category;
  exception
    when others then
      raise exception
        'La categoría no es válida.';
  end;

  v_sport_id := p_sport_id;

  if v_sport_id is null then
    select sport.id
    into v_sport_id
    from public.sports sport
    where sport.code = 'padel'
      and sport.active is true
    limit 1;
  end if;

  if v_sport_id is null
     or not exists (
       select 1
       from public.sports sport
       where sport.id = v_sport_id
         and sport.active is true
     )
  then
    raise exception
      'No se encontró un deporte activo para el partido.';
  end if;

  if public.ptm_can_edit_payments_v1() then
    v_payment_amount :=
      greatest(
        coalesce(
          p_payment_default_amount,
          0
        ),
        0
      );

    v_payment_notes :=
      nullif(
        trim(
          coalesce(
            p_payment_default_notes,
            ''
          )
        ),
        ''
      );
  else
    v_payment_amount := null;
    v_payment_notes := null;
  end if;

  if not v_commission_enabled then
    v_commission_amount := 0;
  end if;

  insert into public.events (
    account_id,
    community_id,
    venue_id,
    sport_id,
    title,
    event_type,
    event_date,
    start_time,
    duration_minutes,
    courts_count,
    players_needed,
    category,
    status,
    custom_message,
    payment_default_amount,
    payment_default_notes,
    gender_mode,
    organizer_staff_id,
    organizer_name,
    commission_amount,
    commission_status,
    created_at,
    updated_at
  )
  values (
    v_account_id,
    p_community_id,
    p_venue_id,
    v_sport_id,
    coalesce(
      nullif(trim(coalesce(p_title, '')), ''),
      concat(
        v_category::text,
        ' · ',
        p_event_date::text,
        ' ',
        to_char(p_start_time, 'HH24:MI')
      )
    ),
    'partido_libre',
    p_event_date,
    p_start_time,
    p_duration_minutes,
    p_courts_count,
    p_players_needed,
    v_category,
    'buscando_jugadores',
    nullif(
      trim(
        coalesce(
          p_custom_message,
          ''
        )
      ),
      ''
    ),
    v_payment_amount,
    v_payment_notes,
    v_gender,
    v_staff_id::text,
    v_staff_name,
    v_commission_amount,
    case
      when v_commission_amount > 0
        then 'pendiente'
      else 'no_aplica'
    end,
    now(),
    now()
  )
  returning id
  into v_event_id;

  return jsonb_build_object(
    'ok',
      true,
    'event_id',
      v_event_id,
    'organizer_staff_id',
      v_staff_id,
    'organizer_name',
      v_staff_name,
    'financial_values_saved',
      public.ptm_can_edit_payments_v1()
  );
end;
$function$;

create or replace function public.ptm_update_event_reservation_v1(
  p_event_id uuid,
  p_status text,
  p_notes text,
  p_reference text,
  p_court_number text,
  p_operator_name text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_account_id uuid;
  v_status text;
begin
  v_account_id :=
    public.ptm_current_account_id_v1();

  perform public.ptm_assert_event_action_v1(
    v_account_id,
    p_event_id,
    'manageReservation'
  );

  v_status :=
    lower(
      trim(
        coalesce(
          p_status,
          ''
        )
      )
    );

  if v_status not in (
    'pendiente_reservar',
    'solicitada',
    'reservada',
    'no_disponible',
    'cancelada'
  ) then
    raise exception
      'El estado de reserva no es válido.';
  end if;

  update public.events
  set
    court_reservation_status = v_status,
    court_reservation_notes =
      nullif(trim(coalesce(p_notes, '')), ''),
    court_reservation_reference =
      nullif(trim(coalesce(p_reference, '')), ''),
    court_number =
      nullif(trim(coalesce(p_court_number, '')), ''),
    court_reservation_requested_at = case
      when v_status = 'solicitada'
        then coalesce(
          court_reservation_requested_at,
          now()
        )
      else court_reservation_requested_at
    end,
    court_reserved_at = case
      when v_status = 'reservada'
        then now()
      else null
    end,
    court_reserved_by = case
      when v_status = 'reservada'
        then coalesce(
          nullif(
            trim(
              coalesce(
                p_operator_name,
                ''
              )
            ),
            ''
          ),
          (
            select staff.full_name
            from public.staff_members_demo staff
            where staff.id =
              public.ptm_current_staff_id_v1()
          )
        )
      else null
    end,
    updated_at = now(),
    last_edited_by = coalesce(
      nullif(
        trim(
          coalesce(
            p_operator_name,
            ''
          )
        ),
        ''
      ),
      (
        select staff.full_name
        from public.staff_members_demo staff
        where staff.id =
          public.ptm_current_staff_id_v1()
      )
    )
  where id = p_event_id
    and account_id = v_account_id;

  return jsonb_build_object(
    'ok',
      true,
    'event_id',
      p_event_id,
    'court_reservation_status',
      v_status
  );
end;
$function$;

create or replace function public.ptm_update_event_finance_v1(
  p_event_id uuid,
  p_payment_default_amount numeric,
  p_payment_default_notes text,
  p_court_cost numeric,
  p_other_expenses numeric,
  p_financial_notes text,
  p_operator_name text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_account_id uuid;
begin
  v_account_id :=
    public.ptm_current_account_id_v1();

  perform public.ptm_assert_event_action_v1(
    v_account_id,
    p_event_id,
    'editPayments'
  );

  update public.events
  set
    payment_default_amount =
      greatest(
        coalesce(
          p_payment_default_amount,
          0
        ),
        0
      ),
    payment_default_notes =
      nullif(
        trim(
          coalesce(
            p_payment_default_notes,
            ''
          )
        ),
        ''
      ),
    court_cost =
      greatest(
        coalesce(
          p_court_cost,
          0
        ),
        0
      ),
    other_expenses =
      greatest(
        coalesce(
          p_other_expenses,
          0
        ),
        0
      ),
    financial_notes =
      nullif(
        trim(
          coalesce(
            p_financial_notes,
            ''
          )
        ),
        ''
      ),
    updated_at = now(),
    last_edited_by = coalesce(
      nullif(
        trim(
          coalesce(
            p_operator_name,
            ''
          )
        ),
        ''
      ),
      (
        select staff.full_name
        from public.staff_members_demo staff
        where staff.id =
          public.ptm_current_staff_id_v1()
      )
    )
  where id = p_event_id
    and account_id = v_account_id;

  return jsonb_build_object(
    'ok',
      true,
    'event_id',
      p_event_id
  );
end;
$function$;

create or replace function public.ptm_update_participation_payment_v1(
  p_event_id uuid,
  p_player_id uuid,
  p_payment_status text,
  p_payment_method text,
  p_payment_amount numeric,
  p_payment_reference text,
  p_payment_notes text,
  p_payment_proof_url text,
  p_payment_due_amount numeric,
  p_payment_due_notes text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_account_id uuid;
  v_status text;
  v_method text;
  v_amount numeric;
  v_due numeric;
begin
  v_account_id :=
    public.ptm_current_account_id_v1();

  perform public.ptm_assert_event_action_v1(
    v_account_id,
    p_event_id,
    'editPayments'
  );

  if not exists (
    select 1
    from public.participations participation
    where participation.event_id = p_event_id
      and participation.player_id = p_player_id
      and participation.account_id = v_account_id
  ) then
    raise exception
      'No se encontró la participación del jugador.';
  end if;

  v_status :=
    lower(
      trim(
        coalesce(
          p_payment_status,
          'pendiente'
        )
      )
    );

  if v_status = 'no_pagado' then
    v_status := 'no_pago';
  end if;

  if v_status not in (
    'pendiente',
    'pagado',
    'no_pago'
  ) then
    raise exception
      'El estado de pago no es válido.';
  end if;

  v_method :=
    nullif(
      lower(
        trim(
          coalesce(
            p_payment_method,
            ''
          )
        )
      ),
      ''
    );

  v_amount :=
    case
      when p_payment_amount is null
        then null
      else greatest(p_payment_amount, 0)
    end;

  v_due :=
    case
      when p_payment_due_amount is null
        then null
      else greatest(p_payment_due_amount, 0)
    end;

  if v_status = 'pagado'
     and v_amount is null
  then
    v_amount := coalesce(v_due, 0);
  end if;

  if v_status <> 'pagado' then
    v_method := null;
  end if;

  update public.participations
  set
    payment_status = v_status,
    payment_method = v_method,
    payment_amount = case
      when v_status = 'pagado'
        then v_amount
      when v_status = 'no_pago'
        then 0
      else null
    end,
    amount_paid = case
      when v_status = 'pagado'
        then v_amount
      when v_status = 'no_pago'
        then 0
      else null
    end,
    payment_reference =
      nullif(
        trim(
          coalesce(
            p_payment_reference,
            ''
          )
        ),
        ''
      ),
    payment_notes =
      nullif(
        trim(
          coalesce(
            p_payment_notes,
            ''
          )
        ),
        ''
      ),
    payment_proof_url =
      nullif(
        trim(
          coalesce(
            p_payment_proof_url,
            ''
          )
        ),
        ''
      ),
    payment_due_amount = v_due,
    payment_due_notes =
      nullif(
        trim(
          coalesce(
            p_payment_due_notes,
            ''
          )
        ),
        ''
      ),
    paid_at = case
      when v_status = 'pagado'
        then now()
      else null
    end
  where event_id = p_event_id
    and player_id = p_player_id
    and account_id = v_account_id;

  return jsonb_build_object(
    'ok',
      true,
    'event_id',
      p_event_id,
    'player_id',
      p_player_id,
    'payment_status',
      v_status
  );
end;
$function$;

create or replace function public.ptm_apply_event_default_price_v1(
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_account_id uuid;
  v_default_amount numeric;
  v_default_notes text;
  v_updated integer;
begin
  v_account_id :=
    public.ptm_current_account_id_v1();

  perform public.ptm_assert_event_action_v1(
    v_account_id,
    p_event_id,
    'editPayments'
  );

  select
    event_record.payment_default_amount,
    event_record.payment_default_notes
  into
    v_default_amount,
    v_default_notes
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = v_account_id;

  if v_default_amount is null then
    raise exception
      'Primero define el precio base del partido.';
  end if;

  update public.participations
  set
    payment_due_amount =
      greatest(
        coalesce(
          v_default_amount,
          0
        ),
        0
      ),
    payment_due_notes =
      coalesce(
        v_default_notes,
        'Precio base del partido'
      ),
    payment_status = case
      when coalesce(v_default_amount, 0) = 0
        then 'pagado'
      else 'pendiente'
    end,
    payment_method = null,
    payment_amount = case
      when coalesce(v_default_amount, 0) = 0
        then 0
      else null
    end,
    amount_paid = case
      when coalesce(v_default_amount, 0) = 0
        then 0
      else null
    end,
    paid_at = case
      when coalesce(v_default_amount, 0) = 0
        then now()
      else null
    end
  where event_id = p_event_id
    and account_id = v_account_id
    and status::text = 'confirmado'
    and payment_due_amount is null;

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'ok',
      true,
    'event_id',
      p_event_id,
    'updated_participations',
      v_updated
  );
end;
$function$;

-- =========================================================
-- 7. FUNCIONES OPERATIVAS EXISTENTES, AHORA PROTEGIDAS
-- =========================================================

CREATE OR REPLACE FUNCTION public.ptm_cancel_event_v1(p_account_id uuid, p_event_id uuid, p_operator_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_status text;
begin

  perform public.ptm_assert_event_action_v1(
    p_account_id,
    p_event_id,
    'cancelMatches'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ptm-event-' || p_event_id::text,
      0
    )
  );

  select event_record.status::text
  into v_status
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = p_account_id
  for update;

  if v_status is null then
    raise exception
      'No se encontró el partido.';
  end if;

  if v_status = 'jugado' then
    raise exception
      'El partido ya fue jugado. Resuelve los pagos y ciérralo; no lo canceles.';
  end if;

  if v_status = 'cerrado' then
    raise exception
      'El partido ya está cerrado.';
  end if;

  if v_status = 'cancelado' then
    return jsonb_build_object(
      'ok', true,
      'event_id', p_event_id,
      'status', 'cancelado'
    );
  end if;

  update public.events
  set
    status = 'cancelado',
    canceled_at = now(),
    close_notes = case
      when nullif(trim(coalesce(p_operator_name, '')), '') is null
        then close_notes
      else concat(
        coalesce(close_notes || E'\n', ''),
        'Cancelado por ',
        trim(p_operator_name),
        '.'
      )
    end
  where id = p_event_id
    and account_id = p_account_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'status', 'cancelado'
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_change_participation_status_v1(p_event_id uuid, p_player_id uuid, p_requested_status text, p_account_id uuid, p_payment_due_amount numeric DEFAULT NULL::numeric, p_payment_due_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_capacity integer;
  v_event_status text;

  v_default_amount numeric;
  v_default_notes text;

  v_due_amount numeric;
  v_due_notes text;
  v_is_free boolean;

  v_previous_status text;
  v_final_status text;

  v_confirmed_count integer := 0;
  v_waitlist_position integer;
  v_existing_waitlist_position integer;

  v_promoted_player_id uuid;
begin

  perform public.ptm_assert_event_action_v1(
    p_account_id,
    p_event_id,
    'registerResponses'
  );

  if not public.ptm_can_access_player_v1(
    p_player_id
  ) then
    raise exception
      'No tienes acceso al jugador seleccionado.';
  end if;

  -- -------------------------------------------------------
  -- 1. VALIDAR LA ACCIÓN
  -- -------------------------------------------------------

  if p_requested_status not in (
    'confirmado',
    'lista_espera',
    'rechazo',
    'ambiguo',
    'pendiente'
  ) then
    raise exception
      'Estado no permitido: %',
      p_requested_status;
  end if;

  -- -------------------------------------------------------
  -- 2. CANDADO DEL PARTIDO
  -- Evita que dos administradores ocupen el último cupo
  -- al mismo tiempo.
  -- -------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtext(p_event_id::text)
  );

  select
    greatest(coalesce(e.players_needed, 4), 1),
    e.status::text,
    coalesce(e.payment_default_amount, 0),
    e.payment_default_notes
  into
    v_capacity,
    v_event_status,
    v_default_amount,
    v_default_notes
  from public.events e
  where e.id = p_event_id
    and e.account_id = p_account_id
  for update;

  if not found then
    raise exception
      'No se encontró el partido o no pertenece a esta cuenta.';
  end if;

  if v_event_status in ('cancelado', 'cerrado') then
    raise exception
      'No se pueden modificar cupos de un partido cancelado o cerrado.';
  end if;

  -- -------------------------------------------------------
  -- 3. ESTADO ANTERIOR DEL JUGADOR
  -- -------------------------------------------------------

  select p.status::text
  into v_previous_status
  from public.participations p
  where p.event_id = p_event_id
    and p.player_id = p_player_id
  for update;

  -- -------------------------------------------------------
  -- 4. CONFIRMAR JUGADOR
  -- Si no hay cupo, entra automáticamente a espera.
  -- -------------------------------------------------------

  if p_requested_status = 'confirmado' then
    select count(*)
    into v_confirmed_count
    from public.participations p
    where p.event_id = p_event_id
      and p.status = 'confirmado'
      and p.player_id <> p_player_id;

    if v_confirmed_count < v_capacity then
      v_due_amount :=
        coalesce(
          p_payment_due_amount,
          v_default_amount,
          0
        );

      v_due_notes :=
        coalesce(
          nullif(trim(p_payment_due_notes), ''),
          v_default_notes,
          'Precio base del partido'
        );

      v_is_free := v_due_amount = 0;

      insert into public.participations (
        account_id,
        event_id,
        player_id,
        status,
        waitlist_position,
        source,
        confirmed_at,

        payment_due_amount,
        payment_due_notes,
        payment_status,
        payment_amount,
        payment_notes,
        paid_at
      )
      values (
        p_account_id,
        p_event_id,
        p_player_id,
        'confirmado',
        null,
        'manual',
        now(),

        v_due_amount,
        v_due_notes,
        case
          when v_is_free then 'pagado'
          else 'pendiente'
        end,
        case
          when v_is_free then 0
          else null
        end,
        case
          when v_is_free
            then 'Gratis / cortesía por precio base del evento.'
          else null
        end,
        case
          when v_is_free then now()
          else null
        end
      )
      on conflict (event_id, player_id)
      do update set
        account_id = excluded.account_id,
        status = 'confirmado',
        waitlist_position = null,
        source = 'manual',
        confirmed_at = now(),

        payment_due_amount =
          coalesce(
            public.participations.payment_due_amount,
            excluded.payment_due_amount
          ),

        payment_due_notes =
          coalesce(
            public.participations.payment_due_notes,
            excluded.payment_due_notes
          ),

        payment_status =
          case
            when public.participations.payment_status::text = 'pagado'
              then public.participations.payment_status

            when coalesce(
              public.participations.payment_due_amount,
              excluded.payment_due_amount,
              0
            ) = 0
              then 'pagado'

            else 'pendiente'
          end,

        payment_amount =
          case
            when public.participations.payment_status::text = 'pagado'
              then public.participations.payment_amount

            when coalesce(
              public.participations.payment_due_amount,
              excluded.payment_due_amount,
              0
            ) = 0
              then 0

            else public.participations.payment_amount
          end,

        paid_at =
          case
            when public.participations.payment_status::text = 'pagado'
              then public.participations.paid_at

            when coalesce(
              public.participations.payment_due_amount,
              excluded.payment_due_amount,
              0
            ) = 0
              then now()

            else null
          end;

      v_final_status := 'confirmado';
      v_waitlist_position := null;
    else
      select p.waitlist_position
      into v_existing_waitlist_position
      from public.participations p
      where p.event_id = p_event_id
        and p.player_id = p_player_id
        and p.status = 'lista_espera';

      if v_existing_waitlist_position is not null then
        v_waitlist_position :=
          v_existing_waitlist_position;
      else
        select
          coalesce(
            max(p.waitlist_position),
            0
          ) + 1
        into v_waitlist_position
        from public.participations p
        where p.event_id = p_event_id
          and p.status = 'lista_espera';
      end if;

      insert into public.participations (
        account_id,
        event_id,
        player_id,
        status,
        waitlist_position,
        source,
        confirmed_at
      )
      values (
        p_account_id,
        p_event_id,
        p_player_id,
        'lista_espera',
        v_waitlist_position,
        'manual',
        null
      )
      on conflict (event_id, player_id)
      do update set
        account_id = excluded.account_id,
        status = 'lista_espera',
        waitlist_position =
          excluded.waitlist_position,
        source = 'manual',
        confirmed_at = null;

      v_final_status := 'lista_espera';
    end if;

  -- -------------------------------------------------------
  -- 5. ENVIAR DIRECTAMENTE A LISTA DE ESPERA
  -- -------------------------------------------------------

  elsif p_requested_status = 'lista_espera' then
    select p.waitlist_position
    into v_existing_waitlist_position
    from public.participations p
    where p.event_id = p_event_id
      and p.player_id = p_player_id
      and p.status = 'lista_espera';

    if v_existing_waitlist_position is not null then
      v_waitlist_position :=
        v_existing_waitlist_position;
    else
      select
        coalesce(
          max(p.waitlist_position),
          0
        ) + 1
      into v_waitlist_position
      from public.participations p
      where p.event_id = p_event_id
        and p.status = 'lista_espera';
    end if;

    insert into public.participations (
      account_id,
      event_id,
      player_id,
      status,
      waitlist_position,
      source,
      confirmed_at
    )
    values (
      p_account_id,
      p_event_id,
      p_player_id,
      'lista_espera',
      v_waitlist_position,
      'manual',
      null
    )
    on conflict (event_id, player_id)
    do update set
      account_id = excluded.account_id,
      status = 'lista_espera',
      waitlist_position =
        excluded.waitlist_position,
      source = 'manual',
      confirmed_at = null;

    v_final_status := 'lista_espera';

  -- -------------------------------------------------------
  -- 6. MARCAR COMO NO PUEDE
  -- -------------------------------------------------------

  elsif p_requested_status = 'rechazo' then
    insert into public.participations (
      account_id,
      event_id,
      player_id,
      status,
      waitlist_position,
      source,
      confirmed_at
    )
    values (
      p_account_id,
      p_event_id,
      p_player_id,
      'rechazo',
      null,
      'manual',
      null
    )
    on conflict (event_id, player_id)
    do update set
      account_id = excluded.account_id,
      status = 'rechazo',
      waitlist_position = null,
      source = 'manual',
      confirmed_at = null;

    v_final_status := 'rechazo';
    v_waitlist_position := null;

  -- -------------------------------------------------------
  -- 7. MARCAR RESPUESTA AMBIGUA
  -- -------------------------------------------------------

  elsif p_requested_status = 'ambiguo' then
    insert into public.participations (
      account_id,
      event_id,
      player_id,
      status,
      waitlist_position,
      source,
      confirmed_at
    )
    values (
      p_account_id,
      p_event_id,
      p_player_id,
      'ambiguo',
      null,
      'manual',
      null
    )
    on conflict (event_id, player_id)
    do update set
      account_id = excluded.account_id,
      status = 'ambiguo',
      waitlist_position = null,
      source = 'manual',
      confirmed_at = null;

    v_final_status := 'ambiguo';
    v_waitlist_position := null;

  -- -------------------------------------------------------
  -- 8. VOLVER A PENDIENTE
  -- No borra el historial ni los pagos.
  -- -------------------------------------------------------

  else
    update public.participations
    set
      status = 'no_respondio',
      waitlist_position = null,
      confirmed_at = null
    where event_id = p_event_id
      and player_id = p_player_id;

    v_final_status := 'pendiente';
    v_waitlist_position := null;
  end if;

  -- -------------------------------------------------------
  -- 9. PROMOVER AUTOMÁTICAMENTE AL PRIMERO DE LA ESPERA
  -- Solo ocurre cuando alguien que estaba confirmado sale.
  -- -------------------------------------------------------

  if v_previous_status = 'confirmado'
     and v_final_status <> 'confirmado' then

    select p.player_id
    into v_promoted_player_id
    from public.participations p
    where p.event_id = p_event_id
      and p.status = 'lista_espera'
      and p.player_id <> p_player_id
    order by
      p.waitlist_position nulls last,
      p.player_id
    limit 1
    for update;

    if v_promoted_player_id is not null then
      v_due_amount :=
        coalesce(
          p_payment_due_amount,
          v_default_amount,
          0
        );

      v_due_notes :=
        coalesce(
          nullif(trim(p_payment_due_notes), ''),
          v_default_notes,
          'Precio base del partido'
        );

      v_is_free := v_due_amount = 0;

      update public.participations
      set
        status = 'confirmado',
        waitlist_position = null,
        confirmed_at = now(),

        payment_due_amount =
          coalesce(
            payment_due_amount,
            v_due_amount
          ),

        payment_due_notes =
          coalesce(
            payment_due_notes,
            v_due_notes
          ),

        payment_status =
          case
            when payment_status::text = 'pagado'
              then payment_status

            when coalesce(
              payment_due_amount,
              v_due_amount,
              0
            ) = 0
              then 'pagado'

            else 'pendiente'
          end,

        payment_amount =
          case
            when payment_status::text = 'pagado'
              then payment_amount

            when coalesce(
              payment_due_amount,
              v_due_amount,
              0
            ) = 0
              then 0

            else payment_amount
          end,

        paid_at =
          case
            when payment_status::text = 'pagado'
              then paid_at

            when coalesce(
              payment_due_amount,
              v_due_amount,
              0
            ) = 0
              then now()

            else null
          end
      where event_id = p_event_id
        and player_id =
          v_promoted_player_id;
    end if;
  end if;

  -- -------------------------------------------------------
  -- 10. REORDENAR LA LISTA DE ESPERA
  -- Siempre quedará 1, 2, 3, 4...
  -- -------------------------------------------------------

  with ordered_waitlist as (
    select
      p.event_id,
      p.player_id,
      row_number() over (
        order by
          p.waitlist_position nulls last,
          p.player_id
      )::integer as new_position
    from public.participations p
    where p.event_id = p_event_id
      and p.status = 'lista_espera'
  )
  update public.participations p
  set waitlist_position =
    ordered_waitlist.new_position
  from ordered_waitlist
  where p.event_id =
      ordered_waitlist.event_id
    and p.player_id =
      ordered_waitlist.player_id;

  -- -------------------------------------------------------
  -- 11. ACTUALIZAR ESTADO DEL PARTIDO
  -- -------------------------------------------------------

  select count(*)
  into v_confirmed_count
  from public.participations p
  where p.event_id = p_event_id
    and p.status = 'confirmado';

  update public.events
  set status =
    case
      when status::text in (
        'cancelado',
        'cerrado'
      ) then status

      when v_confirmed_count >=
        v_capacity
        then 'completo'

      else 'buscando_jugadores'
    end
  where id = p_event_id
    and account_id = p_account_id;

  -- Obtener la posición final, si quedó esperando.
  select p.waitlist_position
  into v_waitlist_position
  from public.participations p
  where p.event_id = p_event_id
    and p.player_id = p_player_id
    and p.status = 'lista_espera';

  return jsonb_build_object(
    'ok', true,
    'previous_status',
      coalesce(
        v_previous_status,
        'pendiente'
      ),
    'final_status',
      v_final_status,
    'waitlist_position',
      v_waitlist_position,
    'promoted_player_id',
      v_promoted_player_id,
    'confirmed_count',
      v_confirmed_count,
    'capacity',
      v_capacity,
    'spots_remaining',
      greatest(
        v_capacity -
        v_confirmed_count,
        0
      )
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_close_event_v1(p_account_id uuid, p_event_id uuid, p_operator_name text, p_close_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_status text;
  v_unresolved integer := 0;
begin

  perform public.ptm_assert_event_action_v1(
    p_account_id,
    p_event_id,
    'editPayments'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ptm-event-' || p_event_id::text,
      0
    )
  );

  select event_record.status::text
  into v_status
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = p_account_id
  for update;

  if v_status is null then
    raise exception
      'No se encontró el partido.';
  end if;

  if v_status = 'cancelado' then
    raise exception
      'Un partido cancelado no puede cerrarse como jugado.';
  end if;

  if v_status = 'cerrado' then
    return jsonb_build_object(
      'ok', true,
      'event_id', p_event_id,
      'status', 'cerrado',
      'unresolved_payments', 0
    );
  end if;

  if v_status <> 'jugado' then
    raise exception
      'Primero marca el partido como jugado.';
  end if;

  select count(*)
  into v_unresolved
  from public.participations participation
  where participation.event_id = p_event_id
    and participation.status::text = 'confirmado'
    and not (
      coalesce(
        participation.payment_status::text,
        'pendiente'
      ) in ('no_pago', 'no_pagado')
      or (
        participation.payment_status::text = 'pagado'
        and coalesce(
          participation.payment_amount,
          0
        ) >= coalesce(
          participation.payment_due_amount,
          0
        )
      )
    );

  if v_unresolved > 0 then
    raise exception
      'Todavía hay % pago(s) pendiente(s) o parcial(es). Resuélvelos como pagado, gratis o no pagó antes de cerrar.',
      v_unresolved;
  end if;

  update public.events
  set
    status = 'cerrado',
    closed_at = now(),
    closed_by =
      nullif(
        trim(coalesce(p_operator_name, '')),
        ''
      ),
    close_notes =
      nullif(
        trim(coalesce(p_close_notes, '')),
        ''
      )
  where id = p_event_id
    and account_id = p_account_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'status', 'cerrado',
    'unresolved_payments', 0
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_delete_venue_v1(p_account_id uuid, p_venue_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_name text;
begin

  perform public.ptm_assert_owner_admin_v1(
    p_account_id
  );

  if not public.ptm_has_venue_access_v1(
    p_venue_id
  ) then
    raise exception
      'No tienes acceso a esta sede.';
  end if;

  select name
  into v_name
  from public.venues
  where id = p_venue_id
    and account_id = p_account_id
  for update;

  if v_name is null then
    raise exception 'No se encontró la sede.';
  end if;

  if lower(trim(v_name)) in ('otra / por definir', 'otra/por definir') then
    raise exception 'La sede “Otra / por definir” es una opción del sistema y no se puede borrar.';
  end if;

  if exists (
    select 1
    from public.events
    where venue_id = p_venue_id
  ) then
    raise exception 'Esta sede ya tiene partidos relacionados. No se puede borrar; desactívala para conservar el historial.';
  end if;

  if to_regclass('public.community_venues') is not null then
    execute 'delete from public.community_venues where venue_id = $1'
    using p_venue_id;
  end if;

  if to_regclass('public.player_venues') is not null then
    execute 'delete from public.player_venues where venue_id = $1'
    using p_venue_id;
  end if;

  delete from public.venues
  where id = p_venue_id
    and account_id = p_account_id;

  return jsonb_build_object(
    'ok', true,
    'deleted_venue_id', p_venue_id
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_mark_event_played_v1(p_account_id uuid, p_event_id uuid, p_operator_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_status text;
begin

  perform public.ptm_assert_event_action_v1(
    p_account_id,
    p_event_id,
    'createMatches'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ptm-event-' || p_event_id::text,
      0
    )
  );

  select event_record.status::text
  into v_status
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = p_account_id
  for update;

  if v_status is null then
    raise exception
      'No se encontró el partido.';
  end if;

  if v_status = 'cancelado' then
    raise exception
      'Un partido cancelado no puede marcarse como jugado.';
  end if;

  if v_status = 'cerrado' then
    raise exception
      'El partido ya está cerrado.';
  end if;

  update public.events
  set
    status = 'jugado',
    played_at = coalesce(played_at, now()),
    close_notes = case
      when nullif(trim(coalesce(p_operator_name, '')), '') is null
        then close_notes
      else concat(
        coalesce(close_notes || E'\n', ''),
        'Marcado como jugado por ',
        trim(p_operator_name),
        '.'
      )
    end
  where id = p_event_id
    and account_id = p_account_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'status', 'jugado'
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_replace_player_availability_v1(p_account_id uuid, p_player_id uuid, p_schedule jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_item jsonb;
  v_day integer;
  v_start time;
  v_end time;
  v_inserted integer := 0;
begin

  perform public.ptm_assert_player_action_v1(
    p_account_id,
    p_player_id,
    'managePlayers'
  );

  -- -------------------------------------------------------
  -- 1. COMPROBAR QUE EL JUGADOR PERTENECE A LA CUENTA
  -- -------------------------------------------------------

  if not exists (
    select 1
    from public.players p
    where p.id = p_player_id
      and p.account_id = p_account_id
  ) then
    raise exception
      'No se encontró el jugador o no pertenece a esta cuenta.';
  end if;

  -- -------------------------------------------------------
  -- 2. VALIDAR EL FORMATO RECIBIDO
  -- -------------------------------------------------------

  if p_schedule is null then
    p_schedule := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_schedule) <> 'array' then
    raise exception
      'La disponibilidad debe enviarse como una lista.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_schedule)
  loop
    begin
      v_day :=
        (v_item ->> 'day_of_week')::integer;

      v_start :=
        (v_item ->> 'start_time')::time;

      v_end :=
        (v_item ->> 'end_time')::time;
    exception
      when others then
        raise exception
          'Existe un día u horario con formato incorrecto.';
    end;

    if v_day < 1 or v_day > 7 then
      raise exception
        'El día de la semana debe estar entre 1 y 7.';
    end if;

    if v_start >= v_end then
      raise exception
        'La hora final debe ser mayor que la hora inicial.';
    end if;
  end loop;

  -- -------------------------------------------------------
  -- 3. BLOQUEAR MOMENTÁNEAMENTE EL PERFIL
  -- Evita que dos personas guarden al mismo tiempo.
  -- -------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ptm-availability-' ||
      p_player_id::text,
      0
    )
  );

  -- -------------------------------------------------------
  -- 4. BORRAR E INSERTAR EN UNA SOLA TRANSACCIÓN
  -- Si algo falla, Supabase recupera los horarios anteriores.
  -- -------------------------------------------------------

  delete from public.player_availability
  where player_id = p_player_id;

  insert into public.player_availability (
    account_id,
    player_id,
    day_of_week,
    start_time,
    end_time
  )
  select
    p_account_id,
    p_player_id,
    parsed.day_of_week,
    parsed.start_time,
    parsed.end_time
  from (
    select distinct on (
      (item ->> 'day_of_week')::integer
    )
      (item ->> 'day_of_week')::integer
        as day_of_week,

      (item ->> 'start_time')::time
        as start_time,

      (item ->> 'end_time')::time
        as end_time

    from jsonb_array_elements(
      p_schedule
    ) as item

    order by
      (item ->> 'day_of_week')::integer,
      (item ->> 'start_time')::time
  ) as parsed
  order by parsed.day_of_week;

  get diagnostics
    v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'player_id', p_player_id,
    'saved_days', v_inserted
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_save_player_profile_v2(p_account_id uuid, p_player_id uuid, p_first_name text, p_last_name text, p_whatsapp text, p_gender text, p_primary_category text, p_secondary_category text, p_preferred_side text, p_active boolean, p_community_ids jsonb, p_schedule jsonb, p_notes text, p_availability_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_player_id uuid;
  v_existing_player_id uuid;

  v_primary_category public.category;
  v_secondary_category public.category;

  v_phone_digits text;
  v_reused_existing boolean := false;

  v_item jsonb;
  v_day integer;
  v_start time;
  v_end time;

  v_saved_communities integer := 0;
  v_saved_days integer := 0;
begin

  perform public.ptm_assert_save_player_v1(
    p_account_id,
    p_player_id,
    p_primary_category,
    p_secondary_category,
    p_gender,
    p_community_ids
  );

  -- -------------------------------------------------------
  -- 1. VALIDAR NOMBRE Y WHATSAPP
  -- -------------------------------------------------------

  if nullif(
    trim(
      coalesce(
        p_first_name,
        ''
      )
    ),
    ''
  ) is null then
    raise exception
      'El nombre del jugador es obligatorio.';
  end if;

  v_phone_digits :=
    regexp_replace(
      coalesce(
        p_whatsapp,
        ''
      ),
      '[^0-9]',
      '',
      'g'
    );

  if length(v_phone_digits) < 8 then
    raise exception
      'El WhatsApp del jugador no es válido.';
  end if;

  -- -------------------------------------------------------
  -- 2. CONVERTIR CATEGORÍAS DE TEXTO AL ENUM REAL
  -- Esta es la corrección del error mostrado en pantalla.
  -- -------------------------------------------------------

  begin
    v_primary_category :=
      p_primary_category::public.category;
  exception
    when others then
      raise exception
        'La categoría principal no es válida.';
  end;

  if p_secondary_category is null
     or trim(p_secondary_category) = '' then

    v_secondary_category := null;

  else
    begin
      v_secondary_category :=
        p_secondary_category::public.category;
    exception
      when others then
        raise exception
          'La categoría secundaria no es válida.';
    end;

    if abs(
      substring(
        v_primary_category::text
        from 2
      )::integer
      -
      substring(
        v_secondary_category::text
        from 2
      )::integer
    ) <> 1 then
      raise exception
        'La categoría secundaria debe estar inmediatamente arriba o abajo de la principal.';
    end if;
  end if;

  -- -------------------------------------------------------
  -- 3. VALIDAR GÉNERO Y LADO
  -- -------------------------------------------------------

  if p_gender not in (
    'hombre',
    'mujer'
  ) then
    raise exception
      'El género seleccionado no es válido.';
  end if;

  if p_preferred_side not in (
    'drive',
    'reves',
    'cualquiera'
  ) then
    raise exception
      'El lado seleccionado no es válido.';
  end if;

  -- -------------------------------------------------------
  -- 4. PREPARAR LISTAS
  -- -------------------------------------------------------

  p_community_ids :=
    coalesce(
      p_community_ids,
      '[]'::jsonb
    );

  p_schedule :=
    coalesce(
      p_schedule,
      '[]'::jsonb
    );

  if jsonb_typeof(
    p_community_ids
  ) <> 'array' then
    raise exception
      'Las comunidades deben enviarse como una lista.';
  end if;

  if jsonb_typeof(
    p_schedule
  ) <> 'array' then
    raise exception
      'La disponibilidad debe enviarse como una lista.';
  end if;

  -- -------------------------------------------------------
  -- 5. VALIDAR COMUNIDADES
  -- -------------------------------------------------------

  if exists (
    select 1
    from jsonb_array_elements_text(
      p_community_ids
    ) selected
    left join public.communities community
      on community.id =
        selected.value::uuid
     and community.account_id =
        p_account_id
    where community.id is null
  ) then
    raise exception
      'Una comunidad seleccionada no pertenece a esta cuenta.';
  end if;

  -- -------------------------------------------------------
  -- 6. VALIDAR LOS HORARIOS
  -- -------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(
      p_schedule
    )
  loop
    begin
      v_day :=
        (
          v_item ->>
          'day_of_week'
        )::integer;

      v_start :=
        (
          v_item ->>
          'start_time'
        )::time;

      v_end :=
        (
          v_item ->>
          'end_time'
        )::time;
    exception
      when others then
        raise exception
          'Existe un día u horario con formato incorrecto.';
    end;

    if v_day < 1
       or v_day > 7 then
      raise exception
        'El día debe estar entre 1 y 7.';
    end if;

    if v_start >= v_end then
      raise exception
        'La hora final debe ser mayor que la hora inicial.';
    end if;
  end loop;

  -- -------------------------------------------------------
  -- 7. EVITAR DOS GUARDADOS AL MISMO TIEMPO
  -- -------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_account_id::text
      || ':'
      || v_phone_digits,
      0
    )
  );

  -- -------------------------------------------------------
  -- 8. BUSCAR EL JUGADOR
  -- -------------------------------------------------------

  if p_player_id is not null then

    select player.id
    into v_player_id
    from public.players player
    where player.id =
        p_player_id
      and player.account_id =
        p_account_id
    for update;

    if v_player_id is null then
      raise exception
        'No se encontró el jugador que intentas editar.';
    end if;

  else

    select player.id
    into v_existing_player_id
    from public.players player
    where player.account_id =
        p_account_id
      and regexp_replace(
        coalesce(
          player.whatsapp,
          ''
        ),
        '[^0-9]',
        '',
        'g'
      ) = v_phone_digits
      and player.deleted_at is null
    order by player.created_at
    limit 1
    for update;

    if v_existing_player_id is not null then
      v_player_id :=
        v_existing_player_id;

      v_reused_existing :=
        true;
    end if;

  end if;

  -- -------------------------------------------------------
  -- 9. CREAR O ACTUALIZAR EL JUGADOR
  -- -------------------------------------------------------

  if v_player_id is null then

    insert into public.players (
      account_id,
      first_name,
      last_name,
      whatsapp,
      gender,
      validated_category,
      secondary_category,
      preferred_side,
      reliability_score,
      opt_in_whatsapp,
      active,
      notes,
      availability_notes,
      deleted_at,
      last_activity_at
    )
    values (
      p_account_id,

      trim(
        p_first_name
      ),

      nullif(
        trim(
          coalesce(
            p_last_name,
            ''
          )
        ),
        ''
      ),

      trim(
        p_whatsapp
      ),

      p_gender,

      v_primary_category,

      v_secondary_category,

      p_preferred_side,

      80,

      true,

      coalesce(
        p_active,
        true
      ),

      nullif(
        trim(
          coalesce(
            p_notes,
            ''
          )
        ),
        ''
      ),

      nullif(
        trim(
          coalesce(
            p_availability_notes,
            ''
          )
        ),
        ''
      ),

      null,

      now()
    )
    returning id
    into v_player_id;

  else

    update public.players
    set
      first_name =
        trim(
          p_first_name
        ),

      last_name =
        nullif(
          trim(
            coalesce(
              p_last_name,
              ''
            )
          ),
          ''
        ),

      whatsapp =
        trim(
          p_whatsapp
        ),

      gender =
        p_gender,

      validated_category =
        v_primary_category,

      secondary_category =
        v_secondary_category,

      preferred_side =
        p_preferred_side,

      active =
        coalesce(
          p_active,
          true
        ),

      notes =
        nullif(
          trim(
            coalesce(
              p_notes,
              ''
            )
          ),
          ''
        ),

      availability_notes =
        nullif(
          trim(
            coalesce(
              p_availability_notes,
              ''
            )
          ),
          ''
        ),

      deleted_at = null,

      last_activity_at =
        now()

    where id =
        v_player_id
      and account_id =
        p_account_id;

  end if;

  -- -------------------------------------------------------
  -- 10. REEMPLAZAR COMUNIDADES
  -- -------------------------------------------------------

  delete from public.player_communities
  where player_id =
    v_player_id;

  if jsonb_array_length(
    p_community_ids
  ) > 0 then

    if exists (
      select 1
      from information_schema.columns
      where table_schema =
          'public'
        and table_name =
          'player_communities'
        and column_name =
          'status'
    ) then

      execute $community_with_status$
        insert into public.player_communities (
          account_id,
          player_id,
          community_id,
          status
        )
        select distinct
          $1,
          $2,
          selected.value::uuid,
          'activo'
        from jsonb_array_elements_text(
          $3
        ) selected
      $community_with_status$
      using
        p_account_id,
        v_player_id,
        p_community_ids;

    else

      execute $community_without_status$
        insert into public.player_communities (
          account_id,
          player_id,
          community_id
        )
        select distinct
          $1,
          $2,
          selected.value::uuid
        from jsonb_array_elements_text(
          $3
        ) selected
      $community_without_status$
      using
        p_account_id,
        v_player_id,
        p_community_ids;

    end if;

    get diagnostics
      v_saved_communities =
        row_count;

  end if;

  -- -------------------------------------------------------
  -- 11. REEMPLAZAR DISPONIBILIDAD
  -- -------------------------------------------------------

  delete from public.player_availability
  where player_id =
    v_player_id;

  if jsonb_array_length(
    p_schedule
  ) > 0 then

    insert into public.player_availability (
      account_id,
      player_id,
      day_of_week,
      start_time,
      end_time
    )
    select
      p_account_id,
      v_player_id,
      schedule.day_of_week,
      schedule.start_time::time,
      schedule.end_time::time
    from jsonb_to_recordset(
      p_schedule
    ) as schedule(
      day_of_week integer,
      start_time text,
      end_time text
    )
    order by
      schedule.day_of_week;

    get diagnostics
      v_saved_days =
        row_count;

  end if;

  -- -------------------------------------------------------
  -- 12. DEVOLVER RESULTADO
  -- -------------------------------------------------------

  return jsonb_build_object(
    'ok',
      true,

    'player_id',
      v_player_id,

    'reused_existing_player',
      v_reused_existing,

    'saved_communities',
      v_saved_communities,

    'saved_days',
      v_saved_days
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_save_venue_v1(p_account_id uuid, p_venue_id uuid, p_name text, p_city text, p_courts_count integer, p_default_duration_minutes integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_venue_id uuid;
  v_clean_name text;
  v_clean_city text;
  v_created boolean := false;
begin

  perform public.ptm_assert_owner_admin_v1(
    p_account_id
  );

  v_clean_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_clean_city := regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g');

  if v_clean_name = '' then
    raise exception 'Escribe el nombre de la sede.';
  end if;

  if v_clean_city = '' then
    v_clean_city := 'Guayaquil';
  end if;

  if p_courts_count is null or p_courts_count < 1 or p_courts_count > 100 then
    raise exception 'La cantidad de canchas debe estar entre 1 y 100.';
  end if;

  if p_default_duration_minutes is null
     or p_default_duration_minutes < 30
     or p_default_duration_minutes > 480 then
    raise exception 'La duración debe estar entre 30 y 480 minutos.';
  end if;

  if exists (
    select 1
    from public.venues v
    where v.account_id = p_account_id
      and lower(trim(v.name)) = lower(v_clean_name)
      and (p_venue_id is null or v.id <> p_venue_id)
  ) then
    raise exception 'Ya existe una sede con ese nombre.';
  end if;

  if p_venue_id is null then
    insert into public.venues (
      account_id,
      name,
      city,
      courts_count,
      default_duration_minutes,
      active
    )
    values (
      p_account_id,
      v_clean_name,
      v_clean_city,
      p_courts_count,
      p_default_duration_minutes,
      coalesce(p_active, true)
    )
    returning id into v_venue_id;

    v_created := true;
  else
    update public.venues
    set
      name = v_clean_name,
      city = v_clean_city,
      courts_count = p_courts_count,
      default_duration_minutes = p_default_duration_minutes,
      active = coalesce(p_active, true)
    where id = p_venue_id
      and account_id = p_account_id
    returning id into v_venue_id;

    if v_venue_id is null then
      raise exception 'No se encontró la sede que intentas editar.';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'venue_id', v_venue_id,
    'created', v_created
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_save_venue_v2(p_account_id uuid, p_venue_id uuid, p_name text, p_country text, p_country_code text, p_city text, p_courts_count integer, p_default_duration_minutes integer, p_active boolean, p_image_url text, p_avatar_emoji text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_venue_id uuid;
  v_clean_name text;
  v_clean_country text;
  v_clean_country_code text;
  v_clean_city text;
  v_clean_image_url text;
  v_clean_avatar text;
  v_created boolean := false;
begin

  perform public.ptm_assert_owner_admin_v1(
    p_account_id
  );

  v_clean_name :=
    regexp_replace(
      trim(coalesce(p_name, '')),
      '\s+',
      ' ',
      'g'
    );

  v_clean_country :=
    regexp_replace(
      trim(coalesce(p_country, '')),
      '\s+',
      ' ',
      'g'
    );

  v_clean_country_code :=
    upper(trim(coalesce(p_country_code, '')));

  v_clean_city :=
    regexp_replace(
      trim(coalesce(p_city, '')),
      '\s+',
      ' ',
      'g'
    );

  v_clean_image_url :=
    nullif(trim(coalesce(p_image_url, '')), '');

  v_clean_avatar :=
    coalesce(
      nullif(trim(coalesce(p_avatar_emoji, '')), ''),
      '🏟️'
    );

  if v_clean_name = '' then
    raise exception 'Escribe el nombre de la sede.';
  end if;

  if v_clean_country = '' then
    raise exception 'Selecciona el país.';
  end if;

  if length(v_clean_country_code) <> 2 then
    raise exception 'El código del país debe tener dos letras.';
  end if;

  if v_clean_city = '' then
    raise exception 'Selecciona o escribe la ciudad.';
  end if;

  if p_courts_count is null
     or p_courts_count < 1
     or p_courts_count > 100 then
    raise exception
      'La cantidad de canchas debe estar entre 1 y 100.';
  end if;

  if p_default_duration_minutes is null
     or p_default_duration_minutes < 30
     or p_default_duration_minutes > 480 then
    raise exception
      'La duración debe estar entre 30 y 480 minutos.';
  end if;

  if length(coalesce(v_clean_image_url, '')) > 500000 then
    raise exception
      'La imagen es demasiado grande. Usa una imagen más pequeña.';
  end if;

  if exists (
    select 1
    from public.venues venue
    where venue.account_id = p_account_id
      and lower(trim(venue.name)) = lower(v_clean_name)
      and lower(trim(coalesce(venue.city, ''))) =
          lower(v_clean_city)
      and upper(trim(coalesce(venue.country_code, 'EC'))) =
          v_clean_country_code
      and (
        p_venue_id is null
        or venue.id <> p_venue_id
      )
  ) then
    raise exception
      'Ya existe una sede con ese nombre en esa ciudad.';
  end if;

  if p_venue_id is null then
    insert into public.venues (
      account_id,
      name,
      country,
      country_code,
      city,
      courts_count,
      default_duration_minutes,
      active,
      image_url,
      avatar_emoji
    )
    values (
      p_account_id,
      v_clean_name,
      v_clean_country,
      v_clean_country_code,
      v_clean_city,
      p_courts_count,
      p_default_duration_minutes,
      coalesce(p_active, true),
      v_clean_image_url,
      v_clean_avatar
    )
    returning id
    into v_venue_id;

    v_created := true;
  else
    update public.venues
    set
      name = v_clean_name,
      country = v_clean_country,
      country_code = v_clean_country_code,
      city = v_clean_city,
      courts_count = p_courts_count,
      default_duration_minutes =
        p_default_duration_minutes,
      active = coalesce(p_active, true),
      image_url = v_clean_image_url,
      avatar_emoji = v_clean_avatar
    where id = p_venue_id
      and account_id = p_account_id
    returning id
    into v_venue_id;

    if v_venue_id is null then
      raise exception
        'No se encontró la sede que intentas editar.';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'venue_id', v_venue_id,
    'created', v_created
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_set_event_commission_status_v1(p_account_id uuid, p_event_id uuid, p_status text, p_operator_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_amount numeric(12,2);
  v_clean_status text;
begin

  perform public.ptm_assert_event_action_v1(
    p_account_id,
    p_event_id,
    'editPayments'
  );

  v_clean_status :=
    lower(trim(coalesce(p_status, '')));

  if v_clean_status not in (
    'pendiente',
    'pagada',
    'no_aplica'
  ) then
    raise exception
      'El estado de comisión no es válido.';
  end if;

  select coalesce(
    event_record.commission_amount,
    0
  )
  into v_amount
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = p_account_id
  for update;

  if v_amount is null then
    raise exception
      'No se encontró el partido.';
  end if;

  if v_amount <= 0 then
    v_clean_status := 'no_aplica';
  end if;

  update public.events
  set
    commission_status = v_clean_status,
    commission_paid_at = case
      when v_clean_status = 'pagada'
        then now()
      else null
    end,
    commission_notes = concat(
      coalesce(commission_notes || E'\n', ''),
      case
        when v_clean_status = 'pagada'
          then 'Comisión marcada como pagada'
        when v_clean_status = 'pendiente'
          then 'Comisión marcada como pendiente'
        else 'Comisión sin aplicar'
      end,
      case
        when nullif(trim(coalesce(p_operator_name, '')), '') is null
          then '.'
        else concat(
          ' por ',
          trim(p_operator_name),
          '.'
        )
      end
    ),
    updated_at = now(),
    last_edited_by =
      nullif(trim(coalesce(p_operator_name, '')), '')
  where id = p_event_id
    and account_id = p_account_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'commission_status', v_clean_status
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_update_event_details_v1(p_account_id uuid, p_event_id uuid, p_community_id uuid, p_venue_id uuid, p_event_date date, p_start_time time without time zone, p_duration_minutes integer, p_courts_count integer, p_category text, p_gender_mode text, p_organizer_staff_id text, p_organizer_name text, p_commission_amount numeric, p_operator_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_status text;
  v_current_community_id uuid;
  v_venue_name text;
  v_category public.category;
  v_players_needed integer;
  v_has_activity boolean := false;
  v_clean_gender text;
  v_clean_organizer_name text;
  v_clean_commission numeric(12,2);
  v_commission_status text;
begin

  perform public.ptm_assert_event_edit_v1(
    p_account_id,
    p_event_id,
    p_community_id,
    p_venue_id,
    p_category,
    p_gender_mode,
    p_organizer_staff_id,
    p_commission_amount,
    null
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ptm-event-' || p_event_id::text,
      0
    )
  );

  select
    event_record.status::text,
    event_record.community_id,
    event_record.commission_status
  into
    v_status,
    v_current_community_id,
    v_commission_status
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = p_account_id
  for update;

  if v_status is null then
    raise exception
      'No se encontró el partido.';
  end if;

  if v_status in ('cancelado', 'cerrado', 'jugado') then
    raise exception
      'Este partido ya no permite cambiar fecha, sede, categoría o género.';
  end if;

  if not exists (
    select 1
    from public.communities community
    where community.id = p_community_id
      and community.account_id = p_account_id
      and community.active is not false
  ) then
    raise exception
      'La comunidad seleccionada no existe o está inactiva.';
  end if;

  select venue.name
  into v_venue_name
  from public.venues venue
  where venue.id = p_venue_id
    and venue.account_id = p_account_id
    and venue.active is not false;

  if v_venue_name is null then
    raise exception
      'La sede seleccionada no existe o está inactiva.';
  end if;

  begin
    v_category :=
      p_category::public.category;
  exception
    when others then
      raise exception
        'La categoría seleccionada no es válida.';
  end;

  v_clean_gender :=
    lower(trim(coalesce(p_gender_mode, '')));

  if v_clean_gender not in (
    'libre',
    'hombres',
    'mujeres',
    'mixto'
  ) then
    raise exception
      'El género del partido no es válido.';
  end if;

  if p_event_date is null then
    raise exception
      'Selecciona la fecha del partido.';
  end if;

  if p_start_time is null then
    raise exception
      'Selecciona la hora del partido.';
  end if;

  if p_duration_minutes is null
     or p_duration_minutes < 30
     or p_duration_minutes > 480 then
    raise exception
      'La duración debe estar entre 30 y 480 minutos.';
  end if;

  if p_courts_count is null
     or p_courts_count < 1
     or p_courts_count > 20 then
    raise exception
      'La cantidad de canchas debe estar entre 1 y 20.';
  end if;

  select exists (
    select 1
    from public.participations participation
    where participation.event_id = p_event_id

    union all

    select 1
    from public.invitations invitation
    where invitation.event_id = p_event_id
  )
  into v_has_activity;

  if p_community_id <> v_current_community_id
     and v_has_activity then
    raise exception
      'La comunidad no se puede cambiar porque el partido ya tiene invitaciones o respuestas. Crea otro partido para la nueva comunidad.';
  end if;

  v_players_needed := p_courts_count * 4;

  v_clean_organizer_name :=
    coalesce(
      nullif(trim(coalesce(p_organizer_name, '')), ''),
      'Sin usuario asignado'
    );

  v_clean_commission :=
    greatest(
      coalesce(p_commission_amount, 0),
      0
    );

  if v_clean_commission <= 0 then
    v_commission_status := 'no_aplica';
  elsif v_commission_status = 'pagada' then
    v_commission_status := 'pagada';
  else
    v_commission_status := 'pendiente';
  end if;

  update public.events
  set
    community_id = p_community_id,
    venue_id = p_venue_id,
    event_date = p_event_date,
    start_time = p_start_time,
    duration_minutes = p_duration_minutes,
    courts_count = p_courts_count,
    players_needed = v_players_needed,
    category = v_category,
    gender_mode = v_clean_gender,
    organizer_staff_id =
      nullif(trim(coalesce(p_organizer_staff_id, '')), ''),
    organizer_name = v_clean_organizer_name,
    commission_amount = v_clean_commission,
    commission_status = v_commission_status,
    commission_paid_at = case
      when v_commission_status = 'pagada'
        then commission_paid_at
      else null
    end,
    title = concat(
      v_category::text,
      ' · ',
      v_venue_name,
      ' · ',
      p_event_date::text,
      ' ',
      to_char(p_start_time, 'HH24:MI')
    ),
    updated_at = now(),
    last_edited_by =
      nullif(trim(coalesce(p_operator_name, '')), '')
  where id = p_event_id
    and account_id = p_account_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'players_needed', v_players_needed,
    'community_changed',
      p_community_id <> v_current_community_id,
    'has_activity', v_has_activity
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ptm_update_event_details_v2(p_account_id uuid, p_event_id uuid, p_community_id uuid, p_venue_id uuid, p_event_date date, p_start_time time without time zone, p_duration_minutes integer, p_courts_count integer, p_players_needed integer, p_category text, p_gender_mode text, p_organizer_staff_id text, p_organizer_name text, p_commission_amount numeric, p_commission_notes text, p_operator_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_status text;
  v_current_community_id uuid;
  v_current_commission_amount numeric(12,2);
  v_current_commission_status text;

  v_venue_name text;
  v_category public.category;
  v_has_activity boolean := false;

  v_clean_gender text;
  v_clean_organizer_name text;
  v_clean_commission numeric(12,2);
  v_clean_commission_notes text;
  v_next_commission_status text;
begin

  perform public.ptm_assert_event_edit_v1(
    p_account_id,
    p_event_id,
    p_community_id,
    p_venue_id,
    p_category,
    p_gender_mode,
    p_organizer_staff_id,
    p_commission_amount,
    p_commission_notes
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ptm-event-' || p_event_id::text,
      0
    )
  );

  select
    event_record.status::text,
    event_record.community_id,
    coalesce(event_record.commission_amount, 0),
    coalesce(event_record.commission_status, 'no_aplica')
  into
    v_status,
    v_current_community_id,
    v_current_commission_amount,
    v_current_commission_status
  from public.events event_record
  where event_record.id = p_event_id
    and event_record.account_id = p_account_id
  for update;

  if v_status is null then
    raise exception
      'No se encontró el partido.';
  end if;

  if v_status in (
    'cancelado',
    'cerrado',
    'jugado'
  ) then
    raise exception
      'Este partido ya no permite cambiar fecha, sede, categoría, jugadores o género.';
  end if;

  if not exists (
    select 1
    from public.communities community
    where community.id = p_community_id
      and community.account_id = p_account_id
      and community.active is not false
  ) then
    raise exception
      'La comunidad seleccionada no existe o está inactiva.';
  end if;

  select venue.name
  into v_venue_name
  from public.venues venue
  where venue.id = p_venue_id
    and venue.account_id = p_account_id
    and venue.active is not false;

  if v_venue_name is null then
    raise exception
      'La sede seleccionada no existe o está inactiva.';
  end if;

  begin
    v_category :=
      p_category::public.category;
  exception
    when others then
      raise exception
        'La categoría seleccionada no es válida.';
  end;

  v_clean_gender :=
    lower(
      trim(
        coalesce(
          p_gender_mode,
          ''
        )
      )
    );

  if v_clean_gender not in (
    'libre',
    'hombres',
    'mujeres',
    'mixto'
  ) then
    raise exception
      'El género del partido no es válido.';
  end if;

  if p_event_date is null then
    raise exception
      'Selecciona la fecha del partido.';
  end if;

  if p_start_time is null then
    raise exception
      'Selecciona la hora del partido.';
  end if;

  if p_duration_minutes is null
     or p_duration_minutes < 30
     or p_duration_minutes > 480 then
    raise exception
      'La duración debe estar entre 30 y 480 minutos.';
  end if;

  if p_courts_count is null
     or p_courts_count < 1
     or p_courts_count > 20 then
    raise exception
      'La cantidad de canchas debe estar entre 1 y 20.';
  end if;

  if p_players_needed is null
     or p_players_needed < 2
     or p_players_needed > 100 then
    raise exception
      'La cantidad de jugadores debe estar entre 2 y 100.';
  end if;

  select exists (
    select 1
    from public.participations participation
    where participation.event_id = p_event_id

    union all

    select 1
    from public.invitations invitation
    where invitation.event_id = p_event_id
  )
  into v_has_activity;

  if p_community_id <> v_current_community_id
     and v_has_activity then
    raise exception
      'La comunidad no se puede cambiar porque el partido ya tiene invitaciones o respuestas. Crea otro partido para la nueva comunidad.';
  end if;

  v_clean_organizer_name :=
    coalesce(
      nullif(
        trim(
          coalesce(
            p_organizer_name,
            ''
          )
        ),
        ''
      ),
      'Sin usuario asignado'
    );

  v_clean_commission :=
    greatest(
      coalesce(
        p_commission_amount,
        0
      ),
      0
    );

  v_clean_commission_notes :=
    nullif(
      trim(
        coalesce(
          p_commission_notes,
          ''
        )
      ),
      ''
    );

  if v_clean_commission <= 0 then
    v_next_commission_status :=
      'no_aplica';
  elsif
    v_current_commission_status = 'pagada'
    and v_current_commission_amount =
      v_clean_commission
  then
    v_next_commission_status :=
      'pagada';
  else
    v_next_commission_status :=
      'pendiente';
  end if;

  update public.events
  set
    community_id =
      p_community_id,

    venue_id =
      p_venue_id,

    event_date =
      p_event_date,

    start_time =
      p_start_time,

    duration_minutes =
      p_duration_minutes,

    courts_count =
      p_courts_count,

    players_needed =
      p_players_needed,

    category =
      v_category,

    gender_mode =
      v_clean_gender,

    organizer_staff_id =
      nullif(
        trim(
          coalesce(
            p_organizer_staff_id,
            ''
          )
        ),
        ''
      ),

    organizer_name =
      v_clean_organizer_name,

    commission_amount =
      v_clean_commission,

    commission_status =
      v_next_commission_status,

    commission_paid_at =
      case
        when v_next_commission_status =
          'pagada'
          then commission_paid_at
        else null
      end,

    commission_notes =
      v_clean_commission_notes,

    title =
      concat(
        v_category::text,
        ' · ',
        v_venue_name,
        ' · ',
        p_event_date::text,
        ' ',
        to_char(
          p_start_time,
          'HH24:MI'
        )
      ),

    updated_at =
      now(),

    last_edited_by =
      nullif(
        trim(
          coalesce(
            p_operator_name,
            ''
          )
        ),
        ''
      )

  where id = p_event_id
    and account_id = p_account_id;

  return jsonb_build_object(
    'ok',
      true,

    'event_id',
      p_event_id,

    'players_needed',
      p_players_needed,

    'courts_count',
      p_courts_count,

    'duration_minutes',
      p_duration_minutes,

    'commission_amount',
      v_clean_commission,

    'commission_status',
      v_next_commission_status,

    'community_changed',
      p_community_id <>
      v_current_community_id,

    'has_activity',
      v_has_activity
  );
end;
$function$

-- =========================================================
-- 8. VISTAS SEGURAS PARA LECTURA
-- =========================================================

drop view if exists public.ptm_events_secure_v1 cascade;

create view public.ptm_events_secure_v1
with (security_barrier = true)
as
select
  event_record.id,
  event_record.account_id,
  event_record.community_id,
  event_record.venue_id,
  event_record.sport_id,
  event_record.created_by,
  event_record.title,
  event_record.event_type,
  event_record.event_date,
  event_record.start_time,
  event_record.end_time,
  event_record.duration_minutes,
  event_record.courts_count,
  event_record.players_needed,
  event_record.category,
  event_record.status,
  case when public.ptm_can_view_payments_v1() then event_record.player_price else null end as player_price,
  case when public.ptm_can_view_payments_v1() then event_record.internal_court_cost else null end as internal_court_cost,
  event_record.custom_message,
  event_record.allow_waitlist,
  event_record.allow_more_courts,
  event_record.created_at,
  case when public.ptm_can_view_payments_v1() then event_record.payment_default_amount else null end as payment_default_amount,
  case when public.ptm_can_view_payments_v1() then event_record.payment_default_notes else null end as payment_default_notes,
  event_record.court_reservation_status,
  event_record.court_reservation_notes,
  event_record.court_reservation_reference,
  event_record.court_reserved_at,
  event_record.court_reservation_requested_at,
  event_record.court_number,
  event_record.court_reserved_by,
  case when public.ptm_can_view_payments_v1() then event_record.court_cost else null end as court_cost,
  case when public.ptm_can_view_payments_v1() then event_record.other_expenses else null end as other_expenses,
  case when public.ptm_can_view_payments_v1() then event_record.financial_notes else null end as financial_notes,
  event_record.played_at,
  event_record.closed_at,
  event_record.closed_by,
  event_record.close_notes,
  event_record.canceled_at,
  event_record.gender_mode,
  event_record.organizer_staff_id,
  event_record.organizer_name,
  case when public.ptm_can_view_payments_v1() then event_record.commission_amount else null end as commission_amount,
  case when public.ptm_can_view_payments_v1() then event_record.commission_status else null end as commission_status,
  case when public.ptm_can_view_payments_v1() then event_record.commission_paid_at else null end as commission_paid_at,
  case when public.ptm_can_view_payments_v1() then event_record.commission_notes else null end as commission_notes,
  event_record.updated_at,
  event_record.last_edited_by
from public.events event_record
where public.ptm_can_access_event_row_v1(
  event_record.account_id,
  event_record.community_id,
  event_record.venue_id,
  event_record.category::text,
  event_record.gender_mode
);

drop view if exists public.ptm_participations_secure_v1 cascade;

create view public.ptm_participations_secure_v1
with (security_barrier = true)
as
select
  participation.id,
  participation.account_id,
  participation.event_id,
  participation.player_id,
  participation.status,
  participation.waitlist_position,
  participation.source,
  participation.confirmed_at,
  participation.cancelled_at,
  case when public.ptm_can_view_payments_v1() then participation.payment_status else null end as payment_status,
  case when public.ptm_can_view_payments_v1() then participation.payment_method else null end as payment_method,
  case when public.ptm_can_view_payments_v1() then participation.amount_paid else null end as amount_paid,
  participation.notes,
  participation.created_at,
  case when public.ptm_can_view_payments_v1() then participation.payment_amount else null end as payment_amount,
  case when public.ptm_can_view_payments_v1() then participation.payment_reference else null end as payment_reference,
  case when public.ptm_can_view_payments_v1() then participation.payment_notes else null end as payment_notes,
  case when public.ptm_can_view_payments_v1() then participation.payment_proof_url else null end as payment_proof_url,
  case when public.ptm_can_view_payments_v1() then participation.paid_at else null end as paid_at,
  case when public.ptm_can_view_payments_v1() then participation.payment_due_amount else null end as payment_due_amount,
  case when public.ptm_can_view_payments_v1() then participation.payment_due_notes else null end as payment_due_notes
from public.participations participation
where public.ptm_can_access_event_v1(
  participation.event_id
);

drop view if exists public.ptm_venues_secure_v1 cascade;

create view public.ptm_venues_secure_v1
with (security_barrier = true)
as
select
  venue_record.id,
  venue_record.account_id,
  venue_record.name,
  venue_record.city,
  venue_record.address,
  venue_record.courts_count,
  venue_record.default_duration_minutes,
  venue_record.opening_time,
  venue_record.closing_time,
  case when public.ptm_can_view_payments_v1() then venue_record.internal_court_cost else null end as internal_court_cost,
  case when public.ptm_can_view_payments_v1() then venue_record.suggested_player_price else null end as suggested_player_price,
  venue_record.active,
  venue_record.created_at,
  venue_record.country,
  venue_record.country_code,
  venue_record.image_url,
  venue_record.avatar_emoji
from public.venues venue_record
where venue_record.account_id =
    public.ptm_current_account_id_v1()
  and public.ptm_has_venue_access_v1(
    venue_record.id
  );

drop view if exists public.ptm_messaging_accounts_safe_v1 cascade;

create view public.ptm_messaging_accounts_safe_v1
with (security_barrier = true)
as
select
  messaging_account.id,
  messaging_account.account_id,
  messaging_account.provider,
  messaging_account.mode_active,
  messaging_account.whatsapp_business_account_id,
  messaging_account.phone_number_id,
  messaging_account.visible_number,
  messaging_account.display_name,
  null::text as access_token_encrypted,
  messaging_account.status,
  messaging_account.quality_status,
  messaging_account.messaging_limit,
  messaging_account.created_at
from public.messaging_accounts messaging_account
where messaging_account.account_id =
  public.ptm_current_account_id_v1();

-- =========================================================
-- 9. QUITAR POLÍTICAS DEMO Y ACTIVAR RLS EN LAS 25 TABLAS
-- =========================================================

do $$
declare
  politica record;
begin
  for politica in
    select
      schemaname,
      tablename,
      policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'accounts',
        'app_users',
        'assistant_feedback_demo',
        'audit_logs',
        'communities',
        'community_categories',
        'community_venues',
        'event_templates',
        'events',
        'invitations',
        'message_templates',
        'messages',
        'messaging_accounts',
        'participations',
        'player_availability',
        'player_communities',
        'player_import_batches',
        'player_relationships',
        'player_requests_demo',
        'player_venues',
        'players',
        'sports',
        'staff_members',
        'staff_members_demo',
        'venues'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      politica.policyname,
      politica.schemaname,
      politica.tablename
    );
  end loop;
end;
$$;

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'accounts',
    'app_users',
    'assistant_feedback_demo',
    'audit_logs',
    'communities',
    'community_categories',
    'community_venues',
    'event_templates',
    'events',
    'invitations',
    'message_templates',
    'messages',
    'messaging_accounts',
    'participations',
    'player_availability',
    'player_communities',
    'player_import_batches',
    'player_relationships',
    'player_requests_demo',
    'player_venues',
    'players',
    'sports',
    'staff_members',
    'staff_members_demo',
    'venues'
  ]
  loop
    execute format(
      'alter table public.%I enable row level security',
      tabla
    );

    execute format(
      'alter table public.%I no force row level security',
      tabla
    );
  end loop;
end;
$$;

-- =========================================================
-- 10. POLÍTICAS DE CUENTA, USUARIOS Y STAFF
-- =========================================================

create policy ptm_accounts_select_v1
on public.accounts
for select
to authenticated
using (
  id = public.ptm_current_account_id_v1()
);

create policy ptm_accounts_update_owner_v1
on public.accounts
for update
to authenticated
using (
  id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_v1()
)
with check (
  id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_v1()
);

create policy ptm_app_users_select_v1
on public.app_users
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and (
    public.ptm_is_owner_admin_v1()
    or auth_user_id = auth.uid()
  )
);

create policy ptm_app_users_manage_owner_v1
on public.app_users
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_v1()
);

create policy ptm_staff_demo_select_v1
on public.staff_members_demo
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and (
    public.ptm_is_owner_admin_v1()
    or auth_user_id = auth.uid()
  )
);

create policy ptm_staff_demo_insert_v1
on public.staff_members_demo
for insert
to authenticated
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
  and (
    public.ptm_is_owner_v1()
    or lower(coalesce(role, 'assistant')) <> 'owner'
  )
);

create policy ptm_staff_demo_update_v1
on public.staff_members_demo
for update
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
  and (
    public.ptm_is_owner_v1()
    or lower(coalesce(role, 'assistant')) <> 'owner'
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
  and (
    public.ptm_is_owner_v1()
    or lower(coalesce(role, 'assistant')) <> 'owner'
  )
);

create policy ptm_staff_demo_delete_v1
on public.staff_members_demo
for delete
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
  and lower(coalesce(role, 'assistant')) <> 'owner'
);

create policy ptm_staff_legacy_select_v1
on public.staff_members
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_staff_legacy_manage_v1
on public.staff_members
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_v1()
);

-- =========================================================
-- 11. POLÍTICAS DE CATÁLOGOS Y CONFIGURACIÓN
-- =========================================================

create policy ptm_sports_select_v1
on public.sports
for select
to authenticated
using (
  public.ptm_is_active_staff_v1()
  and active is true
);

create policy ptm_communities_select_v1
on public.communities
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_community_access_v1(id)
);

create policy ptm_communities_manage_v1
on public.communities
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_community_categories_select_v1
on public.community_categories
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_community_access_v1(
    community_id
  )
);

create policy ptm_community_categories_manage_v1
on public.community_categories
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_community_venues_select_v1
on public.community_venues
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_community_access_v1(
    community_id
  )
  and public.ptm_has_venue_access_v1(
    venue_id
  )
);

create policy ptm_community_venues_manage_v1
on public.community_venues
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_venues_select_v1
on public.venues
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_venue_access_v1(id)
);

create policy ptm_venues_manage_v1
on public.venues
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_event_templates_select_v1
on public.event_templates
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and (
    community_id is null
    or public.ptm_has_community_access_v1(
      community_id
    )
  )
  and (
    venue_id is null
    or public.ptm_has_venue_access_v1(
      venue_id
    )
  )
  and public.ptm_has_category_access_v1(
    category::text
  )
);

create policy ptm_event_templates_manage_v1
on public.event_templates
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'createMatches'
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'createMatches'
  )
  and (
    community_id is null
    or public.ptm_has_community_access_v1(
      community_id
    )
  )
  and (
    venue_id is null
    or public.ptm_has_venue_access_v1(
      venue_id
    )
  )
  and public.ptm_has_category_access_v1(
    category::text
  )
);

create policy ptm_message_templates_select_v1
on public.message_templates
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_active_staff_v1()
);

create policy ptm_message_templates_manage_v1
on public.message_templates
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_messaging_accounts_owner_v1
on public.messaging_accounts
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

-- =========================================================
-- 12. POLÍTICAS DE JUGADORES
-- =========================================================

create policy ptm_players_select_v1
on public.players
for select
to authenticated
using (
  public.ptm_can_access_player_v1(id)
);

create policy ptm_players_insert_v1
on public.players
for insert
to authenticated
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
  and public.ptm_has_category_access_v1(
    coalesce(
      validated_category::text,
      declared_category::text
    )
  )
  and public.ptm_has_gender_access_v1(
    gender
  )
);

create policy ptm_players_update_v1
on public.players
for update
to authenticated
using (
  public.ptm_can_access_player_v1(id)
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
  and public.ptm_has_category_access_v1(
    coalesce(
      validated_category::text,
      declared_category::text
    )
  )
  and public.ptm_has_gender_access_v1(
    gender
  )
);

create policy ptm_players_delete_v1
on public.players
for delete
to authenticated
using (
  public.ptm_can_access_player_v1(id)
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_player_communities_select_v1
on public.player_communities
for select
to authenticated
using (
  public.ptm_can_access_player_v1(player_id)
  and public.ptm_has_community_access_v1(
    community_id
  )
);

create policy ptm_player_communities_manage_v1
on public.player_communities
for all
to authenticated
using (
  public.ptm_can_access_player_v1(player_id)
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
  and public.ptm_has_community_access_v1(
    community_id
  )
  and exists (
    select 1
    from public.players player_record
    where player_record.id = public.player_communities.player_id
      and player_record.account_id =
        public.ptm_current_account_id_v1()
  )
);

create policy ptm_player_venues_select_v1
on public.player_venues
for select
to authenticated
using (
  public.ptm_can_access_player_v1(player_id)
  and public.ptm_has_venue_access_v1(
    venue_id
  )
);

create policy ptm_player_venues_manage_v1
on public.player_venues
for all
to authenticated
using (
  public.ptm_can_access_player_v1(player_id)
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
)
with check (
  public.ptm_has_permission_v1(
    'managePlayers'
  )
  and public.ptm_has_venue_access_v1(
    venue_id
  )
  and exists (
    select 1
    from public.players player_record
    where player_record.id = public.player_venues.player_id
      and player_record.account_id =
        public.ptm_current_account_id_v1()
  )
);

create policy ptm_player_availability_select_v1
on public.player_availability
for select
to authenticated
using (
  public.ptm_can_access_player_v1(player_id)
  and (
    venue_id is null
    or public.ptm_has_venue_access_v1(
      venue_id
    )
  )
);

create policy ptm_player_availability_manage_v1
on public.player_availability
for all
to authenticated
using (
  public.ptm_can_access_player_v1(player_id)
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
  and (
    venue_id is null
    or public.ptm_has_venue_access_v1(
      venue_id
    )
  )
  and exists (
    select 1
    from public.players player_record
    where player_record.id = public.player_availability.player_id
      and player_record.account_id =
        public.ptm_current_account_id_v1()
  )
);

create policy ptm_player_relationships_select_v1
on public.player_relationships
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_can_access_player_v1(
    player_id
  )
  and public.ptm_can_access_player_v1(
    related_player_id
  )
);

create policy ptm_player_relationships_manage_v1
on public.player_relationships
for all
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
  and public.ptm_can_access_player_v1(
    player_id
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
  and public.ptm_can_access_player_v1(
    player_id
  )
  and public.ptm_can_access_player_v1(
    related_player_id
  )
);

create policy ptm_player_import_batches_select_v1
on public.player_import_batches
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and (
    public.ptm_is_owner_admin_v1()
    or public.ptm_has_permission_v1(
      'managePlayers'
    )
  )
);

create policy ptm_player_import_batches_insert_v1
on public.player_import_batches
for insert
to authenticated
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_has_permission_v1(
    'managePlayers'
  )
);

-- =========================================================
-- 13. POLÍTICAS DE EVENTOS, MENSAJES Y PARTICIPACIONES
-- =========================================================

create policy ptm_events_select_v1
on public.events
for select
to authenticated
using (
  public.ptm_can_access_event_row_v1(
    account_id,
    community_id,
    venue_id,
    category::text,
    gender_mode
  )
);

create policy ptm_participations_select_v1
on public.participations
for select
to authenticated
using (
  public.ptm_can_access_event_v1(
    event_id
  )
);

create policy ptm_invitations_select_v1
on public.invitations
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_can_access_event_v1(
    event_id
  )
);

create policy ptm_invitations_insert_v1
on public.invitations
for insert
to authenticated
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_has_permission_v1(
    'registerResponses'
  )
  and public.ptm_can_access_player_v1(
    player_id
  )
);

create policy ptm_invitations_update_v1
on public.invitations
for update
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_has_permission_v1(
    'registerResponses'
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_has_permission_v1(
    'registerResponses'
  )
  and public.ptm_can_access_player_v1(
    player_id
  )
);

create policy ptm_invitations_delete_v1
on public.invitations
for delete
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_has_permission_v1(
    'registerResponses'
  )
);

create policy ptm_messages_select_v1
on public.messages
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and (
    event_id is null
    or public.ptm_can_access_event_v1(
      event_id
    )
  )
);

create policy ptm_messages_insert_v1
on public.messages
for insert
to authenticated
with check (
  account_id = public.ptm_current_account_id_v1()
  and event_id is not null
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_has_permission_v1(
    'registerResponses'
  )
  and (
    player_id is null
    or public.ptm_can_access_player_v1(
      player_id
    )
  )
);

create policy ptm_messages_update_v1
on public.messages
for update
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and event_id is not null
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_has_permission_v1(
    'registerResponses'
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and event_id is not null
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_has_permission_v1(
    'registerResponses'
  )
);

create policy ptm_messages_delete_v1
on public.messages
for delete
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and event_id is not null
  and public.ptm_can_access_event_v1(
    event_id
  )
  and public.ptm_is_owner_admin_v1()
);

-- =========================================================
-- 14. SOLICITUDES PÚBLICAS Y SOLICITUDES INTERNAS
-- =========================================================

create policy ptm_player_requests_public_insert_v1
on public.player_requests_demo
for insert
to anon
with check (
  account_id =
    '10000000-0000-0000-0000-000000000001'::uuid
  and status = 'pendiente'
  and source = 'quiero_jugar'
  and assigned_staff_id is null
  and internal_notes is null
  and contacted_at is null
  and converted_at is null
  and converted_player_id is null
  and length(trim(full_name)) between 2 and 120
  and length(trim(whatsapp)) between 8 and 30
);

create policy ptm_player_requests_select_v1
on public.player_requests_demo
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and (
    public.ptm_is_owner_admin_v1()
    or public.ptm_has_permission_v1(
      'managePlayers'
    )
  )
);

create policy ptm_player_requests_insert_staff_v1
on public.player_requests_demo
for insert
to authenticated
with check (
  account_id = public.ptm_current_account_id_v1()
  and (
    public.ptm_is_owner_admin_v1()
    or public.ptm_has_permission_v1(
      'managePlayers'
    )
  )
);

create policy ptm_player_requests_update_v1
on public.player_requests_demo
for update
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and (
    public.ptm_is_owner_admin_v1()
    or public.ptm_has_permission_v1(
      'managePlayers'
    )
  )
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and (
    public.ptm_is_owner_admin_v1()
    or public.ptm_has_permission_v1(
      'managePlayers'
    )
  )
);

create policy ptm_player_requests_delete_v1
on public.player_requests_demo
for delete
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

-- =========================================================
-- 15. RETROALIMENTACIÓN Y AUDITORÍA
-- =========================================================

create policy ptm_feedback_insert_v1
on public.assistant_feedback_demo
for insert
to authenticated
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_active_staff_v1()
);

create policy ptm_feedback_select_v1
on public.assistant_feedback_demo
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_feedback_manage_v1
on public.assistant_feedback_demo
for update
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
)
with check (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

create policy ptm_audit_logs_select_v1
on public.audit_logs
for select
to authenticated
using (
  account_id = public.ptm_current_account_id_v1()
  and public.ptm_is_owner_admin_v1()
);

-- =========================================================
-- 17. PRIVILEGIOS MÍNIMOS DE TABLAS Y VISTAS
-- =========================================================

grant usage on schema public to anon;
grant usage on schema public to authenticated;

-- Primero se eliminan los permisos amplios heredados del MVP.
revoke all privileges on all tables in schema public
from anon;

revoke all privileges on all tables in schema public
from authenticated;

-- ---------------------------------------------------------
-- 17.1 ÚNICA EXCEPCIÓN PÚBLICA:
-- /quiero-jugar puede INSERTAR una solicitud.
-- No puede leer, actualizar ni borrar solicitudes.
-- ---------------------------------------------------------

grant insert (
  account_id,
  full_name,
  whatsapp,
  email,
  category,
  preferred_venues,
  preferred_days,
  preferred_times,
  message,
  status,
  source
)
on table public.player_requests_demo
to anon;

-- ---------------------------------------------------------
-- 17.2 LECTURA INTERNA AUTENTICADA
-- Las políticas RLS deciden qué filas puede ver cada usuario.
-- ---------------------------------------------------------

grant select on table public.accounts
to authenticated;

grant select on table public.app_users
to authenticated;

grant select on table public.assistant_feedback_demo
to authenticated;

grant select on table public.audit_logs
to authenticated;

grant select on table public.communities
to authenticated;

grant select on table public.community_categories
to authenticated;

grant select on table public.community_venues
to authenticated;

grant select on table public.event_templates
to authenticated;

grant select on table public.invitations
to authenticated;

grant select on table public.message_templates
to authenticated;

grant select on table public.messages
to authenticated;

grant select on table public.player_availability
to authenticated;

grant select on table public.player_communities
to authenticated;

grant select on table public.player_import_batches
to authenticated;

grant select on table public.player_relationships
to authenticated;

grant select on table public.player_requests_demo
to authenticated;

grant select on table public.player_venues
to authenticated;

grant select on table public.players
to authenticated;

grant select on table public.sports
to authenticated;

grant select on table public.staff_members
to authenticated;

grant select on table public.staff_members_demo
to authenticated;

-- Tablas con columnas financieras o secretas:
-- se leen solamente mediante vistas seguras.
grant select on table public.ptm_events_secure_v1
to authenticated;

grant select on table public.ptm_participations_secure_v1
to authenticated;

grant select on table public.ptm_venues_secure_v1
to authenticated;

grant select on table public.ptm_messaging_accounts_safe_v1
to authenticated;

-- ---------------------------------------------------------
-- 17.3 ESCRITURA INTERNA AUTENTICADA
-- Las políticas RLS vuelven a validar cuenta, rol y permisos.
-- ---------------------------------------------------------

grant update on table public.accounts
to authenticated;

grant insert, update, delete
on table public.app_users
to authenticated;

grant insert, update, delete
on table public.assistant_feedback_demo
to authenticated;

grant insert, update, delete
on table public.communities
to authenticated;

grant insert, update, delete
on table public.community_categories
to authenticated;

grant insert, update, delete
on table public.community_venues
to authenticated;

grant insert, update, delete
on table public.event_templates
to authenticated;

grant insert, update, delete
on table public.invitations
to authenticated;

grant insert, update, delete
on table public.message_templates
to authenticated;

grant insert, update, delete
on table public.messages
to authenticated;

grant insert, update, delete
on table public.player_availability
to authenticated;

grant insert, update, delete
on table public.player_communities
to authenticated;

grant insert
on table public.player_import_batches
to authenticated;

grant insert, update, delete
on table public.player_relationships
to authenticated;

grant insert, update, delete
on table public.player_requests_demo
to authenticated;

grant insert, update, delete
on table public.player_venues
to authenticated;

grant insert, update, delete
on table public.players
to authenticated;

grant insert, update, delete
on table public.staff_members
to authenticated;

grant insert, update, delete
on table public.staff_members_demo
to authenticated;

-- No se conceden escrituras directas sobre:
-- events, participations, venues, messaging_accounts.
-- Esas acciones se hacen mediante RPC seguras.

-- =========================================================
-- 18. PRIVILEGIOS MÍNIMOS DE FUNCIONES PTM
-- =========================================================

do $$
declare
  funcion record;
begin
  for funcion in
    select
      p.oid::regprocedure::text as function_identity
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'ptm_%'
      and p.prokind = 'f'
    order by
      p.oid::regprocedure::text
  loop
    execute format(
      'revoke execute on function %s from public',
      funcion.function_identity
    );

    execute format(
      'revoke execute on function %s from anon',
      funcion.function_identity
    );

    execute format(
      'revoke execute on function %s from authenticated',
      funcion.function_identity
    );

    execute format(
      'grant execute on function %s to authenticated',
      funcion.function_identity
    );

    execute format(
      'grant execute on function %s to service_role',
      funcion.function_identity
    );
  end loop;
end;
$$;

-- =========================================================
-- 19. REGISTRAR OBJETOS NUEVOS PARA LA REVERSIÓN
-- =========================================================

insert into
  ptm_backup_seguridad_20260719_01._seguridad_objetos_nuevos (
    object_name,
    object_type,
    drop_sql,
    drop_order
  )
values
  (
    'public.ptm_events_secure_v1',
    'VIEW',
    'drop view if exists public.ptm_events_secure_v1 cascade',
    300
  ),
  (
    'public.ptm_participations_secure_v1',
    'VIEW',
    'drop view if exists public.ptm_participations_secure_v1 cascade',
    300
  ),
  (
    'public.ptm_venues_secure_v1',
    'VIEW',
    'drop view if exists public.ptm_venues_secure_v1 cascade',
    300
  ),
  (
    'public.ptm_messaging_accounts_safe_v1',
    'VIEW',
    'drop view if exists public.ptm_messaging_accounts_safe_v1 cascade',
    300
  )
on conflict (object_name)
do update set
  object_type = excluded.object_type,
  drop_sql = excluded.drop_sql,
  drop_order = excluded.drop_order,
  created_at = now();

insert into
  ptm_backup_seguridad_20260719_01._seguridad_objetos_nuevos (
    object_name,
    object_type,
    drop_sql,
    drop_order
  )
select
  format(
    '%I.%I(%s)',
    n.nspname,
    p.proname,
    pg_get_function_identity_arguments(p.oid)
  ),
  'FUNCTION',
  format(
    'drop function if exists %I.%I(%s) cascade',
    n.nspname,
    p.proname,
    pg_get_function_identity_arguments(p.oid)
  ),
  200
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'ptm_%'
  and p.prokind = 'f'
  and p.oid::regprocedure::text not in (
    select function_identity
    from ptm_backup_seguridad_20260719_01._funciones_ptm
  )
on conflict (object_name)
do update set
  object_type = excluded.object_type,
  drop_sql = excluded.drop_sql,
  drop_order = excluded.drop_order,
  created_at = now();

-- =========================================================
-- 20. VERIFICACIONES DENTRO DE LA TRANSACCIÓN
-- =========================================================

do $$
declare
  v_anon_internal_selects integer;
  v_anon_ptm_functions integer;
  v_open_demo_policies integer;
  v_owner_profile integer;
begin
  select count(*)
  into v_anon_internal_selects
  from information_schema.role_table_grants
  where grantee = 'anon'
    and table_schema = 'public'
    and privilege_type in (
      'SELECT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'TRIGGER',
      'REFERENCES'
    );

  if v_anon_internal_selects <> 0 then
    raise exception
      'Todavía existen % permisos internos peligrosos para anon.',
      v_anon_internal_selects;
  end if;

  select count(*)
  into v_anon_ptm_functions
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'ptm_%'
    and p.prokind = 'f'
    and has_function_privilege(
      'anon',
      p.oid,
      'EXECUTE'
    );

  if v_anon_ptm_functions <> 0 then
    raise exception
      'Todavía existen % funciones PTM ejecutables por anon.',
      v_anon_ptm_functions;
  end if;

  select count(*)
  into v_open_demo_policies
  from pg_policies
  where schemaname = 'public'
    and (
      policyname like 'demo_%'
      or policyname like '%_all'
    );

  if v_open_demo_policies <> 0 then
    raise exception
      'Todavía existen % políticas demo abiertas.',
      v_open_demo_policies;
  end if;

  select count(*)
  into v_owner_profile
  from public.staff_members_demo
  where lower(coalesce(role, '')) = 'owner'
    and active is true
    and auth_user_id is not null
    and public.ptm_staff_is_enabled_v1(
      auth_status
    );

  if v_owner_profile < 1 then
    raise exception
      'La verificación final no encontró un dueño activo vinculado.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

-- =========================================================
-- 21. RESULTADO FINAL
-- =========================================================

select
  'SEGURIDAD_RLS_OK' as resultado,
  (
    select count(*)
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity is true
  ) as tablas_con_rls,
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and policyname like 'ptm_%'
  ) as politicas_ptm,
  (
    select count(*)
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'ptm_%'
      and p.prokind = 'f'
      and has_function_privilege(
        'anon',
        p.oid,
        'EXECUTE'
      )
  ) as funciones_ptm_ejecutables_por_anon,
  (
    select count(*)
    from ptm_backup_seguridad_20260719_01._seguridad_objetos_nuevos
  ) as objetos_nuevos_registrados;
