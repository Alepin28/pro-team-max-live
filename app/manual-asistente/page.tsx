"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

type QuickRule = {
  title: string;
  description: string;
  badge: string;
  badgeClass: "good" | "warn" | "danger" | "neutral";
};

const responseRules: QuickRule[] = [
  {
    title: "OK registrado",
    description:
      "Úsalo cuando el jugador dijo claramente que sí juega. Ese jugador ocupa un cupo del partido.",
    badge: "✅ Confirmado",
    badgeClass: "good",
  },
  {
    title: "Lista de espera",
    description:
      "Úsalo cuando el jugador sí quiere jugar, pero el partido ya está lleno o quieres dejarlo como reemplazo. Si alguien cancela, puede subir a confirmado.",
    badge: "🟡 Reemplazo",
    badgeClass: "warn",
  },
  {
    title: "Ambiguo",
    description:
      "Úsalo cuando el jugador no respondió claro: tal vez, déjame ver, te confirmo luego, depende. No ocupa cupo todavía.",
    badge: "🤔 No decidido",
    badgeClass: "warn",
  },
  {
    title: "No puede",
    description:
      "Úsalo cuando el jugador dijo que no puede jugar. Sirve para no insistirle en ese partido.",
    badge: "❌ No juega",
    badgeClass: "danger",
  },
];

const paymentRules: QuickRule[] = [
  {
    title: "Pagó",
    description:
      "Úsalo cuando el jugador ya pagó completo. Registra método, monto y referencia si aplica.",
    badge: "💵 Cerrado",
    badgeClass: "good",
  },
  {
    title: "Gratis",
    description:
      "Úsalo cuando el jugador no debe pagar por cortesía, invitación o arreglo interno.",
    badge: "🎁 Cortesía",
    badgeClass: "good",
  },
  {
    title: "Después me paga",
    description:
      "Úsalo cuando el jugador sí debe pagar, pero pagará luego. No significa que esté dudando si juega.",
    badge: "⏳ Por cobrar",
    badgeClass: "warn",
  },
  {
    title: "No pagó",
    description:
      "Úsalo cuando se acepta que ese cobro no se recuperará o quedó como pérdida/no cobrado.",
    badge: "🚫 No cobrado",
    badgeClass: "danger",
  },
];

export default function ManualAsistentePage() {
  return (
    <>
      <PageHeader
        title="Manual rápido del asistente"
        description="Guía simple para Laura, Tito y cualquier asistente activo: crear partidos, contactar jugadores, registrar respuestas y controlar pagos."
        action={
          <Link className="btn" href="/llenar-canchas">
            Abrir Llenar Canchas
          </Link>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-actions">
          <span className="badge good">Uso interno</span>
          <span className="badge warn">WhatsApp manual</span>
          <span className="badge neutral">No borrar historial</span>
        </div>

        <h2>Objetivo del asistente</h2>

        <p>
          El trabajo del asistente es ayudar a llenar partidos rápido, registrar
          bien las respuestas y dejar claro quién juega, quién queda en espera,
          quién no puede y quién debe pagar después.
        </p>

        <p className="help-text">
          Regla principal: si algo no está claro, no inventes. Marca como
          ambiguo o avisa al administrador.
        </p>

        <div className="row-actions">
          <Link className="btn secondary" href="/eventos">
            Ver partidos
          </Link>

          <Link className="btn secondary" href="/jugadores">
            Ver jugadores
          </Link>

          <Link className="btn secondary" href="/">
            Ir al dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>1. Entrar al sistema</h2>

          <p>
            Entra con tu correo y contraseña asignada. Si el sistema pide nueva
            contraseña, cámbiala y guárdala.
          </p>

          <div className="mini-panel">
            <strong>Importante</strong>
            <p className="help-text">
              No compartas tu contraseña. Cada asistente debe usar su propio
              acceso.
            </p>
          </div>

          <div className="row-actions">
            <Link className="btn secondary" href="/login">
              Ir al login
            </Link>
          </div>
        </div>

        <div className="card">
          <h2>2. Crear partido</h2>

          <p>
            Abre <strong>Llenar Canchas</strong> y selecciona comunidad, sede,
            fecha, hora, categoría, cantidad de canchas y cantidad de jugadores.
          </p>

          <p className="help-text">
            Ejemplo: una cancha puede tener 4 jugadores normales, pero también
            puede tener 5 o 6 si el administrador lo decide.
          </p>

          <div className="row-actions">
            <Link className="btn secondary" href="/llenar-canchas">
              Crear partido
            </Link>
          </div>
        </div>

        <div className="card">
          <h2>3. Revisar jugadores sugeridos</h2>

          <p>
            El sistema muestra jugadores que coinciden por comunidad, categoría
            y disponibilidad.
          </p>

          <p className="help-text">
            También puede mostrar sugeridos con categoría cercana o horario no
            exacto. Esos se pueden consultar, pero revisa bien antes de
            confirmar.
          </p>

          <div className="mini-panel">
            <strong>No invitar</strong>
            <p className="help-text">
              No contactes jugadores inactivos, bloqueados o que no pertenecen a
              la comunidad del partido.
            </p>
          </div>
        </div>

        <div className="card">
          <h2>4. Escribir por WhatsApp</h2>

          <p>
            Usa <strong>Copiar mensaje</strong> o{" "}
            <strong>Abrir WhatsApp</strong>. El envío todavía es manual.
          </p>

          <p className="help-text">
            No mandes mensajes masivos sin revisar. Lo importante es llenar bien
            la cancha, no escribirle a todo el mundo sin control.
          </p>

          <div className="mini-panel">
            <strong>Tip operativo</strong>
            <p className="help-text">
              Cuando el jugador responda, registra la respuesta inmediatamente
              para que otro asistente vea el estado actualizado.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Estados de respuesta</h2>

        <p>
          Estos estados son para saber si el jugador juega o no juega. No los
          mezcles con pagos.
        </p>

        <div className="grid grid-2">
          {responseRules.map((rule) => (
            <div className="mini-panel" key={rule.title}>
              <div className="row-actions">
                <span className={`badge ${rule.badgeClass}`}>
                  {rule.badge}
                </span>
              </div>

              <h3>{rule.title}</h3>
              <p className="help-text">{rule.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Ejemplo de lista de espera</h2>

        <p>
          Tienes un partido de 4 jugadores. Ya hay 4 confirmados. Luego otra
          persona responde: “Sí, yo puedo jugar”.
        </p>

        <div className="mini-panel">
          <p>
            En ese caso no la pongas como confirmado, porque el partido ya está
            lleno. Márcala como <strong>Lista de espera</strong>.
          </p>

          <p className="help-text">
            Si luego alguien cancela, puedes pasar al primero de la lista de
            espera a OK registrado.
          </p>
        </div>

        <div className="row-actions">
          <span className="badge good">4/4 confirmados</span>
          <span className="badge warn">1 en espera</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Pagos</h2>

        <p>
          Los pagos solo aplican para jugadores confirmados. Un jugador en
          lista de espera, ambiguo o no puede no debe tener cobro activo.
        </p>

        <div className="grid grid-2">
          {paymentRules.map((rule) => (
            <div className="mini-panel" key={rule.title}>
              <div className="row-actions">
                <span className={`badge ${rule.badgeClass}`}>
                  {rule.badge}
                </span>
              </div>

              <h3>{rule.title}</h3>
              <p className="help-text">{rule.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>5. Revisar detalle del partido</h2>

          <p>
            Entra a <strong>Partidos</strong> y abre el detalle. Ahí puedes ver
            confirmados, lista de espera, ambiguos, no pueden, pagos, reserva y
            costos.
          </p>

          <p className="help-text">
            Desde el detalle también puedes cambiar estados si alguien confirma,
            cancela o pasa de espera a OK.
          </p>

          <div className="row-actions">
            <Link className="btn secondary" href="/eventos">
              Ver partidos
            </Link>
          </div>
        </div>

        <div className="card">
          <h2>6. Marcar partido como jugado</h2>

          <p>
            Cuando el partido ya se jugó, márcalo como{" "}
            <strong>Jugado</strong>.
          </p>

          <p className="help-text">
            Después de marcarlo como jugado, revisa los pagos antes de cerrarlo
            definitivamente.
          </p>
        </div>

        <div className="card">
          <h2>7. Cerrar partido</h2>

          <p>
            El partido se cierra cuando los pagos están resueltos: pagado,
            gratis o no pagó.
          </p>

          <p className="help-text">
            Cerrar no borra el partido. Lo manda al historial y deja la
            operación limpia.
          </p>
        </div>

        <div className="card">
          <h2>8. Cancelar partido</h2>

          <p>
            Solo cancela si el partido ya no se jugará. Luego copia los avisos
            para jugadores confirmados, espera y ambiguos.
          </p>

          <p className="help-text">
            No se avisa a los que ya dijeron “No puede”, porque ellos ya estaban
            fuera del partido.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Reglas que no se deben romper</h2>

        <div className="grid grid-2">
          <div className="mini-panel">
            <strong>No borrar información real</strong>
            <p className="help-text">
              Si algo está mal, avisa al administrador. No borres partidos ni
              jugadores para “arreglar rápido”.
            </p>
          </div>

          <div className="mini-panel">
            <strong>No cambiar categoría del jugador</strong>
            <p className="help-text">
              La categoría del jugador solo la cambia el administrador o head
              coach autorizado.
            </p>
          </div>

          <div className="mini-panel">
            <strong>No compartir contactos</strong>
            <p className="help-text">
              Los contactos son de la cuenta. No se comparten fuera del equipo.
            </p>
          </div>

          <div className="mini-panel">
            <strong>No inventar pagos</strong>
            <p className="help-text">
              Si no estás seguro, marca “Después me paga” o deja una nota para
              revisar.
            </p>
          </div>

          <div className="mini-panel">
            <strong>No usar accesos de ex empleados</strong>
            <p className="help-text">
              Cada persona activa debe tener su propio acceso. Si alguien deja
              de trabajar, se desactiva su usuario, pero no se borra su
              historial.
            </p>
          </div>

          <div className="mini-panel">
            <strong>Consultar dudas</strong>
            <p className="help-text">
              Si un caso no está claro, no adivines. Avisa al administrador.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Resumen rápido</h2>

        <div className="row-actions">
          <span className="badge good">OK = juega</span>
          <span className="badge warn">Espera = quiere, pero no hay cupo</span>
          <span className="badge warn">Ambiguo = no decidió</span>
          <span className="badge danger">No puede = no juega</span>
          <span className="badge warn">Después me paga = juega y debe</span>
          <span className="badge good">Gratis = no debe pagar</span>
        </div>

        <p className="help-text">
          Menos toques, más orden: registrar bien cada respuesta evita llamadas,
          confusiones y partidos mal armados.
        </p>
      </div>
    </>
  );
}