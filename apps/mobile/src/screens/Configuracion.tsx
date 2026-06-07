import { useEffect, useState } from "@lynx-js/react";

import { Avatar } from "../components/Avatar.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Pressable } from "../components/Pressable.jsx";
import { Modal } from "../components/Modal.jsx";
import { AppMultiSelect, type MultiOption } from "../components/AppMultiSelect.jsx";
import type { Device } from "../data/devices.js";
import type { AppRef } from "@yapi/contract";
import { api, ContractError } from "../api.js";
import { getInstalledApps } from "../installedApps.js";
import { getUser, clearSession } from "../session.js";
import {
  hasNativeIngest,
  hasNotificationAccess,
  openNotificationAccess,
} from "../notifListener.js";
import { colors } from "../theme.js";

type InputEvent = { detail: { value: string } };
type SubTab = "perfil" | "dispositivos";

function describeError(e: unknown, fallback: string): string {
  return e instanceof ContractError && e.status !== 0 ? e.message : fallback;
}

export function Configuracion({ onLogout }: { onLogout: () => void }) {
  const [subtab, setSubtab] = useState<SubTab>("perfil");

  return (
    <view
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        position: "relative",
      }}
    >
      <text
        accessibility-heading={true}
        style={{
          color: colors.text,
          fontSize: "26px",
          fontWeight: "bold",
          marginTop: "56px",
          marginLeft: "20px",
        }}
      >
        Configuración
      </text>

      <view
        style={{
          display: "flex",
          flexDirection: "row",
          marginTop: "16px",
          paddingLeft: "20px",
          paddingRight: "20px",
        }}
      >
        <SubTabButton
          label="Perfil"
          active={subtab === "perfil"}
          onTap={() => setSubtab("perfil")}
        />
        <SubTabButton
          label="Dispositivos"
          active={subtab === "dispositivos"}
          onTap={() => setSubtab("dispositivos")}
        />
      </view>

      {subtab === "perfil" ? <PerfilTab onLogout={onLogout} /> : null}
      {subtab === "dispositivos" ? <DispositivosTab /> : null}
    </view>
  );
}

function SubTabButton({
  label,
  active,
  onTap,
}: {
  label: string;
  active: boolean;
  onTap: () => void;
}) {
  return (
    <Pressable
      label={label}
      traits="tabbar"
      value={active ? "seleccionado" : undefined}
      onTap={onTap}
      style={{
        // `flex: 1` colapsa en Lynx nativo; mitad y mitad explícito.
        width: "50%",
        flexGrow: 1,
        flexBasis: "50%",
        alignItems: "center",
        paddingTop: "10px",
        paddingBottom: "10px",
        borderBottomWidth: "2px",
        borderBottomColor: active ? colors.primary : colors.border,
      }}
    >
      <text
        accessibility-elements-hidden={true}
        style={{
          color: active ? colors.text : colors.textMuted,
          fontSize: "15px",
          fontWeight: "bold",
        }}
      >
        {label}
      </text>
    </Pressable>
  );
}

/* ---------- Sello Activado/Desactivado ---------- */

function StatusPill({ on }: { on: boolean }) {
  return (
    <view
      accessibility-elements-hidden={true}
      style={{
        backgroundColor: on ? colors.successSoft : colors.pillNeutral,
        borderRadius: "20px",
        paddingLeft: "12px",
        paddingRight: "12px",
        paddingTop: "6px",
        paddingBottom: "6px",
      }}
    >
      <text
        style={{
          color: on ? colors.success : colors.textMuted,
          fontSize: "13px",
          fontWeight: "bold",
        }}
      >
        {on ? "Activado" : "Desactivado"}
      </text>
    </view>
  );
}

/** Fila etiqueta + valor (solo lectura). */
function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <view
      accessibility-element={true}
      accessibility-label={`${label}: ${value}`}
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "14px",
        paddingBottom: "14px",
        borderBottomWidth: last ? "0px" : "1px",
        borderBottomColor: colors.border,
      }}
    >
      <text style={{ color: colors.textMuted, fontSize: "14px" }}>{label}</text>
      <text style={{ color: colors.text, fontSize: "14px" }}>{value}</text>
    </view>
  );
}

/* ---------- Pestaña Perfil ---------- */

function PerfilTab({ onLogout }: { onLogout: () => void }) {
  const user = getUser();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    // Con Firebase Auth el cierre de sesión es del lado del cliente: descartamos
    // la sesión local (ID + refresh token). No hay sesión que invalidar en el server.
    clearSession();
    onLogout();
  }

  return (
    <view style={{ flex: 1, paddingLeft: "20px", paddingRight: "20px" }}>
      <view style={{ alignItems: "center", marginTop: "20px" }}>
        <Avatar name={user?.name ?? "?"} color={user?.color ?? colors.primary} size={88} />
        <text
          style={{
            color: colors.text,
            fontSize: "22px",
            fontWeight: "bold",
            marginTop: "12px",
          }}
        >
          {user?.name ?? "Usuario"}
        </text>
        <text style={{ color: colors.textMuted, fontSize: "14px", marginTop: "2px" }}>
          @{user?.handle ?? "—"}
        </text>
      </view>

      <view
        style={{
          backgroundColor: colors.surface,
          borderRadius: "14px",
          paddingLeft: "16px",
          paddingRight: "16px",
          marginTop: "24px",
        }}
      >
        <InfoRow label="Usuario" value={`@${user?.handle ?? "—"}`} />
        <InfoRow label="Email" value={user?.email ?? "Sin email"} last />
      </view>

      <Pressable
        label="Cerrar sesión"
        onTap={logout}
        disabled={loggingOut}
        style={{
          marginTop: "28px",
          backgroundColor: colors.dangerSoft,
          borderRadius: "12px",
          padding: "15px",
          alignItems: "center",
          borderWidth: "1px",
          borderColor: colors.danger,
        }}
      >
        <text
          accessibility-elements-hidden={true}
          style={{ color: colors.danger, fontSize: "15px", fontWeight: "bold" }}
        >
          {loggingOut ? "Cerrando…" : "Cerrar sesión"}
        </text>
      </Pressable>
    </view>
  );
}

/* ---------- Pestaña Dispositivos ---------- */

/**
 * Aviso para conceder "Acceso a notificaciones" (solo en el dispositivo nativo;
 * en web no se renderiza). Sin este permiso el lector no puede capturar las
 * notificaciones de otras apps para reenviarlas.
 */
function NotificationAccessBanner() {
  // Estado local para refrescar tras volver de Ajustes.
  const [granted, setGranted] = useState(hasNotificationAccess());

  if (!hasNativeIngest() || granted) return null;

  return (
    <view
      style={{
        backgroundColor: colors.surface,
        borderRadius: "12px",
        borderWidth: "1px",
        borderColor: colors.primary,
        padding: "14px",
        marginBottom: "14px",
      }}
    >
      <text style={{ color: colors.text, fontSize: "14px", fontWeight: "bold" }}>
        Activa el reenvío de notificaciones
      </text>
      <text style={{ color: colors.textMuted, fontSize: "13px", marginTop: "4px" }}>
        Concede “Acceso a notificaciones” para que yapi pueda leer las apps que
        elijas y reenviarlas a tus canales.
      </text>
      <Pressable
        label="Conceder acceso a notificaciones"
        onTap={() => {
          openNotificationAccess();
          // Al volver, reevaluamos el permiso.
          setGranted(hasNotificationAccess());
        }}
        style={{
          backgroundColor: colors.primary,
          borderRadius: "10px",
          paddingTop: "10px",
          paddingBottom: "10px",
          alignItems: "center",
          marginTop: "12px",
        }}
      >
        <text
          accessibility-elements-hidden={true}
          style={{ color: colors.text, fontSize: "14px", fontWeight: "bold" }}
        >
          Conceder acceso
        </text>
      </Pressable>
    </view>
  );
}

function DispositivosTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [installed, setInstalled] = useState<AppRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Device | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.call("listDevices"), getInstalledApps()])
      .then(([d, apps]) => {
        if (cancelled) return;
        setDevices(d);
        setInstalled(apps);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(describeError(e, "No se pudieron cargar los dispositivos"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function replaceDevice(updated: Device) {
    setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function confirmDelete() {
    const d = pendingDelete;
    if (!d) return;
    setPendingDelete(null);
    try {
      await api.call("deleteDevice", { id: d.id });
      setDevices((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      setError(describeError(e, "No se pudo eliminar el dispositivo"));
    }
  }

  const ordered = [...devices].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <view style={{ flex: 1, position: "relative" }}>
      <scroll-view
        scroll-orientation="vertical"
        style={{ flex: 1, paddingLeft: "20px", paddingRight: "20px" }}
      >
        <text
          accessibility-heading={true}
          style={{
            color: colors.text,
            fontSize: "18px",
            fontWeight: "bold",
            marginTop: "20px",
            marginBottom: "10px",
          }}
        >
          Dispositivos
        </text>

        <NotificationAccessBanner />

        {loading ? (
          <text style={{ color: colors.textMuted, fontSize: "14px" }}>Cargando…</text>
        ) : null}

        {error ? (
          <view
            style={{
              backgroundColor: colors.surface,
              borderRadius: "12px",
              borderWidth: "1px",
              borderColor: colors.danger,
              padding: "14px",
              marginBottom: "12px",
            }}
          >
            <text style={{ color: colors.danger, fontSize: "13px" }}>{error}</text>
          </view>
        ) : null}

        {!loading && ordered.length === 0 && !error ? (
          <text style={{ color: colors.textFaint, fontSize: "14px" }}>
            No tienes dispositivos registrados.
          </text>
        ) : null}

        {ordered.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            installed={installed}
            onUpdated={replaceDevice}
            onRequestDelete={() => setPendingDelete(d)}
            onError={(msg) => setError(msg)}
          />
        ))}

        <view style={{ height: "24px" }} />
      </scroll-view>

      {pendingDelete ? (
        <ConfirmDialog
          title="Eliminar dispositivo"
          message={`¿Eliminar "${pendingDelete.name}"? Dejará de recibir notificaciones.`}
          confirmLabel="Eliminar"
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </view>
  );
}

/** Tarjeta de un dispositivo: renombrar, editar apps, alternar notificador y eliminar. */
function DeviceCard({
  device,
  installed,
  onUpdated,
  onRequestDelete,
  onError,
}: {
  device: Device;
  installed: AppRef[];
  onUpdated: (d: Device) => void;
  onRequestDelete: () => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState(device.name);
  const [busy, setBusy] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  // Paquetes seleccionados en el modal de apps (los que pueden leer notificaciones).
  const [selectedPkgs, setSelectedPkgs] = useState<string[]>(
    device.apps.map((a) => a.package),
  );
  const trimmed = draft.trim();
  const dirty = trimmed.length > 0 && trimmed !== device.name;

  // Opciones del modal: las apps instaladas (web: mock) por package.
  const appOptions: MultiOption[] = installed.map((a) => ({
    key: a.package,
    label: a.label,
  }));

  function openApps() {
    setSelectedPkgs(device.apps.map((a) => a.package));
    setAppsOpen(true);
  }

  function toggleApp(pkg: string) {
    setSelectedPkgs((prev) =>
      prev.includes(pkg) ? prev.filter((x) => x !== pkg) : [...prev, pkg],
    );
  }

  async function saveApps() {
    if (busy) return;
    setBusy(true);
    try {
      const apps: AppRef[] = installed.filter((a) =>
        selectedPkgs.includes(a.package),
      );
      const updated = await api.call("updateDevice", { id: device.id, apps });
      onUpdated(updated);
      setAppsOpen(false);
    } catch (e) {
      onError(describeError(e, "No se pudieron guardar las apps"));
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      const updated = await api.call("updateDevice", { id: device.id, name: trimmed });
      onUpdated(updated);
    } catch (e) {
      onError(describeError(e, "No se pudo renombrar el dispositivo"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifier() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.call("updateDevice", {
        id: device.id,
        notifier: !device.notifier,
      });
      onUpdated(updated);
    } catch (e) {
      onError(describeError(e, "No se pudo cambiar el notificador"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <view
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.surface,
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      {/* Nombre editable */}
      <view style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <input
          {...({ value: device.name } as Record<string, string>)}
          accessibility-label={`Nombre de ${device.name}`}
          style={{
            flexGrow: 1,
            flexBasis: "auto",
            backgroundColor: colors.surfaceInput,
            borderRadius: "10px",
            height: "44px",
            color: colors.text,
            fontSize: "15px",
            paddingLeft: "12px",
            paddingRight: "12px",
          }}
          placeholder="Nombre del dispositivo"
          placeholder-color={colors.textFaint}
          bindinput={(e: InputEvent) => setDraft(e.detail.value)}
        />
        <Pressable
          label={dirty ? "Guardar nombre" : "Nombre guardado"}
          onTap={saveName}
          disabled={!dirty || busy}
          style={{
            marginLeft: "8px",
            height: "44px",
            paddingLeft: "14px",
            paddingRight: "14px",
            borderRadius: "10px",
            backgroundColor: dirty ? colors.primary : colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text
            accessibility-elements-hidden={true}
            style={{
              color: dirty ? colors.text : colors.textFaint,
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {dirty ? "Guardar" : "Guardado"}
          </text>
        </Pressable>
      </view>

      <view style={{ display: "flex", flexDirection: "row", alignItems: "center", marginTop: "6px" }}>
        <text style={{ color: colors.textFaint, fontSize: "12px" }}>{device.platform}</text>
        {device.hasToken ? null : (
          <text style={{ color: colors.textFaint, fontSize: "12px", marginLeft: "8px" }}>
            · sin token de push
          </text>
        )}
      </view>

      {/* Apps que pueden leer notificaciones en este dispositivo */}
      <Pressable
        label={`Apps que pueden notificar en ${device.name}`}
        value={`${device.apps.length} apps`}
        onTap={openApps}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surfaceInput,
          borderRadius: "10px",
          paddingLeft: "12px",
          paddingRight: "12px",
          height: "44px",
          marginTop: "10px",
        }}
      >
        <text style={{ color: colors.text, fontSize: "14px" }}>Apps con notificaciones</text>
        <view style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <text style={{ color: colors.textMuted, fontSize: "13px", marginRight: "6px" }}>
            {device.apps.length === 0
              ? "Ninguna"
              : device.apps.length === 1
                ? "1 app"
                : `${device.apps.length} apps`}
          </text>
          <text accessibility-elements-hidden={true} style={{ color: colors.textMuted, fontSize: "16px" }}>
            ›
          </text>
        </view>
      </Pressable>

      {/* Acciones: eliminar + notificador */}
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "14px",
        }}
      >
        <Pressable
          label={`Eliminar ${device.name}`}
          onTap={onRequestDelete}
          style={{
            backgroundColor: colors.dangerSoft,
            borderRadius: "10px",
            borderWidth: "1px",
            borderColor: colors.danger,
            paddingLeft: "14px",
            paddingRight: "14px",
            paddingTop: "8px",
            paddingBottom: "8px",
          }}
        >
          <text
            accessibility-elements-hidden={true}
            style={{ color: colors.danger, fontSize: "13px", fontWeight: "bold" }}
          >
            Eliminar
          </text>
        </Pressable>

        <Pressable
          label={`Notificador de ${device.name}`}
          traits="none"
          value={device.notifier ? "activado" : "desactivado"}
          onTap={toggleNotifier}
          disabled={busy}
          style={{ display: "flex", flexDirection: "row", alignItems: "center" }}
        >
          <text style={{ color: colors.textMuted, fontSize: "12px", marginRight: "8px" }}>
            Notificador
          </text>
          <StatusPill on={device.notifier} />
        </Pressable>
      </view>

      {appsOpen ? (
        <Modal
          title={`Apps · ${device.name}`}
          onClose={() => setAppsOpen(false)}
          footer={
            <Pressable
              label="Guardar apps"
              onTap={saveApps}
              disabled={busy}
              style={{
                backgroundColor: colors.primary,
                borderRadius: "12px",
                paddingTop: "14px",
                paddingBottom: "14px",
                alignItems: "center",
              }}
            >
              <text
                accessibility-elements-hidden={true}
                style={{ color: colors.text, fontSize: "15px", fontWeight: "bold" }}
              >
                {busy ? "Guardando…" : "Guardar"}
              </text>
            </Pressable>
          }
        >
          <text style={{ color: colors.textMuted, fontSize: "13px", paddingTop: "8px" }}>
            Elige qué apps pueden leer notificaciones en este dispositivo.
          </text>
          <AppMultiSelect
            options={appOptions}
            selected={selectedPkgs}
            onToggle={toggleApp}
            emptyText="No se detectaron apps instaladas."
          />
        </Modal>
      ) : null}
    </view>
  );
}
