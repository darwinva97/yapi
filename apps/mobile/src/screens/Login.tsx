import { useState } from "@lynx-js/react";

import { Pressable } from "../components/Pressable.jsx";
import { colors } from "../theme.js";
import { api, ContractError } from "../api.js";
import { setAuth, setUser } from "../session.js";
import {
  signInEmail,
  signUpEmail,
  signInWithGoogle,
  FirebaseAuthError,
  type FirebaseSession,
} from "../firebaseClient.js";
import { getSocialCredential, hasNativeSocial } from "../socialAuth.js";

type InputEvent = { detail: { value: string } };
type Mode = "login" | "register";
type Method = "correo" | "google";

const METHODS: { key: Method; label: string; icon: string }[] = [
  { key: "correo", label: "Correo", icon: "✉️" },
  { key: "google", label: "Google", icon: "G" },
];

function Field({
  label,
  placeholder,
  type,
  onInput,
  onConfirm,
}: {
  label: string;
  placeholder: string;
  type?: "text" | "password" | "email";
  onInput: (v: string) => void;
  onConfirm?: () => void;
}) {
  return (
    <view style={{ marginTop: "18px" }}>
      <text style={{ color: colors.textMuted, fontSize: "13px", marginBottom: "6px" }}>
        {label}
      </text>
      <input
        accessibility-label={label}
        style={{
          backgroundColor: colors.surface,
          borderRadius: "12px",
          height: "52px",
          color: colors.text,
          fontSize: "16px",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
        type={type ?? "text"}
        placeholder={placeholder}
        placeholder-color={colors.textFaint}
        bindinput={(e: InputEvent) => onInput(e.detail.value)}
        bindconfirm={onConfirm}
      />
    </view>
  );
}

export function Login({ onLogin }: { onLogin: () => void }) {
  const [method, setMethod] = useState<Method>("correo");
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const native = hasNativeSocial();

  function describeError(e: unknown): string {
    if (e instanceof FirebaseAuthError) return e.message;
    if (e instanceof ContractError) {
      return e.status === 0 ? "No se pudo conectar con el servidor" : e.message;
    }
    return "No se pudo iniciar sesión";
  }

  /** Tras autenticar en Firebase: guarda la sesión y carga el usuario del worker. */
  async function finish(session: FirebaseSession) {
    setAuth(session);
    const user = await api.call("me");
    setUser(user);
    onLogin();
  }

  async function submitCorreo() {
    if (loading) return;
    if (!email.trim() || !pass) {
      setError("Completa correo y contraseña");
      return;
    }
    if (mode === "register") {
      if (pass !== confirm) return setError("Las contraseñas no coinciden");
      if (pass.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    }
    setLoading(true);
    setError(null);
    try {
      const session =
        mode === "login"
          ? await signInEmail(email.trim(), pass)
          : await signUpEmail(email.trim(), pass);
      await finish(session);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle() {
    if (loading) return;
    if (!native) {
      setError("Google solo está disponible en la app del teléfono");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const googleIdToken = await getSocialCredential("google");
      if (!googleIdToken) {
        setError("No se obtuvo la credencial de Google");
        return;
      }
      const session = await signInWithGoogle(googleIdToken);
      await finish(session);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  function selectMethod(next: Method) {
    setMethod(next);
    setMode("login");
    setError(null);
  }

  const isLogin = mode === "login";
  const subtitle =
    method === "google"
      ? "Continuar con Google"
      : isLogin
        ? "Inicia sesión con tu correo"
        : "Crea tu cuenta con correo";

  return (
    <view
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.bg,
      }}
    >
      <scroll-view
        scroll-orientation="vertical"
        style={{ flex: 1, paddingLeft: "28px", paddingRight: "28px" }}
      >
        <view style={{ alignItems: "center", marginTop: "80px" }}>
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
            <text
              accessibility-elements-hidden={true}
              style={{ color: colors.text, fontSize: "40px", fontWeight: "bold" }}
            >
              y
            </text>
          </view>
          <text
            accessibility-heading={true}
            style={{ color: colors.text, fontSize: "30px", fontWeight: "bold", marginTop: "16px" }}
          >
            yapi
          </text>
          <text style={{ color: colors.textMuted, fontSize: "15px", marginTop: "6px" }}>
            {subtitle}
          </text>
        </view>

        {/* Selector de método */}
        <view
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            marginTop: "26px",
          }}
        >
          {METHODS.map((m) => {
            const active = method === m.key;
            return (
              <Pressable
                key={m.key}
                label={`Método: ${m.label}`}
                value={active ? "seleccionado" : undefined}
                onTap={() => selectMethod(m.key)}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                  borderRadius: "10px",
                  paddingTop: "9px",
                  paddingBottom: "9px",
                  paddingLeft: "16px",
                  paddingRight: "16px",
                  margin: "4px",
                }}
              >
                <text accessibility-elements-hidden={true} style={{ fontSize: "14px", marginRight: "6px" }}>
                  {m.icon}
                </text>
                <text
                  accessibility-elements-hidden={true}
                  style={{
                    color: active ? colors.primarySoftText : colors.textMuted,
                    fontSize: "14px",
                    fontWeight: active ? "bold" : "normal",
                  }}
                >
                  {m.label}
                </text>
              </Pressable>
            );
          })}
        </view>

        <view style={{ marginTop: "8px" }}>
          {method === "correo" ? (
            <>
              <Field
                label="Correo"
                placeholder="tu@correo.com"
                type="email"
                onInput={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                onConfirm={submitCorreo}
              />
              <Field
                label="Contraseña"
                placeholder="••••••"
                type="password"
                onInput={(v) => {
                  setPass(v);
                  setError(null);
                }}
                onConfirm={submitCorreo}
              />
              {!isLogin ? (
                <Field
                  label="Confirmar contraseña"
                  placeholder="••••••"
                  type="password"
                  onInput={(v) => {
                    setConfirm(v);
                    setError(null);
                  }}
                  onConfirm={submitCorreo}
                />
              ) : null}
            </>
          ) : (
            <text
              style={{
                color: colors.textMuted,
                fontSize: "14px",
                textAlign: "center",
                marginTop: "20px",
              }}
            >
              {native
                ? "Pulsa el botón para continuar con tu cuenta de Google."
                : "El inicio con Google está disponible en la app del teléfono."}
            </text>
          )}

          {error ? (
            <text
              accessibility-traits="updating"
              style={{ color: colors.danger, fontSize: "13px", marginTop: "12px" }}
            >
              {error}
            </text>
          ) : null}

          <Pressable
            label={
              method === "google"
                ? "Continuar con Google"
                : isLogin
                  ? "Entrar"
                  : "Crear cuenta"
            }
            onTap={method === "google" ? submitGoogle : submitCorreo}
            disabled={loading}
            style={{
              marginTop: "28px",
              backgroundColor: colors.primary,
              borderRadius: "12px",
              padding: "16px",
              alignItems: "center",
            }}
          >
            <text
              accessibility-elements-hidden={true}
              style={{ color: colors.text, fontSize: "17px", fontWeight: "bold" }}
            >
              {loading
                ? "Procesando…"
                : method === "google"
                  ? "Continuar con Google"
                  : isLogin
                    ? "Entrar"
                    : "Crear cuenta"}
            </text>
          </Pressable>

          {method === "correo" ? (
            <view
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                marginTop: "20px",
              }}
            >
              <text style={{ color: colors.textMuted, fontSize: "13px" }}>
                {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
              </text>
              <Pressable
                label={isLogin ? "Regístrate" : "Inicia sesión"}
                onTap={() => {
                  setMode(isLogin ? "register" : "login");
                  setError(null);
                }}
                hitSlop="10px"
                style={{ marginLeft: "6px" }}
              >
                <text
                  accessibility-elements-hidden={true}
                  style={{ color: colors.primary, fontSize: "13px", fontWeight: "bold" }}
                >
                  {isLogin ? "Regístrate" : "Inicia sesión"}
                </text>
              </Pressable>
            </view>
          ) : null}

          <view style={{ height: "32px" }} />
        </view>
      </scroll-view>
    </view>
  );
}
