import { Pressable } from "./Pressable.jsx";
import { colors } from "../theme.js";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <view
      // El backdrop también cierra el diálogo al tocarlo (patrón habitual).
      bindtap={onCancel}
      style={{
        position: "absolute",
        top: "0px",
        left: "0px",
        right: "0px",
        bottom: "0px",
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: "24px",
        paddingRight: "24px",
      }}
    >
      <view
        // Evita que un toque dentro del cuadro se propague al backdrop y lo cierre.
        catchtap={() => {}}
        accessibility-element={true}
        accessibility-label={`${title}. ${message}`}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          backgroundColor: colors.surface,
          borderRadius: "16px",
          borderWidth: "1px",
          borderColor: colors.border,
          padding: "20px",
        }}
      >
        <text
          accessibility-heading={true}
          style={{ color: colors.text, fontSize: "17px", fontWeight: "bold" }}
        >
          {title}
        </text>
        <text
          style={{
            color: colors.textMuted,
            fontSize: "14px",
            marginTop: "8px",
            lineHeight: "20px",
          }}
        >
          {message}
        </text>

        <view
          style={{
            display: "flex",
            flexDirection: "row",
            marginTop: "20px",
          }}
        >
          <Pressable
            label="Cancelar"
            onTap={onCancel}
            style={{
              flex: 1,
              backgroundColor: colors.surfaceMuted,
              borderRadius: "10px",
              paddingTop: "12px",
              paddingBottom: "12px",
              alignItems: "center",
              marginRight: "8px",
            }}
          >
            <text
              accessibility-elements-hidden={true}
              style={{ color: colors.textSecondary, fontSize: "15px", fontWeight: "bold" }}
            >
              Cancelar
            </text>
          </Pressable>
          <Pressable
            label={confirmLabel}
            onTap={onConfirm}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: "10px",
              paddingTop: "12px",
              paddingBottom: "12px",
              alignItems: "center",
              marginLeft: "8px",
            }}
          >
            <text
              accessibility-elements-hidden={true}
              style={{ color: colors.text, fontSize: "15px", fontWeight: "bold" }}
            >
              {confirmLabel}
            </text>
          </Pressable>
        </view>
      </view>
    </view>
  );
}
