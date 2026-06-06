import { useCallback, useEffect, useState } from "@lynx-js/react";

import { Pressable } from "../components/Pressable.jsx";
import { api, ContractError } from "../api.js";
import { colors } from "../theme.js";
import type { ActivityItem } from "@yapi/contract";

/** Formatea un timestamp ISO a algo corto y legible. */
function shortTime(iso: string): string {
  // Acepta ISO o "YYYY-MM-DD HH:mm"; nos quedamos con fecha + hora:minuto.
  const m = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
}

function InvitationCard({
  item,
  busy,
  onAccept,
  onDecline,
}: {
  item: ActivityItem;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <view
      style={{
        backgroundColor: colors.surface,
        borderRadius: "14px",
        borderWidth: "1px",
        borderColor: colors.primary,
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <view style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <text accessibility-elements-hidden={true} style={{ fontSize: "16px", marginRight: "8px" }}>
          ✉️
        </text>
        <text style={{ color: colors.primarySoftText, fontSize: "12px", fontWeight: "bold" }}>
          Invitación
        </text>
        <text style={{ color: colors.textFaint, fontSize: "11px", marginLeft: "auto" }}>
          {shortTime(item.timestamp)}
        </text>
      </view>
      <text style={{ color: colors.text, fontSize: "16px", fontWeight: "bold", marginTop: "8px" }}>
        {item.channelName}
      </text>
      <text style={{ color: colors.textMuted, fontSize: "13px", marginTop: "4px" }}>
        {item.description}
      </text>
      <view style={{ display: "flex", flexDirection: "row", marginTop: "14px" }}>
        <Pressable
          label={`Aceptar invitación a ${item.channelName}`}
          onTap={onAccept}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            borderRadius: "10px",
            paddingTop: "11px",
            paddingBottom: "11px",
            alignItems: "center",
            marginRight: "8px",
          }}
        >
          <text accessibility-elements-hidden={true} style={{ color: colors.text, fontSize: "14px", fontWeight: "bold" }}>
            Aceptar
          </text>
        </Pressable>
        <Pressable
          label={`Rechazar invitación a ${item.channelName}`}
          onTap={onDecline}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: colors.surfaceMuted,
            borderRadius: "10px",
            paddingTop: "11px",
            paddingBottom: "11px",
            alignItems: "center",
          }}
        >
          <text accessibility-elements-hidden={true} style={{ color: colors.textSecondary, fontSize: "14px", fontWeight: "bold" }}>
            Rechazar
          </text>
        </Pressable>
      </view>
    </view>
  );
}

function NotificationCard({ item }: { item: ActivityItem }) {
  return (
    <view
      style={{
        backgroundColor: colors.surface,
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <view style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <text style={{ color: colors.textMuted, fontSize: "12px", fontWeight: "bold" }}>
          {item.channelName}
        </text>
        {item.sourceApp ? (
          <text style={{ color: colors.textFaint, fontSize: "11px", marginLeft: "8px" }}>
            · {item.sourceApp}
          </text>
        ) : null}
        <text style={{ color: colors.textFaint, fontSize: "11px", marginLeft: "auto" }}>
          {shortTime(item.timestamp)}
        </text>
      </view>
      <text style={{ color: colors.text, fontSize: "15px", fontWeight: "bold", marginTop: "8px" }}>
        {item.title}
      </text>
      {item.description ? (
        <text style={{ color: colors.textSecondary, fontSize: "13px", marginTop: "4px" }}>
          {item.description}
        </text>
      ) : null}
    </view>
  );
}

export function Actividad() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .call("activityFeed")
      .then((list) => setItems(list))
      .catch((e: unknown) =>
        setError(
          e instanceof ContractError && e.status !== 0
            ? e.message
            : "No se pudieron cargar las novedades",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .call("activityFeed")
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ContractError && e.status !== 0
              ? e.message
              : "No se pudieron cargar las novedades",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function respond(item: ActivityItem, accept: boolean) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await api.call(accept ? "acceptInvite" : "declineInvite", { id: item.channelId });
      await load();
    } catch {
      setError("No se pudo procesar la invitación");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <view
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        paddingLeft: "20px",
        paddingRight: "20px",
      }}
    >
      <text
        accessibility-heading={true}
        style={{ color: colors.text, fontSize: "26px", fontWeight: "bold", marginTop: "56px" }}
      >
        Novedades
      </text>
      <text style={{ color: colors.textMuted, fontSize: "12px", marginTop: "8px" }}>
        {loading ? "Cargando…" : "Invitaciones y últimas publicaciones de tus canales"}
      </text>

      <scroll-view scroll-orientation="vertical" style={{ flex: 1, marginTop: "16px" }}>
        {error ? (
          <view
            style={{
              backgroundColor: colors.surface,
              borderRadius: "12px",
              borderWidth: "1px",
              borderColor: colors.danger,
              padding: "16px",
              marginBottom: "12px",
            }}
          >
            <text style={{ color: colors.danger, fontSize: "14px" }}>{error}</text>
          </view>
        ) : null}

        {items.map((item) =>
          item.type === "invitation" ? (
            <InvitationCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onAccept={() => respond(item, true)}
              onDecline={() => respond(item, false)}
            />
          ) : (
            <NotificationCard key={item.id} item={item} />
          ),
        )}

        {!loading && !error && items.length === 0 ? (
          <text style={{ color: colors.textFaint, fontSize: "14px", marginTop: "8px" }}>
            No tienes novedades por ahora.
          </text>
        ) : null}
        <view style={{ height: "16px" }} />
      </scroll-view>
    </view>
  );
}
