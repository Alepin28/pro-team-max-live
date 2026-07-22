"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type StaffPermissions = {
  createMatches?: boolean;
  registerResponses?: boolean;
  managePayments?: boolean;
  viewPayments?: boolean;
  manageCourtReservation?: boolean;
  [key: string]: boolean | undefined;
};

type StaffProfile = {
  id: string;
  account_id: string;
  auth_user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean | null;
  auth_status: string | null;
  must_change_password: boolean | null;
  allowed_categories: string[] | null;
  allowed_community_ids: string[] | null;
  allowed_venue_ids: string[] | null;
  allowed_genders: string[] | null;
  permissions: StaffPermissions | null;
  notes: string | null;
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

const OWNER_ADMIN_PATHS = [
  "/staff",
  "/usuarios-acceso",
  "/configuracion",
  "/revision",
];

function matchesPath(
  pathname: string,
  paths: string[]
) {
  return paths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );
}

function canViewFinances(
  profile: StaffProfile
) {
  return (
    profile.role === "owner" ||
    profile.role === "admin" ||
    profile.permissions?.viewPayments === true
  );
}

function saveSnapshot(
  profile: StaffProfile
) {
  const snapshot = {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    allowedCategories:
      profile.allowed_categories ?? [],
    allowedCommunityIds:
      profile.allowed_community_ids ?? [],
    allowedVenueIds:
      profile.allowed_venue_ids ?? [],
    allowedGenders:
      profile.allowed_genders ?? [],
    permissions:
      profile.permissions ?? {},
    authUserId:
      profile.auth_user_id,
    mode: "authenticated",
  };

  window.localStorage.setItem(
    "ptm.selectedStaffSnapshot",
    JSON.stringify(snapshot)
  );

  window.localStorage.setItem(
    "ptm.selectedStaffId",
    profile.id
  );
}

export default function AccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [ready, setReady] =
    useState(false);

  const [message, setMessage] =
    useState(
      "Comprobando tu acceso..."
    );

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      if (
        matchesPath(
          pathname,
          PUBLIC_PATHS
        )
      ) {
        if (active) {
          setReady(true);
        }

        return;
      }

      setReady(false);
      setMessage(
        "Comprobando tu acceso..."
      );

      try {
        const {
          data: userData,
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !userData.user
        ) {
          await supabase.auth.signOut({
            scope: "local",
          });

          window.localStorage.removeItem(
            "ptm.selectedStaffSnapshot"
          );

          window.localStorage.removeItem(
            "ptm.selectedStaffId"
          );

          router.replace(
            `/login?volver=${encodeURIComponent(
              pathname
            )}`
          );

          return;
        }

        const {
          data,
          error,
        } =
          await supabase.rpc(
            "ptm_current_staff_profile_v1"
          );

        if (error) {
          throw error;
        }

        const profile =
          (Array.isArray(data)
            ? data[0]
            : data) as
            | StaffProfile
            | null;

        if (!profile) {
          await supabase.auth.signOut();

          router.replace(
            "/login?error=sin-perfil"
          );

          return;
        }

        if (
          profile.active === false ||
          profile.auth_status ===
            "deshabilitado"
        ) {
          await supabase.auth.signOut();

          router.replace(
            "/login?error=deshabilitado"
          );

          return;
        }

        saveSnapshot(profile);

        await supabase.rpc(
          "ptm_mark_current_login_v1"
        );

        if (
          profile.must_change_password &&
          pathname !==
            "/nueva-clave"
        ) {
          router.replace(
            "/nueva-clave?obligatorio=1"
          );

          return;
        }

        if (
          pathname ===
            "/acceso-asistentes"
        ) {
          router.replace("/");
          return;
        }

        if (
          matchesPath(
            pathname,
            OWNER_ADMIN_PATHS
          ) &&
          profile.role !== "owner" &&
          profile.role !== "admin"
        ) {
          router.replace(
            "/?sin_permiso=1"
          );

          return;
        }

        if (
          (
            pathname ===
              "/finanzas" ||
            pathname.startsWith(
              "/finanzas/"
            )
          ) &&
          !canViewFinances(profile)
        ) {
          router.replace(
            "/?sin_permiso=finanzas"
          );

          return;
        }

        if (active) {
          setReady(true);
        }
      } catch (error: any) {
        console.error(
          "AccessGuard:",
          error
        );

        if (active) {
          setMessage(
            `No se pudo comprobar el acceso: ${error.message}`
          );
          setReady(false);
        }
      }
    }

    void verifyAccess();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (event) => {
          if (
            event === "SIGNED_OUT"
          ) {
            window.localStorage.removeItem(
              "ptm.selectedStaffSnapshot"
            );

            window.localStorage.removeItem(
              "ptm.selectedStaffId"
            );

            router.replace("/login");
          }
        }
      );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            PTM
          </div>

          <h1>Pro Team Max</h1>
          <p>{message}</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}