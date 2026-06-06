import { describe, expect, it } from "vitest";

import { isWithinSchedule } from "./schedule.js";

// 2024-01-01 (UTC) fue lunes; 2024-01-02 martes.
const MON_12 = new Date("2024-01-01T12:00:00Z");
const TUE_12 = new Date("2024-01-02T12:00:00Z");
const MON_08 = new Date("2024-01-01T08:00:00Z");
const MON_18 = new Date("2024-01-01T18:00:00Z");
const MON_23 = new Date("2024-01-01T23:00:00Z");
const MON_05 = new Date("2024-01-01T05:00:00Z");

describe("isWithinSchedule", () => {
  it("sin restricciones (days null, sin horas) → siempre dentro", () => {
    const s = { days: null, start: null, end: null };
    expect(isWithinSchedule(s, MON_12)).toBe(true);
    expect(isWithinSchedule(s, TUE_12)).toBe(true);
  });

  it("restringe por día de la semana (0=Lun)", () => {
    const lunes = { days: [0], start: null, end: null };
    expect(isWithinSchedule(lunes, MON_12)).toBe(true);
    expect(isWithinSchedule(lunes, TUE_12)).toBe(false);
  });

  it("franja horaria normal (09:00–17:00)", () => {
    const s = { days: null, start: "09:00", end: "17:00" };
    expect(isWithinSchedule(s, MON_12)).toBe(true);
    expect(isWithinSchedule(s, MON_08)).toBe(false);
    expect(isWithinSchedule(s, MON_18)).toBe(false);
  });

  it("franja que cruza la medianoche (22:00–06:00)", () => {
    const s = { days: null, start: "22:00", end: "06:00" };
    expect(isWithinSchedule(s, MON_23)).toBe(true);
    expect(isWithinSchedule(s, MON_05)).toBe(true);
    expect(isWithinSchedule(s, MON_12)).toBe(false);
  });

  it("solo hora de inicio / solo hora de fin", () => {
    expect(isWithinSchedule({ days: null, start: "09:00", end: null }, MON_12)).toBe(true);
    expect(isWithinSchedule({ days: null, start: "09:00", end: null }, MON_08)).toBe(false);
    expect(isWithinSchedule({ days: null, start: null, end: "17:00" }, MON_12)).toBe(true);
    expect(isWithinSchedule({ days: null, start: null, end: "17:00" }, MON_18)).toBe(false);
  });

  it("combina día + franja (lunes 09:00–17:00)", () => {
    const s = { days: [0], start: "09:00", end: "17:00" };
    expect(isWithinSchedule(s, MON_12)).toBe(true);
    expect(isWithinSchedule(s, TUE_12)).toBe(false); // martes, aunque sea mediodía
    expect(isWithinSchedule(s, MON_08)).toBe(false); // lunes, pero antes de las 9
  });
});
