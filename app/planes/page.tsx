import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const plans = [
  {
    name: "Gratis",
    price: "$0",
    players: "Hasta 50 jugadores activos",
    description:
      "Ideal para probar el producto, organizar una comunidad pequeña y demostrar valor rápido.",
    features: [
      "Crear partidos",
      "Recomendar jugadores",
      "Registrar respuestas",
      "Control básico de pagos",
      "Solicitudes de jugadores",
      "Portal jugador básico",
    ],
    badge: "Entrada",
  },
  {
    name: "Comunidad",
    price: "Mensual",
    players: "51–100 jugadores activos",
    description:
      "Para profesores, academias pequeñas o comunidades que ya organizan partidos todas las semanas.",
    features: [
      "Todo lo del plan gratis",
      "Más jugadores activos",
      "Staff / asistentes",
      "Permisos por categoría y sede",
      "Alertas internas",
      "Mejor control operativo",
    ],
    badge: "Primer plan pago",
  },
  {
    name: "Club",
    price: "Mensual",
    players: "101–200 jugadores activos",
    description:
      "Para clubes con varias categorías, varias sedes, más volumen y más administradores.",
    features: [
      "Multi-sede",
      "Varios asistentes",
      "Reportes",
      "Historial de partidos",
      "Pagos más completos",
      "Portal jugador más avanzado",
    ],
    badge: "Clubes",
  },
  {
    name: "Empresa",
    price: "Personalizado",
    players: "200+ jugadores activos",
    description:
      "Para clubes grandes, cadenas, torneos, academias con varias sedes o proyectos multi-deporte.",
    features: [
      "Multi-cuenta",
      "Multi-deporte",
      "Automatizaciones",
      "Soporte personalizado",
      "Integraciones",
      "WhatsApp API / BSP",
    ],
    badge: "Escalable",
  },
];

const roadmap30 = [
  "Login real para administrador y asistente",
  "RLS en Supabase por account_id",
  "Separar permisos reales por rol",
  "Pulir Crear partido",
  "Mejorar conversión de solicitud a jugador",
  "Backups y estabilidad",
];

const roadmap60 = [
  "Portal jugador con login",
  "Disponibilidad editable por jugador",
  "Ranking real básico",
  "Historial de partidos por jugador",
  "Control de deuda y pagos más claro",
  "PWA inicial para usar en celular",
];

const roadmap90 = [
  "WhatsApp Cloud API o proveedor BSP",
  "Respuestas automáticas Sí / No / Tal vez",
  "Planes de suscripción",
  "Cobro online",
  "Reportes para clubes",
  "Multi-deporte y multi-sede más robusto",
];

export default function PlanesPage() {
  return (
    <>
      <PageHeader
        title="Planes y roadmap comercial"
        description="Cómo Pro Team Max puede pasar de MVP funcional a producto vendible para clubes, profesores y comunidades."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="badge good">Modelo freemium</span>
        <span className="badge warn">MVP actual</span>
        <span className="badge neutral">Preparado para escalar</span>

        <h2 style={{ marginTop: 16 }}>Regla principal del modelo</h2>

        <p style={{ fontSize: 18 }}>
          <strong>
            El plan gratis permite hasta 50 jugadores activos. Desde el jugador
            51, el administrador necesita un plan pago.
          </strong>
        </p>

        <p className="help-text">
          Los jugadores inactivos o archivados no deberían contar como jugadores
          activos, pero tampoco deben poder ser usados para convocatorias.
        </p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {plans.map((plan) => (
          <div className="card" key={plan.name}>
            <span className="badge good">{plan.badge}</span>

            <h2 style={{ marginTop: 12 }}>{plan.name}</h2>

            <p className="help-text">{plan.players}</p>

            <h2>{plan.price}</h2>

            <p>{plan.description}</p>

            <div className="grid">
              {plan.features.map((feature) => (
                <div className="mini-panel" key={feature}>
                  ✅ {feature}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="help-text">Día 0–30</p>
          <h2>Base segura</h2>

          <div className="grid">
            {roadmap30.map((item) => (
              <div className="mini-panel" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="help-text">Día 31–60</p>
          <h2>Jugador conectado</h2>

          <div className="grid">
            {roadmap60.map((item) => (
              <div className="mini-panel" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="help-text">Día 61–90</p>
          <h2>Automatización y venta</h2>

          <div className="grid">
            {roadmap90.map((item) => (
              <div className="mini-panel" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Qué ya está listo para mostrar</h2>

        <div className="grid grid-3">
          <div className="mini-panel">
            <h3>Panel administrador</h3>
            <p className="help-text">
              Dashboard, crear partido, jugadores, solicitudes, pagos, reserva
              de cancha y staff.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Portal jugador</h3>
            <p className="help-text">
              El jugador puede pedir jugar y consultar solicitudes, partidos y pagos.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Flujo completo</h3>
            <p className="help-text">
              Solicitud → contacto → conversión en jugador → convocatoria → pago.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Riesgos principales antes de vender</h2>

        <div className="grid grid-2">
          <div className="mini-panel">
            <h3>Seguridad</h3>
            <p className="help-text">
              Hay que implementar login real, roles y RLS antes de usar datos reales de varios clientes.
            </p>
          </div>

          <div className="mini-panel">
            <h3>WhatsApp</h3>
            <p className="help-text">
              La automatización depende de WhatsApp Cloud API o un proveedor BSP.
              Mientras tanto, el MVP funciona con copia manual.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Pagos</h3>
            <p className="help-text">
              Hoy se registran pagos manualmente. Para producto comercial se puede integrar cobro online.
            </p>
          </div>

          <div className="mini-panel">
            <h3>Operación multi-cliente</h3>
            <p className="help-text">
              Hay que blindar que cada admin solo vea sus jugadores, sedes, comunidades y partidos.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Acciones rápidas</h2>

        <div className="row-actions">
          <Link className="btn" href="/pitch">
            Ver pitch comercial
          </Link>

          <Link className="btn" href="/demo">
            Ver presentación producto
          </Link>

          <Link className="btn" href="/llenar-canchas">
            Crear partido
          </Link>

          <Link className="btn secondary" href="/jugador">
            Portal jugador
          </Link>
        </div>
      </div>
    </>
  );
}