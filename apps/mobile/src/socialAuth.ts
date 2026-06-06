// Obtención de credenciales de login social (Google / Facebook) vía el
// NativeModule de Lynx.
//
// En un dispositivo Android real, el SDK nativo de Google/Facebook abre la
// pantalla de consentimiento y devuelve un ID token / access token, que el
// worker valida contra los servidores del proveedor.
//
// En modo web (preview / pruebas E2E) no hay SDK nativo, así que devolvemos una
// credencial mock con el formato `mock:<email>:<nombre>` que el worker acepta
// cuando AUTH_DEV_MOCK="1". Así se puede probar el flujo completo sin teléfono.

declare const NativeModules:
  | {
      SocialAuthModule?: {
        // Lynx entrega el resultado por callback (un solo valor); "" si falla.
        signInGoogle(callback: (credential: string) => void): void;
        signInFacebook(callback: (credential: string) => void): void;
      };
    }
  | undefined;

export type SocialProvider = "google" | "facebook";

function getModule() {
  try {
    if (typeof NativeModules === "undefined") return null;
    return NativeModules?.SocialAuthModule ?? null;
  } catch {
    return null;
  }
}

/**
 * Devuelve una credencial para `api.call("googleAuth"/"facebookAuth", { credential })`.
 *
 * - En dispositivo: el ID/access token real del SDK nativo.
 * - En web/preview: una credencial mock derivada de los datos de prueba, para
 *   que el worker (con AUTH_DEV_MOCK="1") cree/encuentre el usuario.
 */
export async function getSocialCredential(
  provider: SocialProvider,
  mock?: { email: string; name: string },
): Promise<string | null> {
  const mod = getModule();

  if (!mod) {
    // Sin módulo nativo (web): usamos la credencial mock si se proporcionó.
    if (mock && mock.email.trim()) {
      const name = mock.name.trim() || mock.email.trim().split("@")[0];
      return `mock:${mock.email.trim()}:${name}`;
    }
    return null;
  }

  return new Promise<string | null>((resolve) => {
    try {
      const cb = (credential: string) => resolve(credential ? credential : null);
      if (provider === "google") mod.signInGoogle(cb);
      else mod.signInFacebook(cb);
    } catch {
      resolve(null);
    }
  });
}

/** ¿Hay SDK social nativo disponible? (false en web → usamos credencial mock). */
export function hasNativeSocial(): boolean {
  return getModule() !== null;
}
