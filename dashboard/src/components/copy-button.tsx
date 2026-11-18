import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

/** Inside a claude.ai frame the page may not be allowed the clipboard, so the old command is the fallback. */
function legacyCopy(text: string): boolean {
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  // Selecting the field takes focus from the button; a keyboard user gets it back.
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
    focused?.focus();
  }
}

/** A button that copies `text`, with its outcome shown beside it and announced. */
export function CopyButton({ text, children }: { text: () => string; children: string }) {
  const [outcome, setOutcome] = useState<"Copied" | "Copy failed" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    const value = text();
    let ok: boolean;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = legacyCopy(value);
    }
    setOutcome(ok ? "Copied" : "Copy failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOutcome(null), 2000);
  }
  return (
    <div className="flex items-center gap-2.5">
      <Button type="button" variant="outline" size="sm" onClick={copy} data-copy>
        {outcome === "Copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
        {children}
      </Button>
      <span role="status" className="text-muted-foreground text-xs">
        {outcome}
      </span>
    </div>
  );
}
