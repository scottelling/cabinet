"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CabinetToolCommandInput,
  CabinetToolCommandResult,
  CabinetToolDetail,
  CabinetToolInventory,
  CabinetToolManifest,
  InstalledCabinetTool,
} from "@/types/tools";

const EMPTY_INVENTORY: CabinetToolInventory = {
  catalog: [],
  installed: [],
  proposals: [],
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // Fall back to the response status below.
  }
  return `Cabinet Tool request failed (${response.status}).`;
}

export function useCabinetTools(cabinetPath: string) {
  const [inventory, setInventory] =
    useState<CabinetToolInventory>(EMPTY_INVENTORY);
  const [loading, setLoading] = useState(true);
  const [changingToolId, setChangingToolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tools?cabinetPath=${encodeURIComponent(cabinetPath)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await readError(response));
      setInventory((await response.json()) as CabinetToolInventory);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load Cabinet Tools.",
      );
    } finally {
      setLoading(false);
    }
  }, [cabinetPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = useCallback(
    async (
      tool: string | CabinetToolManifest,
    ): Promise<InstalledCabinetTool> => {
      const toolId = typeof tool === "string" ? tool : tool.id;
      setChangingToolId(toolId);
      try {
        const response = await fetch("/api/tools", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            typeof tool === "string"
              ? { cabinetPath, toolId }
              : { cabinetPath, manifest: tool },
          ),
        });
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as {
          installed: InstalledCabinetTool;
        };
        await refresh();
        return body.installed;
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to install Cabinet Tool.",
        );
        throw cause;
      } finally {
        setChangingToolId(null);
      }
    },
    [cabinetPath, refresh],
  );

  const uninstall = useCallback(
    async (toolId: string): Promise<void> => {
      setChangingToolId(toolId);
      try {
        const response = await fetch("/api/tools", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cabinetPath, toolId }),
        });
        if (!response.ok) throw new Error(await readError(response));
        await refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to remove Cabinet Tool.",
        );
        throw cause;
      } finally {
        setChangingToolId(null);
      }
    },
    [cabinetPath, refresh],
  );

  return {
    inventory,
    loading,
    changingToolId,
    error,
    refresh,
    install,
    uninstall,
  };
}

export function useCabinetToolDetail(cabinetPath: string, toolId: string) {
  const [detail, setDetail] = useState<CabinetToolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tools?cabinetPath=${encodeURIComponent(cabinetPath)}&toolId=${encodeURIComponent(toolId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await readError(response));
      setDetail((await response.json()) as CabinetToolDetail);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load this Cabinet Tool.",
      );
    } finally {
      setLoading(false);
    }
  }, [cabinetPath, toolId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setChanging(true);
      try {
        const response = await fetch("/api/tools", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cabinetPath, ...body }),
        });
        if (!response.ok) throw new Error(await readError(response));
        const result = (await response.json()) as Record<string, unknown>;
        await refresh();
        setError(null);
        return result;
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to update this Cabinet Tool.",
        );
        throw cause;
      } finally {
        setChanging(false);
      }
    },
    [cabinetPath, refresh],
  );

  const runCommand = useCallback(
    async (
      command: CabinetToolCommandInput,
    ): Promise<CabinetToolCommandResult> => {
      const body = await patch({
        action: "command",
        command: {
          ...command,
          toolId,
          actor: { type: "user" },
        },
      });
      return (body as { result: CabinetToolCommandResult }).result;
    },
    [patch, toolId],
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      await patch({ action: "set-enabled", toolId, enabled });
    },
    [patch, toolId],
  );

  const rollback = useCallback(
    async (version: string) => {
      await patch({ action: "rollback", toolId, version });
    },
    [patch, toolId],
  );

  return {
    detail,
    loading,
    changing,
    error,
    refresh,
    runCommand,
    setEnabled,
    rollback,
  };
}
