"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { SettingsSelect, SettingsToggle } from "@/components/settings/settings-controls";
import { SettingsActions, SettingsCard, SettingsField, SettingsHeader } from "@/components/settings/settings-layout";
import { getPreferences, updatePreferences } from "@/features/settings/api/settings";
import type { PreferencesSettings } from "@/features/settings/types/settings.types";

const preferencesSchema = z.object({
  autoSyncEnabled: z.boolean(),
  autoSyncFrequency: z.enum(["MANUAL", "15M", "1H", "6H", "24H"]),
  chartDefaultTimeframe: z.enum(["24H", "7D", "30D", "90D", "1Y", "ALL"]),
  dataProviderPriority: z.enum(["FIRST_AVAILABLE", "COINGECKO", "MANUAL"]),
  defaultCurrency: z.enum(["USD", "EUR", "MXN"]),
  pnlMethod: z.enum(["FIFO", "AVERAGE_COST"]),
});

const defaultValues: PreferencesSettings = {
  autoSyncEnabled: true,
  autoSyncFrequency: "1H",
  chartDefaultTimeframe: "30D",
  dataProviderPriority: "FIRST_AVAILABLE",
  defaultCurrency: "USD",
  pnlMethod: "FIFO",
};

export function PreferencesSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    formState: { isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<PreferencesSettings>({
    resolver: zodResolver(preferencesSchema),
    defaultValues,
  });

  useEffect(() => {
    let active = true;

    getPreferences()
      .then((preferences) => {
        if (active) reset(preferences);
      })
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las preferencias."),
      )
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reset]);

  async function onSubmit(values: PreferencesSettings) {
    setError(null);
    setSaved(false);

    try {
      const updated = await updatePreferences(values);
      reset({ ...values, ...updated });
      setSaved(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "No se pudieron guardar las preferencias.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <SettingsCard data-testid="settings-card-preferences">
        <SettingsHeader
          title="Preferencias del portfolio"
          description="Cálculo de PnL, moneda y datos por defecto."
          icon={<SlidersHorizontal className="text-blue-400" size={20} />}
        />

        {(error || saved) ? (
          <div className="px-5 pt-4 md:px-8">
            {error ? <ProblemAlert message={error} /> : null}
            {saved ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                Preferencias guardadas.
              </p>
            ) : null}
          </div>
        ) : null}

        <form data-testid="preferences-settings-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="divide-y divide-neutral-800">
            <SettingsField label="Metodo PnL">
              <SettingsSelect
                data-testid="pnl-method-select"
                disabled={loading}
                hideLabel
                label="PnL Method"
                options={[
                  { label: "FIFO", value: "FIFO" },
                  { label: "Average Cost", value: "AVERAGE_COST" },
                ]}
                {...register("pnlMethod")}
              />
            </SettingsField>
            <SettingsField label="Moneda por defecto">
              <SettingsSelect
                data-testid="default-currency-select"
                disabled={loading}
                hideLabel
                label="Default Currency"
                options={[
                  { label: "USD", value: "USD" },
                  { label: "EUR", value: "EUR" },
                  { label: "MXN", value: "MXN" },
                ]}
                {...register("defaultCurrency")}
              />
            </SettingsField>
            <SettingsField label="Rango grafico inicial">
              <SettingsSelect
                data-testid="chart-timeframe-select"
                disabled={loading}
                hideLabel
                label="Chart Default Timeframe"
                options={[
                  { label: "24H", value: "24H" },
                  { label: "7D", value: "7D" },
                  { label: "30D", value: "30D" },
                  { label: "90D", value: "90D" },
                  { label: "1Y", value: "1Y" },
                  { label: "All", value: "ALL" },
                ]}
                {...register("chartDefaultTimeframe")}
              />
            </SettingsField>
            <SettingsField label="Prioridad de proveedor">
              <SettingsSelect
                data-testid="data-provider-select"
                disabled={loading}
                hideLabel
                label="Data Provider Priority"
                options={[
                  { label: "First available", value: "FIRST_AVAILABLE" },
                  { label: "CoinGecko", value: "COINGECKO" },
                  { label: "Manual", value: "MANUAL" },
                ]}
                {...register("dataProviderPriority")}
              />
            </SettingsField>
            <SettingsField label="Frecuencia de sincronización">
              <SettingsSelect
                data-testid="sync-frequency-select"
                disabled={loading}
                hideLabel
                label="Auto-sync Frequency"
                options={[
                  { label: "Manual", value: "MANUAL" },
                  { label: "Every 15 minutes", value: "15M" },
                  { label: "Hourly", value: "1H" },
                  { label: "Every 6 hours", value: "6H" },
                  { label: "Daily", value: "24H" },
                ]}
                {...register("autoSyncFrequency")}
              />
            </SettingsField>
            <SettingsField label="Sincronización automática">
              <Controller
                control={control}
                name="autoSyncEnabled"
                render={({ field }) => (
                  <SettingsToggle
                    checked={field.value}
                    data-testid="auto-sync-toggle"
                    description="Allow the tracker to refresh integrations on schedule."
                    disabled={loading}
                    label="Auto-sync enabled"
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                )}
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
              {isSubmitting ? "Guardando..." : "Save preferences"}
            </Button>
          </SettingsActions>
        </form>
      </SettingsCard>
    </div>
  );
}
