import { NextRequest, NextResponse } from "next/server";
import {
  applyCabinetToolEvent,
  executeCabinetToolCommand,
  getCabinetToolDetail,
  getCabinetToolInventory,
  installCabinetTool,
  rollbackCabinetTool,
  setCabinetToolEnabled,
  uninstallCabinetTool,
} from "@/lib/tools/tool-platform";
import type {
  CabinetToolCommand,
  CabinetToolManifest,
  CabinetToolSourceEvent,
} from "@/types/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Cabinet Tool request failed.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const cabinetPath = request.nextUrl.searchParams.get("cabinetPath")?.trim();
  if (!cabinetPath) {
    return NextResponse.json(
      { error: "cabinetPath is required." },
      { status: 400 },
    );
  }
  try {
    const toolId = request.nextUrl.searchParams.get("toolId")?.trim();
    if (toolId) {
      return NextResponse.json(
        await getCabinetToolDetail(cabinetPath, toolId),
      );
    }
    return NextResponse.json(await getCabinetToolInventory(cabinetPath));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: unknown;
      cabinetPath?: unknown;
      command?: unknown;
      toolId?: unknown;
      enabled?: unknown;
      version?: unknown;
      event?: unknown;
    };
    if (typeof body.cabinetPath !== "string" || !body.cabinetPath.trim()) {
      throw new Error("cabinetPath is required.");
    }
    if (body.action === "command") {
      if (!body.command || typeof body.command !== "object") {
        throw new Error("command is required.");
      }
      return NextResponse.json({
        result: await executeCabinetToolCommand(
          body.cabinetPath,
          {
            ...(body.command as CabinetToolCommand),
            actor: { type: "user" },
          } as CabinetToolCommand,
        ),
      });
    }
    if (body.action === "set-enabled") {
      if (typeof body.toolId !== "string" || typeof body.enabled !== "boolean") {
        throw new Error("toolId and enabled are required.");
      }
      return NextResponse.json({
        installation: await setCabinetToolEnabled(
          body.cabinetPath,
          body.toolId,
          body.enabled,
        ),
      });
    }
    if (body.action === "rollback") {
      if (typeof body.toolId !== "string" || typeof body.version !== "string") {
        throw new Error("toolId and version are required.");
      }
      return NextResponse.json({
        installation: await rollbackCabinetTool(
          body.cabinetPath,
          body.toolId,
          body.version,
        ),
      });
    }
    if (body.action === "event") {
      if (!body.event || typeof body.event !== "object") {
        throw new Error("event is required.");
      }
      return NextResponse.json({
        outcomes: await applyCabinetToolEvent(
          body.cabinetPath,
          body.event as CabinetToolSourceEvent,
        ),
      });
    }
    throw new Error("Unsupported Cabinet Tool action.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      cabinetPath?: unknown;
      toolId?: unknown;
      manifest?: unknown;
    };
    if (typeof body.cabinetPath !== "string" || !body.cabinetPath.trim()) {
      throw new Error("cabinetPath is required.");
    }
    const tool =
      typeof body.toolId === "string" && body.toolId.trim()
        ? body.toolId.trim()
        : (body.manifest as CabinetToolManifest | undefined);
    if (!tool) {
      throw new Error("toolId or manifest is required.");
    }
    const installed = await installCabinetTool(body.cabinetPath, tool);
    return NextResponse.json({ installed }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      cabinetPath?: unknown;
      toolId?: unknown;
    };
    if (typeof body.cabinetPath !== "string" || !body.cabinetPath.trim()) {
      throw new Error("cabinetPath is required.");
    }
    if (typeof body.toolId !== "string" || !body.toolId.trim()) {
      throw new Error("toolId is required.");
    }
    await uninstallCabinetTool(body.cabinetPath, body.toolId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
