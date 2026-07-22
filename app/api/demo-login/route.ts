import {
  NextRequest,
  NextResponse,
} from "next/server";

const ACCESS_COOKIE =
  "ptm_demo_access_v4";

const LOGOUT_COOKIE =
  "ptm_demo_logged_out_v4";

const TEMPORARY_PIN =
  "12345678";

const OLD_COOKIES = [
  "ptm_demo_access",
  "ptm_demo_access_v2",
  "ptm_demo_access_v3",
  "ptm_demo_logged_out_v2",
  "ptm_demo_logged_out_v3",
];

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

function isSecureRequest(
  request: NextRequest
) {
  const forwardedProtocol =
    request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();

  return (
    forwardedProtocol === "https" ||
    request.nextUrl.protocol ===
      "https:"
  );
}

export async function POST(
  request: NextRequest
) {
  const accessToken =
    process.env
      .DEMO_ACCESS_TOKEN
      ?.trim();

  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "El token temporal no está configurado correctamente en .env.local.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  let body: {
    pin?: string;
    next?: string;
  };

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "La solicitud no es válida.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const receivedPin =
    String(
      body.pin ?? ""
    ).trim();

  if (
    receivedPin !== TEMPORARY_PIN
  ) {
    return NextResponse.json(
      {
        error:
          "La clave es incorrecta.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const requestedPath =
    String(
      body.next ?? "/"
    );

  const safeNextPath =
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith(
      "//"
    ) &&
    !requestedPath.startsWith(
      "/entrada"
    )
      ? requestedPath
      : "/";

  const response =
    NextResponse.json({
      ok: true,
      next: safeNextPath,
      accessToken,
    });

  const secureCookie =
    isSecureRequest(request);

  response.cookies.set({
    name: ACCESS_COOKIE,
    value: accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  response.cookies.set({
    name: LOGOUT_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  for (
    const oldCookie of OLD_COOKIES
  ) {
    response.cookies.set({
      name: oldCookie,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0"
  );

  response.headers.set(
    "Pragma",
    "no-cache"
  );

  response.headers.set(
    "Expires",
    "0"
  );

  return response;
}