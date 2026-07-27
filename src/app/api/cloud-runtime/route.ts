import { NextRequest, NextResponse } from "next/server";
import { matchCloudRoute, type CloudRouteMethod } from "@/lib/cloud/generated-route-manifest";
import {
  CloudWorkspaceConflictError,
  withVercelWorkspace,
} from "@/lib/cloud/vercel-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const INTERNAL_PATH_PARAM = "__cabinet_path";

async function dispatch(request: NextRequest): Promise<Response> {
  const originalPath =
    request.headers.get("x-cabinet-original-path") ||
    request.nextUrl.searchParams.get(INTERNAL_PATH_PARAM);
  if (!originalPath || !originalPath.startsWith("/api/")) {
    return NextResponse.json({ error: "Missing Cabinet API route." }, { status: 400 });
  }

  const match = matchCloudRoute(originalPath);
  if (!match) {
    return NextResponse.json({ error: "Cabinet API route not found." }, { status: 404 });
  }

  const method = request.method.toUpperCase() as CloudRouteMethod;
  const handler = match.module[method];
  if (!handler) {
    return NextResponse.json(
      { error: `Method ${method} is not supported for ${originalPath}.` },
      { status: 405, headers: { Allow: Object.keys(match.module).join(", ") } }
    );
  }

  const forwardedUrl = new URL(request.url);
  forwardedUrl.pathname = originalPath;
  forwardedUrl.searchParams.delete(INTERNAL_PATH_PARAM);

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("x-cabinet-cloud-runtime", "vercel");

  const body = method === "GET" || method === "HEAD"
    ? undefined
    : await request.arrayBuffer();

  const forwardedRequest = new NextRequest(forwardedUrl, {
    method,
    headers,
    body,
  });

  return handler(forwardedRequest, { params: Promise.resolve(match.params) });
}

async function handle(request: NextRequest): Promise<Response> {
  try {
    return await withVercelWorkspace(request.method, () => dispatch(request));
  } catch (error) {
    if (error instanceof CloudWorkspaceConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Cloud runtime failed.";
    console.error("[cloud-runtime]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
