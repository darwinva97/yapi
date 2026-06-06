import type { Schedule } from "@yapi/contract";

/**
 * Evalúa si un instante cae dentro del horario de un canal. Es una función pura
 * (sin DB ni red) para poder probarla en unidad y reusarla en el reenvío.
 *
 * Convención de `Schedule`:
 *  - `days`: índices 0=Lun … 6=Dom. `null` = todos los días.
 *  - `start` / `end`: "HH:mm". `null` = sin restricción por ese extremo.
 *  - Si `start > end` la franja cruza la medianoche (p. ej. 22:00–06:00).
 *
 * El instante se evalúa en **UTC** (los Workers corren en UTC); la zona horaria
 * por usuario queda como mejora futura.
 */
export function isWithinSchedule(schedule: Schedule, when: Date): boolean {
  // Día de la semana en nuestra convención (0=Lun … 6=Dom).
  if (schedule.days != null) {
    const day = (when.getUTCDay() + 6) % 7; // getUTCDay: 0=Dom … 6=Sáb
    if (!schedule.days.includes(day)) return false;
  }

  const start = parseHHmm(schedule.start);
  const end = parseHHmm(schedule.end);
  if (start == null && end == null) return true;

  const cur = when.getUTCHours() * 60 + when.getUTCMinutes();

  if (start != null && end != null) {
    return start <= end
      ? cur >= start && cur <= end // franja normal dentro del día
      : cur >= start || cur <= end; // franja que cruza la medianoche
  }
  if (start != null) return cur >= start; // solo hora de inicio
  return cur <= end!; // solo hora de fin
}

/** "HH:mm" → minutos desde medianoche, o null si vacío/ inválido. */
function parseHHmm(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
