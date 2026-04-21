"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { registerUser } from "@/features/auth/api/register";
import { ApiError, getProblemMessage } from "@/lib/api/problem-details";

type Props = {
  onRegistered: (email: string) => void;
};

const PASSWORD_RULES = [
  { label: "Minimo 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Una mayuscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Una minuscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Un numero", test: (value: string) => /[0-9]/.test(value) },
  { label: "Un simbolo (@#$%^&+=!)", test: (value: string) => /[@#$%^&+=!]/.test(value) },
] as const;

export function RegisterForm({ onRegistered }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ label: rule.label, valid: rule.test(password) })),
    [password],
  );
  const passwordScore = passwordChecks.filter((rule) => rule.valid).length;
  const passwordValid = passwordChecks.every((rule) => rule.valid);
  const strength = getPasswordStrength(password, passwordScore);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError("La contrasena debe incluir mayuscula, minuscula, numero y simbolo antes de enviarse.");
      return;
    }

    setPending(true);

    try {
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      onRegistered(email.trim());
    } catch (err) {
      setError(err instanceof ApiError ? getProblemMessage(err) : "No fue posible crear la cuenta.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <ProblemAlert
        className="rounded-[1rem] border border-[#4b1d28] bg-[#241217] px-4 py-3 text-sm text-[#ff8ea5] shadow-none"
        message={error}
      />
      <Input
        autoComplete="username"
        hideLabel
        icon={<UserIcon />}
        inputClassName="text-[1.02rem] text-white placeholder:text-[#636c7a]"
        label="Nombre completo"
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Nombre completo"
        value={username}
        wrapperClassName="rounded-[1rem] border border-[#2a2f37] bg-[#0f1116] px-4 py-[1.02rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
      />
      <Input
        autoComplete="email"
        hideLabel
        icon={<MailIcon />}
        inputClassName="text-[1.02rem] text-white placeholder:text-[#636c7a]"
        label="Correo"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="tucorreo@ejemplo.com"
        type="email"
        value={email}
        wrapperClassName="rounded-[1rem] border border-[#2a2f37] bg-[#0f1116] px-4 py-[1.02rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
      />
      <div className="space-y-3">
        <Input
          autoComplete="new-password"
          hideLabel
          icon={<LockIcon />}
          inputClassName="text-[1.02rem] text-white placeholder:text-[#636c7a]"
          label="Contrasena"
          onChange={(event) => setPassword(event.target.value)}
          placeholder=".............."
          type={showPassword ? "text" : "password"}
          value={password}
          wrapperClassName="rounded-[1rem] border border-[#2a2f37] bg-[#0f1116] px-4 py-[1.02rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <button
            className="font-medium text-[#77808d] transition hover:text-[#19c37d]"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
          </button>
          <span className={strength.badgeClass}>{strength.label}</span>
        </div>
        <div className="rounded-[1rem] border border-[#232831] bg-[#12151b] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1b2028]">
            <div className={strength.barClass} style={{ width: `${strength.width}%` }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-[#727986]">
            Usa mayuscula, minuscula, numero y simbolo para cumplir la validacion del backend.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {passwordChecks.map((rule) => (
              <div className="flex items-center gap-2.5 text-xs" key={rule.label}>
                <span
                  className={
                    rule.valid
                      ? "flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-[#17392b] text-[10px] font-bold text-[#34d399]"
                      : "flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-[#1d2128] text-[10px] font-bold text-[#7b8390]"
                  }
                >
                  {rule.valid ? "Y" : "-"}
                </span>
                <span className={rule.valid ? "text-[#b8e8d1]" : "text-[#818896]"}>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Button
        block
        className="h-[3.55rem] rounded-[1rem] bg-[#19c37d] py-4 text-[1.02rem] font-bold text-[#07130d] shadow-[0_18px_40px_rgba(25,195,125,0.2)] hover:bg-[#22d08a] disabled:bg-[#205c45] disabled:text-[#98bea9]"
        disabled={!username.trim() || !email.trim() || !password.trim() || !passwordValid || pending}
        icon={<ArrowRightIcon />}
        type="submit"
      >
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
    </form>
  );
}

function getPasswordStrength(password: string, score: number) {
  if (!password) {
    return {
      label: "Pendiente",
      width: 0,
      barClass: "h-full rounded-full bg-[#2d333d] transition-all",
      badgeClass: "rounded-full bg-[#1a1f27] px-3 py-1 text-[11px] font-semibold text-[#8b92a0]",
    };
  }

  if (score <= 2) {
    return {
      label: "Debil",
      width: 33,
      barClass: "h-full rounded-full bg-[#ef4444] transition-all",
      badgeClass: "rounded-full bg-[#31151b] px-3 py-1 text-[11px] font-semibold text-[#ff8ea5]",
    };
  }

  if (score <= 4) {
    return {
      label: "Media",
      width: 66,
      barClass: "h-full rounded-full bg-[#f59e0b] transition-all",
      badgeClass: "rounded-full bg-[#35260f] px-3 py-1 text-[11px] font-semibold text-[#f9c46b]",
    };
  }

    return {
      label: "Fuerte",
      width: 100,
      barClass: "h-full rounded-full bg-[#19c37d] transition-all",
      badgeClass: "rounded-full bg-[#153225] px-3 py-1 text-[11px] font-semibold text-[#66f0b1]",
    };
  }

function UserIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Zm1.7.1 6.1 4.7a.35.35 0 0 0 .4 0l6.1-4.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M7 10V8a5 5 0 1 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M5 12h13m-4-4 4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
