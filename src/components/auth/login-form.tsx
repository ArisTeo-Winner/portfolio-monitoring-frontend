"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { login } from "@/features/auth/api/login";
import { persistSession } from "@/features/auth/lib/session";
import { loginSchema } from "@/core/validation/schemas/auth.schemas";
import { mapApiError, mapZodError } from "@/core/validation/error-mapper";

type Props = {
  initialEmail?: string;
};

export function LoginForm({ initialEmail = "" }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => !email.trim() || !password.trim() || pending, [email, password, pending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setError(mapZodError(parsed.error));
      return;
    }

    setPending(true);

    try {
      const accessToken = await login(parsed.data);
      persistSession(accessToken);
      router.push("/portfolio");
      router.refresh();
    } catch (err) {
      setError(mapApiError(err, "No fue posible iniciar sesión."));
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
      <Input
        autoComplete="email"
        data-testid="email-input"
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
      <Input
        autoComplete="current-password"
        data-testid="password-input"
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
      <div className="flex justify-end">
        <button
          className="text-[0.75rem] font-medium text-[#8896a8] transition hover:text-[#19c37d]"
          onClick={() => setShowPassword((value) => !value)}
          suppressHydrationWarning
          type="button"
        >
          {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        </button>
      </div>
      <Button
        block
        className="h-12 rounded-xl bg-[#19c37d] py-0 text-[0.875rem] font-bold text-[#07130d] shadow-none hover:bg-[#22d08a] disabled:bg-[#205c45] disabled:text-[#98bea9] md:h-[3.55rem] md:rounded-[1rem] md:py-4 md:text-[1.02rem] md:shadow-[0_18px_40px_rgba(25,195,125,0.2)]"
        data-testid="submit-login"
        disabled={disabled}
        icon={<ArrowRightIcon />}
        type="submit"
      >
        {pending ? "Accediendo..." : "Acceder"}
      </Button>
    </form>
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
