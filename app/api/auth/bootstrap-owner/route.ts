import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createSupabaseAdmin,
  PTM_ACCOUNT_ID,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BootstrapBody = {
  fullName?: string;
  email?: string;
  password?: string;
  setupSecret?: string;
};

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as
        BootstrapBody;

    const expectedSecret =
      process.env.PTM_SETUP_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        {
          error:
            "Falta PTM_SETUP_SECRET en .env.local.",
        },
        { status: 500 }
      );
    }

    if (
      body.setupSecret !==
      expectedSecret
    ) {
      return NextResponse.json(
        {
          error:
            "La clave de configuración no es correcta.",
        },
        { status: 401 }
      );
    }

    const fullName =
      body.fullName?.trim();

    const email =
      body.email
        ?.trim()
        .toLowerCase();

    const password =
      body.password ?? "";

    if (
      !fullName ||
      !email ||
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error:
            "Nombre, correo y contraseña de al menos 8 caracteres son obligatorios.",
        },
        { status: 400 }
      );
    }

    const admin =
      createSupabaseAdmin();

    const {
      data: linkedOwner,
      error: linkedError,
    } =
      await admin
        .from(
          "staff_members_demo"
        )
        .select(
          "id, auth_user_id"
        )
        .eq(
          "account_id",
          PTM_ACCOUNT_ID
        )
        .eq("role", "owner")
        .not(
          "auth_user_id",
          "is",
          null
        )
        .limit(1)
        .maybeSingle();

    if (linkedError) {
      throw linkedError;
    }

    if (linkedOwner?.auth_user_id) {
      return NextResponse.json(
        {
          error:
            "El acceso inicial ya fue configurado.",
        },
        { status: 409 }
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
            full_name: fullName,
            account_id:
              PTM_ACCOUNT_ID,
            role: "owner",
          },
        });

    if (
      authError ||
      !authData.user
    ) {
      throw (
        authError ??
        new Error(
          "Supabase no devolvió el usuario creado."
        )
      );
    }

    const {
      data: matchingEmail,
      error: matchingEmailError,
    } =
      await admin
        .from(
          "staff_members_demo"
        )
        .select("id")
        .eq(
          "account_id",
          PTM_ACCOUNT_ID
        )
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

    if (matchingEmailError) {
      await admin.auth.admin
        .deleteUser(
          authData.user.id
        );

      throw matchingEmailError;
    }

    const {
      data: matchingName,
      error: matchingNameError,
    } =
      matchingEmail?.id
        ? {
            data: null,
            error: null,
          }
        : await admin
            .from(
              "staff_members_demo"
            )
            .select("id")
            .eq(
              "account_id",
              PTM_ACCOUNT_ID
            )
            .ilike(
              "full_name",
              fullName
            )
            .limit(1)
            .maybeSingle();

    if (matchingNameError) {
      await admin.auth.admin
        .deleteUser(
          authData.user.id
        );

      throw matchingNameError;
    }

    const {
      data: existingOwner,
      error: ownerError,
    } =
      matchingEmail?.id ||
      matchingName?.id
        ? {
            data: null,
            error: null,
          }
        : await admin
            .from(
              "staff_members_demo"
            )
            .select("id")
            .eq(
              "account_id",
              PTM_ACCOUNT_ID
            )
            .in(
              "role",
              ["owner", "admin"]
            )
            .order(
              "created_at",
              {
                ascending: true,
              }
            )
            .limit(1)
            .maybeSingle();

    if (ownerError) {
      await admin.auth.admin
        .deleteUser(
          authData.user.id
        );

      throw ownerError;
    }

    const profileId =
      matchingEmail?.id ??
      matchingName?.id ??
      existingOwner?.id ??
      null;

    let profileError:
      | Error
      | null = null;

    if (profileId) {
      const {
        error,
      } =
        await admin
          .from(
            "staff_members_demo"
          )
          .update({
            full_name:
              fullName,
            email,
            role:
              "owner",
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
            profileId
          );

      profileError = error;
    } else {
      const {
        error,
      } =
        await admin
          .from(
            "staff_members_demo"
          )
          .insert({
            id: crypto.randomUUID(),
            account_id:
              PTM_ACCOUNT_ID,
            full_name:
              fullName,
            email,
            phone: null,
            role: "owner",
            active: true,
            allowed_categories:
              [],
            allowed_community_ids:
              [],
            allowed_venue_ids:
              [],
            allowed_genders:
              [],
            permissions: {
              createMatches:
                true,
              registerResponses:
                true,
              managePayments:
                true,
              viewPayments:
                true,
              manageCourtReservation:
                true,
            },
            notes:
              "Dueño principal de PadelProX.",
            auth_user_id:
              authData.user.id,
            auth_status:
              "activo",
            must_change_password:
              true,
            auth_created_at:
              new Date()
                .toISOString(),
          });

      profileError = error;
    }

    if (profileError) {
      await admin.auth.admin
        .deleteUser(
          authData.user.id
        );

      throw profileError;
    }

    return NextResponse.json({
      ok: true,
      email,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ??
          "No se pudo crear el acceso inicial.",
      },
      { status: 500 }
    );
  }
}