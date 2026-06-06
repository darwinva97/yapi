import { useEffect, useState } from "@lynx-js/react";

import { Avatar } from "../components/Avatar.jsx";
import { Pressable } from "../components/Pressable.jsx";
import { Modal } from "../components/Modal.jsx";
import { AppMultiSelect, type MultiOption } from "../components/AppMultiSelect.jsx";
import { ScheduleEditor, scheduleSummary } from "../components/ScheduleEditor.jsx";
import type { User } from "../data/users.js";
import type { Device } from "../data/devices.js";
import type { Channel, ChannelNotification } from "../data/channels.js";
import type { Schedule } from "@yapi/contract";
import { api, ContractError } from "../api.js";
import { colors } from "../theme.js";

type InputEvent = { detail: { value: string } };
type Section = "info" | "users" | "integrations" | "notifications";
type ModalKind = "apps" | "schedule" | "invite" | null;

const EMPTY_SCHEDULE: Schedule = { days: null, start: null, end: null };

const BASE_SECTIONS: { key: Section; icon: string; label: string }[] = [
  { key: "info", icon: "ℹ️", label: "Información" },
  { key: "users", icon: "👥", label: "Usuarios" },
  { key: "integrations", icon: "🤖", label: "Integraciones" },
];

const NOTIFICATIONS_SECTION: { key: Section; icon: string; label: string } = {
  key: "notifications",
  icon: "🔔",
  label: "Notificaciones",
};

function describeError(e: unknown, fallback: string): string {
  return e instanceof ContractError && e.status !== 0 ? e.message : fallback;
}

/**
 * Editor de canal: "Crear Canal" (sin `channel`) o ver/editar uno existente.
 * Solo el propietario puede editar (`editable`); el resto lo ve en solo lectura.
 * Persiste contra la API (worker) vía el contrato.
 */
export function ChannelEditor({
  title,
  channel,
  editable,
  onClose,
}: {
  title: string;
  channel?: Channel;
  editable: boolean;
  onClose: () => void;
}) {
  const sections = channel
    ? [...BASE_SECTIONS, NOTIFICATIONS_SECTION]
    : BASE_SECTIONS;

  const [section, setSection] = useState<Section>("info");
  const [name, setName] = useState(channel?.name ?? "");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [enabled, setEnabled] = useState(channel?.enabled ?? true);
  // Miembros = aceptados (subscribers) + invitados pendientes. Inicializamos con
  // ambos para que al guardar no se pierdan las invitaciones aún sin aceptar.
  const [members, setMembers] = useState<string[]>(
    channel
      ? [...channel.subscribers, ...channel.pendingInvites].map((u) => u.id)
      : [],
  );
  const [deviceIds, setDeviceIds] = useState<string[]>(channel?.deviceIds ?? []);
  const [appIds, setAppIds] = useState<string[]>(channel?.appIds ?? []);
  const [schedule, setSchedule] = useState<Schedule>(
    channel?.schedule ?? EMPTY_SCHEDULE,
  );
  const [modal, setModal] = useState<ModalKind>(null);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDevice(id: string) {
    setDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleApp(id: string) {
    setAppIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Apps disponibles = unión de las apps de los dispositivos seleccionados, con
  // el nº de esos dispositivos en los que está instalada cada app.
  const appOptions: MultiOption[] = (() => {
    const byId = new Map<string, Device>(devices.map((d) => [d.id, d]));
    const counts = new Map<string, { label: string; count: number }>();
    for (const id of deviceIds) {
      const d = byId.get(id);
      if (!d) continue;
      for (const a of d.apps) {
        const e = counts.get(a.id);
        if (e) e.count += 1;
        else counts.set(a.id, { label: a.label, count: 1 });
      }
    }
    return [...counts.entries()]
      .map(([key, { label, count }]) => ({
        key,
        label,
        meta: `en ${count} dispositivo${count === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  })();

  // Usuarios miembros (unidos/invitados): resolvemos los ids seleccionados a
  // objetos User, combinando los suscriptores del canal con el directorio
  // (`listUsers`). Así la pestaña Usuarios muestra SOLO a los miembros, no a
  // todo el directorio.
  const memberUsers: User[] = (() => {
    const byId = new Map<string, User>();
    for (const u of channel?.subscribers ?? []) byId.set(u.id, u);
    for (const u of channel?.pendingInvites ?? []) byId.set(u.id, u);
    for (const u of allUsers) byId.set(u.id, u);
    return members
      .map((id) => byId.get(id))
      .filter((u): u is User => Boolean(u));
  })();

  // Ids con invitación aún pendiente (para marcarlos en la lista).
  const pendingIds = new Set((channel?.pendingInvites ?? []).map((u) => u.id));

  // Candidatos a invitar = todo el directorio (la API ya excluye al usuario
  // actual), presentados con buscador en el modal de invitación.
  const inviteOptions: MultiOption[] = allUsers
    .map((u) => ({ key: u.id, label: u.name, meta: `@${u.handle}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // El editor (solo propietario) necesita la lista de usuarios y dispositivos.
  useEffect(() => {
    if (!editable) return;
    let cancelled = false;
    Promise.all([api.call("listUsers"), api.call("listDevices")])
      .then(([u, d]) => {
        if (cancelled) return;
        setAllUsers(u);
        setDevices(d);
      })
      .catch(() => {
        /* no bloquea la edición de info; se reintenta al reabrir */
      });
    return () => {
      cancelled = true;
    };
  }, [editable]);

  function toggleMember(id: string) {
    setMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      setSection("info");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (channel) {
        await api.call("updateChannel", {
          id: channel.id,
          name: name.trim(),
          description,
          enabled,
          subscriberIds: members,
          deviceIds,
          appIds,
          schedule,
        });
      } else {
        await api.call("createChannel", {
          name: name.trim(),
          description,
          enabled,
          subscriberIds: members,
          deviceIds,
          appIds,
          schedule,
        });
      }
      onClose();
    } catch (e) {
      setError(describeError(e, "No se pudo guardar el canal"));
      setSaving(false);
    }
  }

  const headerTitle = editable && channel ? `Editar: ${title}` : title;

  return (
    <view
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.bg,
      }}
    >
      {/* Header: volver + título */}
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          paddingTop: "52px",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingBottom: "12px",
        }}
      >
        <Pressable
          label="Volver"
          onTap={onClose}
          minTouch={true}
          style={{
            width: "44px",
            height: "44px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text
            accessibility-elements-hidden={true}
            style={{ color: colors.text, fontSize: "28px", lineHeight: "30px" }}
          >
            ‹
          </text>
        </Pressable>
        <text
          accessibility-heading={true}
          style={{
            color: colors.text,
            fontSize: "20px",
            fontWeight: "bold",
            marginLeft: "8px",
            flex: 1,
          }}
        >
          {headerTitle}
        </text>
      </view>

      {/* Tabs */}
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
      >
        {sections.map((s) => {
          const on = section === s.key;
          return (
            <Pressable
              key={s.key}
              label={s.label}
              traits="tabbar"
              value={on ? "seleccionado" : undefined}
              onTap={() => setSection(s.key)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingTop: "12px",
                paddingBottom: "12px",
                backgroundColor: on ? colors.surface : "transparent",
                borderTopLeftRadius: "12px",
                borderTopRightRadius: "12px",
                borderBottomWidth: "2px",
                borderBottomColor: on ? colors.primary : colors.border,
              }}
            >
              <text
                accessibility-elements-hidden={true}
                style={{ fontSize: "20px", opacity: on ? 1 : 0.5 }}
              >
                {s.icon}
              </text>
            </Pressable>
          );
        })}
      </view>

      <scroll-view
        scroll-orientation="vertical"
        style={{
          flex: 1,
          paddingLeft: "20px",
          paddingRight: "20px",
          paddingTop: "8px",
        }}
      >
        {!editable ? <ReadOnlyBanner publisher={channel?.publisher.name} /> : null}

        {section === "info" ? (
          <InfoSection
            editable={editable}
            name={name}
            description={description}
            publisherName={channel?.publisher.name}
            enabled={enabled}
            devices={devices}
            deviceIds={deviceIds}
            appCount={appIds.length}
            scheduleText={scheduleSummary(schedule)}
            onChangeName={setName}
            onChangeDescription={setDescription}
            onToggleEnabled={() => setEnabled((v) => !v)}
            onToggleDevice={toggleDevice}
            onOpenApps={() => setModal("apps")}
            onOpenSchedule={() => setModal("schedule")}
          />
        ) : null}

        {section === "users" ? (
          <UsersSection
            editable={editable}
            members={memberUsers}
            subscribers={channel?.subscribers ?? []}
            pendingIds={pendingIds}
            onRemove={toggleMember}
            onInvite={() => setModal("invite")}
          />
        ) : null}

        {section === "integrations" ? (
          <IntegrationsSection editable={editable} />
        ) : null}

        {section === "notifications" ? (
          <NotificationsSection
            channelId={channel?.id}
            editable={editable}
            initial={channel?.notifications ?? []}
          />
        ) : null}

        <view style={{ height: "24px" }} />
      </scroll-view>

      {/* Acción principal: solo para quien puede editar. */}
      {editable ? (
        <view
          style={{
            paddingLeft: "20px",
            paddingRight: "20px",
            paddingTop: "12px",
            paddingBottom: "28px",
            borderTopWidth: "1px",
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          {error ? (
            <text
              accessibility-traits="updating"
              style={{ color: colors.danger, fontSize: "13px", marginBottom: "10px" }}
            >
              {error}
            </text>
          ) : null}
          <Pressable
            label={channel ? "Guardar cambios" : "Crear canal"}
            onTap={save}
            disabled={saving}
            style={{
              backgroundColor: colors.primary,
              borderRadius: "12px",
              paddingTop: "15px",
              paddingBottom: "15px",
              alignItems: "center",
            }}
          >
            <text
              accessibility-elements-hidden={true}
              style={{ color: colors.text, fontSize: "16px", fontWeight: "bold" }}
            >
              {saving
                ? "Guardando…"
                : channel
                  ? "Guardar cambios"
                  : "Crear canal"}
            </text>
          </Pressable>
        </view>
      ) : null}

      {/* Modal de Apps: unión de apps de los dispositivos seleccionados. */}
      {modal === "apps" ? (
        <Modal title="Apps del canal" onClose={() => setModal(null)}>
          {deviceIds.length === 0 ? (
            <text style={{ color: colors.textFaint, fontSize: "14px", paddingTop: "12px" }}>
              Selecciona primero los dispositivos para ver sus apps.
            </text>
          ) : (
            <AppMultiSelect
              options={appOptions}
              selected={appIds}
              onToggle={toggleApp}
              emptyText="Los dispositivos seleccionados no tienen apps."
            />
          )}
        </Modal>
      ) : null}

      {/* Modal de Horario. */}
      {modal === "schedule" ? (
        <Modal title="Horario" onClose={() => setModal(null)}>
          <ScheduleEditor value={schedule} onChange={setSchedule} />
        </Modal>
      ) : null}

      {/* Modal de invitar usuarios: busca en el directorio y marca a quién
          invitar. Los marcados pasan a ser miembros del canal al guardar. */}
      {modal === "invite" ? (
        <Modal title="Invitar usuarios" onClose={() => setModal(null)}>
          <AppMultiSelect
            options={inviteOptions}
            selected={members}
            onToggle={toggleMember}
            emptyText="No hay usuarios para invitar."
          />
        </Modal>
      ) : null}
    </view>
  );
}

/* ---------- Banner de solo lectura ---------- */

function ReadOnlyBanner({ publisher }: { publisher?: string }) {
  return (
    <view
      accessibility-element={true}
      accessibility-label={`Solo lectura. Este canal lo gestiona ${publisher ?? "otro usuario"}.`}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: "12px",
        borderWidth: "1px",
        borderColor: colors.border,
        paddingLeft: "14px",
        paddingRight: "14px",
        paddingTop: "12px",
        paddingBottom: "12px",
        marginTop: "12px",
        marginBottom: "4px",
      }}
    >
      <text accessibility-elements-hidden={true} style={{ fontSize: "16px", marginRight: "10px" }}>
        👁
      </text>
      <text style={{ color: colors.textMuted, fontSize: "13px", flex: 1, lineHeight: "18px" }}>
        Solo lectura. Este canal lo gestiona{" "}
        <text style={{ color: colors.text, fontWeight: "bold" }}>
          {publisher ?? "otro usuario"}
        </text>
        .
      </text>
    </view>
  );
}

/* ---------- Información ---------- */

function SectionLabel({ children }: { children: string }) {
  return (
    <text
      accessibility-heading={true}
      style={{
        color: colors.textMuted,
        fontSize: "13px",
        fontWeight: "bold",
        marginTop: "20px",
        marginBottom: "10px",
      }}
    >
      {children}
    </text>
  );
}

function ReadonlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <view
      accessibility-element={true}
      accessibility-label={`${label}: ${value || "vacío"}`}
      style={{
        backgroundColor: colors.surface,
        borderRadius: "12px",
        paddingLeft: "14px",
        paddingRight: "14px",
        paddingTop: "12px",
        paddingBottom: "12px",
        marginBottom: "10px",
        minHeight: multiline ? "72px" : undefined,
      }}
    >
      <text style={{ color: colors.textMuted, fontSize: "12px", marginBottom: "4px" }}>
        {label}
      </text>
      <text style={{ color: colors.text, fontSize: "15px", lineHeight: "20px" }}>
        {value || "—"}
      </text>
    </view>
  );
}

function Row({
  label,
  trailing,
  onTap,
}: {
  label: string;
  trailing: string;
  onTap?: () => void;
}) {
  const inner = (
    <>
      <text style={{ color: colors.text, fontSize: "15px" }}>{label}</text>
      <text
        accessibility-elements-hidden={true}
        style={{ color: colors.textMuted, fontSize: "16px" }}
      >
        {trailing}
      </text>
    </>
  );

  const rowStyle = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: "12px",
    paddingLeft: "14px",
    paddingRight: "14px",
    height: "50px",
    marginBottom: "10px",
  } as const;

  if (onTap) {
    return (
      <Pressable label={label} onTap={onTap} style={{ ...rowStyle }}>
        {inner}
      </Pressable>
    );
  }
  return <view style={rowStyle}>{inner}</view>;
}

function InfoSection({
  editable,
  name,
  description,
  publisherName,
  enabled,
  devices,
  deviceIds,
  appCount,
  scheduleText,
  onChangeName,
  onChangeDescription,
  onToggleEnabled,
  onToggleDevice,
  onOpenApps,
  onOpenSchedule,
}: {
  editable: boolean;
  name: string;
  description: string;
  publisherName?: string;
  enabled: boolean;
  devices: Device[];
  deviceIds: string[];
  appCount: number;
  scheduleText: string;
  onChangeName: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onToggleEnabled: () => void;
  onToggleDevice: (id: string) => void;
  onOpenApps: () => void;
  onOpenSchedule: () => void;
}) {
  return (
    <view style={{ display: "flex", flexDirection: "column" }}>
      <SectionLabel>Información</SectionLabel>

      {editable ? (
        <>
          <input
            {...({ value: name } as Record<string, string>)}
            accessibility-label="Nombre del canal"
            style={{
              backgroundColor: colors.surface,
              borderRadius: "12px",
              height: "50px",
              color: colors.text,
              fontSize: "15px",
              marginBottom: "10px",
              paddingLeft: "14px",
              paddingRight: "14px",
            }}
            placeholder="Nombre"
            placeholder-color={colors.textFaint}
            bindinput={(e: InputEvent) => onChangeName(e.detail.value)}
          />

          <input
            {...({ value: description } as Record<string, string>)}
            accessibility-label="Descripción del canal"
            style={{
              backgroundColor: colors.surface,
              borderRadius: "12px",
              height: "90px",
              color: colors.text,
              fontSize: "15px",
              paddingLeft: "14px",
              paddingRight: "14px",
              marginBottom: "10px",
            }}
            placeholder="Descripción"
            placeholder-color={colors.textFaint}
            bindinput={(e: InputEvent) => onChangeDescription(e.detail.value)}
          />
        </>
      ) : (
        <>
          <ReadonlyField label="Nombre" value={name} />
          <ReadonlyField label="Descripción" value={description} multiline />
        </>
      )}

      {publisherName ? (
        <Row label="Publicador" trailing={publisherName} />
      ) : null}

      {editable ? (
        <>
          <SectionLabel>Suscripción</SectionLabel>

          <Pressable
            label="Estado del canal"
            traits="none"
            value={enabled ? "activado" : "desactivado"}
            onTap={onToggleEnabled}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.surface,
              borderRadius: "12px",
              paddingLeft: "14px",
              paddingRight: "14px",
              height: "50px",
              marginBottom: "10px",
            }}
          >
            <text style={{ color: colors.text, fontSize: "15px" }}>Estado</text>
            <Checkbox on={enabled} shape="square" />
          </Pressable>

          <DeviceSelect
            devices={devices}
            selected={deviceIds}
            onToggle={onToggleDevice}
          />

          <Row label="Horario" trailing={scheduleText} onTap={onOpenSchedule} />
          <Row
            label="Apps"
            trailing={appCount === 0 ? "Ninguna" : `${appCount}`}
            onTap={onOpenApps}
          />
        </>
      ) : null}
    </view>
  );
}

/* ---------- Checkbox / Radio decorativos ---------- */

function Checkbox({
  on,
  shape = "square",
}: {
  on: boolean;
  shape?: "square" | "round";
}) {
  const size = shape === "square" ? "26px" : "22px";
  return (
    <view
      accessibility-elements-hidden={true}
      style={{
        width: size,
        height: size,
        borderRadius: shape === "square" ? "6px" : "22px",
        borderWidth: "2px",
        borderColor: on ? colors.check : colors.controlBorder,
        backgroundColor: on ? colors.check : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <text style={{ color: colors.text, fontSize: "14px" }}>{on ? "✓" : ""}</text>
    </view>
  );
}

/* ---------- Multiselect de dispositivos (desplegable) ---------- */

/**
 * Selector múltiple de dispositivos definidos en Configuración (vienen de la API
 * `listDevices`). Se despliega al tocar la cabecera. La selección la controla el
 * editor y se persiste como `deviceIds` del canal.
 */
function DeviceSelect({
  devices,
  selected,
  onToggle,
}: {
  devices: Device[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = onToggle;
  const count = selected.length;
  const summary =
    count === 0
      ? "Ninguno"
      : count === devices.length
        ? "Todos"
        : `${count} seleccionado${count === 1 ? "" : "s"}`;

  return (
    <view
      style={{
        backgroundColor: colors.surface,
        borderRadius: "12px",
        marginBottom: "10px",
        overflow: "hidden",
      }}
    >
      <Pressable
        label="Dispositivos"
        value={`${summary}, ${open ? "expandido" : "contraído"}`}
        onTap={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "14px",
          paddingRight: "14px",
          height: "50px",
        }}
      >
        <text style={{ color: colors.text, fontSize: "15px" }}>Dispositivos</text>
        <view style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <text style={{ color: colors.textMuted, fontSize: "14px", marginRight: "8px" }}>
            {summary}
          </text>
          <text
            accessibility-elements-hidden={true}
            style={{ color: colors.textMuted, fontSize: "16px" }}
          >
            {open ? "▾" : "▸"}
          </text>
        </view>
      </Pressable>

      {open ? (
        <view
          style={{
            borderTopWidth: "1px",
            borderTopColor: colors.border,
            paddingTop: "4px",
            paddingBottom: "4px",
          }}
        >
          {devices.map((d) => {
            const on = selected.includes(d.id);
            return (
              <Pressable
                key={d.id}
                label={d.name}
                traits="none"
                value={on ? "seleccionado" : "no seleccionado"}
                onTap={() => toggle(d.id)}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingLeft: "14px",
                  paddingRight: "14px",
                  paddingTop: "12px",
                  paddingBottom: "12px",
                }}
              >
                <Checkbox on={on} shape="square" />
                <view style={{ marginLeft: "12px", flex: 1 }}>
                  <text style={{ color: colors.text, fontSize: "15px" }}>{d.name}</text>
                  <text style={{ color: colors.textFaint, fontSize: "12px", marginTop: "2px" }}>
                    {d.notifier ? "Notificador activado" : "Notificador desactivado"}
                  </text>
                </view>
              </Pressable>
            );
          })}
          {devices.length === 0 ? (
            <text style={{ color: colors.textFaint, fontSize: "13px", padding: "14px" }}>
              No hay dispositivos. Añádelos en Configuración.
            </text>
          ) : null}
        </view>
      ) : null}
    </view>
  );
}

/* ---------- Usuarios ---------- */

function UsersSection({
  editable,
  members,
  subscribers,
  pendingIds,
  onRemove,
  onInvite,
}: {
  editable: boolean;
  /** Miembros del canal (unidos/invitados), ya resueltos a objetos User. */
  members: User[];
  /** Suscriptores actuales del canal (vista de solo lectura). */
  subscribers: User[];
  /** Ids con invitación aún sin aceptar (se marcan como "Pendiente"). */
  pendingIds: Set<string>;
  onRemove: (id: string) => void;
  onInvite: () => void;
}) {
  // Solo se listan los miembros: en edición, los seleccionados por el dueño
  // (con opción de quitar e invitar más); en lectura, los suscriptores.
  const visibleUsers = editable ? members : subscribers;

  return (
    <view style={{ display: "flex", flexDirection: "column" }}>
      <view
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "12px",
          marginBottom: "8px",
        }}
      >
        <text
          accessibility-heading={true}
          style={{ color: colors.text, fontSize: "20px", fontWeight: "bold" }}
        >
          Usuarios
        </text>
        {editable ? (
          <text style={{ color: colors.textMuted, fontSize: "13px" }}>
            {members.length} miembro{members.length === 1 ? "" : "s"}
          </text>
        ) : null}
      </view>

      {/* Botón para invitar a más usuarios (abre el buscador en un modal). */}
      {editable ? (
        <Pressable
          label="Invitar usuario"
          onTap={onInvite}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            borderRadius: "12px",
            borderWidth: "1px",
            borderColor: colors.primary,
            height: "48px",
            marginBottom: "12px",
          }}
        >
          <text
            accessibility-elements-hidden={true}
            style={{ color: colors.primary, fontSize: "15px", fontWeight: "bold" }}
          >
            ＋ Invitar usuario
          </text>
        </Pressable>
      ) : null}

      {visibleUsers.length === 0 ? (
        <text style={{ color: colors.textFaint, fontSize: "14px", marginTop: "8px" }}>
          {editable
            ? "Aún no has invitado a nadie. Usa “Invitar usuario” para añadir miembros."
            : "Este canal no tiene usuarios."}
        </text>
      ) : null}

      {visibleUsers.map((u) => {
        const pending = pendingIds.has(u.id);
        const rowContent = (
          <>
            <Avatar name={u.name} color={u.color} size={36} />
            <view style={{ marginLeft: "12px", flex: 1 }}>
              <view style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                <text style={{ color: colors.text, fontSize: "15px" }}>{u.name}</text>
                {pending ? (
                  <text
                    style={{
                      color: colors.primarySoftText,
                      fontSize: "11px",
                      backgroundColor: colors.primarySoft,
                      borderRadius: "6px",
                      paddingLeft: "6px",
                      paddingRight: "6px",
                      paddingTop: "1px",
                      paddingBottom: "1px",
                      marginLeft: "8px",
                    }}
                  >
                    Pendiente
                  </text>
                ) : null}
              </view>
              <text style={{ color: colors.textMuted, fontSize: "12px" }}>
                @{u.handle}
              </text>
            </view>
          </>
        );

        if (!editable) {
          return (
            <view
              key={u.id}
              accessibility-element={true}
              accessibility-label={`${u.name}, @${u.handle}${pending ? ", invitación pendiente" : ""}`}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                paddingTop: "10px",
                paddingBottom: "10px",
              }}
            >
              {rowContent}
            </view>
          );
        }

        return (
          <view
            key={u.id}
            accessibility-element={true}
            accessibility-label={`${u.name}, @${u.handle}${pending ? ", invitación pendiente" : ""}`}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              paddingTop: "6px",
              paddingBottom: "6px",
            }}
          >
            {rowContent}
            <Pressable
              label={`Quitar a ${u.name}`}
              traits="button"
              onTap={() => onRemove(u.id)}
              minTouch={true}
              style={{
                width: "44px",
                height: "44px",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <text
                accessibility-elements-hidden={true}
                style={{ color: colors.textMuted, fontSize: "20px" }}
              >
                ✕
              </text>
            </Pressable>
          </view>
        );
      })}
    </view>
  );
}

/* ---------- Notificaciones ---------- */

function NotificationsSection({
  channelId,
  editable,
  initial,
}: {
  channelId?: string;
  editable: boolean;
  initial: ChannelNotification[];
}) {
  const [notifications, setNotifications] = useState<ChannelNotification[]>(initial);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    if (sending || !channelId) return;
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const n = await api.call("createNotification", {
        id: channelId,
        title: title.trim(),
        description: desc,
        sourceApp: "yapi",
      });
      setNotifications((prev) => [n, ...prev]);
      setTitle("");
      setDesc("");
    } catch (e) {
      setError(describeError(e, "No se pudo publicar la notificación"));
    } finally {
      setSending(false);
    }
  }

  return (
    <view style={{ display: "flex", flexDirection: "column" }}>
      <text
        accessibility-heading={true}
        style={{
          color: colors.text,
          fontSize: "20px",
          fontWeight: "bold",
          marginTop: "12px",
          marginBottom: "8px",
        }}
      >
        Notificaciones
      </text>

      {/* El propietario puede publicar una notificación nueva. */}
      {editable && channelId ? (
        <view
          style={{
            backgroundColor: colors.surface,
            borderRadius: "12px",
            padding: "12px",
            marginBottom: "14px",
          }}
        >
          <input
            {...({ value: title } as Record<string, string>)}
            accessibility-label="Título de la notificación"
            style={{
              backgroundColor: colors.surfaceInput,
              borderRadius: "10px",
              height: "44px",
              color: colors.text,
              fontSize: "14px",
              paddingLeft: "12px",
              paddingRight: "12px",
              marginBottom: "8px",
            }}
            placeholder="Título"
            placeholder-color={colors.textFaint}
            bindinput={(e: InputEvent) => setTitle(e.detail.value)}
          />
          <input
            {...({ value: desc } as Record<string, string>)}
            accessibility-label="Descripción de la notificación"
            style={{
              backgroundColor: colors.surfaceInput,
              borderRadius: "10px",
              height: "44px",
              color: colors.text,
              fontSize: "14px",
              paddingLeft: "12px",
              paddingRight: "12px",
              marginBottom: "8px",
            }}
            placeholder="Descripción (opcional)"
            placeholder-color={colors.textFaint}
            bindinput={(e: InputEvent) => setDesc(e.detail.value)}
          />
          {error ? (
            <text style={{ color: colors.danger, fontSize: "12px", marginBottom: "8px" }}>
              {error}
            </text>
          ) : null}
          <Pressable
            label="Publicar notificación"
            onTap={publish}
            disabled={sending}
            style={{
              backgroundColor: colors.primary,
              borderRadius: "10px",
              paddingTop: "11px",
              paddingBottom: "11px",
              alignItems: "center",
            }}
          >
            <text
              accessibility-elements-hidden={true}
              style={{ color: colors.text, fontSize: "14px", fontWeight: "bold" }}
            >
              {sending ? "Publicando…" : "Publicar"}
            </text>
          </Pressable>
        </view>
      ) : null}

      {notifications.length === 0 ? (
        <text style={{ color: colors.textFaint, fontSize: "14px", marginTop: "8px" }}>
          Aún no se han enviado notificaciones.
        </text>
      ) : null}

      {notifications.map((n) => (
        <view
          key={n.id}
          accessibility-element={true}
          accessibility-label={`${n.title}. ${n.description}. Origen ${n.sourceApp}, ${n.timestamp}.`}
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: colors.surface,
            borderRadius: "14px",
            borderWidth: "1px",
            borderColor: colors.border,
            padding: "14px",
            marginBottom: "12px",
          }}
        >
          <view
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <text
              style={{
                color: colors.text,
                fontSize: "15px",
                fontWeight: "bold",
                flex: 1,
              }}
            >
              {n.title}
            </text>
            <text style={{ color: colors.textFaint, fontSize: "12px", marginLeft: "8px" }}>
              {n.timestamp}
            </text>
          </view>

          <text
            style={{
              color: colors.textSecondary,
              fontSize: "14px",
              marginTop: "6px",
              lineHeight: "20px",
            }}
          >
            {n.description}
          </text>

          <view
            style={{
              backgroundColor: colors.primarySoft,
              borderRadius: "8px",
              paddingLeft: "10px",
              paddingRight: "10px",
              paddingTop: "4px",
              paddingBottom: "4px",
              marginTop: "10px",
              alignSelf: "flex-start",
            }}
          >
            <text style={{ color: colors.primarySoftText, fontSize: "12px", fontWeight: "bold" }}>
              {n.sourceApp}
            </text>
          </view>
        </view>
      ))}
    </view>
  );
}

/* ---------- Integraciones ---------- */

function IntegrationsSection({ editable }: { editable: boolean }) {
  return (
    <view style={{ display: "flex", flexDirection: "column" }}>
      <text
        accessibility-heading={true}
        style={{
          color: colors.text,
          fontSize: "20px",
          fontWeight: "bold",
          marginTop: "12px",
        }}
      >
        Integraciones
      </text>
      <text style={{ color: colors.textFaint, fontSize: "14px", marginTop: "16px" }}>
        {editable
          ? "Aún no hay integraciones configuradas."
          : "Este canal no tiene integraciones."}
      </text>
    </view>
  );
}
