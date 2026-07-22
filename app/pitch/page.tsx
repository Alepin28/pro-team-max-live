import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const functionalItems = [
  "Crear partidos manualmente",
  "Recomendar jugadores por categoría, sede y disponibilidad",
  "Enviar mensajes por WhatsApp manual",
  "Registrar OK, No puede, Ambiguo y Lista de espera",
  "Controlar pagos por jugador",
  "Marcar estado de reserva de cancha",
  "Recibir solicitudes de jugadores que quieren jugar",
  "Convertir solicitudes en jugadores activos",
  "Portal jugador para consultar solicitudes, partidos y pagos",
  "Staff / permisos demo para asistentes",
];

const pendingItems = [
  "Login real para administradores, asistentes y jugadores",
  "Seguridad final con RLS en Supabase",
  "WhatsApp Cloud API o BSP para mensajes automáticos",
  "Pagos online integrados",
  "Ranking real y métricas avanzadas",
  "App móvil o PWA separada para jugadores",
  "Planes comerciales y control de suscripción",
];

export default function PitchPage() {
  return (
    <>
      <PageHeader
        title="Pitch comercial Pro Team Max"
        description="Resumen para presentar el producto a clubes, profesores, academias o posibles socios."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="badge good">MVP funcional</span>
        <span className="badge warn">Pádel primero</span>
        <span className="badge neutral">Multi-deporte después</span>

        <h2 style={{ marginTop: 16 }}>Frase corta</h2>

        <p style={{ fontSize: 18 }}>
          <strong>
            Pro Team Max ayuda a clubes, profesores y administradores a llenar
            canchas más rápido, organizar jugadores, controlar pagos y gestionar
            partidos desde un solo lugar.
          </strong>
        </p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="help-text">Problema</p>
          <h2>Armar partidos toma demasiado tiempo</h2>
          <p>
            Hoy muchos administradores dependen de WhatsApp, memoria, notas y
            grupos desordenados para llenar una cancha.
          </p>
        </div>

        <div className="card">
          <p className="help-text">Solución</p>
          <h2>Crear partido y convocar rápido</h2>
          <p>
            El sistema recomienda jugadores compatibles, registra respuestas,
            pagos, reservas y solicitudes de nuevos jugadores.
          </p>
        </div>

        <div className="card">
          <p className="help-text">Promesa</p>
          <h2>Llenar canchas con menos pasos</h2>
          <p>
            Menos tiempo buscando jugadores, menos errores, mejor control y más
            partidos organizados.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Cliente objetivo</h2>

        <div className="grid grid-3">
          <div className="mini-panel">
            <h3>Clubes</h3>
            <p className="help-text">
              Clubes que organizan partidos, reservas, torneos internos o comunidades.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Profesores</h3>
            <p className="help-text">
              Profesores que manejan alumnos, niveles, partidos y grupos de juego.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Administradores</h3>
            <p className="help-text">
              Personas que llenan canchas por WhatsApp y necesitan orden, velocidad y control.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Cómo funciona</h2>

        <div className="grid">
          <div className="mini-panel">
            <strong>1. El admin crea un partido</strong>
            <p className="help-text">
              Elige sede, fecha, hora, categoría, precio y cantidad de canchas.
            </p>
          </div>

          <div className="mini-panel">
            <strong>2. El sistema recomienda jugadores</strong>
            <p className="help-text">
              Prioriza jugadores por categoría, sede, disponibilidad y datos guardados.
            </p>
          </div>

          <div className="mini-panel">
            <strong>3. El admin invita por WhatsApp</strong>
            <p className="help-text">
              Copia mensaje o abre WhatsApp. En versión comercial podrá automatizarse.
            </p>
          </div>

          <div className="mini-panel">
            <strong>4. Se registran respuestas</strong>
            <p className="help-text">
              Confirmado, lista de espera, no puede o ambiguo.
            </p>
          </div>

          <div className="mini-panel">
            <strong>5. Se controla cancha y pago</strong>
            <p className="help-text">
              Reserva pendiente o reservada, monto esperado, pagado y faltante.
            </p>
          </div>

          <div className="mini-panel">
            <strong>6. El jugador también puede pedir jugar</strong>
            <p className="help-text">
              Envía solicitud, el admin lo contacta y puede convertirlo en jugador activo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Qué ya funciona en el MVP</h2>

          <div className="grid">
            {functionalItems.map((item) => (
              <div className="mini-panel" key={item}>
                ✅ {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Qué falta para versión comercial</h2>

          <div className="grid">
            {pendingItems.map((item) => (
              <div className="mini-panel" key={item}>
                ⏳ {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Modelo de negocio inicial</h2>

        <div className="grid grid-3">
          <div className="mini-panel">
            <p className="help-text">Plan gratis</p>
            <h2>Hasta 50 jugadores activos</h2>
            <p className="help-text">
              Ideal para probar el producto y que el admin vea valor rápido.
            </p>
          </div>

          <div className="mini-panel">
            <p className="help-text">Plan club pequeño</p>
            <h2>51–100 jugadores</h2>
            <p className="help-text">
              Para profesores, comunidades y clubes chicos.
            </p>
          </div>

          <div className="mini-panel">
            <p className="help-text">Plan club / empresa</p>
            <h2>100+ jugadores</h2>
            <p className="help-text">
              Multi-sede, asistentes, permisos, reportes y automatizaciones.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Diferenciador</h2>

        <p>
          Pro Team Max no empieza como una app pesada de reservas. Empieza desde
          el dolor real del administrador: <strong>llenar la cancha</strong>.
          Luego conecta jugadores, pagos, disponibilidad, reservas y comunidad.
        </p>

        <div className="row-actions">
          <span className="badge good">Menos pasos</span>
          <span className="badge good">Más partidos</span>
          <span className="badge good">Mejor control</span>
          <span className="badge good">Jugador conectado</span>
        </div>
      </div>

      <div className="card">
        <h2>Rutas para mostrar en vivo</h2>

        <div className="row-actions">
          <Link className="btn" href="/demo">
            Presentación producto
          </Link>

          <Link className="btn" href="/llenar-canchas">
            Crear partido
          </Link>

          <Link className="btn" href="/solicitudes">
            Solicitudes
          </Link>

          <Link className="btn" href="/jugador">
            Portal jugador
          </Link>

          <Link className="btn secondary" href="/">
            Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}