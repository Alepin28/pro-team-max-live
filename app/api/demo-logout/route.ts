import {
  NextRequest,
  NextResponse,
} from "next/server";

const ACCESS_COOKIE =
  "ptm_demo_access_v4";

const LOGOUT_COOKIE =
  "ptm_demo_logged_out_v4";

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

export function GET(
  request: NextRequest
) {
  const loginUrl =
    new URL(
      "/entrada",
      request.url
    );

  loginUrl.searchParams.set(
    "cerrado",
    "1"
  );

  loginUrl.searchParams.set(
    "logout",
    "1"
  );

  loginUrl.searchParams.set(
    "momento",
    Date.now().toString()
  );

  const response =
    NextResponse.redirect(
      loginUrl,
      {
        status: 303,
      }
    );

  const secureCookie =
    isSecureRequest(request);

  response.cookies.set({
    name: LOGOUT_COOKIE,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  response.cookies.set({
    name: ACCESS_COOKIE,
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