import { useEffect, useState } from "@lynx-js/react";

import { TabBar, type Tab } from "./components/TabBar.jsx";
import { Login } from "./screens/Login.jsx";
import { Configuracion } from "./screens/Configuracion.jsx";
import { Channels } from "./screens/Channels.jsx";
import { Actividad } from "./screens/Actividad.jsx";
import { ChannelEditor } from "./screens/ChannelEditor.jsx";
import { isOwn, type Channel } from "./data/channels.js";
import { api } from "./api.js";
import { getFcmToken } from "./fcm.js";
import { setIngestSession } from "./notifListener.js";
import { restoreSession } from "./session.js";
import { colors } from "./theme.js";

export function App() {
  const [logged, setLogged] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [tab, setTab] = useState<Tab>("canales");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [openChannel, setOpenChannel] = useState<Channel | null>(null);

  // Al arrancar, restaura la sesión persistida (refresh token de Firebase) para
  // no obligar a re-logear en cada apertura.
  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((user) => {
        if (!cancelled && user) setLogged(true);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Al iniciar sesión registramos este dispositivo en silencio (con su token de
  // push si lo hay), SIN tocar sus apps. Qué apps pueden leer notificaciones se
  // configura aparte en Configuración → Dispositivos. Omitir `apps` hace que el
  // worker conserve las que ya hubiera, así que un re-login no las borra.
  useEffect(() => {
    if (!logged) return;
    getFcmToken()
      .then((token) =>
        api.call("registerDevice", {
          token: token ?? undefined,
          platform: token ? "lynx" : "web",
          name: token ? "Mi teléfono" : "Navegador",
        }),
      )
      .then((device) => {
        // Entrega al lector nativo (si lo hay) la sesión + apps permitidas para
        // que pueda reenviar notificaciones. No-op en web.
        setIngestSession(
          device.id,
          device.apps.map((a) => a.package),
        );
      })
      .catch(() => {
        /* el registro es best-effort; no bloquea el uso de la app */
      });
  }, [logged]);

  // Mientras se restaura la sesión persistida, muestra un splash (evita el
  // parpadeo del login si el usuario ya estaba autenticado).
  if (restoring) {
    return (
      <view
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <view
          style={{
            width: "76px",
            height: "76px",
            borderRadius: "76px",
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text style={{ color: colors.text, fontSize: "40px", fontWeight: "bold" }}>
            y
          </text>
        </view>
      </view>
    );
  }

  if (!logged) {
    return <Login onLogin={() => setLogged(true)} />;
  }

  // Pantalla completa (sin tab bar), como en el mockup de "Crear Canal".
  // Al crear, siempre eres el propietario, así que es editable.
  if (creatingChannel) {
    return (
      <ChannelEditor
        title="Crear Canal"
        editable={true}
        onClose={() => setCreatingChannel(false)}
      />
    );
  }

  // Detalle de un canal: misma vista que "Crear Canal", con datos precargados.
  // Solo el propietario (publicador) puede editarlo; el resto lo ve en modo lectura.
  if (openChannel) {
    return (
      <ChannelEditor
        title={openChannel.name}
        channel={openChannel}
        editable={isOwn(openChannel)}
        onClose={() => setOpenChannel(null)}
      />
    );
  }

  return (
    <view
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.bg,
        position: "relative",
      }}
    >
      <view
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          paddingBottom: "100px",
        }}
      >
        {tab === "canales" ? (
          <Channels
            onCreate={() => setCreatingChannel(true)}
            onOpen={(c) => setOpenChannel(c)}
          />
        ) : null}
        {tab === "actividad" ? <Actividad /> : null}
        {tab === "configuracion" ? (
          <Configuracion onLogout={() => setLogged(false)} />
        ) : null}
      </view>
      <view style={{ position: "absolute", left: "0px", right: "0px", bottom: "0px" }}>
        <TabBar active={tab} onChange={setTab} />
      </view>
    </view>
  );
}
