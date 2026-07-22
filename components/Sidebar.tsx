import Link from "next/link";

const items = [
  ["/", "Dashboard"],
  ["/llenar-canchas", "🎾 Llenar Canchas"],
  ["/jugadores", "Jugadores"],
  ["/comunidades", "Comunidades"],
  ["/sedes", "Sedes"],
  ["/eventos/demo", "Evento demo"],
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Pro Team Max</div>
      <div className="brand-sub">MVP manual · Pádel primero</div>
      <nav className="nav">
        {items.map(([href, label]) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </nav>
    </aside>
  );
}
