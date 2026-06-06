import { initials } from "../data/users.js";
import { colors } from "../theme.js";

export function Avatar({
  name,
  color,
  size = 44,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <view
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${size}px`,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <text
        // Las iniciales son decorativas: el nombre del usuario siempre se muestra
        // junto al avatar, así que evitamos que el lector lea "AT", "LG", etc.
        accessibility-elements-hidden={true}
        style={{
          color: colors.text,
          fontSize: `${Math.round(size / 2.6)}px`,
          fontWeight: "bold",
        }}
      >
        {initials(name)}
      </text>
    </view>
  );
}
