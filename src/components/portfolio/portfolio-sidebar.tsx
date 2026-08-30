"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SidebarGroup } from "@/components/portfolio/portfolio-sidebar-data";
import { formatCurrency } from "@/lib/utils/format";

export function PortfolioSidebar({
  activeType,
  defaultType,
  groups,
  totalValueLabel,
  onCreatePortfolio,
  onEditPortfolio,
  onRemovePortfolio,
  onSetDefault,
}: {
  activeType: string;
  defaultType: string | null;
  groups: SidebarGroup[];
  totalValueLabel: string;
  onCreatePortfolio: () => void;
  onEditPortfolio: (group: SidebarGroup) => void;
  onRemovePortfolio: (assetType: string) => void;
  onSetDefault: (assetType: string) => void;
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
              <p className="mt-1 text-[1rem] font-semibold tracking-[-0.03em] text-white max-sm:text-[1.35rem]">{totalValueLabel}</p>
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
                  const isDefault = group.assetType === defaultType;
                  return (
                    <PortfolioSidebarItem
                      active={active}
                      group={group}
                      isDefault={isDefault}
                      key={group.assetType}
                      onEdit={() => onEditPortfolio(group)}
                      onNavigate={() => router.push(`/portfolio?type=${group.assetType}`)}
                      onRemove={() => onRemovePortfolio(group.assetType)}
                      onSetDefault={() => onSetDefault(group.assetType)}
                    />
                  );
                })
              ) : (
                <div className="rounded-[1rem] bg-[#12151a] px-4 py-5 text-center shadow-[0_18px_36px_rgba(0,0,0,0.16)]">
                  <p className="text-[0.86rem] font-semibold text-white">Aún no hay portfolios activos</p>
                  <p className="mt-1.5 text-[0.76rem] leading-6 text-[#7f8aa3]">Registra una primera transacción para empezar a construirlos.</p>
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

// ─── Portfolio item with context menu ─────────────────────────────────────────

function PortfolioSidebarItem({
  group,
  active,
  isDefault,
  onNavigate,
  onEdit,
  onRemove,
  onSetDefault,
}: {
  group: SidebarGroup;
  active: boolean;
  isDefault: boolean;
  onNavigate: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onSetDefault: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function handleMenuToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }

  function handleAction(fn: () => void) {
    setMenuOpen(false);
    fn();
  }

  return (
    <div className="group relative">
      <button
        className={`w-full rounded-[1rem] px-4 py-3 text-left transition max-sm:px-3 max-sm:py-2.5 ${
          active
            ? "bg-[#151920] shadow-[0_16px_32px_rgba(0,0,0,0.2)]"
            : "bg-transparent hover:bg-[#13171d] hover:shadow-[0_14px_28px_rgba(0,0,0,0.14)]"
        }`}
        onClick={onNavigate}
        type="button"
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] shadow-[0_12px_30px_rgba(0,0,0,0.18)] max-sm:h-9 max-sm:w-9 max-sm:rounded-full"
            style={{ backgroundColor: group.avatar ? "transparent" : group.color }}
          >
            {group.avatar
              ? <span className="text-[1.35rem] leading-none">{group.avatar}</span>
              : <span className="text-[0.82rem] font-bold text-white">{group.label.slice(0, 1)}</span>
            }
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[0.9rem] font-semibold text-white">{group.label}</p>
              {isDefault && (
                <span className="shrink-0 rounded-full bg-[#1e2d4a] px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#3b82f6]">
                  Default
                </span>
              )}
            </div>
            <p className="mt-1 text-[0.76rem] text-[#7f8aa3] max-sm:mt-0.5">{formatCurrency(group.totalValue)}</p>
            <div className="mt-1 flex items-center justify-between max-sm:hidden">
              <p className="text-[0.72rem] text-[#5f6d82]">{group.entryCount} activos</p>
              <p className={`text-[0.74rem] font-semibold ${group.changePercent >= 0 ? "text-[#17c784]" : "text-[#ff6b6b]"}`}>
                {group.changePercent >= 0 ? "+" : ""}
                {group.changePercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </button>

      {/* ··· menu button */}
      <button
        aria-label="Opciones"
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[#5f6d82] opacity-0 transition hover:bg-[#1b2130] hover:text-white group-hover:opacity-100"
        onClick={handleMenuToggle}
        type="button"
      >
        <DotsIcon />
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <button
            aria-label="Cerrar menu"
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
            type="button"
          />
          <div
            ref={menuRef}
            className="absolute right-1 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-[0.85rem] border border-[#1f2430] bg-[#111317] py-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <ContextMenuItem icon={<EditIcon />} label="Editar" onClick={() => handleAction(onEdit)} />
            <ContextMenuItem
              icon={<StarIcon filled={isDefault} />}
              label={isDefault ? "Es el default" : "Set as default"}
              onClick={() => handleAction(onSetDefault)}
              muted={isDefault}
            />
            <div className="my-1 border-t border-[#1a1f29]" />
            <ContextMenuItem danger icon={<TrashIcon />} label="Eliminar" onClick={() => handleAction(onRemove)} />
          </div>
        </>
      )}
    </div>
  );
}

function ContextMenuItem({
  icon,
  label,
  onClick,
  danger = false,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-[0.82rem] font-medium transition ${
        danger
          ? "text-[#ff6b6b] hover:bg-[#ff6b6b]/10"
          : muted
          ? "cursor-default text-[#5f6d82]"
          : "text-[#c4cede] hover:bg-[#1b2130] hover:text-white"
      }`}
      disabled={muted}
      onClick={onClick}
      type="button"
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function DotsIcon() {
  return (
    <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg fill={filled ? "currentColor" : "none"} height="14" viewBox="0 0 24 24" width="14">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
