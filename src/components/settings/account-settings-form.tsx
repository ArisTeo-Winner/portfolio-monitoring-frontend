"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
  firstName: z.string().max(60, "Máximo 60 caracteres.").optional(),
  lastName: z.string().max(60, "Máximo 60 caracteres.").optional(),
  phoneNumber: z.string().max(30, "Máximo 30 caracteres.").optional(),
  address: z.string().max(120, "Máximo 120 caracteres.").optional(),
  city: z.string().max(80, "Máximo 80 caracteres.").optional(),
  state: z.string().max(80, "Máximo 80 caracteres.").optional(),
  postalCode: z.string().max(20, "Máximo 20 caracteres.").optional(),
  country: z.string().max(80, "Máximo 80 caracteres.").optional(),
  dateOfBirth: z.date({ invalid_type_error: "Fecha inválida." }).nullable().optional(),
  preferredCurrency: z.enum(["USD", "EUR", "MXN"]),
  timezone: z.string().min(1, "Selecciona una zona horaria."),
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
      firstName: "",
      lastName: "",
      phoneNumber: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      dateOfBirth: null,
      preferredCurrency: "USD",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
  });

  useEffect(() => {
    let active = true;

    getAccountSettings()
      .then((account) => {
        if (!active) return;
        reset({
          firstName: account.firstName ?? "",
          lastName: account.lastName ?? "",
          phoneNumber: account.phoneNumber ?? "",
          address: account.address ?? "",
          city: account.city ?? "",
          state: account.state ?? "",
          postalCode: account.postalCode ?? "",
          country: account.country ?? "",
          dateOfBirth: account.dateOfBirth ? new Date(account.dateOfBirth) : null,
          preferredCurrency: normalizeCurrency(account.preferredCurrency),
          timezone: account.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
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

    const payload = {
      ...values,
      dateOfBirth: values.dateOfBirth ? toISODate(values.dateOfBirth) : null,
    };

    try {
      const updated = await updateAccountSettings(payload);
      reset({
        firstName: updated.firstName ?? values.firstName,
        lastName: updated.lastName ?? values.lastName,
        phoneNumber: updated.phoneNumber ?? values.phoneNumber,
        address: updated.address ?? values.address,
        city: updated.city ?? values.city,
        state: updated.state ?? values.state,
        postalCode: updated.postalCode ?? values.postalCode,
        country: updated.country ?? values.country,
        dateOfBirth: updated.dateOfBirth ? new Date(updated.dateOfBirth) : (values.dateOfBirth ?? null),
        preferredCurrency: normalizeCurrency(updated.preferredCurrency ?? values.preferredCurrency),
        timezone: updated.timezone ?? values.timezone,
      });
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la cuenta.");
    }
  }

  const inputClass = "bg-neutral-950";

  return (
    <div className="space-y-4">
      <SettingsCard data-testid="settings-card-account">
        <SettingsHeader
          title="Perfil"
          description="Información personal y datos regionales de tu cuenta."
        />

        {(error || saved) ? (
          <div className="px-5 pt-4 md:px-8">
            {error ? <ProblemAlert message={error} /> : null}
            {saved ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                Perfil actualizado correctamente.
              </p>
            ) : null}
          </div>
        ) : null}

        <form data-testid="account-settings-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="divide-y divide-neutral-800">

            <SettingsField label="Nombre">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  data-testid="first-name-input"
                  disabled={loading}
                  error={errors.firstName?.message}
                  hideLabel
                  label="Nombre"
                  placeholder="Aristeo"
                  wrapperClassName={inputClass}
                  {...register("firstName")}
                />
                <Input
                  data-testid="last-name-input"
                  disabled={loading}
                  error={errors.lastName?.message}
                  hideLabel
                  label="Apellido"
                  placeholder="Ortiz"
                  wrapperClassName={inputClass}
                  {...register("lastName")}
                />
              </div>
            </SettingsField>

            <SettingsField label="Teléfono">
              <Input
                data-testid="phone-input"
                disabled={loading}
                error={errors.phoneNumber?.message}
                hideLabel
                label="Teléfono"
                placeholder="+52 55 1234 5678"
                type="tel"
                wrapperClassName={inputClass}
                {...register("phoneNumber")}
              />
            </SettingsField>

            <SettingsField label="Dirección">
              <Input
                data-testid="address-input"
                disabled={loading}
                error={errors.address?.message}
                hideLabel
                label="Dirección"
                placeholder="Av. Vallarta 1234"
                wrapperClassName={inputClass}
                {...register("address")}
              />
            </SettingsField>

            <SettingsField label="Ciudad / Estado">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  data-testid="city-input"
                  disabled={loading}
                  error={errors.city?.message}
                  hideLabel
                  label="Ciudad"
                  placeholder="Ciudad de México"
                  wrapperClassName={inputClass}
                  {...register("city")}
                />
                <Input
                  data-testid="state-input"
                  disabled={loading}
                  error={errors.state?.message}
                  hideLabel
                  label="Estado"
                  placeholder="Jalisco"
                  wrapperClassName={inputClass}
                  {...register("state")}
                />
              </div>
            </SettingsField>

            <SettingsField label="Código postal / País">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  data-testid="postal-code-input"
                  disabled={loading}
                  error={errors.postalCode?.message}
                  hideLabel
                  label="Código postal"
                  placeholder="44100"
                  wrapperClassName={inputClass}
                  {...register("postalCode")}
                />
                <Input
                  data-testid="country-input"
                  disabled={loading}
                  error={errors.country?.message}
                  hideLabel
                  label="País"
                  placeholder="México"
                  wrapperClassName={inputClass}
                  {...register("country")}
                />
              </div>
            </SettingsField>

            <SettingsField label="Fecha de nacimiento">
              <Input
                data-testid="date-of-birth-input"
                disabled={loading}
                error={errors.dateOfBirth?.message}
                hideLabel
                inputClassName="[color-scheme:dark]"
                label="Fecha de nacimiento"
                max={new Date().toISOString().split("T")[0]}
                type="date"
                wrapperClassName={inputClass}
                {...register("dateOfBirth", { valueAsDate: true })}
              />
            </SettingsField>

            <SettingsField label="Moneda base">
              <SettingsSelect
                data-testid="base-currency-select"
                disabled={loading}
                error={errors.preferredCurrency?.message}
                hideLabel
                label="Moneda base"
                options={currencyOptions}
                {...register("preferredCurrency")}
              />
            </SettingsField>

            <SettingsField label="Zona horaria">
              <SettingsSelect
                data-testid="timezone-select"
                disabled={loading}
                error={errors.timezone?.message}
                hideLabel
                label="Zona horaria"
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
              Cancelar
            </Button>
            <Button
              className="h-12 rounded-2xl font-semibold"
              data-testid="settings-save-button"
              disabled={loading || isSubmitting || !isDirty}
              type="submit"
            >
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </SettingsActions>
        </form>
      </SettingsCard>
    </div>
  );
}

function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeCurrency(value?: string) {
  return value === "EUR" || value === "MXN" || value === "USD" ? value : "USD";
}

function getTimezoneOptions() {
  const timezones =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : fallbackTimezones;
  return timezones.map((timezone) => ({ label: timezone, value: timezone }));
}
