import { useSyncExternalStore } from "react";

const onHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

/** The address's hash, kept up to date as it changes. */
export function useHash(): string {
  return useSyncExternalStore(onHash, () => window.location.hash);
}

/** Whether the page currently matches a CSS media query, kept up to date as the window resizes. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
