-- =========================================================
-- PRO TEAM MAX
-- 02_SQL_REVERTIR_SEGURIDAD.sql
--
-- OBJETIVO
-- Volver al estado exacto anterior a Seguridad Real Fase 2
-- usando el respaldo:
-- ptm_backup_seguridad_20260719_01
--
-- IMPORTANTE
-- 1. NO ejecutar ahora.
-- 2. Guardar este archivo antes de aplicar el SQL de seguridad.
-- 3. Ejecutarlo únicamente si la aplicación falla después del RLS.
-- 4. No borra jugadores, partidos, pagos ni otros datos operativos.
-- =========================================================

begin;

-- =========================================================
-- 1. VERIFICAR QUE EL RESPALDO EXISTE Y ESTÁ COMPLETO
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_namespace
    where nspname = 'ptm_backup_seguridad_20260719_01'
  ) then
    raise exception
      'No existe el esquema de respaldo ptm_backup_seguridad_20260719_01.';
  end if;

  if to_regclass(
    'ptm_backup_seguridad_20260719_01._estado_rls'
  ) is null then
    raise exception
      'Falta la tabla de respaldo _estado_rls.';
  end if;

  if to_regclass(
    'ptm_backup_seguridad_20260719_01._politicas_actuales'
  ) is null then
    raise exception
      'Falta la tabla de respaldo _politicas_actuales.';
  end if;

  if to_regclass(
    'ptm_backup_seguridad_20260719_01._permisos_tablas'
  ) is null then
    raise exception
      'Falta la tabla de respaldo _permisos_tablas.';
  end if;

  if to_regclass(
    'ptm_backup_seguridad_20260719_01._funciones_ptm'
  ) is null then
    raise exception
      'Falta la tabla de respaldo _funciones_ptm.';
  end if;
end;
$$;

-- =========================================================
-- 2. ELIMINAR OBJETOS NUEVOS CREADOS POR EL SQL DE SEGURIDAD
--
-- El SQL de seguridad creará un manifiesto con las sentencias
-- DROP necesarias. Si la aplicación de seguridad falló antes de
-- crear el manifiesto, este bloque simplemente no hace nada.
-- =========================================================

do $$
declare
  objeto record;
begin
  if to_regclass(
    'ptm_backup_seguridad_20260719_01._seguridad_objetos_nuevos'
  ) is not null then
    for objeto in
      execute '
        select
          drop_sql
        from
          ptm_backup_seguridad_20260719_01._seguridad_objetos_nuevos
        where
          drop_sql is not null
          and btrim(drop_sql) <> ''''
        order by
          drop_order desc,
          created_at desc
      '
    loop
      execute objeto.drop_sql;
    end loop;
  end if;
end;
$$;

-- =========================================================
-- 3. RESPALDO DE EMERGENCIA DEL ESTADO QUE SE VA A REVERTIR
--
-- Solo guarda una fotografía técnica del estado inmediatamente
-- anterior a la reversión. No copia datos operativos.
-- =========================================================

create table if not exists
  ptm_backup_seguridad_20260719_01._reversion_ejecutada (
    id bigint generated always as identity primary key,
    executed_at timestamptz not null default now(),
    executed_by text not null default current_user,
    note text not null
  );

insert into
  ptm_backup_seguridad_20260719_01._reversion_ejecutada (
    note
  )
values (
  'Inicio de reversión de Seguridad Real Fase 2'
);

-- =========================================================
-- 4. QUITAR TODAS LAS POLÍTICAS ACTUALES DE LAS TABLAS
-- RESPALDADAS
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
        select table_name
        from ptm_backup_seguridad_20260719_01._estado_rls
        where schema_name = 'public'
      )
    order by
      tablename,
      policyname
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

-- =========================================================
-- 5. RESTAURAR LAS POLÍTICAS QUE EXISTÍAN EN EL RESPALDO
-- =========================================================

do $$
declare
  politica record;
  roles_sql text;
  sentencia text;
begin
  for politica in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    from
      ptm_backup_seguridad_20260719_01._politicas_actuales
    order by
      tablename,
      policyname
  loop
    select string_agg(
      case
        when rol::text = 'public' then 'public'
        else quote_ident(rol::text)
      end,
      ', '
    )
    into roles_sql
    from unnest(politica.roles) as rol;

    if roles_sql is null or btrim(roles_sql) = '' then
      roles_sql := 'public';
    end if;

    sentencia := format(
      'create policy %I on %I.%I as %s for %s to %s',
      politica.policyname,
      politica.schemaname,
      politica.tablename,
      case
        when upper(coalesce(politica.permissive, 'PERMISSIVE'))
          = 'RESTRICTIVE'
        then 'RESTRICTIVE'
        else 'PERMISSIVE'
      end,
      upper(coalesce(politica.cmd, 'ALL')),
      roles_sql
    );

    if politica.qual is not null then
      sentencia :=
        sentencia
        || ' using ('
        || politica.qual
        || ')';
    end if;

    if politica.with_check is not null then
      sentencia :=
        sentencia
        || ' with check ('
        || politica.with_check
        || ')';
    end if;

    execute sentencia;
  end loop;
end;
$$;

-- =========================================================
-- 6. RESTAURAR PERMISOS DE TABLAS PARA ANON Y AUTHENTICATED
--
-- Se restauran únicamente los permisos de los roles usados por
-- el navegador. Los permisos de postgres y service_role no se
-- reducen ni se alteran.
-- =========================================================

do $$
declare
  tabla record;
begin
  for tabla in
    select
      schema_name,
      table_name
    from
      ptm_backup_seguridad_20260719_01._estado_rls
    order by
      schema_name,
      table_name
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon',
      tabla.schema_name,
      tabla.table_name
    );

    execute format(
      'revoke all privileges on table %I.%I from authenticated',
      tabla.schema_name,
      tabla.table_name
    );
  end loop;
end;
$$;

do $$
declare
  permiso record;
  sentencia text;
begin
  for permiso in
    select
      grantee,
      table_schema,
      table_name,
      privilege_type,
      is_grantable
    from
      ptm_backup_seguridad_20260719_01._permisos_tablas
    where
      grantee in ('anon', 'authenticated')
    order by
      table_schema,
      table_name,
      grantee,
      privilege_type
  loop
    sentencia := format(
      'grant %s on table %I.%I to %I',
      permiso.privilege_type,
      permiso.table_schema,
      permiso.table_name,
      permiso.grantee
    );

    if permiso.is_grantable = 'YES' then
      sentencia := sentencia || ' with grant option';
    end if;

    execute sentencia;
  end loop;
end;
$$;

-- =========================================================
-- 7. RESTAURAR DEFINICIONES ORIGINALES DE FUNCIONES PTM
-- =========================================================

do $$
declare
  funcion record;
begin
  for funcion in
    select
      function_identity,
      function_definition
    from
      ptm_backup_seguridad_20260719_01._funciones_ptm
    order by
      function_name,
      function_identity
  loop
    execute funcion.function_definition;
  end loop;
end;
$$;

-- =========================================================
-- 8. QUITAR PERMISOS DE EJECUCIÓN ACTUALES DE LAS FUNCIONES
-- ORIGINALES
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
      and p.proname in (
        select distinct function_name
        from ptm_backup_seguridad_20260719_01._funciones_ptm
      )
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
  end loop;
end;
$$;

-- =========================================================
-- 9. RESTAURAR EJECUCIÓN EFECTIVA DE FUNCIONES
--
-- La fotografía técnica guardó si cada función podía ejecutarse
-- desde anon, authenticated y service_role.
-- =========================================================

do $$
declare
  funcion record;
  detalle_json jsonb;
begin
  if to_regclass(
    'ptm_backup_seguridad_20260719_01._snapshot_tecnico_seguridad'
  ) is not null then
    for funcion in
      select
        objeto as function_identity,
        detalle
      from
        ptm_backup_seguridad_20260719_01._snapshot_tecnico_seguridad
      where
        seccion = '07_FUNCIONES_PTM'
      order by
        objeto
    loop
      detalle_json := funcion.detalle::jsonb;

      if coalesce(
        (detalle_json ->> 'anon_can_execute')::boolean,
        false
      ) then
        execute format(
          'grant execute on function %s to anon',
          funcion.function_identity
        );
      end if;

      if coalesce(
        (detalle_json ->> 'authenticated_can_execute')::boolean,
        false
      ) then
        execute format(
          'grant execute on function %s to authenticated',
          funcion.function_identity
        );
      end if;

      if coalesce(
        (detalle_json ->> 'service_role_can_execute')::boolean,
        false
      ) then
        execute format(
          'grant execute on function %s to service_role',
          funcion.function_identity
        );
      end if;
    end loop;
  else
    -- Respaldo alternativo:
    -- la auditoría original confirmó acceso efectivo para estos
    -- tres roles en las 14 funciones existentes.
    for funcion in
      select
        p.oid::regprocedure::text as function_identity
      from pg_proc p
      join pg_namespace n
        on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          select distinct function_name
          from ptm_backup_seguridad_20260719_01._funciones_ptm
        )
        and p.prokind = 'f'
      order by
        p.oid::regprocedure::text
    loop
      execute format(
        'grant execute on function %s to anon',
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
  end if;
end;
$$;

-- =========================================================
-- 10. RESTAURAR ESTADO DE RLS TABLA POR TABLA
-- =========================================================

do $$
declare
  tabla record;
begin
  for tabla in
    select
      schema_name,
      table_name,
      rls_enabled,
      force_rls
    from
      ptm_backup_seguridad_20260719_01._estado_rls
    order by
      schema_name,
      table_name
  loop
    if tabla.rls_enabled then
      execute format(
        'alter table %I.%I enable row level security',
        tabla.schema_name,
        tabla.table_name
      );
    else
      execute format(
        'alter table %I.%I disable row level security',
        tabla.schema_name,
        tabla.table_name
      );
    end if;

    if tabla.force_rls then
      execute format(
        'alter table %I.%I force row level security',
        tabla.schema_name,
        tabla.table_name
      );
    else
      execute format(
        'alter table %I.%I no force row level security',
        tabla.schema_name,
        tabla.table_name
      );
    end if;
  end loop;
end;
$$;

-- =========================================================
-- 11. REGISTRAR FINAL DE LA REVERSIÓN
-- =========================================================

insert into
  ptm_backup_seguridad_20260719_01._reversion_ejecutada (
    note
  )
values (
  'Reversión de Seguridad Real Fase 2 completada'
);

commit;

-- =========================================================
-- 12. VERIFICACIÓN FINAL
-- =========================================================

select
  'REVERSION_OK' as resultado,
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
  ) as politicas_public_actuales,
  (
    select count(*)
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity = true
  ) as tablas_con_rls,
  (
    select count(*)
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'ptm_%'
      and p.prokind = 'f'
  ) as funciones_ptm_actuales;