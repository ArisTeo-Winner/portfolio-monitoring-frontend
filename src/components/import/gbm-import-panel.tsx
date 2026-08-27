"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsCard, SettingsHeader } from "@/components/settings/settings-layout";
import { settingsDensity } from "@/features/settings/ui/settings-density";
import { GbmUploadSection } from "@/components/import/gbm-upload-section";
import { invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";

export function GbmImportPanel() {
  const queryClient = useQueryClient();

  const refreshPortfolio = useCallback(async () => {
    invalidatePortfolioCache();
    await queryClient.invalidateQueries({ queryKey: ["portfolio-holdings-performance"] });
    await queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
  }, [queryClient]);

  return (
    <SettingsCard data-testid="gbm-import-panel">
      <SettingsHeader
        description="Elige el canal según la moneda de tu operación: estado de cuenta mensual en pesos (MXN) o confirmaciones DriveWealth en dólares (USD)."
        title="Conectar broker: GBM"
      />

      <div className={settingsDensity.contentCard}>
        <GbmUploadSection onImported={refreshPortfolio} />
      </div>
    </SettingsCard>
  );
}
