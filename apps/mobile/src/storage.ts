// Almacenamiento clave-valor persistente, multiplataforma:
// - Nativo (Android): NativeModule StorageModule (SharedPreferences).
// - Web (preview): localStorage del navegador.
//
// Se usa para persistir la sesión (refresh token de Firebase) y no re-logear.

declare const NativeModules:
  | {
      StorageModule?: {
        setItem(key: string, value: string): void;
        getItem(key: string, callback: (value: string) => void): void;
        removeItem(key: string): void;
      };
    }
  | undefined;

function nativeStorage() {
  try {
    if (typeof NativeModules === "undefined") return null;
    return NativeModules?.StorageModule ?? null;
  } catch {
    return null;
  }
}

function webStorage(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

export function storageGet(key: string): Promise<string | null> {
  const mod = nativeStorage();
  if (mod) {
    return new Promise((resolve) => {
      try {
        mod.getItem(key, (v) => resolve(v ? v : null));
      } catch {
        resolve(null);
      }
    });
  }
  try {
    return Promise.resolve(webStorage()?.getItem(key) ?? null);
  } catch {
    return Promise.resolve(null);
  }
}

export function storageSet(key: string, value: string): void {
  const mod = nativeStorage();
  if (mod) {
    try {
      mod.setItem(key, value);
    } catch {
      /* best-effort */
    }
    return;
  }
  try {
    webStorage()?.setItem(key, value);
  } catch {
    /* best-effort */
  }
}

export function storageRemove(key: string): void {
  const mod = nativeStorage();
  if (mod) {
    try {
      mod.removeItem(key);
    } catch {
      /* best-effort */
    }
    return;
  }
  try {
    webStorage()?.removeItem(key);
  } catch {
    /* best-effort */
  }
}
