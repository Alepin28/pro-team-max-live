export default function ConfiguracionPage() {
  const modules = [
    {
      name: "Crear partido rápido",
      status: "Listo MVP",
      description:
        "Permite crear un partido, elegir sede, comunidad, categoría, fecha, hora y buscar jugadores compatibles.",
    },
    {
      name: "Eventos / partidos guardados",
      status: "Listo MVP",
      description:
        "Permite revisar partidos creados, estados, jugadores confirmados, lista de espera, pagos y cancelaciones.",
    },
    {
      name: "Jugadores",
      status: "Listo MVP",
      description:
        "Permite administrar jugadores activos, inactivos, categorías, teléfono, mano, comunidades y disponibilidad.",
    },
    {
      name: "Sedes",
      status: "Listo MVP",
      description:
        "Permite registrar sedes, revisar datos básicos y mantenerlas activas o inactivas.",
    },
    {
      name: "Comunidades",
      status: "Listo MVP",
      description:
        "Permite organizar grupos de jugadores por comunidad, nivel o sede.",
    },
    {
      name: "Staff / asistentes",
      status: "Demo funcional",
      description:
        "Permite simular asistentes y permisos. En versión real deberá conectarse con login y seguridad.",
    },
    {
      name: "Solicitudes de jugadores",
      status: "Demo funcional",
      description:
        "Permite que un jugador solicite jugar y que el administrador revise, contacte o convierta esa solicitud en jugador.",
    },
    {
      name: "Perfil jugador",
      status: "Demo funcional",
      description:
        "Permite al jugador consultar información básica usando su WhatsApp. En versión real necesita login o validación.",
    },
    {
      name: "Pagos",
      status: "Listo MVP básico",
      description:
        "Permite marcar pagos por jugador, revisar total esperado, cobrado y faltante por partido.",
    },
    {
      name: "WhatsApp",
      status: "Manual MVP",
      description:
        "Actualmente se copia o abre mensaje manualmente. La integración automática con WhatsApp Cloud API queda para fase posterior.",
    },
  ];

  const rules = [
    "Un jugador activo cuenta para el límite del plan.",
    "Un jugador inactivo no debe recibir invitaciones.",
    "Un jugador borrado/inactivo conserva historial, pero no debe mostrar datos sensibles.",
    "El partido puede estar buscando jugadores, cerrado o cancelado.",
    "La reserva de cancha debe manejarse separado del estado del partido.",
    "Los pagos pueden ser efectivo, transferencia u otro método.",
    "Puede haber jugadores gratis, pagos parciales o montos diferentes por jugador.",
    "El administrador debe poder copiar mensajes para WhatsApp Business.",
    "La prioridad del sistema es crear partidos rápido, con pocos clics.",
  ];

  const roadmap = [
    {
      phase: "Fase 1",
      title: "MVP interno",
      items: [
        "Probar con administradores y asistentes.",
        "Corregir errores visibles.",
        "Mejorar textos, orden y experiencia.",
        "Dejar flujo de crear partido rápido muy claro.",
      ],
    },
    {
      phase: "Fase 2",
      title: "MVP comercial",
      items: [
        "Login real para administradores.",
        "Separación real por cuenta/account_id.",
        "Reglas de seguridad RLS en Supabase.",
        "Planes y límites reales.",
        "Mejor onboarding para nuevos clubes.",
      ],
    },
    {
      phase: "Fase 3",
      title: "Automatización",
      items: [
        "Integración WhatsApp Cloud API o BSP.",
        "Mensajes automáticos con plantillas.",
        "Notificaciones internas.",
        "Importar contactos.",
        "Ranking y confiabilidad más avanzado.",
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Pro Team Max
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                Configuración del sistema
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Panel general para revisar cómo está configurado el MVP, qué
                módulos están listos, qué reglas de negocio se están usando y
                qué queda para las siguientes fases.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-100">
              <p className="font-bold">Estado actual</p>
              <p className="mt-1 text-cyan-200">MVP interno en prueba</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Cuenta demo</p>
            <p className="mt-2 text-2xl font-black text-white">Padel Prox</p>
            <p className="mt-1 text-xs text-slate-500">
              Cuenta principal de prueba
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Plan actual</p>
            <p className="mt-2 text-2xl font-black text-white">Free / Demo</p>
            <p className="mt-1 text-xs text-slate-500">
              Hasta 50 jugadores activos
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">WhatsApp</p>
            <p className="mt-2 text-2xl font-black text-white">Manual</p>
            <p className="mt-1 text-xs text-slate-500">
              Copiar / abrir mensaje
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Seguridad</p>
            <p className="mt-2 text-2xl font-black text-amber-300">Demo</p>
            <p className="mt-1 text-xs text-slate-500">
              Login y RLS quedan para fase comercial
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">
                Módulos de la aplicación
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Vista rápida de lo que ya existe dentro del MVP.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <article
                key={module.name}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-black text-white">
                    {module.name}
                  </h3>
                  <span
                    className={
                      module.status.includes("Listo")
                        ? "shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200"
                        : module.status.includes("Demo")
                          ? "shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200"
                          : "shrink-0 rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200"
                    }
                  >
                    {module.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {module.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-black text-white">
              Reglas principales del MVP
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Estas reglas guían el funcionamiento actual de Pro Team Max.
            </p>

            <div className="mt-5 space-y-3">
              {rules.map((rule, index) => (
                <div
                  key={rule}
                  className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-black text-slate-950">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-black text-white">
              Configuración recomendada
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Parámetros sugeridos para operar el MVP interno.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="text-sm font-bold text-slate-300">
                  Límite del plan gratis
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  50 jugadores activos
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Los inactivos no cuentan para el límite, pero conservan
                  historial.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="text-sm font-bold text-slate-300">
                  Canal de mensajes
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  WhatsApp Business manual
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Para MVP se copia el mensaje y se envía manualmente. La API
                  queda para fase posterior.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="text-sm font-bold text-slate-300">
                  Prioridad del producto
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  Crear partido rápido
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Menos clics, menos fricción, más velocidad para llenar
                  canchas.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-2xl font-black text-white">Roadmap</h2>
          <p className="mt-1 text-sm text-slate-400">
            Orden sugerido para pasar de demo interna a producto comercial.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {roadmap.map((phase) => (
              <article
                key={phase.phase}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
              >
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
                  {phase.phase}
                </p>
                <h3 className="mt-2 text-xl font-black text-white">
                  {phase.title}
                </h3>

                <ul className="mt-4 space-y-3">
                  {phase.items.map((item) => (
                    <li
                      key={item}
                      className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm leading-5 text-slate-300"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-6">
          <h2 className="text-2xl font-black text-amber-100">
            Nota importante antes de vender
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-amber-100/90">
            Este MVP sirve para probar operación, flujo, mensajes y valor del
            producto. Antes de abrirlo a clubes reales con datos reales, hay que
            activar login, seguridad por cuenta, reglas RLS en Supabase,
            protección de datos de jugadores y configuración real de planes.
          </p>
        </section>
      </div>
    </main>
  );
}