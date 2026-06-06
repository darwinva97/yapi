// Tipos de canal. Los datos vienen de la API (@yapi/contract). El canal ya trae
// calculados `isOwner` / `isSubscribed` para el usuario autenticado.
import type { Channel, ChannelNotification } from "@yapi/contract";

export type { Channel, ChannelNotification };

/** Soy el publicador del canal (puedo editarlo). */
export function isOwn(c: Channel): boolean {
  return c.isOwner;
}

/** Soy suscriptor del canal. */
export function isSubscribed(c: Channel): boolean {
  return c.isSubscribed;
}
