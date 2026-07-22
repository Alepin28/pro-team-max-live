-- Seed v4: datos demo completos para conectar la app con Supabase.
-- Puedes correrlo aunque ya hayas corrido seed.sql antes.

insert into accounts (id, name, client_type, country, city)
values ('00000000-0000-0000-0000-000000000001', 'Pro Team Max Demo', 'organizador', 'EC', 'Guayaquil')
on conflict (id) do update set name = excluded.name, city = excluded.city;

insert into venues (id, account_id, name, city, courts_count, default_duration_minutes)
values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'WE', 'Guayaquil', 4, 90),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'La Perla', 'Guayaquil', 3, 90),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Spot Padel', 'Guayaquil', 4, 90),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Manta', 'Manta', 4, 90)
on conflict (id) do update set name = excluded.name, city = excluded.city, courts_count = excluded.courts_count, default_duration_minutes = excluded.default_duration_minutes;

insert into communities (id, account_id, sport_id, name, city, default_category)
select '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', id, 'Padel Prox', 'Guayaquil', 'C5'
from sports where code = 'padel'
on conflict (id) do update set name = excluded.name, city = excluded.city, default_category = excluded.default_category;

insert into communities (id, account_id, sport_id, name, city, default_category)
select '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', id, 'Mixtos Guayaquil', 'Guayaquil', 'C5'
from sports where code = 'padel'
on conflict (id) do update set name = excluded.name, city = excluded.city, default_category = excluded.default_category;

insert into communities (id, account_id, sport_id, name, city, default_category)
select '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', id, 'Sparring / Quedadas', 'Guayaquil', 'C5'
from sports where code = 'padel'
on conflict (id) do update set name = excluded.name, city = excluded.city, default_category = excluded.default_category;

insert into community_venues (community_id, venue_id)
values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into players (id, account_id, first_name, last_name, whatsapp, gender, declared_category, validated_category, preferred_side, status, opt_in_whatsapp, reliability_score, last_activity_at)
values
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Juan', 'Pérez', '+593991111111', 'hombre', 'C5', 'C5', 'drive', 'activo', true, 94, now() - interval '8 days'),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Carlos', 'Ruiz', '+593992222222', 'hombre', 'C5', 'C5', 'reves', 'activo', true, 88, now() - interval '14 days'),
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Pedro', 'Mora', '+593993333333', 'hombre', 'C5', 'C5', 'cualquiera', 'activo', true, 78, now() - interval '3 days'),
('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Luis', 'Andrade', '+593994444444', 'hombre', 'C5', 'C5', 'drive', 'activo', true, 81, now() - interval '20 days'),
('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Andrés', 'Vera', '+593995555555', 'hombre', 'C5', 'C5', 'reves', 'activo', true, 67, now() - interval '35 days'),
('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Marco', 'León', '+593996666666', 'hombre', 'C6', 'C6', 'cualquiera', 'activo', true, 91, now() - interval '11 days'),
('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'David', 'Torres', '+593997777777', 'hombre', 'C6', 'C6', 'drive', 'activo', true, 93, now() - interval '4 days'),
('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Sofía', 'Lima', '+593998888888', 'mujer', 'C5', 'C5', 'reves', 'activo', true, 90, now() - interval '6 days'),
('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'María', 'Torres', '+593989999999', 'mujer', 'C4', 'C4', 'drive', 'activo', true, 92, now() - interval '5 days'),
('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Ana', 'Salazar', '+593987777777', 'mujer', 'C6', 'C6', 'cualquiera', 'activo', true, 85, now() - interval '12 days')
on conflict (account_id, whatsapp) do update set
first_name = excluded.first_name,
last_name = excluded.last_name,
gender = excluded.gender,
declared_category = excluded.declared_category,
validated_category = excluded.validated_category,
preferred_side = excluded.preferred_side,
status = excluded.status,
opt_in_whatsapp = excluded.opt_in_whatsapp,
reliability_score = excluded.reliability_score,
last_activity_at = excluded.last_activity_at;

insert into player_communities (player_id, community_id, community_category, status)
values
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'C5', 'activo'),
('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'C5', 'activo'),
('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'C5', 'activo'),
('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'C5', 'activo'),
('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'C5', 'activo'),
('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'C6', 'activo'),
('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'C6', 'activo'),
('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 'C5', 'activo'),
('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 'C4', 'activo'),
('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'C6', 'activo')
on conflict (player_id, community_id) do update set community_category = excluded.community_category, status = excluded.status;

insert into player_venues (player_id, venue_id, preference)
values
('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'preferida'),
('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'preferida'),
('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'aceptada'),
('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'preferida'),
('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'aceptada'),
('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'preferida'),
('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'preferida'),
('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'preferida'),
('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'preferida'),
('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'aceptada'),
('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'aceptada'),
('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'aceptada'),
('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'preferida'),
('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 'preferida')
on conflict (player_id, venue_id) do update set preference = excluded.preference;

insert into player_availability (player_id, day_of_week, start_time, end_time)
values
('30000000-0000-0000-0000-000000000001', 2, '18:00', '22:00'),
('30000000-0000-0000-0000-000000000002', 2, '19:00', '22:00'),
('30000000-0000-0000-0000-000000000003', 2, '17:00', '20:00'),
('30000000-0000-0000-0000-000000000004', 2, '19:00', '23:00'),
('30000000-0000-0000-0000-000000000005', 2, '19:00', '21:00'),
('30000000-0000-0000-0000-000000000006', 2, '18:00', '22:00'),
('30000000-0000-0000-0000-000000000007', 2, '19:00', '22:00'),
('30000000-0000-0000-0000-000000000008', 2, '19:00', '22:00'),
('30000000-0000-0000-0000-000000000009', 2, '18:00', '22:30'),
('30000000-0000-0000-0000-000000000010', 2, '17:30', '21:00')
on conflict do nothing;
