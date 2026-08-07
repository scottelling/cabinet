"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  THEMES,
  applyTheme,
  resolveInitialThemeName,
  storeThemeName,
} from "@/lib/themes";

/**
 * Mounts once at the app root to ensure the custom theme CSS vars
 * are applied before any UI renders. This prevents flashes of the
 * wrong theme when navigating between panels.
 */
export function ThemeInitializer() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const desktop =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              CabinetDesktop?: {
                onFullscreenChanged?: (cb: (v: boolean) => void) => () => void;
              };
            }
          ).CabinetDesktop
        : undefined;
    let unsubscribeFullscreen: (() => void) | undefined;
    if (desktop) {
      document.documentElement.classList.add("electron-desktop");
      // Drop the traffic-light clearance while full-screen (globals.css).
      unsubscribeFullscreen = desktop.onFullscreenChanged?.((isFull) =>
        document.documentElement.classList.toggle("is-fullscreen", isFull)
      );
    }

    // Restore or migrate once to the current Kit. applyTheme() loads only the
    // Google Font families that theme actually uses — see themes.ts.
    const themeName = resolveInitialThemeName();
    const themeDef = THEMES.find((t) => t.name === themeName);
    if (themeDef) {
      applyTheme(themeDef);
      setTheme(themeDef.type);
      storeThemeName(themeName);
    }

    return () => unsubscribeFullscreen?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
