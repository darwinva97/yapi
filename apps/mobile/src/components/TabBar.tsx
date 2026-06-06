import { Pressable } from "./Pressable.jsx";
import { colors } from "../theme.js";

export type Tab = "canales" | "actividad" | "configuracion";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "canales", label: "Canales", icon: "📡" },
  { key: "actividad", label: "Novedades", icon: "🔔" },
  { key: "configuracion", label: "Configuración", icon: "⚙️" },
];

export function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <view
      style={{
        display: "flex",
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderTopWidth: "1px",
        borderTopColor: colors.border,
        paddingTop: "10px",
        paddingBottom: "24px",
      }}
    >
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <Pressable
            key={t.key}
            label={t.label}
            traits="tabbar"
            value={on ? "seleccionado" : undefined}
            onTap={() => onChange(t.key)}
            style={{ flex: 1, alignItems: "center", paddingTop: "2px", paddingBottom: "2px" }}
          >
            {/* Icono y etiqueta son decorativos: el nombre accesible lo da Pressable. */}
            <text
              accessibility-elements-hidden={true}
              style={{ fontSize: "22px", opacity: on ? 1 : 0.45 }}
            >
              {t.icon}
            </text>
            <text
              accessibility-elements-hidden={true}
              style={{
                fontSize: "11px",
                marginTop: "3px",
                color: on ? colors.primary : colors.textMuted,
              }}
            >
              {t.label}
            </text>
          </Pressable>
        );
      })}
    </view>
  );
}
