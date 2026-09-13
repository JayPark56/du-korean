import { useSyncExternalStore } from "react";

// Tabs driven by the URL hash (e.g. /dashboard#profile): shareable, survives
// reloads, and switching never navigates or refetches the page.

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Current location.hash ("" during server render). */
export function useHash() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
}

/** Switches to a hash tab in place: no navigation, no new history entry. */
export function selectHashTab(hash: string) {
  if (window.location.hash !== hash) {
    const url = new URL(window.location.href);
    url.hash = hash;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  window.scrollTo({ top: 0 });
}
