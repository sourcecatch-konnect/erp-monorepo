"use client";

import * as React from "react";
import { IconFlask, IconFlaskOff } from "@tabler/icons-react";
import { useTestMode, setTestMode } from "./useTestMode";

export function TestModeToggle() {
  const active = useTestMode();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {active && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tracking-tight text-amber-700 shadow-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          TEST MODE
        </div>
      )}

      <button
        type="button"
        title={active ? "Disable test mode" : "Enable test mode"}
        onClick={() => setTestMode(!active)}
        className={[
          "flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-colors duration-150",
          active
            ? "border-amber-400 bg-amber-400 text-white hover:bg-amber-500"
            : "border-border bg-card text-muted-foreground hover:bg-muted",
        ].join(" ")}
      >
        {active ? <IconFlask size={16} /> : <IconFlaskOff size={16} />}
      </button>
    </div>
  );
}
