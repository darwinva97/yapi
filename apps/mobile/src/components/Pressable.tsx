import { MIN_TOUCH } from "../theme.js";

type Traits = "button" | "link" | "tabbar" | "header" | "image" | "none";

// `tabindex` no está en los tipos de Lynx, pero el custom element web lo refleja
// y hace el control enfocable/activable con teclado en el preview web.
type ExtraAttrs = Record<string, string>;

export interface PressableProps {
  /** Nombre accesible que anuncia el lector de pantalla (TalkBack/VoiceOver). */
  label: string;
  /** Rol semántico del control. Por defecto "button". */
  traits?: Traits;
  /** Texto de estado adicional (p. ej. "seleccionado", "activado"). */
  value?: string;
  onTap?: () => void;
  disabled?: boolean;
  /**
   * Expande el área táctil sin cambiar el tamaño visual. Útil para iconos
   * pequeños que deben llegar al mínimo de 44px. Acepta "8px" o un objeto.
   */
  hitSlop?:
    | `${number}px`
    | { top: `${number}px`; left: `${number}px`; right: `${number}px`; bottom: `${number}px` };
  /** Garantiza un área táctil mínima de 44x44 (además de hit-slop). */
  minTouch?: boolean;
  style?: Record<string, string | number>;
  children?: unknown;
}

/**
 * Envoltorio tocable y accesible. Centraliza la semántica de accesibilidad que
 * antes faltaba en casi todos los controles: marca el elemento como accesible,
 * le da rol y etiqueta, lo hace enfocable con teclado en web y asegura un área
 * táctil cómoda. Úsalo en lugar de un `<view bindtap=...>` suelto.
 */
export function Pressable({
  label,
  traits = "button",
  value,
  onTap,
  disabled = false,
  hitSlop,
  minTouch = false,
  style,
  children,
}: PressableProps) {
  const focusable: ExtraAttrs = !disabled && onTap ? { tabindex: "0" } : {};

  const baseStyle: Record<string, string | number> = minTouch
    ? { minWidth: `${MIN_TOUCH}px`, minHeight: `${MIN_TOUCH}px` }
    : {};

  return (
    <view
      {...focusable}
      bindtap={disabled ? undefined : onTap}
      accessibility-element={true}
      accessibility-label={label}
      accessibility-traits={disabled ? "none" : traits}
      accessibility-value={value}
      hit-slop={hitSlop}
      style={{
        ...baseStyle,
        ...style,
        opacity: disabled ? 0.5 : (style?.opacity ?? 1),
      }}
    >
      {children as never}
    </view>
  );
}
