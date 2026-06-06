/**
 * Tokens de diseño de la app. Centralizar los colores aquí evita inconsistencias
 * (antes cada pantalla repetía los hex a mano) y facilita ajustar el tema.
 *
 * Notas de accesibilidad: los grises de texto cumplen contraste WCAG AA (>= 4.5:1)
 * sobre los fondos oscuros de la app. En particular `textFaint` sustituye al antiguo
 * `#5b606b`, que se quedaba en ~3:1 y no pasaba AA para texto normal.
 */
export const colors = {
  /** Fondo principal de pantalla. */
  bg: "#0b0b0f",
  /** Superficie de tarjetas, inputs y filas. */
  surface: "#16181d",
  /** Superficie alternativa (barra de pestañas). */
  surfaceAlt: "#111317",
  /** Input anidado sobre una tarjeta. */
  surfaceInput: "#0f1115",
  /** Botón/sello deshabilitado o neutro. */
  surfaceMuted: "#1d2127",
  /** Sello neutro (estado desactivado). */
  pillNeutral: "#2a2e36",
  /** Borde sutil. */
  border: "#23262d",
  /** Borde de control sin seleccionar (radio/checkbox). */
  controlBorder: "#3a3f48",

  /** Acento de marca. */
  primary: "#2f6fed",
  /** Fondo tenue del acento (sellos "Actual", apps de origen). */
  primarySoft: "#1d2a4d",
  /** Texto sobre fondo `primarySoft`. */
  primarySoftText: "#7aa2f7",

  /** Texto principal. */
  text: "#ffffff",
  /** Texto secundario (descripciones). */
  textSecondary: "#c4c8cf",
  /** Texto atenuado (labels, metadatos). AA sobre bg y surface. */
  textMuted: "#9aa0aa",
  /** Texto muy atenuado (captions, placeholders). AA sobre bg y surface. */
  textFaint: "#80868f",

  /** Peligro (cerrar sesión, errores). */
  danger: "#ef4444",
  /** Fondo tenue de peligro. */
  dangerSoft: "#1a1416",
  /** Éxito (notificador activado). */
  success: "#22c55e",
  successSoft: "#16321f",
  /** Verde de confirmación (checkbox activo). */
  check: "#16a34a",
} as const;

/** Tamaño mínimo recomendado de área táctil (px). */
export const MIN_TOUCH = 44;
