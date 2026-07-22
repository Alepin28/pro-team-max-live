# Pro Team Max MVP — Starter Kit

Este paquete es el primer MVP técnico de **Pro Team Max** en modo manual.

Incluye:

- Estructura de aplicación con Next.js App Router.
- Pantallas base: Dashboard, Jugadores, Comunidades, Sedes y Llenar Canchas.
- Motor básico de recomendación con datos demo.
- Generador de mensaje personalizado y link `wa.me` para abrir WhatsApp manualmente.
- SQL inicial para Supabase/PostgreSQL.
- Separación preparada para futuro WhatsApp Cloud API.

## 1. Requisitos

- Node.js 20.9 o superior.
- Una cuenta en Supabase.
- Un editor de código, idealmente VS Code.

## 2. Crear proyecto Supabase

1. Entra a Supabase.
2. Crea un proyecto nuevo.
3. Ve a **SQL Editor**.
4. Copia y ejecuta el archivo:

```txt
supabase/schema.sql
```

5. Opcional: ejecuta también:

```txt
supabase/seed.sql
```

## 3. Variables de entorno

Copia el archivo `.env.example` y crea uno llamado `.env.local`:

```bash
cp .env.example .env.local
```

Luego coloca tus valores de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 4. Instalar y correr

```bash
npm install
npm run dev
```

Abre:

```txt
http://localhost:3000
```

## 5. Qué ya funciona en demo

La pantalla **Llenar Canchas** usa datos demo y permite:

- Elegir comunidad, sede, categoría y número de canchas.
- Buscar jugadores compatibles.
- Ver score recomendado.
- Generar mensaje personalizado.
- Copiar mensaje.
- Abrir WhatsApp con texto prellenado.

## 6. Qué sigue

El siguiente paquete debería conectar estas pantallas a Supabase de verdad:

1. Auth/login.
2. CRUD real de jugadores.
3. CRUD real de comunidades y sedes.
4. Crear evento real.
5. Guardar invitaciones manuales.
6. Confirmar jugadores desde el detalle del evento.

## 7. Filosofía del MVP

No intentamos crear todo el producto todavía.

Primero queremos probar la experiencia central:

> Crear evento → buscar jugadores → enviar invitaciones manuales por WhatsApp → llenar cancha.


## v3

- Botones Registrar OK / No puede / Ambiguo ahora actualizan estado en pantalla.
- Se muestra contador de confirmados, cupos faltantes, lista de espera y rechazados.
- Si se llenan los cupos, los siguientes OK pasan a lista de espera.

## V5
- Agrega `supabase/seed_v5_reset.sql` para resetear y cargar datos demo completos.
- Mejora mensajes de error cuando Supabase no devuelve filas.
- Reabre el último evento creado después de refrescar y vuelve a cargar participaciones desde Supabase.
