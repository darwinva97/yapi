import { useEffect, useState } from "@lynx-js/react";

import { ChannelCard } from "../components/ChannelCard.jsx";
import { Pressable } from "../components/Pressable.jsx";
import type { Channel } from "../data/channels.js";
import { api, ContractError } from "../api.js";
import { colors } from "../theme.js";

type Filter = "todos" | "propios" | "otros";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "propios", label: "Propios" },
  { key: "otros", label: "Otros" },
];

export function Channels({
  onCreate,
  onOpen,
}: {
  onCreate: () => void;
  onOpen: (c: Channel) => void;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .call("listChannels")
      .then((list) => {
        if (!cancelled) setChannels(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ContractError && e.status !== 0
              ? e.message
              : "No se pudieron cargar los canales",
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

  // La API ya devuelve los canales ordenados por nombre.
  // "Todos" no muestra canales ajenos: solo aquellos donde eres dueño o estás
  // suscrito. "Propios" = eres el dueño; "Otros" = estás suscrito pero no eres
  // el dueño.
  const visible = channels.filter((c) => {
    if (filter === "propios") return c.isOwner;
    if (filter === "otros") return c.isSubscribed && !c.isOwner;
    return c.isOwner || c.isSubscribed;
  });

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
      {/* Título + botón "+" para crear canal */}
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "56px",
        }}
      >
        <text
          accessibility-heading={true}
          style={{ color: colors.text, fontSize: "26px", fontWeight: "bold" }}
        >
          Canales
        </text>
        <Pressable
          label="Crear canal"
          onTap={onCreate}
          minTouch={true}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "44px",
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text
            accessibility-elements-hidden={true}
            style={{ color: colors.text, fontSize: "26px", lineHeight: "28px" }}
          >
            +
          </text>
        </Pressable>
      </view>

      {/* Filtro segmentado: Todos / Propios / Otros */}
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: "12px",
          padding: "4px",
          marginTop: "16px",
        }}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              label={f.label}
              value={on ? "seleccionado" : undefined}
              onTap={() => setFilter(f.key)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingTop: "9px",
                paddingBottom: "9px",
                borderRadius: "9px",
                backgroundColor: on ? colors.primary : "transparent",
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
                {f.label}
              </text>
            </Pressable>
          );
        })}
      </view>

      <text style={{ color: colors.textMuted, fontSize: "12px", marginTop: "12px" }}>
        {loading
          ? "Cargando…"
          : `${visible.length} canal${visible.length === 1 ? "" : "es"}`}
      </text>

      <scroll-view
        scroll-orientation="vertical"
        style={{ flex: 1, marginTop: "12px" }}
      >
        {error ? (
          <view
            style={{
              backgroundColor: colors.surface,
              borderRadius: "12px",
              borderWidth: "1px",
              borderColor: colors.danger,
              padding: "16px",
            }}
          >
            <text style={{ color: colors.danger, fontSize: "14px" }}>{error}</text>
          </view>
        ) : null}

        {visible.map((c) => (
          <ChannelCard key={c.id} channel={c} onTap={() => onOpen(c)} />
        ))}

        {!loading && !error && visible.length === 0 ? (
          <text style={{ color: colors.textFaint, fontSize: "14px", marginTop: "8px" }}>
            No hay canales en esta vista.
          </text>
        ) : null}
        {/* Espaciador final para que la última card no quede pegada al footer */}
        <view style={{ height: "16px" }} />
      </scroll-view>
    </view>
  );
}
