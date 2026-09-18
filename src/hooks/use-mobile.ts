import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** Trên server luôn coi là desktop; client sẽ đồng bộ sau khi hydrate. */
function getServerSnapshot() {
  return false;
}

/**
 * Bản gốc của shadcn gọi setState trong effect (gây cascading render và bị rule
 * `react-hooks/set-state-in-effect` chặn). Dùng useSyncExternalStore là cách đúng:
 * đăng ký nguồn ngoài, không setState trong effect, an toàn với SSR.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
