"use client";

import { toast } from "sonner";

export function TestToastButton() {
  return (
    <button
      className="font-medium text-sm text-muted-foreground hover:text-foreground hover:underline"
      onClick={() => toast.success("Toasts are working!")}
      type="button"
    >
      Test toast
    </button>
  );
}
