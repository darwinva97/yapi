// Obtención del token FCM del dispositivo vía el NativeModule de Lynx.
//
// El módulo Android (Kotlin) vive en apps/mobile/native/android/ (clase FcmModule)
// y se accede por el global `NativeModules` que expone el runtime de Lynx.

declare const NativeModules:
  | {
      FcmModule?: {
        // Lynx entrega el resultado por callback (un solo valor); "" si falla.
        getToken(callback: (token: string) => void): void;
      };
    }
  | undefined;

// Para PROBAR sin dispositivo: pega aquí un token FCM válido y se usará tal cual.
const MANUAL_TOKEN: string | null = null;

function getFcmModule() {
  try {
    const present = typeof NativeModules !== "undefined";
    console.log(
      "[yapi] NativeModules present=" +
        present +
        " keys=" +
        (present ? Object.keys(NativeModules as object).join(",") : "n/a"),
    );
    return present ? (NativeModules?.FcmModule ?? null) : null;
  } catch (e) {
    console.log("[yapi] getFcmModule error " + String(e));
    return null;
  }
}

/** Devuelve el token FCM, o `null` si no hay módulo nativo / token manual. */
export async function getFcmToken(): Promise<string | null> {
  if (MANUAL_TOKEN) return MANUAL_TOKEN;

  const mod = getFcmModule();
  if (!mod) return null;

  return new Promise<string | null>((resolve) => {
    try {
      mod.getToken((token) => resolve(token ? token : null));
    } catch {
      resolve(null);
    }
  });
}
