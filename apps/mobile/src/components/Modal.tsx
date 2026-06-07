import { Pressable } from "./Pressable.jsx";
import { colors } from "../theme.js";

/**
 * Hoja modal (bottom sheet) reutilizable: fondo oscuro + tarjeta con cabecera
 * (título + cerrar), contenido desplazable y un pie opcional para acciones.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children?: unknown;
  footer?: unknown;
}) {
  return (
    <view
      bindtap={onClose}
      style={{
        position: "absolute",
        top: "0px",
        left: "0px",
        right: "0px",
        bottom: "0px",
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <view
        catchtap={() => {}}
        accessibility-element={false}
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
          backgroundColor: colors.bg,
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          borderTopWidth: "1px",
          borderTopColor: colors.border,
        }}
      >
        {/* Cabecera */}
        <view
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: "20px",
            paddingRight: "12px",
            paddingTop: "16px",
            paddingBottom: "12px",
            borderBottomWidth: "1px",
            borderBottomColor: colors.border,
          }}
        >
          <text
            accessibility-heading={true}
            style={{ color: colors.text, fontSize: "18px", fontWeight: "bold", flexGrow: 1, flexBasis: "auto" }}
          >
            {title}
          </text>
          <Pressable
            label="Cerrar"
            onTap={onClose}
            minTouch={true}
            style={{
              width: "44px",
              height: "44px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <text
              accessibility-elements-hidden={true}
              style={{ color: colors.textMuted, fontSize: "22px" }}
            >
              ✕
            </text>
          </Pressable>
        </view>

        {/* Contenido. maxHeight (no flex:1): la tarjeta no tiene alto definido
            —solo maxHeight— y en Lynx nativo un flex:1 vertical ahí colapsa a 0.
            Con maxHeight el contenido crece y hace scroll al pasarse. */}
        <scroll-view
          scroll-orientation="vertical"
          style={{ maxHeight: "60vh", paddingLeft: "20px", paddingRight: "20px" }}
        >
          {children as never}
          <view style={{ height: "12px" }} />
        </scroll-view>

        {/* Pie opcional */}
        {footer ? (
          <view
            style={{
              paddingLeft: "20px",
              paddingRight: "20px",
              paddingTop: "12px",
              paddingBottom: "28px",
              borderTopWidth: "1px",
              borderTopColor: colors.border,
            }}
          >
            {footer as never}
          </view>
        ) : null}
      </view>
    </view>
  );
}
