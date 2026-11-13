import { useSyncExternalStore } from "react";
import { parseHash } from "@/routes";

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseHash(hash);
}

/** Moves to `hash` without a new history entry, as picking a row should not fill the back button. */
export function replaceHash(hash: string) {
  window.history.replaceState(null, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
