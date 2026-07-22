import {
  NextRequest,
  NextResponse,
} from "next/server";

const ACCESS_COOKIE =
  "ptm_demo_access_v4";

const LOGOUT_COOKIE =
  "ptm_demo_logged_out_v4";

const OLD_ACCESS_COOKIES = [
  "ptm_demo_access_v3",
  "ptm_demo_access_v2",
  "ptm_demo_access",
];

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

function bearerToken(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return "";
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

export function GET(
  request: NextRequest
) {
  const requiredToken =
    process.env
      .DEMO_ACCESS_TOKEN
      ?.trim();

  const tokenFromHeader =
    bearerToken(request);

  const tokenFromCurrentCookie =
    request.cookies.get(
      ACCESS_COOKIE
    )?.value ?? "";

  const tokenFromOldCookie =
    OLD_ACCESS_COOKIES
      .map(
        (cookieName) =>
          request.cookies.get(
            cookieName
          )?.value
      )
      .find(Boolean) ?? "";

  const sessionWasClosed =
    request.cookies.get(
      LOGOUT_COOKIE
    )?.value === "1";

  const headerAuthenticated =
    Boolean(requiredToken) &&
    tokenFromHeader ===
      requiredToken;

  const cookieAuthenticated =
    Boolean(requiredToken) &&
    !sessionWasClosed &&
    (
      tokenFromCurrentCookie ===
        requiredToken ||
      tokenFromOldCookie ===
        requiredToken
    );

  const authenticated =
    headerAuthenticated ||
    cookieAuthenticated;

  const response =
    NextResponse.json({
      authenticated,
    });

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