import { useState } from "@lynx-js/react";

import { Pressable } from "../components/Pressable.jsx";
import { colors } from "../theme.js";
import { api, ContractError } from "../api.js";
import { setSession } from "../session.js";
import { getSocialCredential, hasNativeSocial } from "../socialAuth.js";

type InputEvent = { detail: { value: string } };
type Mode = "login" | "register";
type Method = "usuario" | "correo" | "celular" | "google" | "facebook";

const METHODS: { key: Method; label: string; icon: string }[] = [
  { key: "usuario", label: "Usuario", icon: "👤" },
  { key: "correo", label: "Correo", icon: "✉️" },
  { key: "celular", label: "Celular", icon: "📱" },
  { key: "google", label: "Google", icon: "G" },
  { key: "facebook", label: "Facebook", icon: "f" },
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
  type?: "text" | "password" | "email" | "tel" | "number";
  onInput: (v: string) => void;
  onConfirm?: () => void;
}) {
  return (
    <view style={{ marginTop: "18px" }}>
      <text style={{ color: colors.textMuted, fontSize: "13px", marginBottom: "6px" }}>
        {label}
      </text>
      <input
        // Sin <label> nativo en Lynx: damos al input un nombre accesible explícito.
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
  const [method, setMethod] = useState<Method>("usuario");
  const [mode, setMode] = useState<Mode>("login");

  // Campos compartidos / por método.
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const native = hasNativeSocial();

  function describeError(e: unknown): string {
    if (e instanceof ContractError) {
      return e.status === 0 ? "No se pudo conectar con el servidor" : e.message;
    }
    return "No se pudo conectar con el servidor";
  }

  function finish(res: { token: string; user: Parameters<typeof setSession>[1] }) {
    setSession(res.token, res.user);
    onLogin();
  }

  // ---- Usuario (handle + contraseña) ----
  async function submitUsuario() {
    if (loading) return;
    if (!user.trim() || !pass) {
      setError("Completa usuario y contraseña");
      return;
    }
    if (mode === "register") {
      if (pass !== confirm) return setError("Las contraseñas no coinciden");
      if (pass.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    }
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === "login"
          ? await api.call("login", { handle: user.trim(), password: pass })
          : await api.call("register", {
              handle: user.trim(),
              name: user.trim(),
              email: email.trim() || undefined,
              password: pass,
            });
      finish(res);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  // ---- Correo (email + contraseña) ----
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
      const res =
        mode === "login"
          ? await api.call("emailLogin", { email: email.trim(), password: pass })
          : await api.call("emailRegister", {
              email: email.trim(),
              password: pass,
              name: name.trim() || undefined,
            });
      finish(res);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  // ---- Celular (OTP) ----
  async function submitPhoneStart() {
    if (loading) return;
    if (!phone.trim()) {
      setError("Ingresa tu número de celular");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.call("phoneStart", { phone: phone.trim() });
      setDevCode(res.devCode ?? null);
      setPhoneStep("code");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitPhoneVerify() {
    if (loading) return;
    if (!code.trim()) {
      setError("Ingresa el código que recibiste");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.call("phoneVerify", {
        phone: phone.trim(),
        code: code.trim(),
        name: name.trim() || undefined,
      });
      finish(res);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  // ---- Google / Facebook ----
  async function submitSocial(provider: "google" | "facebook") {
    if (loading) return;
    // En web (sin SDK nativo) usamos los campos correo/nombre como credencial mock.
    if (!native && !email.trim()) {
      setError("Ingresa un correo para simular el login social en web");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = await getSocialCredential(provider, {
        email: email.trim(),
        name: name.trim(),
      });
      if (!credential) {
        setError("No se obtuvo la credencial del proveedor");
        return;
      }
      const endpoint = provider === "google" ? "googleAuth" : "facebookAuth";
      const res = await api.call(endpoint, { credential });
      finish(res);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  function selectMethod(next: Method) {
    setMethod(next);
    setMode("login");
    setPhoneStep("phone");
    setDevCode(null);
    setError(null);
  }

  const supportsModes = method === "usuario" || method === "correo";
  const isLogin = mode === "login";

  const subtitle =
    method === "usuario"
      ? isLogin
        ? "Inicia sesión con tu usuario"
        : "Crea tu cuenta con usuario"
      : method === "correo"
        ? isLogin
          ? "Inicia sesión con tu correo"
          : "Crea tu cuenta con correo"
        : method === "celular"
          ? "Inicia sesión con tu celular"
          : method === "google"
            ? "Continuar con Google"
            : "Continuar con Facebook";

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
        <view style={{ alignItems: "center", marginTop: "70px" }}>
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

        {/* Selector de método de autenticación */}
        <view
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
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
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  margin: "4px",
                }}
              >
                <text
                  accessibility-elements-hidden={true}
                  style={{ fontSize: "14px", marginRight: "6px" }}
                >
                  {m.icon}
                </text>
                <text
                  accessibility-elements-hidden={true}
                  style={{
                    color: active ? colors.primarySoftText : colors.textMuted,
                    fontSize: "13px",
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
          {/* ---- Usuario ---- */}
          {method === "usuario" ? (
            <>
              <Field
                label="Usuario"
                placeholder={isLogin ? "admin" : "elige un usuario único"}
                onInput={(v) => {
                  setUser(v);
                  setError(null);
                }}
                onConfirm={submitUsuario}
              />
              <Field
                label="Contraseña"
                placeholder="••••••"
                type="password"
                onInput={(v) => {
                  setPass(v);
                  setError(null);
                }}
                onConfirm={submitUsuario}
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
                  onConfirm={submitUsuario}
                />
              ) : null}
            </>
          ) : null}

          {/* ---- Correo ---- */}
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
              {!isLogin ? (
                <Field
                  label="Nombre (opcional)"
                  placeholder="Tu nombre"
                  onInput={(v) => {
                    setName(v);
                    setError(null);
                  }}
                  onConfirm={submitCorreo}
                />
              ) : null}
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
          ) : null}

          {/* ---- Celular ---- */}
          {method === "celular" ? (
            phoneStep === "phone" ? (
              <Field
                label="Número de celular"
                placeholder="+51 999 999 999"
                type="tel"
                onInput={(v) => {
                  setPhone(v);
                  setError(null);
                }}
                onConfirm={submitPhoneStart}
              />
            ) : (
              <>
                <Field
                  label={`Código enviado a ${phone}`}
                  placeholder="123456"
                  type="number"
                  onInput={(v) => {
                    setCode(v);
                    setError(null);
                  }}
                  onConfirm={submitPhoneVerify}
                />
                <Field
                  label="Nombre (opcional, primera vez)"
                  placeholder="Tu nombre"
                  onInput={(v) => {
                    setName(v);
                    setError(null);
                  }}
                  onConfirm={submitPhoneVerify}
                />
                {devCode ? (
                  <text
                    accessibility-traits="updating"
                    style={{ color: colors.success, fontSize: "13px", marginTop: "12px" }}
                  >
                    Código de prueba: {devCode}
                  </text>
                ) : null}
                <Pressable
                  label="Cambiar número"
                  onTap={() => {
                    setPhoneStep("phone");
                    setCode("");
                    setDevCode(null);
                    setError(null);
                  }}
                  hitSlop="10px"
                  style={{ marginTop: "12px" }}
                >
                  <text
                    accessibility-elements-hidden={true}
                    style={{ color: colors.primary, fontSize: "13px" }}
                  >
                    ← Cambiar número
                  </text>
                </Pressable>
              </>
            )
          ) : null}

          {/* ---- Google / Facebook ---- */}
          {method === "google" || method === "facebook" ? (
            native ? (
              <text
                style={{
                  color: colors.textMuted,
                  fontSize: "14px",
                  textAlign: "center",
                  marginTop: "20px",
                }}
              >
                Pulsa el botón para continuar con{" "}
                {method === "google" ? "Google" : "Facebook"}.
              </text>
            ) : (
              <>
                <text
                  style={{ color: colors.textFaint, fontSize: "12px", marginTop: "16px" }}
                >
                  En web no hay SDK nativo: simula el login indicando el correo
                  (y nombre) de la cuenta {method === "google" ? "Google" : "Facebook"}.
                </text>
                <Field
                  label="Correo de la cuenta"
                  placeholder="tu@gmail.com"
                  type="email"
                  onInput={(v) => {
                    setEmail(v);
                    setError(null);
                  }}
                  onConfirm={() => submitSocial(method as "google" | "facebook")}
                />
                <Field
                  label="Nombre (opcional)"
                  placeholder="Tu nombre"
                  onInput={(v) => {
                    setName(v);
                    setError(null);
                  }}
                  onConfirm={() => submitSocial(method as "google" | "facebook")}
                />
              </>
            )
          ) : null}

          {error ? (
            <text
              accessibility-traits="updating"
              style={{ color: colors.danger, fontSize: "13px", marginTop: "12px" }}
            >
              {error}
            </text>
          ) : null}

          {/* Botón de acción principal según el método */}
          <PrimaryButton
            method={method}
            mode={mode}
            phoneStep={phoneStep}
            loading={loading}
            onUsuario={submitUsuario}
            onCorreo={submitCorreo}
            onPhoneStart={submitPhoneStart}
            onPhoneVerify={submitPhoneVerify}
            onSocial={submitSocial}
          />

          {/* Alternar login/registro (solo usuario y correo) */}
          {supportsModes ? (
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

          {method === "usuario" && isLogin ? (
            <text
              style={{
                color: colors.textFaint,
                fontSize: "12px",
                textAlign: "center",
                marginTop: "16px",
              }}
            >
              Demo: admin / 123456
            </text>
          ) : null}

          <view style={{ height: "32px" }} />
        </view>
      </scroll-view>
    </view>
  );
}

function PrimaryButton({
  method,
  mode,
  phoneStep,
  loading,
  onUsuario,
  onCorreo,
  onPhoneStart,
  onPhoneVerify,
  onSocial,
}: {
  method: Method;
  mode: Mode;
  phoneStep: "phone" | "code";
  loading: boolean;
  onUsuario: () => void;
  onCorreo: () => void;
  onPhoneStart: () => void;
  onPhoneVerify: () => void;
  onSocial: (p: "google" | "facebook") => void;
}) {
  let label: string;
  let onTap: () => void;

  if (method === "usuario") {
    label = mode === "login" ? "Entrar" : "Crear cuenta";
    onTap = onUsuario;
  } else if (method === "correo") {
    label = mode === "login" ? "Entrar" : "Crear cuenta";
    onTap = onCorreo;
  } else if (method === "celular") {
    label = phoneStep === "phone" ? "Enviar código" : "Verificar";
    onTap = phoneStep === "phone" ? onPhoneStart : onPhoneVerify;
  } else if (method === "google") {
    label = "Continuar con Google";
    onTap = () => onSocial("google");
  } else {
    label = "Continuar con Facebook";
    onTap = () => onSocial("facebook");
  }

  return (
    <Pressable
      label={label}
      onTap={onTap}
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
        {loading ? "Procesando…" : label}
      </text>
    </Pressable>
  );
}
