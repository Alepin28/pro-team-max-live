import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const blocks = [
  {
    number: "1",
    title: "Crear partido",
    description:
      "El administrador crea un partido en pocos pasos: sede, fecha, hora, categoría, precio y cupos.",
    href: "/llenar-canchas",
    action: "Crear partido",
    status: "Funcional",
  },
  {
    number: "2",
    title: "Recomendar jugadores",
    description:
      "El sistema muestra jugadores compatibles por categoría, sede, horario, disponibilidad y nivel.",
    href: "/llenar-canchas",
    action: "Ver recomendados",
    status: "Funcional",
  },
  {
    number: "3",
    title: "Enviar WhatsApp",
    description:
      "El admin copia el mensaje o abre WhatsApp para invitar jugadores de forma rápida y natural.",
    href: "/llenar-canchas",
    action: "Abrir invitaciones",
    status: "Manual MVP",
  },
  {
    number: "4",
    title: "Registrar respuestas",
    description:
      "Se registra si el jugador confirma, no puede, queda ambiguo o pasa a lista de espera.",
    href: "/llenar-canchas",
    action: "Registrar OK / No",
    status: "Funcional",
  },
  {
    number: "5",
    title: "Reserva de cancha",
    description:
      "El partido puede quedar con cancha pendiente, reservada, no disponible o cancelada.",
    href: "/eventos",
    action: "Ver partidos",
    status: "Funcional",
  },
  {
    number: "6",
    title: "Pagos",
    description:
      "El admin controla cuánto debe pagar cada jugador, cuánto pagó, método, referencia y faltante.",
    href: "/eventos",
    action: "Ver pagos",
    status: "Funcional",
  },
  {
    number: "7",
    title: "Jugador quiere jugar",
    description:
      "Un jugador externo llena una solicitud indicando nombre, WhatsApp, categoría, sede y horario.",
    href: "/quiero-jugar",
    action: "Abrir formulario",
    status: "Funcional",
  },
  {
    number: "8",
    title: "Convertir solicitud en jugador",
    description:
      "El admin revisa solicitudes, contacta al jugador y lo convierte en jugador activo para convocatorias.",
    href: "/solicitudes",
    action: "Ver solicitudes",
    status: "Funcional",
  },
  {
    number: "9",
    title: "Portal jugador",
    description:
      "El jugador consulta sus solicitudes, partidos, pagos, estado de cancha y perfil deportivo.",
    href: "/mi-perfil-jugador",
    action: "Ver perfil jugador",
    status: "Funcional MVP",
  },
];

export default function DemoPage() {
  return (
    <>
      <PageHeader
        title="Presentación Pro Team Max"
        description="Guion rápido para mostrar el producto: del partido vacío al jugador convocado, pagado y con cancha reservada."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="badge good">Prototipo funcional</span>
        <span className="badge warn">MVP manual</span>
        <span className="badge neutral">Pádel primero · Multi-deporte después</span>

        <h2 style={{ marginTop: 14 }}>Qué problema resuelve</h2>

        <p>
          Pro Team Max ayuda a administradores, clubes y profesores a llenar
          canchas más rápido, organizar jugadores, registrar respuestas,
          controlar pagos y no olvidar la reserva de cancha.
        </p>

        <div className="grid grid-3" style={{ marginTop: 16 }}>
          <div className="mini-panel">
            <p className="help-text">Promesa principal</p>
            <h2>Crear partido rápido</h2>
            <p className="help-text">
              Menos pasos para armar una convocatoria.
            </p>
          </div>

          <div className="mini-panel">
            <p className="help-text">Valor para admin</p>
            <h2>Llenar canchas</h2>
            <p className="help-text">
              Recomendaciones, WhatsApp, respuestas, pagos y reservas.
            </p>
          </div>

          <div className="mini-panel">
            <p className="help-text">Valor para jugador</p>
            <h2>Quiero jugar</h2>
            <p className="help-text">
              El jugador levanta la mano y entra al flujo.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Guion de presentación en 5 minutos</h2>

        <div className="grid">
          <div className="mini-panel">
            <strong>1. Empieza en Dashboard</strong>
            <p className="help-text">
              Muestra partidos activos, pagos, reservas y alertas internas.
            </p>
            <Link className="btn secondary" href="/">
              Abrir Dashboard
            </Link>
          </div>

          <div className="mini-panel">
            <strong>2. Crea un partido</strong>
            <p className="help-text">
              Muestra cómo se crea un partido rápido y aparecen jugadores recomendados.
            </p>
            <Link className="btn secondary" href="/llenar-canchas">
              Crear partido
            </Link>
          </div>

          <div className="mini-panel">
            <strong>3. Registra respuestas</strong>
            <p className="help-text">
              Marca OK, No puede, Ambiguo o lista de espera.
            </p>
            <Link className="btn secondary" href="/llenar-canchas">
              Registrar respuestas
            </Link>
          </div>

          <div className="mini-panel">
            <strong>4. Entra al detalle del partido</strong>
            <p className="help-text">
              Muestra pagos, confirmados, reserva de cancha y estado del partido.
            </p>
            <Link className="btn secondary" href="/eventos">
              Ver partidos
            </Link>
          </div>

          <div className="mini-panel">
            <strong>5. Muestra el lado jugador</strong>
            <p className="help-text">
              El jugador pide jugar, luego revisa su perfil, pagos y partidos.
            </p>
            <div className="row-actions">
              <Link className="btn secondary" href="/quiero-jugar">
                Quiero jugar
              </Link>

              <Link className="btn secondary" href="/mi-perfil-jugador">
                Mi perfil jugador
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        {blocks.map((block) => (
          <div className="card" key={block.number}>
            <div className="player-top">
              <div>
                <span className="badge good">Paso {block.number}</span>
                <h2>{block.title}</h2>
              </div>

              <div className="score">{block.number}</div>
            </div>

            <p>{block.description}</p>

            <div className="row-actions">
              <span className="badge neutral">{block.status}</span>
            </div>

            <div style={{ height: 12 }} />

            <Link className="btn" href={block.href}>
              {block.action}
            </Link>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Qué falta para versión comercial</h2>

        <div className="grid grid-2">
          <div className="mini-panel">
            <h3>Login y seguridad</h3>
            <p className="help-text">
              Separar admin, asistente y jugador con cuentas reales, permisos y RLS en Supabase.
            </p>
          </div>

          <div className="mini-panel">
            <h3>WhatsApp automático</h3>
            <p className="help-text">
              Conectar WhatsApp Cloud API o BSP para enviar mensajes y recibir respuestas.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Portal jugador real</h3>
            <p className="help-text">
              Login, perfil, historial, pagos, ranking, disponibilidad y preferencias.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Planes y cobro</h3>
            <p className="help-text">
              Freemium, límite de jugadores activos, planes por volumen y suscripción.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}