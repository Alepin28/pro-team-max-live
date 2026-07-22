-- Pro Team Max MVP schema
-- Ejecutar en Supabase SQL Editor.

create extension if not exists pgcrypto;

create type app_role as enum ('propietario', 'administrador', 'asistente');
create type category as enum ('C1','C2','C3','C4','C5','C6','C7');
create type player_side as enum ('drive','reves','cualquiera');
create type player_status as enum ('activo','inactivo','en_prueba','bloqueado','no_contactar','pendiente_validacion');
create type event_status as enum ('borrador','buscando_jugadores','casi_lleno','lleno','reemplazo_urgente','en_curso','finalizado','cancelado');
create type invitation_status as enum ('pendiente','enviada','respondida','fallida','cancelada');
create type participation_status as enum ('confirmado','lista_espera','cancelado','rechazo','no_respondio','asistio','no_show','reemplazo');
create type messaging_channel as enum ('manual','meta_cloud','bsp','test');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_type text default 'organizador',
  country text default 'EC',
  city text,
  plan text default 'gratis',
  active_players_limit int default 50,
  created_at timestamptz default now()
);

create table app_users (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  auth_user_id uuid unique,
  full_name text not null,
  email text unique,
  phone text,
  role app_role not null default 'administrador',
  created_at timestamptz default now()
);

create table sports (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  players_per_court int not null default 4,
  active boolean default true
);

insert into sports (code, name, players_per_court)
values ('padel', 'Pádel', 4)
on conflict (code) do nothing;

create table venues (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  city text,
  address text,
  courts_count int default 1,
  default_duration_minutes int default 90,
  opening_time time,
  closing_time time,
  internal_court_cost numeric(10,2),
  suggested_player_price numeric(10,2),
  active boolean default true,
  created_at timestamptz default now()
);

create table communities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  sport_id uuid not null references sports(id),
  name text not null,
  city text,
  default_category category,
  active boolean default true,
  created_at timestamptz default now()
);

create table community_venues (
  community_id uuid references communities(id) on delete cascade,
  venue_id uuid references venues(id) on delete cascade,
  primary key (community_id, venue_id)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  first_name text not null,
  last_name text,
  whatsapp text not null,
  email text,
  gender text,
  city text,
  photo_url text,
  declared_category category,
  validated_category category,
  preferred_side player_side default 'cualquiera',
  dominant_hand text,
  status player_status default 'pendiente_validacion',
  opt_in_whatsapp boolean default false,
  opt_out_whatsapp boolean default false,
  internal_notes text,
  reliability_score int default 70 check (reliability_score between 0 and 100),
  last_activity_at timestamptz,
  created_at timestamptz default now(),
  unique(account_id, whatsapp)
);

create table player_communities (
  player_id uuid references players(id) on delete cascade,
  community_id uuid references communities(id) on delete cascade,
  community_category category,
  notes text,
  status player_status default 'activo',
  created_at timestamptz default now(),
  primary key (player_id, community_id)
);

create table player_venues (
  player_id uuid references players(id) on delete cascade,
  venue_id uuid references venues(id) on delete cascade,
  preference text default 'aceptada',
  primary key (player_id, venue_id)
);

create table player_availability (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  venue_id uuid references venues(id),
  notes text
);

create table player_relationships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  related_player_id uuid not null references players(id) on delete cascade,
  relation_type text not null, -- bloqueo_no_jugar, preferencia_positiva, pareja_habitual
  notes text,
  created_at timestamptz default now(),
  check (player_id <> related_player_id)
);

create table event_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  community_id uuid references communities(id),
  venue_id uuid references venues(id),
  name text not null,
  category category,
  default_time time,
  default_duration_minutes int default 90,
  default_courts int default 1,
  message_template text,
  is_favorite boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  community_id uuid not null references communities(id),
  venue_id uuid not null references venues(id),
  sport_id uuid not null references sports(id),
  created_by uuid references app_users(id),
  title text not null,
  event_type text default 'partido_libre',
  event_date date not null,
  start_time time not null,
  end_time time,
  duration_minutes int not null default 90,
  courts_count int not null default 1,
  players_needed int not null default 4,
  category category,
  status event_status default 'borrador',
  player_price numeric(10,2),
  internal_court_cost numeric(10,2),
  custom_message text,
  allow_waitlist boolean default true,
  allow_more_courts boolean default true,
  created_at timestamptz default now()
);

create table messaging_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  provider messaging_channel default 'manual',
  mode_active messaging_channel default 'manual',
  whatsapp_business_account_id text,
  phone_number_id text unique,
  visible_number text,
  display_name text,
  access_token_encrypted text,
  status text default 'sin_configurar',
  quality_status text,
  messaging_limit int,
  created_at timestamptz default now()
);

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  messaging_account_id uuid references messaging_accounts(id),
  name text not null,
  use_type text not null,
  body text not null,
  language text default 'es',
  meta_category text,
  approval_status text default 'no_aplica',
  meta_template_id text,
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  messaging_account_id uuid references messaging_accounts(id),
  player_id uuid references players(id),
  event_id uuid references events(id),
  channel messaging_channel default 'manual',
  direction text default 'outbound',
  body text not null,
  status text default 'pendiente',
  wa_message_id text,
  sent_by uuid references app_users(id),
  registered_by uuid references app_users(id),
  sent_at timestamptz,
  response_at timestamptz,
  created_at timestamptz default now()
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  message_id uuid references messages(id),
  wave_number int not null default 1,
  channel messaging_channel default 'manual',
  status invitation_status default 'pendiente',
  recommendation_score int,
  recommendation_reasons jsonb default '[]'::jsonb,
  sent_at timestamptz,
  responded_at timestamptz,
  response_text text,
  created_at timestamptz default now(),
  unique(event_id, player_id)
);

create table participations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status participation_status not null,
  waitlist_position int,
  source text default 'manual',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  payment_status text default 'pendiente',
  payment_method text,
  amount_paid numeric(10,2),
  notes text,
  created_at timestamptz default now(),
  unique(event_id, player_id)
);

-- Función para contar confirmados y evitar sobrecupo en transacciones futuras.
create or replace function confirmed_count(p_event_id uuid)
returns int language sql stable as $$
  select count(*)::int from participations
  where event_id = p_event_id and status in ('confirmado','asistio','reemplazo');
$$;

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  user_id uuid references app_users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz default now()
);

-- Índices útiles
create index idx_players_account_category on players(account_id, validated_category);
create index idx_players_whatsapp on players(account_id, whatsapp);
create index idx_events_account_date on events(account_id, event_date);
create index idx_invitations_event on invitations(event_id);
create index idx_participations_event on participations(event_id);
create index idx_messages_event on messages(event_id);
