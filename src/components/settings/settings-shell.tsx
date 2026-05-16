"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { settingsDensity } from "@/features/settings/ui/settings-density";

const settingsNav = [
  { href: "/settings/account", label: "Cuenta" },
  { href: "/settings/security", label: "Seguridad" },
  { href: "/settings/sessions", label: "Sesiones" },
  { href: "/settings/preferences", label: "Preferencias" },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = settingsNav.find((item) => pathname.startsWith(item.href)) ?? settingsNav[0];

  return (
    <div data-testid="settings-page" className={settingsDensity.page}>
      <div className="mb-6">
        <label className="block md:hidden">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">Settings</span>
          <select
            className="h-11 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm font-medium text-neutral-100 outline-none transition duration-150 ease-out focus:border-blue-500"
            data-testid="settings-category-select"
            onChange={(event) => router.push(event.target.value)}
            value={activeItem.href}
          >
            {settingsNav.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <nav
          aria-label="Settings navigation"
          className="hidden overflow-x-auto border-b border-neutral-800 md:flex md:items-end md:gap-8"
        >
          {settingsNav.map((item) => {
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                className={cn(
                  "shrink-0 border-b px-1 py-3 text-sm font-medium transition duration-150 ease-out",
                  active ? "border-blue-500 text-blue-400" : "border-transparent text-neutral-500 hover:text-neutral-200",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="min-w-0">
        <div className={settingsDensity.pageInner}>{children}</div>
      </main>
    </div>
  );
}
