import { useState } from "@lynx-js/react";

import { Pressable } from "./Pressable.jsx";
import { colors } from "../theme.js";

type InputEvent = { detail: { value: string } };

export interface MultiOption {
  /** Clave estable (package o id). */
  key: string;
  label: string;
  /** Texto secundario (p. ej. "en 2 dispositivos"). */
  meta?: string;
}

/**
 * Lista multiselección con buscador. Reutilizable para elegir apps de un
 * dispositivo o las apps de un canal. Filtra por `label`.
 */
export function AppMultiSelect({
  options,
  selected,
  onToggle,
  emptyText = "No hay apps.",
}: {
  options: MultiOption[];
  selected: string[];
  onToggle: (key: string) => void;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  return (
    <view style={{ display: "flex", flexDirection: "column", paddingTop: "12px" }}>
      <input
        accessibility-label="Buscar app"
        style={{
          backgroundColor: colors.surface,
          borderRadius: "10px",
          height: "44px",
          color: colors.text,
          fontSize: "15px",
          paddingLeft: "14px",
          paddingRight: "14px",
          marginBottom: "8px",
        }}
        placeholder="Buscar…"
        placeholder-color={colors.textFaint}
        bindinput={(e: InputEvent) => setQuery(e.detail.value)}
      />

      {options.length === 0 ? (
        <text style={{ color: colors.textFaint, fontSize: "14px", paddingTop: "8px" }}>
          {emptyText}
        </text>
      ) : null}

      {options.length > 0 && filtered.length === 0 ? (
        <text style={{ color: colors.textFaint, fontSize: "14px", paddingTop: "8px" }}>
          Sin resultados para “{query}”.
        </text>
      ) : null}

      {filtered.map((o) => {
        const on = selected.includes(o.key);
        return (
          <Pressable
            key={o.key}
            label={o.label + (o.meta ? `, ${o.meta}` : "")}
            traits="none"
            value={on ? "seleccionado" : "no seleccionado"}
            onTap={() => onToggle(o.key)}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              paddingTop: "10px",
              paddingBottom: "10px",
            }}
          >
            <view
              accessibility-elements-hidden={true}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                borderWidth: "2px",
                borderColor: on ? colors.check : colors.controlBorder,
                backgroundColor: on ? colors.check : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "12px",
              }}
            >
              <text style={{ color: colors.text, fontSize: "13px" }}>{on ? "✓" : ""}</text>
            </view>
            <view style={{ flexGrow: 1, flexBasis: "auto" }}>
              <text style={{ color: colors.text, fontSize: "15px" }}>{o.label}</text>
              {o.meta ? (
                <text style={{ color: colors.textFaint, fontSize: "12px", marginTop: "2px" }}>
                  {o.meta}
                </text>
              ) : null}
            </view>
          </Pressable>
        );
      })}
    </view>
  );
}
