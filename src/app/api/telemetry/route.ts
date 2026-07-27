import { NextResponse, type NextRequest } from "next/server";
import {
  isAllowedEvent,
  type EventName,
  type EventPayload,
} from "@/lib/telemetry/catalog";

interface BrowserEvent {
  name: string;
  payload?: EventPayload;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // The self-hosted Vercel edition does not use Cabinet's anonymous desktop
  // telemetry queue. Avoid touching ~/.config in an immutable serverless home
  // directory; application data itself is persisted by the cloud workspace.
  if (process.env.CABINET_VERCEL_RUNTIME === "1") {
    return new NextResponse(null, { status: 202 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const candidate = body as Partial<BrowserEvent> | null;
  const name = candidate?.name;
  if (typeof name !== "string" || !isAllowedEvent(name)) {
    return NextResponse.json({ error: "unknown event" }, { status: 400 });
  }

  const payload =
    candidate?.payload && typeof candidate.payload === "object"
      ? (candidate.payload as EventPayload)
      : {};

  const { emit } = await import("@/lib/telemetry/emitter");
  emit(name as EventName, payload);
  return new NextResponse(null, { status: 202 });
}
