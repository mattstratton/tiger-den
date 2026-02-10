"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "~/hooks/use-mobile";

type ViewMode = "grid" | "table";

const STORAGE_KEY = "tiger-den-view-mode";

export function useViewPreference(): [ViewMode, (mode: ViewMode) => void] {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<ViewMode>("table");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "grid" || stored === "table") {
      setMode(stored);
    } else {
      setMode(isMobile ? "grid" : "table");
    }
    setInitialized(true);
  }, [isMobile]);

  // Update if mobile status changes and user hasn't explicitly chosen
  useEffect(() => {
    if (!initialized) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setMode(isMobile ? "grid" : "table");
    }
  }, [isMobile, initialized]);

  const setViewMode = useCallback((newMode: ViewMode) => {
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  return [mode, setViewMode];
}
