"use client";

import { useRouter } from "next/navigation";
import type { SidebarGroup } from "@/components/portfolio/portfolio-sidebar-data";
import { formatCurrency } from "@/lib/utils/format";

export function PortfolioSidebar({
  activeType,
  groups,
  totalValue,
  onCreatePortfolio,
}: {
  activeType: string;
  groups: SidebarGroup[];
  totalValue: number;
  createdCount: number;
  onCreatePortfolio: () => void;
}) {
  const router = useRouter();

  return (
    <aside className="w-full lg:sticky lg:top-[6.5rem] lg:self-start">
      <div className="overflow-hidden rounded-[1.65rem] bg-[#0d1014] shadow-[0_26px_70px_rgba(0,0,0,0.36)] max-sm:rounded-none max-sm:border-b max-sm:border-[#1f2229] max-sm:bg-[#111317] max-sm:shadow-none">
        <div className="px-5 pb-5 pt-6 max-sm:px-4 max-sm:py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[#15181e] text-white shadow-[0_16px_36px_rgba(0,0,0,0.22)] max-sm:h-9 max-sm:w-9 max-sm:rounded-[0.8rem]">
              <GridIcon className="h-4.5 w-4.5 max-sm:h-4 max-sm:w-4" />
            </span>
            <div>
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#71819b] max-sm:text-[0.68rem] max-sm:tracking-[0.18em]">Resumen</p>
              <p className="mt-1 text-[1rem] font-semibold tracking-[-0.03em] text-white max-sm:text-[1.35rem]">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-4 py-5 max-sm:space-y-3 max-sm:px-4 max-sm:pb-4 max-sm:pt-0">
          <button
            className={`w-full rounded-[1.15rem] px-4 py-4 text-left transition max-sm:hidden ${
              !activeType
                ? "bg-[#101916] shadow-[0_18px_36px_rgba(0,0,0,0.2)]"
                : "bg-[#12151a] shadow-[0_18px_36px_rgba(0,0,0,0.18)] hover:bg-[#151920]"
            }`}
            onClick={() => router.push("/portfolio")}
            type="button"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-[#17c784]/12 text-[#17c784]">
                <PulseIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[0.95rem] font-semibold text-white">Overview</p>
                <p className="mt-1 text-[0.78rem] text-[#7f8aa3]">Vista consolidada de tu wallet</p>
              </div>
            </div>
          </button>

          <div>
            <div className="mb-3 flex items-center justify-between px-1 max-sm:mb-2">
              <p className="text-[0.76rem] font-medium uppercase tracking-[0.18em] text-[#71819b] max-sm:text-[0.68rem] max-sm:tracking-[0.16em]">Mis portfolios</p>
              <span className="rounded-full bg-[#15181e] px-2.5 py-1 text-[0.72rem] font-semibold text-[#d7dfeb] shadow-[0_10px_24px_rgba(0,0,0,0.16)] max-sm:px-2 max-sm:py-0.5 max-sm:text-[0.68rem]">
                {groups.length}
              </span>
            </div>

            <div className="space-y-2 max-sm:space-y-1">
              {groups.length ? (
                groups.map((group) => {
                  const active = group.assetType === activeType;
                  return (
                    <button
                      className={`w-full rounded-[1rem] px-4 py-3 text-left transition max-sm:px-3 max-sm:py-2.5 ${
                        active
                          ? "bg-[#151920] shadow-[0_16px_32px_rgba(0,0,0,0.2)]"
                          : "bg-transparent hover:bg-[#13171d] hover:shadow-[0_14px_28px_rgba(0,0,0,0.14)]"
                      }`}
                      key={group.assetType}
                      onClick={() => router.push(`/portfolio?type=${group.assetType}`)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] text-[0.82rem] font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] max-sm:h-9 max-sm:w-9 max-sm:rounded-full"
                          style={{ backgroundColor: group.color }}
                        >
                          {group.label.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-[0.9rem] font-semibold text-white">{group.label}</p>
                            <p className={`text-[0.74rem] font-semibold ${group.changePercent >= 0 ? "text-[#17c784]" : "text-[#ff6b6b]"}`}>
                              {group.changePercent >= 0 ? "+" : ""}
                              {group.changePercent.toFixed(2)}%
                            </p>
                          </div>
                          <p className="mt-1 text-[0.76rem] text-[#7f8aa3] max-sm:mt-0.5">{formatCurrency(group.totalValue)}</p>
                          <p className="mt-1 text-[0.72rem] text-[#5f6d82] max-sm:hidden">{group.entryCount} activos registrados</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1rem] bg-[#12151a] px-4 py-5 text-center shadow-[0_18px_36px_rgba(0,0,0,0.16)]">
                  <p className="text-[0.86rem] font-semibold text-white">Aun no hay portfolios activos</p>
                  <p className="mt-1.5 text-[0.76rem] leading-6 text-[#7f8aa3]">Registra una primera transaccion para empezar a construirlos.</p>
                </div>
              )}
            </div>
          </div>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-[#12151a] px-4 py-3 text-[0.86rem] font-semibold text-[#b4c0d4] shadow-[0_18px_36px_rgba(0,0,0,0.16)] transition hover:bg-[#14191d] hover:text-white max-sm:hidden"
            onClick={onCreatePortfolio}
            type="button"
          >
            <PlusIcon className="h-4 w-4" />
            Crear portfolio
          </button>
        </div>
      </div>
    </aside>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z" />
    </svg>
  );
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M3 12h4l2.1-4.5L12.6 16l2.4-5H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
