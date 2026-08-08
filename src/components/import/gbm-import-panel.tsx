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
        description="Sube tus estados de cuenta o confirmaciones para importar transacciones automáticamente."
        title="Conectar Broker: GBM"
      />

      <div className={`${settingsDensity.contentCard} space-y-6`}>
        <GbmUploadSection
          docType="GBM_MONTHLY_STATEMENT"
          multiple={false}
          onImported={refreshPortfolio}
          subtitle="Para Smart Cash y Trading México"
          testId="gbm-monthly-statement"
          title="Cargar Estado de Cuenta Mensual (.pdf)"
        />

        <GbmUploadSection
          docType="DRIVEWEALTH_CONFIRMATION"
          multiple
          onImported={refreshPortfolio}
          subtitle="Para Trading Global / USA — Permite selección múltiple"
          testId="gbm-drivewealth-confirmation"
          title="Cargar Confirmaciones DriveWealth (.pdf)"
        />
      </div>
    </SettingsCard>
  );
}
