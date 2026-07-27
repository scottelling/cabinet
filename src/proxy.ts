import { NextRequest, NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/kb-auth";
import {
  cloudGateActive,
  cloudUserSub,
  hasValidKbAuthCookie,
} from "@/lib/auth/request-gate";

const CLOUD_RUNTIME_PATH = "/api/cloud-runtime";

function shouldUseVercelSpaShell(pathname: string): boolean {
  if (process.env.CABINET_VERCEL_RUNTIME !== "1") return false;
  if (pathname === "/" || pathname === "/login") return false;
  return !pathname.startsWith("/api/");
}

function shouldUseVercelCloudRuntime(pathname: string): boolean {
  if (process.env.CABINET_VERCEL_RUNTIME !== "1") return false;
  if (!pathname.startsWith("/api/")) return false;
  if (pathname === CLOUD_RUNTIME_PATH) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  if (pathname.startsWith("/api/health")) return false;
  if (pathname === "/api/cloud/status") return false;
  if (pathname === "/api/telemetry") return false;
  if (pathname === "/api/system/client-log") return false;
  return true;
}

function continueRequest(req: NextRequest, requestHeaders?: Headers): NextResponse {
  // The root page is statically rendered, while the catch-all page is rendered
  // on demand. Reuse the static shell for clean SPA URLs on Vercel so a deep
  // link never evaluates optional desktop-only dependencies in a serverless
  // renderer. A rewrite preserves the visible URL, so AppShell still opens the
  // requested room, integration, task, or settings surface after hydration.
  if (shouldUseVercelSpaShell(req.nextUrl.pathname)) {
    const destination = req.nextUrl.clone();
    destination.pathname = "/";
    const headers = requestHeaders || req.headers;
    return NextResponse.rewrite(destination, { request: { headers } });
  }

  if (!shouldUseVercelCloudRuntime(req.nextUrl.pathname)) {
    return requestHeaders
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : NextResponse.next();
  }

  const destination = req.nextUrl.clone();
  destination.pathname = CLOUD_RUNTIME_PATH;
  destination.searchParams.set("__cabinet_path", req.nextUrl.pathname);
  const headers = new Headers(requestHeaders || req.headers);
  headers.set("x-cabinet-original-path", req.nextUrl.pathname);
  return NextResponse.rewrite(destination, { request: { headers } });
}

// ---------------------------------------------------------------------------
// Cabinet Cloud gate (CABINET_CLOUD=1)
// ---------------------------------------------------------------------------
// In the hosted, multi-tenant edition each tenant is a container fronted by a
// host agent that already authorizes requests. This gate is defense-in-depth:
// the app ITSELF verifies the Supabase access token the panel issued, so a
// request that somehow reaches the container without a valid session is denied
// here too. Verification is a signature check against the Supabase JWKS
// (ES256), so no shared secret lives in the container.
//
// This path is entirely separate from the local/desktop KB_PASSWORD gate below
// and only runs when CABINET_CLOUD === "1"; every other deployment keeps the
// existing behavior untouched.

// The JWT verification itself lives in @/lib/auth/request-gate so routes
// excluded from the matcher below (/api/upload) can apply the identical gate.

async function cloudProxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Liveness/readiness probes must answer without a user session so the host
  // agent / orchestrator can tell a booting container from a dead one.
  if (pathname.startsWith("/api/health")) {
    return continueRequest(req);
  }

  const sub = await cloudUserSub(req);

  if (!sub) {
    // API routes get a machine-readable 401.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages bounce to the panel's login (a different origin). Resolve relative
    // to the request so a relative override still works; fail closed with a 401
    // if no login URL is configured rather than looping or leaking the app.
    const loginUrl = process.env.CABINET_CLOUD_LOGIN_URL;
    if (loginUrl) {
      return NextResponse.redirect(new URL(loginUrl, req.url));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authenticated: hand the verified subject to downstream handlers. Build the
  // forwarded headers from the incoming ones and OVERWRITE any client-supplied
  // `x-cabinet-user` (Headers.set replaces), so the value can only ever come
  // from a verified token — never spoofed by the caller.
  const headers = new Headers(req.headers);
  headers.set("x-cabinet-user", sub);
  return continueRequest(req, headers);
}

export async function proxy(req: NextRequest) {
  // Hosted edition: Supabase-JWT gate, independent of the KB_PASSWORD path.
  // Opt-in via CABINET_JWT_JWKS_URL: only gate when it's configured. This keeps
  // the in-app gate a deliberate, verifiable choice (the host agent already gates
  // at the edge) — a cloud tenant with CABINET_CLOUD=1 but no JWKS URL configured
  // must NOT fail closed and lock itself out.
  if (cloudGateActive()) {
    return cloudProxy(req);
  }

  // Auth disabled — no password set
  if (!isAuthEnabled()) {
    return continueRequest(req);
  }

  const { pathname } = req.nextUrl;

  // Allow login page and login API
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/check") {
    return continueRequest(req);
  }

  // Allow health check
  if (pathname.startsWith("/api/health")) {
    return continueRequest(req);
  }

  // Check auth cookie (constant-time; expected token is memoized so this is
  // O(1) per request — PBKDF2 runs once per process, not per request).
  if (!(await hasValidKbAuthCookie(req))) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return continueRequest(req);
}

export const config = {
  matcher: [
    // Protect all routes except static files and Next.js internals. The Vercel
    // edition deliberately sends API uploads through the cloud runtime so the
    // resulting files are included in the durable workspace snapshot.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
