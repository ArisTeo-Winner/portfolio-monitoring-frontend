export type MarkToMarketResponse = {
  valorCompra: number;
  valorHoy: number | null;
  valorAlVencimiento: number;
  mtmPnl: number | null;
  mtmPnlPct: number | null;
  tasaCompra: number | null;
  tasaHoy: number | null;
  diasRestantes: number;
  plazoSerieUsada: number | null;
  fechaValuacion: string;
  vencida: boolean;
};
