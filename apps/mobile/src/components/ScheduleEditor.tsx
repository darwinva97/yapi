import { Pressable } from "./Pressable.jsx";
import { colors } from "../theme.js";
import type { Schedule } from "@yapi/contract";

type InputEvent = { detail: { value: string } };

const DAYS: { i: number; l: string; name: string }[] = [
  { i: 0, l: "L", name: "lunes" },
  { i: 1, l: "M", name: "martes" },
  { i: 2, l: "X", name: "miércoles" },
  { i: 3, l: "J", name: "jueves" },
  { i: 4, l: "V", name: "viernes" },
  { i: 5, l: "S", name: "sábado" },
  { i: 6, l: "D", name: "domingo" },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Editor de horario (controlado): días de la semana activos + franja horaria.
 * `days = null` se interpreta como "todos los días"; `start/end = null` como
 * "todo el día".
 */
export function ScheduleEditor({
  value,
  onChange,
}: {
  value: Schedule;
  onChange: (s: Schedule) => void;
}) {
  const selected = value.days ?? ALL_DAYS;
  const allDay = !value.start && !value.end;

  function toggleDay(i: number) {
    const set = new Set(selected);
    if (set.has(i)) set.delete(i);
    else set.add(i);
    onChange({ ...value, days: [...set].sort((a, b) => a - b) });
  }

  function setAllDay(on: boolean) {
    onChange(
      on
        ? { ...value, start: null, end: null }
        : { ...value, start: value.start ?? "09:00", end: value.end ?? "18:00" },
    );
  }

  return (
    <view style={{ display: "flex", flexDirection: "column", paddingTop: "8px" }}>
      <text style={{ color: colors.textMuted, fontSize: "13px", marginBottom: "10px" }}>
        Días activos
      </text>
      <view style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
        {DAYS.map((d) => {
          const on = selected.includes(d.i);
          return (
            <Pressable
              key={d.i}
              label={d.name}
              value={on ? "activo" : "inactivo"}
              onTap={() => toggleDay(d.i)}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "20px",
                backgroundColor: on ? colors.primary : colors.surface,
                borderWidth: "1px",
                borderColor: on ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <text
                accessibility-elements-hidden={true}
                style={{
                  color: on ? colors.text : colors.textMuted,
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                {d.l}
              </text>
            </Pressable>
          );
        })}
      </view>

      {/* Franja horaria */}
      <Pressable
        label="Todo el día"
        traits="none"
        value={allDay ? "activado" : "desactivado"}
        onTap={() => setAllDay(!allDay)}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "20px",
          paddingTop: "10px",
          paddingBottom: "10px",
        }}
      >
        <text style={{ color: colors.text, fontSize: "15px" }}>Todo el día</text>
        <view
          accessibility-elements-hidden={true}
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "6px",
            borderWidth: "2px",
            borderColor: allDay ? colors.check : colors.controlBorder,
            backgroundColor: allDay ? colors.check : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text style={{ color: colors.text, fontSize: "14px" }}>{allDay ? "✓" : ""}</text>
        </view>
      </Pressable>

      {!allDay ? (
        <view
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            marginTop: "8px",
          }}
        >
          <view style={{ flex: 1 }}>
            <text style={{ color: colors.textMuted, fontSize: "12px", marginBottom: "6px" }}>
              Desde
            </text>
            <input
              {...({ value: value.start ?? "09:00" } as Record<string, string>)}
              accessibility-label="Hora de inicio"
              style={timeInputStyle}
              placeholder="09:00"
              placeholder-color={colors.textFaint}
              bindinput={(e: InputEvent) => onChange({ ...value, start: e.detail.value })}
            />
          </view>
          <view style={{ width: "12px" }} />
          <view style={{ flex: 1 }}>
            <text style={{ color: colors.textMuted, fontSize: "12px", marginBottom: "6px" }}>
              Hasta
            </text>
            <input
              {...({ value: value.end ?? "18:00" } as Record<string, string>)}
              accessibility-label="Hora de fin"
              style={timeInputStyle}
              placeholder="18:00"
              placeholder-color={colors.textFaint}
              bindinput={(e: InputEvent) => onChange({ ...value, end: e.detail.value })}
            />
          </view>
        </view>
      ) : null}
    </view>
  );
}

const timeInputStyle = {
  backgroundColor: colors.surface,
  borderRadius: "10px",
  height: "46px",
  color: colors.text,
  fontSize: "16px",
  paddingLeft: "14px",
  paddingRight: "14px",
  textAlign: "center",
} as const;

/** Resumen legible del horario para mostrar en la fila "Horario". */
export function scheduleSummary(s: Schedule): string {
  const daysPart =
    s.days == null || s.days.length === 7
      ? "Todos los días"
      : s.days.length === 0
        ? "Ningún día"
        : s.days
            .slice()
            .sort((a, b) => a - b)
            .map((d) => DAYS[d]?.l ?? "")
            .join(" ");
  const timePart = !s.start && !s.end ? "todo el día" : `${s.start ?? "—"}–${s.end ?? "—"}`;
  return `${daysPart} · ${timePart}`;
}
