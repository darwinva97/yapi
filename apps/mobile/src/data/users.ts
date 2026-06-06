// Tipos y utilidades de usuarios. Los datos ahora vienen de la API (@yapi/contract),
// no de mocks; aquí solo quedan helpers puros que usan varias pantallas.
import type { User } from "@yapi/contract";

export type { User };

/** Comparador para ordenar listas alfabéticamente por `name` (regla global). */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

/** Devuelve una copia de la lista ordenada alfabéticamente por nombre. */
export function sortedByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort(byName);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
