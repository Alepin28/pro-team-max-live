import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !anonKey) {
    return jsonError(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      500
    );
  }

  const authorization =
    request.headers.get("authorization") || "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return jsonError(
      "No hay sesión activa para completar el cambio de contraseña.",
      401
    );
  }

  const supabase = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonError(
      "No se pudo validar el usuario actual: " +
        (userError?.message || "sin usuario"),
      401
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "ptm_complete_password_change_v1"
  );

  if (error) {
    return jsonError(
      "No se pudo actualizar el perfil interno: " +
        error.message,
      500
    );
  }

  return NextResponse.json({
    ok: true,
    user_id: userData.user.id,
    result: data,
  });
}