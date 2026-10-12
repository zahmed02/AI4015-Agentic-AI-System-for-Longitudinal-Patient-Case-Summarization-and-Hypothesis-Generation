/** Tiny localStorage-backed store compatible with useSyncExternalStore. */
export function createLocalStore(key: string, fallback: string) {
  const event = `chronomed:${key}`;
  return {
    subscribe(callback: () => void) {
      window.addEventListener(event, callback);
      window.addEventListener("storage", callback);
      return () => {
        window.removeEventListener(event, callback);
        window.removeEventListener("storage", callback);
      };
    },
    getSnapshot(): string {
      try {
        return window.localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    getServerSnapshot(): string {
      return fallback;
    },
    set(value: string | null) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        /* storage unavailable */
      }
      window.dispatchEvent(new Event(event));
    },
  };
}