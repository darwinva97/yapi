import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type Credential,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let app: App | undefined;

/**
 * Resuelve las credenciales de Firebase en este orden:
 * 1. FIREBASE_SERVICE_ACCOUNT       → JSON de la service account en una línea.
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH  → ruta al fichero serviceAccountKey.json.
 * 3. GOOGLE_APPLICATION_CREDENTIALS → credenciales por defecto de Google (ruta a JSON).
 */
function resolveCredential(): Credential {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) return cert(JSON.parse(inline));

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path) return cert(path); // firebase-admin lee y parsea el fichero

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();

  throw new Error(
    "Faltan credenciales de Firebase. Define FIREBASE_SERVICE_ACCOUNT (JSON), " +
      "FIREBASE_SERVICE_ACCOUNT_PATH (ruta al serviceAccountKey.json) o " +
      "GOOGLE_APPLICATION_CREDENTIALS.",
  );
}

function getApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: resolveCredential() });
  }
  return app;
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Envía una push notification vía Firebase Cloud Messaging (HTTP v1). Devuelve el messageId. */
export async function sendPush(msg: PushMessage): Promise<string> {
  const messaging = getMessaging(getApp());
  return messaging.send({
    token: msg.token,
    notification: { title: msg.title, body: msg.body },
    data: msg.data,
  });
}
