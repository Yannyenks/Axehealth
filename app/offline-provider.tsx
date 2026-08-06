"use client";

import { useEffect } from "react";
import { registerOfflineSupport } from "@/lib/offline/register-sw";

export function OfflineProvider() {
  useEffect(() => {
    void registerOfflineSupport();
  }, []);

  return null;
}
