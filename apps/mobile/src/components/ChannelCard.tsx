import { Avatar } from "./Avatar.jsx";
import { Pressable } from "./Pressable.jsx";
import type { Channel } from "../data/channels.js";
import { sortedByName } from "../data/users.js";
import { colors } from "../theme.js";

const MAX_SUBSCRIBERS = 3;

export function ChannelCard({
  channel,
  onTap,
}: {
  channel: Channel;
  onTap?: () => void;
}) {
  const ordered = sortedByName(channel.subscribers);
  const shown = ordered.slice(0, MAX_SUBSCRIBERS);
  const extra = ordered.length - shown.length;
  const count = channel.subscribers.length;

  return (
    <Pressable
      onTap={onTap}
      label={`Canal ${channel.name}. Publica ${channel.publisher.name}. ${count} suscriptor${count === 1 ? "" : "es"}.`}
      style={{
        backgroundColor: colors.surface,
        borderRadius: "16px",
        borderWidth: "1px",
        borderColor: colors.border,
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      {/* Nombre del canal */}
      <text style={{ color: colors.text, fontSize: "18px", fontWeight: "bold" }}>
        {channel.name}
      </text>

      {/* Publicador */}
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          marginTop: "8px",
        }}
      >
        <Avatar
          name={channel.publisher.name}
          color={channel.publisher.color}
          size={22}
        />
        <text style={{ color: colors.textMuted, fontSize: "13px", marginLeft: "8px" }}>
          Publica {channel.publisher.name}
        </text>
      </view>

      {/* Descripción */}
      <text
        style={{
          color: colors.textSecondary,
          fontSize: "14px",
          marginTop: "10px",
          lineHeight: "20px",
        }}
      >
        {channel.description}
      </text>

      {/* Suscriptores: máximo 3 + "+n" */}
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          marginTop: "14px",
        }}
      >
        {shown.map((u, i) => (
          <view
            key={u.id}
            style={{
              marginLeft: i === 0 ? "0px" : "-10px",
              borderRadius: "30px",
              borderWidth: "2px",
              borderColor: colors.surface,
            }}
          >
            <Avatar name={u.name} color={u.color} size={30} />
          </view>
        ))}

        {extra > 0 ? (
          <view
            style={{
              marginLeft: "-10px",
              width: "30px",
              height: "30px",
              borderRadius: "30px",
              borderWidth: "2px",
              borderColor: colors.surface,
              backgroundColor: colors.pillNeutral,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <text
              style={{ color: colors.text, fontSize: "12px", fontWeight: "bold" }}
            >
              +{extra}
            </text>
          </view>
        ) : null}

        <text style={{ color: colors.textFaint, fontSize: "12px", marginLeft: "10px" }}>
          {count} suscriptor{count === 1 ? "" : "es"}
        </text>
      </view>
    </Pressable>
  );
}
