"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { registerUser } from "@/features/auth/api/register";
import { registerSchema } from "@/core/validation/schemas/auth.schemas";
import { mapApiError, mapZodError } from "@/core/validation/error-mapper";

type Props = {
  onRegistered: (email: string) => void;
};

const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Una mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Una minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Un número", test: (value: string) => /[0-9]/.test(value) },
  { label: "Un símbolo (@#$%^&+=!)", test: (value: string) => /[@#$%^&+=!]/.test(value) },
] as const;

export function RegisterForm({ onRegistered }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
  const strength = getPasswordStrength(password, passwordScore);
  const disabled = useMemo(
    () => !firstName.trim() || !lastName.trim() || !username.trim() || !email.trim() || !password.trim() || pending,
    [email, firstName, lastName, password, pending, username],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      email: email.trim(),
      password,
    });

    if (!parsed.success) {
      setError(mapZodError(parsed.error));
      return;
    }

    setPending(true);

    try {
      await registerUser(parsed.data);
      onRegistered(parsed.data.email);
    } catch (err) {
      setError(mapApiError(err, "No fue posible crear la cuenta."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3 md:space-y-4" noValidate onSubmit={handleSubmit}>
      <ProblemAlert
        className="rounded-xl border border-[#4b1d28] bg-[#241217] px-3 py-2 text-[0.8125rem] text-[#ff8ea5] shadow-none md:rounded-[1rem] md:px-4 md:py-3 md:text-sm"
        message={error}
      />
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <Input
          autoComplete="given-name"
          hideLabel
          icon={<UserIcon />}
          inputClassName="text-[0.875rem] text-white placeholder:text-[#636c7a] md:text-[1.02rem]"
          label="Nombre"
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="Nombre"
          value={firstName}
          wrapperClassName="h-12 rounded-xl border border-[#2a2f37] bg-[#0f1116] px-3 py-0 shadow-none transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.18)] md:h-auto md:rounded-[1rem] md:px-4 md:py-[1.02rem] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
        />
        <Input
          autoComplete="family-name"
          hideLabel
          inputClassName="text-[0.875rem] text-white placeholder:text-[#636c7a] md:text-[1.02rem]"
          label="Apellido"
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Apellido"
          value={lastName}
          wrapperClassName="h-12 rounded-xl border border-[#2a2f37] bg-[#0f1116] px-3 py-0 shadow-none transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.18)] md:h-auto md:rounded-[1rem] md:px-4 md:py-[1.02rem] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
        />
      </div>
      <Input
        autoComplete="username"
        hideLabel
        icon={<UserIcon />}
        inputClassName="text-[0.875rem] text-white placeholder:text-[#636c7a] md:text-[1.02rem]"
        label="Usuario"
        onChange={(event) => setUsername(event.target.value)}
        placeholder="nombre_usuario"
        value={username}
        wrapperClassName="h-12 rounded-xl border border-[#2a2f37] bg-[#0f1116] px-3 py-0 shadow-none transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.18)] md:h-auto md:rounded-[1rem] md:px-4 md:py-[1.02rem] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
      />
      <Input
        autoComplete="email"
        hideLabel
        icon={<MailIcon />}
        inputClassName="text-[0.875rem] text-white placeholder:text-[#636c7a] md:text-[1.02rem]"
        label="Correo"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="tucorreo@ejemplo.com"
        type="email"
        value={email}
        wrapperClassName="h-12 rounded-xl border border-[#2a2f37] bg-[#0f1116] px-3 py-0 shadow-none transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.18)] md:h-auto md:rounded-[1rem] md:px-4 md:py-[1.02rem] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
      />
      <div className="space-y-2 md:space-y-3">
        <Input
          autoComplete="new-password"
          hideLabel
          icon={<LockIcon />}
          inputClassName="text-[0.875rem] text-white placeholder:text-[#636c7a] md:text-[1.02rem]"
          label="Contraseña"
          onChange={(event) => setPassword(event.target.value)}
          placeholder=".............."
          type={showPassword ? "text" : "password"}
          value={password}
          wrapperClassName="h-12 rounded-xl border border-[#2a2f37] bg-[#0f1116] px-3 py-0 shadow-none transition focus-within:border-[#246f54] focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.18)] md:h-auto md:rounded-[1rem] md:px-4 md:py-[1.02rem] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:focus-within:shadow-[0_0_0_1px_rgba(25,195,125,0.24)]"
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <button
            className="font-medium text-[#77808d] transition hover:text-[#19c37d]"
            onClick={() => setShowPassword((value) => !value)}
            suppressHydrationWarning
            type="button"
          >
            {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          </button>
          <span className={strength.badgeClass}>{strength.label}</span>
        </div>
        <div className="rounded-xl border border-[#232831] bg-[#11151b] px-3 py-2 shadow-none md:rounded-[1rem] md:px-4 md:py-3 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="h-1 overflow-hidden rounded-full bg-[#1b2028] md:h-1.5">
            <div className={strength.barClass} style={{ width: `${strength.width}%` }} />
          </div>
          <p className="mt-2 text-[0.6875rem] leading-4 text-[#727986] md:mt-3 md:text-xs md:leading-5">
            Usa mayúscula, minúscula, número y símbolo.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:mt-3 md:gap-2">
            {passwordChecks.map((rule) => (
              <div className="flex items-center gap-2 text-[0.6875rem] md:gap-2.5 md:text-xs" key={rule.label}>
                <span
                  className={
                    rule.valid
                      ? "flex h-4 w-4 items-center justify-center rounded-full bg-[#17392b] text-[9px] font-bold text-[#34d399] md:h-[1.125rem] md:w-[1.125rem] md:text-[10px]"
                      : "flex h-4 w-4 items-center justify-center rounded-full bg-[#1d2128] text-[9px] font-bold text-[#7b8390] md:h-[1.125rem] md:w-[1.125rem] md:text-[10px]"
                  }
                >
                  {rule.valid ? <CheckIcon className="h-2.5 w-2.5" /> : "-"}
                </span>
                <span className={rule.valid ? "text-[#b8e8d1]" : "text-[#818896]"}>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Button
        block
        className="h-12 rounded-xl bg-[#19c37d] py-0 text-[0.875rem] font-bold text-[#07130d] shadow-none hover:bg-[#22d08a] disabled:bg-[#205c45] disabled:text-[#98bea9] md:h-[3.55rem] md:rounded-[1rem] md:py-4 md:text-[1.02rem] md:shadow-[0_18px_40px_rgba(25,195,125,0.2)]"
        disabled={disabled}
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
      label: "Débil",
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M5 12.5 9.5 17 19 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
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
