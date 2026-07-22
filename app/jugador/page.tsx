import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function JugadorPage() {
  return (
    <>
      <PageHeader
        title="Portal del jugador"
        description="Desde aquí el jugador puede solicitar jugar o consultar la información registrada por la administración."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-actions">
          <span className="badge good">Portal simple</span>
          <span className="badge warn">MVP sin login</span>
        </div>

        <h2>¿Qué quieres hacer?</h2>
        <p className="help-text">
          Elige una de las dos opciones. El jugador no puede cambiar directamente su categoría,
          comunidades, estado ni datos administrativos.
        </p>

        <div className="grid grid-2">
          <div className="card">
            <h2>🎾 Quiero jugar</h2>
            <p>
              Envía una solicitud con tu nombre, WhatsApp y disponibilidad. La administración la revisará antes de registrarte o invitarte.
            </p>
            <Link className="btn" href="/quiero-jugar">
              Enviar solicitud
            </Link>
          </div>

          <div className="card">
            <h2>👤 Mi perfil jugador</h2>
            <p>
              Consulta tus solicitudes, partidos, pagos y datos registrados usando tu WhatsApp.
            </p>
            <Link className="btn" href="/mi-perfil-jugador">
              Ver mi perfil
            </Link>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Cómo funciona</h2>

        <div className="grid grid-2">
          <div>
            <span className="badge neutral">Paso 1</span>
            <h3>El jugador solicita</h3>
            <p className="help-text">Deja sus datos y explica cuándo puede jugar.</p>
          </div>

          <div>
            <span className="badge neutral">Paso 2</span>
            <h3>La administración revisa</h3>
            <p className="help-text">Comprueba el nivel, disponibilidad y datos del jugador.</p>
          </div>

          <div>
            <span className="badge neutral">Paso 3</span>
            <h3>Se asignan categoría y comunidades</h3>
            <p className="help-text">Solo un administrador o asistente autorizado puede hacer estos cambios.</p>
          </div>

          <div>
            <span className="badge neutral">Paso 4</span>
            <h3>El jugador participa</h3>
            <p className="help-text">Empieza a recibir invitaciones compatibles y puede consultar sus partidos.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>¿Necesitas corregir algún dato?</h2>
        <p className="help-text">
          Comunícate con el administrador. Por seguridad, el jugador no puede modificar por su cuenta
          la categoría principal o secundaria, las comunidades asignadas, el estado activo/inactivo ni las notas internas.
        </p>
      </div>
    </>
  );
}