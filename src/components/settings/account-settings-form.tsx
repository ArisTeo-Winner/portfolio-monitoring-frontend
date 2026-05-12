"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { SettingsSelect } from "@/components/settings/settings-controls";
import { SettingsActions, SettingsCard, SettingsField, SettingsHeader } from "@/components/settings/settings-layout";
import { getAccountSettings, updateAccountSettings } from "@/features/settings/api/settings";

const accountSchema = z.object({
  baseCurrency: z.enum(["USD", "EUR", "MXN"]),
  email: z.string().email("Ingresa un email valido."),
  timezone: z.string().min(1, "Selecciona una zona horaria."),
  username: z.string().min(2, "Minimo 2 caracteres.").max(80, "Maximo 80 caracteres."),
});

type AccountFormValues = z.infer<typeof accountSchema>;

const currencyOptions = [
  { label: "USD - US Dollar", value: "USD" },
  { label: "EUR - Euro", value: "EUR" },
  { label: "MXN - Mexican Peso", value: "MXN" },
];

const fallbackTimezones = ["America/Mexico_City", "America/New_York", "America/Los_Angeles", "UTC"];

export function AccountSettingsForm() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  const {
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      baseCurrency: "USD",
      email: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      username: "",
    },
  });

  useEffect(() => {
    let active = true;

    getAccountSettings()
      .then((account) => {
        if (!active) return;
        reset({
          baseCurrency: normalizeCurrency(account.baseCurrency),
          email: account.email ?? "",
          timezone: account.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          username: account.username ?? "",
        });
      })
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la cuenta."),
      )
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reset]);

  async function onSubmit(values: AccountFormValues) {
    setError(null);
    setSaved(false);

    try {
      const updated = await updateAccountSettings(values);
      reset({
        baseCurrency: normalizeCurrency(updated.baseCurrency ?? values.baseCurrency),
        email: updated.email ?? values.email,
        timezone: updated.timezone ?? values.timezone,
        username: updated.username ?? values.username,
      });
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la cuenta.");
    }
  }

  return (
    <div className="space-y-4">
      <SettingsCard data-testid="settings-card-account">
        <SettingsHeader
          title="Usuario"
          description="Identidad y datos regionales de tu tracker."
        />

        {(error || saved) ? (
          <div className="px-5 pt-4 md:px-8">
            {error ? <ProblemAlert message={error} /> : null}
            {saved ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                Configuración guardada.
              </p>
            ) : null}
          </div>
        ) : null}

        <form data-testid="account-settings-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="divide-y divide-neutral-800">
            <SettingsField label="Nombre de usuario">
              <Input
                data-testid="username-input"
                disabled={loading}
                error={errors.username?.message}
                hideLabel
                icon={<UserRound size={20} />}
                label="Username"
                placeholder="debra"
                wrapperClassName="bg-neutral-950"
                {...register("username")}
              />
            </SettingsField>
            <SettingsField label="Correo electronico">
              <Input
                data-testid="email-input"
                disabled={loading}
                error={errors.email?.message}
                hideLabel
                icon={<Mail size={20} />}
                label="Email"
                placeholder="you@example.com"
                type="email"
                wrapperClassName="bg-neutral-950"
                {...register("email")}
              />
            </SettingsField>
            <SettingsField label="Moneda base">
              <SettingsSelect
                data-testid="base-currency-select"
                disabled={loading}
                error={errors.baseCurrency?.message}
                hideLabel
                label="Base Currency"
                options={currencyOptions}
                {...register("baseCurrency")}
              />
            </SettingsField>
            <SettingsField label="Zona horaria">
              <SettingsSelect
                data-testid="timezone-select"
                disabled={loading}
                error={errors.timezone?.message}
                hideLabel
                label="Timezone"
                options={timezoneOptions}
                {...register("timezone")}
              />
            </SettingsField>
          </div>

          <SettingsActions>
            <Button
              className="h-12 rounded-2xl font-semibold"
              data-testid="settings-reset-button"
              disabled={loading || isSubmitting || !isDirty}
              onClick={() => reset()}
              type="button"
              variant="secondary"
            >
              Reset
            </Button>
            <Button
              className="h-12 rounded-2xl font-semibold"
              data-testid="settings-save-button"
              disabled={loading || isSubmitting || !isDirty}
              type="submit"
            >
              {isSubmitting ? "Guardando..." : "Save changes"}
            </Button>
          </SettingsActions>
        </form>
      </SettingsCard>
    </div>
  );
}

function normalizeCurrency(value?: string) {
  return value === "EUR" || value === "MXN" || value === "USD" ? value : "USD";
}

function getTimezoneOptions() {
  const timezones =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : fallbackTimezones;
  return timezones.map((timezone) => ({ label: timezone, value: timezone }));
}
