// Configuración de los backends de yapi.
//
// - `worker` (Cloudflare Workers + D1): toda la API de dominio (auth, usuarios,
//   canales, dispositivos, notificaciones). En dev corre con `wrangler dev` (8787).
// - `server` (Node + firebase-admin): SOLO el envío de push notifications (3001).
//
// OJO: desde LynxExplorer en un móvil NO funciona "localhost"; usa la IP LAN de
// tu máquina (la misma que muestra `rspeedy dev`, p. ej. http://192.168.1.176).
// Por USB se puede usar `adb reverse tcp:8787 tcp:8787` para que localhost del
// teléfono apunte al worker del PC. En el preview web del navegador, localhost va bien.
//
// Las URLs se inyectan en tiempo de build desde `lynx.config.ts` (variables
// `YAPI_WORKER_URL` / `YAPI_SERVER_URL`). Por defecto apuntan a localhost para
// el preview web; en el APK Android desplegado se pasan las URLs de producción.
declare const __YAPI_WORKER_URL__: string;
declare const __YAPI_SERVER_URL__: string;

export const WORKER_URL =
  typeof __YAPI_WORKER_URL__ !== "undefined"
    ? __YAPI_WORKER_URL__
    : "http://127.0.0.1:8787";
export const SERVER_URL =
  typeof __YAPI_SERVER_URL__ !== "undefined"
    ? __YAPI_SERVER_URL__
    : "http://127.0.0.1:3001";

// Basic Auth del server de push (demo). En producción el push lo dispara el
// worker/servidor, no el cliente. base64("admin:changeme")
export const BASIC_AUTH_HEADER = "Basic YWRtaW46Y2hhbmdlbWU=";

// Web API key de Firebase (NO es secreto: se distribuye en el cliente). El móvil
// inicia sesión contra Firebase Auth (correo/Google) y manda el ID token al worker.
export const FIREBASE_API_KEY = "AIzaSyCg-_K1jv9z37-8TbiDbR8K4xcABmDJ-Vc";
