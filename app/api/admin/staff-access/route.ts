import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createSupabaseAdmin,
  PTM_ACCOUNT_ID,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ActionBody = {
  action?:
    | "create_access"
    | "disable_access"
    | "enable_access"
    | "temporary_password";
  staffId?: string;
  email?: string;
  temporaryPassword?: string;
};

async function authorize(
  request: NextRequest
) {
  const header =
    request.headers.get(
      "authorization"
    );

  const token =
    header?.startsWith(
      "Bearer "
    )
      ? header.slice(7)
      : "";

  if (!token) {
    throw new Error(
      "Sesión no válida."
    );
  }

  const admin =
    createSupabaseAdmin();

  const {
    data: userData,
    error: userError,
  } =
    await admin.auth.getUser(
      token
    );

  if (
    userError ||
    !userData.user
  ) {
    throw new Error(
      "La sesión venció."
    );
  }

  const {
    data: staff,
    error: staffError,
  } =
    await admin
      .from(
        "staff_members_demo"
      )
      .select(
        "id, role, active, auth_status"
      )
      .eq(
        "account_id",
        PTM_ACCOUNT_ID
      )
      .eq(
        "auth_user_id",
        userData.user.id
      )
      .maybeSingle();

  if (staffError) {
    throw staffError;
  }

  if (
    !staff ||
    staff.active === false ||
    staff.auth_status ===
      "deshabilitado"
  ) {
    throw new Error(
      "Tu acceso no está activo."
    );
  }

  if (
    staff.role !== "owner" &&
    staff.role !== "admin"
  ) {
    throw new Error(
      "Solo el dueño o un administrador puede gestionar accesos."
    );
  }

  return {
    admin,
    user:
      userData.user,
    staff,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      admin,
      user,
      staff: caller,
    } =
      await authorize(request);

    const body =
      (await request.json()) as
        ActionBody;

    if (
      !body.action ||
      !body.staffId
    ) {
      return NextResponse.json(
        {
          error:
            "Falta la acción o el usuario.",
        },
        { status: 400 }
      );
    }

    const {
      data: target,
      error: targetError,
    } =
      await admin
        .from(
          "staff_members_demo"
        )
        .select(
          "id, full_name, email, role, active, auth_user_id, auth_status"
        )
        .eq(
          "account_id",
          PTM_ACCOUNT_ID
        )
        .eq(
          "id",
          body.staffId
        )
        .maybeSingle();

    if (targetError) {
      throw targetError;
    }

    if (!target) {
      return NextResponse.json(
        {
          error:
            "No se encontró el usuario interno.",
        },
        { status: 404 }
      );
    }

    if (
      body.action ===
      "create_access"
    ) {
      if (
        target.auth_user_id
      ) {
        return NextResponse.json(
          {
            error:
              "Este usuario ya tiene acceso.",
          },
          { status: 409 }
        );
      }

      const email =
        body.email
          ?.trim()
          .toLowerCase();

      const password =
        body.temporaryPassword ??
        "";

      if (
        !email ||
        password.length < 8
      ) {
        return NextResponse.json(
          {
            error:
              "Escribe un correo y una contraseña temporal de al menos 8 caracteres.",
          },
          { status: 400 }
        );
      }

      const {
        data: authData,
        error: authError,
      } =
        await admin.auth.admin
          .createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name:
                target.full_name,
              staff_id:
                target.id,
              account_id:
                PTM_ACCOUNT_ID,
              role:
                target.role,
            },
          });

      if (
        authError ||
        !authData.user
      ) {
        throw (
          authError ??
          new Error(
            "No se pudo crear el usuario de Auth."
          )
        );
      }

      const {
        error: updateError,
      } =
        await admin
          .from(
            "staff_members_demo"
          )
          .update({
            email,
            auth_user_id:
              authData.user.id,
            auth_status:
              "activo",
            must_change_password:
              true,
            auth_created_at:
              new Date()
                .toISOString(),
            auth_disabled_at:
              null,
            active: true,
          })
          .eq(
            "account_id",
            PTM_ACCOUNT_ID
          )
          .eq(
            "id",
            target.id
          );

      if (updateError) {
        await admin.auth.admin
          .deleteUser(
            authData.user.id
          );

        throw updateError;
      }

      return NextResponse.json({
        ok: true,
        message:
          "Acceso creado.",
      });
    }

    if (
      !target.auth_user_id
    ) {
      return NextResponse.json(
        {
          error:
            "Este usuario todavía no tiene acceso individual.",
        },
        { status: 409 }
      );
    }

    if (
      target.auth_user_id ===
      user.id &&
      body.action ===
        "disable_access"
    ) {
      return NextResponse.json(
        {
          error:
            "No puedes deshabilitar tu propio acceso.",
        },
        { status: 400 }
      );
    }

    if (
      body.action ===
      "disable_access"
    ) {
      const {
        error: banError,
      } =
        await admin.auth.admin
          .updateUserById(
            target.auth_user_id,
            {
              ban_duration:
                "876000h",
            }
          );

      if (banError) {
        throw banError;
      }

      const {
        error: updateError,
      } =
        await admin
          .from(
            "staff_members_demo"
          )
          .update({
            active: false,
            auth_status:
              "deshabilitado",
            auth_disabled_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "account_id",
            PTM_ACCOUNT_ID
          )
          .eq(
            "id",
            target.id
          );

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        ok: true,
        message:
          "Acceso deshabilitado.",
      });
    }

    if (
      body.action ===
      "enable_access"
    ) {
      const {
        error: unbanError,
      } =
        await admin.auth.admin
          .updateUserById(
            target.auth_user_id,
            {
              ban_duration:
                "none",
            }
          );

      if (unbanError) {
        throw unbanError;
      }

      const {
        error: updateError,
      } =
        await admin
          .from(
            "staff_members_demo"
          )
          .update({
            active: true,
            auth_status:
              "activo",
            auth_disabled_at:
              null,
          })
          .eq(
            "account_id",
            PTM_ACCOUNT_ID
          )
          .eq(
            "id",
            target.id
          );

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        ok: true,
        message:
          "Acceso habilitado.",
      });
    }

    if (
      body.action ===
      "temporary_password"
    ) {
      const password =
        body.temporaryPassword ??
        "";

      if (
        password.length < 8
      ) {
        return NextResponse.json(
          {
            error:
              "La contraseña temporal debe tener al menos 8 caracteres.",
          },
          { status: 400 }
        );
      }

      const {
        error: passwordError,
      } =
        await admin.auth.admin
          .updateUserById(
            target.auth_user_id,
            {
              password,
              email_confirm: true,
            }
          );

      if (passwordError) {
        throw passwordError;
      }

      const {
        error: updateError,
      } =
        await admin
          .from(
            "staff_members_demo"
          )
          .update({
            must_change_password:
              true,
            auth_status:
              "activo",
            active: true,
            auth_disabled_at:
              null,
          })
          .eq(
            "account_id",
            PTM_ACCOUNT_ID
          )
          .eq(
            "id",
            target.id
          );

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        ok: true,
        message:
          "Contraseña temporal creada.",
      });
    }

    return NextResponse.json(
      {
        error:
          "Acción no reconocida.",
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ??
          "No se pudo gestionar el acceso.",
      },
      { status: 500 }
    );
  }
}