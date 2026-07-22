"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";

type NavigationItem = {
  href: string;
  label: string;
  icon: string;
};

type Snapshot = {
  id?: string;
  fullName?: string;
  email?: string | null;
  role?: string;
  permissions?: {
    viewPayments?: boolean;
  };
};

const PUBLIC_PATHS = [
  "/login",
  "/recuperar-clave",
  "/nueva-clave",
  "/configurar-acceso-inicial",
  "/quiero-jugar",
  "/jugador",
  "/mi-perfil-jugador",
];

const homeItem: NavigationItem = {
  href: "/",
  label: "Inicio",
  icon: "🏠",
};

const setupBase: NavigationItem[] = [
  {
    href: "/sedes",
    label: "1. Sedes",
    icon: "📍",
  },
  {
    href: "/comunidades",
    label: "2. Comunidades",
    icon: "🧩",
  },
  {
    href: "/jugadores",
    label: "3. Jugadores",
    icon: "👥",
  },
];

const usersItem: NavigationItem = {
  href: "/staff",
  label: "4. Usuarios",
  icon: "🧑‍💼",
};

const accessItem: NavigationItem = {
  href: "/usuarios-acceso",
  label: "Accesos",
  icon: "🔐",
};

const financeItem: NavigationItem = {
  href: "/finanzas",
  label: "Finanzas",
  icon: "💰",
};

const operationItems: NavigationItem[] = [
  {
    href: "/llenar-canchas",
    label: "Crear partido",
    icon: "🎾",
  },
  {
    href: "/eventos",
    label: "Partidos",
    icon: "📋",
  },
  {
    href: "/solicitudes",
    label: "Solicitudes",
    icon: "📥",
  },
];

const commonSystemItems: NavigationItem[] = [
  {
    href: "/manual-asistente",
    label: "Manual del equipo",
    icon: "📘",
  },
];

const adminSystemItems: NavigationItem[] = [
  {
    href: "/configuracion",
    label: "Configuración",
    icon: "⚙️",
  },
  {
    href: "/revision",
    label: "Revisión del sistema",
    icon: "✅",
  },
];

function isPublicPath(
  pathname: string
) {
  return PUBLIC_PATHS.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(
        `${path}/`
      )
  );
}

function isActivePath(
  pathname: string,
  href: string
) {
  if (href === "/") {
    return pathname === "/";
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`
    )
  );
}

function NavigationLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    isActivePath(
      pathname,
      item.href
    );

  return (
    <Link
      className={
        active
          ? "nav-link active"
          : "nav-link"
      }
      href={item.href}
      onClick={onNavigate}
    >
      <span aria-hidden="true">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function NavigationSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title?: string;
  items: NavigationItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="nav-section">
      {title ? (
        <p className="nav-section-title">
          {title}
        </p>
      ) : null}

      {items.map((item) => (
        <NavigationLink
          item={item}
          key={item.href}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export default function AppNavigation({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [
    drawerOpen,
    setDrawerOpen,
  ] = useState(false);

  const [
    snapshot,
    setSnapshot,
  ] = useState<Snapshot>({
    fullName:
      "Usuario",
    role: "assistant",
  });

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(
          "ptm.selectedStaffSnapshot"
        );

      if (raw) {
        setSnapshot(
          JSON.parse(raw) as Snapshot
        );
      }
    } catch {
      setSnapshot({
        fullName: "Usuario",
        role: "assistant",
      });
    }
  }, [pathname]);

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  const canManageUsers =
    snapshot.role === "owner" ||
    snapshot.role === "admin";

  const canViewFinances =
    canManageUsers ||
    snapshot.permissions
      ?.viewPayments === true;

  const setupItems =
    canManageUsers
      ? [...setupBase, usersItem]
      : setupBase;

  const visibleOperationItems =
    canViewFinances
      ? [
          ...operationItems,
          financeItem,
        ]
      : operationItems;

  const systemItems =
    canManageUsers
      ? [
          accessItem,
          ...adminSystemItems,
          ...commonSystemItems,
        ]
      : commonSystemItems;

  async function logout() {
    setDrawerOpen(false);

    await supabase.auth.signOut();

    window.localStorage.removeItem(
      "ptm.selectedStaffSnapshot"
    );

    window.localStorage.removeItem(
      "ptm.selectedStaffId"
    );

    router.replace("/login");
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  const logoutButton = (
    <button
      className="nav-link logout-link"
      onClick={() =>
        void logout()
      }
      type="button"
    >
      <span aria-hidden="true">
        🔒
      </span>

      <span>Cerrar sesión</span>
    </button>
  );

  return (
    <div className="app-shell">
      <aside
        className="sidebar"
        aria-label="Navegación principal"
      >
        <div className="brand-block">
          <div className="brand-mark">
            PTM
          </div>

          <div>
            <h1 className="brand-title">
              Pro Team Max
            </h1>

            <p className="brand-subtitle">
              Operación interna de
              PadelProX
            </p>
          </div>
        </div>

        <div className="operator-box">
          <span className="operator-label">
            Sesión actual
          </span>

          <strong>
            {snapshot.fullName ??
              "Usuario"}
          </strong>

          {snapshot.email ? (
            <small>
              {snapshot.email}
            </small>
          ) : null}
        </div>

        <nav className="nav">
          <NavigationSection
            items={[homeItem]}
            pathname={pathname}
          />

          <NavigationSection
            title="Comenzar"
            items={setupItems}
            pathname={pathname}
          />

          <NavigationSection
            title="Operación diaria"
            items={
              visibleOperationItems
            }
            pathname={pathname}
          />

          <NavigationSection
            title="Sistema"
            items={systemItems}
            pathname={pathname}
          />

          <div className="nav-section">
            {logoutButton}
          </div>
        </nav>
      </aside>

      <header className="mobile-topbar">
        <button
          aria-expanded={drawerOpen}
          aria-label="Abrir menú"
          className="mobile-menu-button"
          onClick={() =>
            setDrawerOpen(true)
          }
          type="button"
        >
          ☰
        </button>

        <div className="mobile-brand-copy">
          <strong>Pro Team Max</strong>
          <span>
            {snapshot.fullName ??
              "Usuario"}
          </span>
        </div>

        <Link
          aria-label="Crear partido"
          className="mobile-create-button"
          href="/llenar-canchas"
        >
          🎾
        </Link>
      </header>

      <main className="main-content">
        {children}
      </main>

      <nav
        className="mobile-bottom-nav"
        aria-label="Accesos rápidos"
      >
        <NavigationLink
          item={homeItem}
          pathname={pathname}
        />

        <NavigationLink
          item={
            operationItems[0]
          }
          pathname={pathname}
        />

        <NavigationLink
          item={
            operationItems[1]
          }
          pathname={pathname}
        />

        <button
          className={
            drawerOpen
              ? "nav-link active"
              : "nav-link"
          }
          onClick={() =>
            setDrawerOpen(true)
          }
          type="button"
        >
          <span aria-hidden="true">
            ☰
          </span>

          <span>Más</span>
        </button>
      </nav>

      {drawerOpen ? (
        <>
          <button
            aria-label="Cerrar menú"
            className="drawer-backdrop"
            onClick={closeDrawer}
            type="button"
          />

          <aside
            aria-label="Menú móvil"
            className="mobile-drawer"
          >
            <div className="mobile-drawer-header">
              <div>
                <strong>
                  Pro Team Max
                </strong>

                <p>
                  {snapshot.fullName ??
                    "Usuario"}
                </p>
              </div>

              <button
                aria-label="Cerrar menú"
                onClick={closeDrawer}
                type="button"
              >
                ✕
              </button>
            </div>

            <nav className="nav mobile-drawer-nav">
              <NavigationSection
                items={[homeItem]}
                pathname={pathname}
                onNavigate={
                  closeDrawer
                }
              />

              <NavigationSection
                title="Comenzar"
                items={setupItems}
                pathname={pathname}
                onNavigate={
                  closeDrawer
                }
              />

              <NavigationSection
                title="Operación diaria"
                items={
                  visibleOperationItems
                }
                pathname={pathname}
                onNavigate={
                  closeDrawer
                }
              />

              <NavigationSection
                title="Sistema"
                items={systemItems}
                pathname={pathname}
                onNavigate={
                  closeDrawer
                }
              />

              {logoutButton}
            </nav>
          </aside>
        </>
      ) : null}
    </div>
  );
}