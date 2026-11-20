/** A Map-backed `localStorage` for node tests (`vi.stubGlobal("localStorage", memoryStorage())`). */
export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** A `localStorage` that throws on every call, as a browser with site data blocked does. */
export function throwingStorage(): Storage {
  const no = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  return { length: 0, clear: no, getItem: no, key: no, removeItem: no, setItem: no };
}
