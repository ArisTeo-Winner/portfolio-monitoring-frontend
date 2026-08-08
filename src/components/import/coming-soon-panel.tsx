"use client";

export function ComingSoonPanel() {
  return (
    <div
      className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-400"
      data-testid="gbm-import-coming-soon"
    >
      <p className="font-medium text-neutral-200">Próximamente</p>
      <p className="mt-1">
        Estamos trabajando en soportar el Estado de Cuenta Mensual. Por ahora, registra tus movimientos
        manualmente.
      </p>
    </div>
  );
}
