# ADR-0012 / Spec — Indicador de Estado de Mercado (BMV · NYSE)

**Status:** Proposed
**Date:** 2026-10-07
**Deciders:** Frontend (Aristeo) · Backend GBM (Java 23) · Diseño
**Prototipo de referencia:** artifact "Indicador de Mercado" (shell TRACKER, 2 capas)

---

## 1. Context

Hoy la app no comunica si los mercados están operando. El inversionista no sabe, de un vistazo, si BMV/BIVA o NYSE/NASDAQ están abiertos, en horas extendidas o cerrados. Esto afecta la lectura de precios (un “−1.93%” a las 2 a.m. es el cierre, no un movimiento vivo) y la expectativa de ejecución de órdenes.

Fuerzas en juego:
- **Multi-mercado, multi-huso:** BMV opera en `America/Mexico_City` (sin DST desde 2023); NYSE/NASDAQ en `America/New_York` (con DST). El desfase CT↔ET cambia entre 1 h (invierno) y 2 h (verano).
- **Horas extendidas (EE.UU.):** pre-market 04:00–09:30 y aftermarket 16:00–20:00 ET; México minorista no las maneja.
- **Calendario:** festivos y cierres anticipados (13:00 ET) distintos por país.
- **Fintech Density + tema oscuro:** el componente debe integrarse sin romper la densidad ni el header actual.

## 2. Decision

Implementar el estado de mercado en **dos capas de diseño** sobre **una sola fuente de verdad**:

1. **Indicador Global (header).** Reemplaza la caja de búsqueda del header (`protected-shell.tsx`), entre **“+ Activo”** y el ícono **Global (🌐)**. Muestra **ambos mercados a la vez**: `BMV ● · NYSE ●`, cada uno con punto de color por estado. Persistente en Dashboard, Portfolio y Transacciones.
2. **Anclajes Contextuales (widgets).** Un mini-indicador (`punto + etiqueta`) embebido por instrumento/mercado en filas de activos y transacciones.

**Fuente de verdad: el backend Java 23** expone `GET /api/v1/market/status`. El frontend consume vía BFF same-origin (`/api/market/status`), con **cálculo client-side como _fallback_** (mismo algoritmo validado en el prototipo) para degradación elegante si el backend falla.

Estados (enum único compartido): `OPEN` 🟢 · `PRE_MARKET` 🟡 · `AFTER_HOURS` 🟡 · `CLOSED` 🔴.

## 3. Options Considered

### Opción A — Cálculo 100% client-side
| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja |
| Costo | Nulo (sin backend) |
| Exactitud | Riesgo: festivos hardcodeados se vuelven stale; sin autoridad |
| Familiaridad | Alta (ya prototipado) |

**Pros:** cero dependencias, inmediato. **Cons:** el calendario de festivos vive en el bundle; cada año requiere redeploy; no hay una sola verdad entre back y front.

### Opción B — Backend fuente de verdad + fallback client-side *(elegida)*
| Dimensión | Evaluación |
|---|---|
| Complejidad | Media |
| Costo | 1 endpoint + cache |
| Exactitud | Alta (calendario en backend, versionable) |
| Familiaridad | Alta (reusa patrón BFF de transacciones) |

**Pros:** una sola verdad; festivos/horarios administrables en back; front resiliente por el fallback. **Cons:** un endpoint más que mantener.

### Opción C — API de terceros (p. ej. proveedor de market-status)
| Dimensión | Evaluación |
|---|---|
| Complejidad | Media | 
| Costo | $ (suscripción) / rate limits |
| Exactitud | Alta pero dependiente de un externo |
| Familiaridad | Baja |

**Cons:** dependencia externa y costo para un dato que ya conocemos (horarios/calendario).

## 4. Trade-off Analysis

Elegimos **B**: el dato de horarios/festivos es **autoridad de negocio**, no debe vivir en el bundle del cliente. El backend ya posee el contexto (ADR-0009/0011 manejan fechas y calendarios). El fallback client-side (Opción A como respaldo) nos da resiliencia sin volverlo la fuente. El chip hace *tick* local cada segundo para el countdown sin martillar la red; re-sincroniza por intervalo y al cruzar `nextChange`.

## 5. Arquitectura y árbol de archivos

Nueva feature `market` siguiendo la estructura del repo (`src/features/<x>/{api,hooks,lib,types,components}`):

```
src/
  features/market/
    types/market-status.types.ts        # enums + contratos (compartidos con anclajes)
    lib/market-calendar.ts              # motor PURO (sin DOM/red) — fallback + utilidades tz
    lib/market-calendar.data.ts         # horarios + festivos 2026 (fallback; editable)
    api/get-market-status.ts            # cliente BFF (apiRequest sameOrigin)
    hooks/use-market-status.ts          # fetch + poll + tick + fallback
    components/MarketStatusChip.tsx     # Capa 1 — indicador dual del header
    components/MarketStatusAnchor.tsx   # Capa 2 — anclaje contextual
    __tests__/market-calendar.test.ts
    hooks/__tests__/use-market-status.test.ts
  app/api/market/status/route.ts        # BFF proxy same-origin → backend
  lib/api/endpoints.ts                  # + bff.marketStatus, + market.status
  components/layout/protected-shell.tsx # MONTAJE Capa 1 (reemplaza el search, L346–355)
docs/engineering/MARKET_STATUS_INDICATOR_SPEC.md  # este documento
```

## 6. Contrato de datos (fuente de verdad)

### Backend (Java 23)
```
GET /api/v1/market/status            # ROLE_USER (como los demás /me/*; o público si se decide)
```
```json
{
  "asOf": "2026-10-07T21:34:00Z",
  "markets": [
    {
      "code": "BMV", "label": "México y SIC", "exchange": "BMV · BIVA · SIC",
      "timezone": "America/Mexico_City",
      "phase": "CLOSED", "isOpen": false,
      "regular": { "open": "08:30", "close": "15:00" },
      "extended": null,
      "nextChange": { "type": "OPEN", "at": "2026-10-08T13:30:00Z" },
      "reasonCode": "AFTER_CLOSE"
    },
    {
      "code": "NYSE", "label": "Estados Unidos", "exchange": "NYSE · NASDAQ",
      "timezone": "America/New_York",
      "phase": "AFTER_HOURS", "isOpen": false,
      "regular": { "open": "09:30", "close": "16:00" },
      "extended": { "pre": "04:00", "after": "20:00" },
      "nextChange": { "type": "OPEN", "at": "2026-10-08T13:30:00Z" },
      "reasonCode": "AFTER_HOURS"
    }
  ]
}
```
- `phase`: `OPEN | PRE_MARKET | AFTER_HOURS | CLOSED`.
- `reasonCode`: `REGULAR | EARLY_CLOSE | PRE_MARKET | AFTER_HOURS | BEFORE_OPEN | AFTER_CLOSE | WEEKEND | HOLIDAY`.
- `nextChange.at`: instante ISO-8601 UTC; el front hace el countdown local.
- **Cache:** `Cache-Control: max-age=30`. El backend ya tiene el calendario; evita recomputar por request.
- Un endpoint de **detalle** para la futura sección Mercados: `GET /api/v1/market/{code}/calendar?year=2026` → festivos + cierres anticipados.

### BFF same-origin (patrón de `me/transactions`)
```
GET /api/market/status   → reenvía a backend, mismo shape. Permite cacheo en el edge y oculta el origen.
```

## 7. Tipos compartidos — `types/market-status.types.ts`
```ts
export type MarketPhase = "OPEN" | "PRE_MARKET" | "AFTER_HOURS" | "CLOSED";
export type MarketCode = "BMV" | "NYSE";

export type MarketStatus = {
  code: MarketCode;
  label: string;
  exchange: string;
  timezone: string;          // IANA
  phase: MarketPhase;
  isOpen: boolean;           // phase === "OPEN"
  regular: { open: string; close: string };   // "HH:mm" local
  extended: { pre: string; after: string } | null;
  nextChange: { type: "OPEN" | "CLOSE"; at: string } | null; // ISO UTC
  reasonCode: string;
};

export type MarketStatusResponse = { asOf: string; markets: MarketStatus[] };

// semaphore para la UI: colapsa pre/after en "extended"
export type StatusTone = "open" | "extended" | "closed";
export const toneOf = (p: MarketPhase): StatusTone =>
  p === "OPEN" ? "open" : p === "CLOSED" ? "closed" : "extended";
```

## 8. Motor puro — `lib/market-calendar.ts` (fallback + utilidades)

Portado del prototipo (verificado 9/9: pre/after, cierre anticipado, DST, fin de semana, festivos). **Sin DOM ni red**, 100% testeable. Usa `Intl.DateTimeFormat` con `timeZone` (no offsets fijos) para ser correcto todo el año.

```ts
import { MARKETS } from "./market-calendar.data";
import type { MarketCode, MarketPhase, MarketStatus } from "../types/market-status.types";

const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function tzParts(tz: string, date: Date) {
  const o: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date).forEach((p) => { if (p.type !== "literal") o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute, ss: +o.second };
}
function tzOffsetMs(tz: string, date: Date) {
  const p = tzParts(tz, date);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - date.getTime();
}
function instantFor(tz: string, y: number, m: number, d: number, min: number) {
  const naive = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60, 0);
  return new Date(naive - tzOffsetMs(tz, new Date(naive)));
}

type DayType = "trading" | "early" | "weekend" | "full";
function dayType(code: MarketCode, y: number, m: number, d: number): { type: DayType; name?: string; close?: string } {
  const mk = MARKETS[code];
  const h = mk.holidaysByDate[ymd(y, m, d)];
  if (h?.type === "full") return { type: "full", name: h.name };
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (wd === 0 || wd === 6) return { type: "weekend" };
  if (h?.type === "early") return { type: "early", name: h.name, close: h.close };
  return { type: "trading" };
}

/** Fallback local: calcula el estado como lo haría el backend. */
export function computeMarketStatus(code: MarketCode, now = new Date()): MarketStatus {
  const mk = MARKETS[code];
  const p = tzParts(mk.timezone, now);
  const dt = dayType(code, p.y, p.m, p.d);
  const openMin = toMin(mk.open);
  let closeMin = toMin(mk.close);
  let phase: MarketPhase = "CLOSED";
  let reasonCode = "AFTER_CLOSE";

  if (dt.type === "full") reasonCode = "HOLIDAY";
  else if (dt.type === "weekend") reasonCode = "WEEKEND";
  else {
    const early = dt.type === "early";
    if (early) closeMin = toMin(dt.close ?? mk.earlyClose!);
    const m = p.hh * 60 + p.mm;
    if (mk.extended) {
      const pre = toMin(mk.preOpen!);
      const aft = toMin(early ? mk.earlyAfterClose! : mk.afterClose!);
      if (m < pre) reasonCode = "BEFORE_OPEN";
      else if (m < openMin) { phase = "PRE_MARKET"; reasonCode = "PRE_MARKET"; }
      else if (m < closeMin) { phase = "OPEN"; reasonCode = early ? "EARLY_CLOSE" : "REGULAR"; }
      else if (m < aft) { phase = "AFTER_HOURS"; reasonCode = "AFTER_HOURS"; }
    } else {
      const m2 = p.hh * 60 + p.mm;
      if (m2 >= openMin && m2 < closeMin) { phase = "OPEN"; reasonCode = early ? "EARLY_CLOSE" : "REGULAR"; }
      else reasonCode = m2 < openMin ? "BEFORE_OPEN" : "AFTER_CLOSE";
    }
  }

  const nextChange = computeNextChange(code, now, phase, p, openMin, closeMin, dt.type);
  return {
    code, label: mk.label, exchange: mk.exchange, timezone: mk.timezone,
    phase, isOpen: phase === "OPEN",
    regular: { open: mk.open, close: mk.close },
    extended: mk.extended ? { pre: mk.preOpen!, after: mk.afterClose! } : null,
    nextChange, reasonCode,
  };
}
// computeNextChange: si OPEN → cierre de hoy; si PRE → apertura de hoy; si no → apertura del próximo día hábil.
// (implementación completa en el prototipo; iterar hasta 14 días buscando trading/early.)
export function computeNextChange(/* … */): MarketStatus["nextChange"] { /* ver prototipo */ return null; }
```

`lib/market-calendar.data.ts` contiene `MARKETS` (horarios + `holidaysByDate`) para **2026** — tomado del prototipo. Es **solo fallback**; la verdad vive en backend. Marcar con comentario "verificar contra calendario oficial BMV/BIVA y NYSE".

## 9. Cliente + hook

`api/get-market-status.ts` (patrón BFF idéntico a `get-transactions.ts`):
```ts
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { MarketStatusResponse } from "@/features/market/types/market-status.types";

export function getMarketStatus(signal?: AbortSignal) {
  return apiRequest<MarketStatusResponse>(endpoints.bff.marketStatus, { auth: true, sameOrigin: true, signal });
}
```
`endpoints.ts` → `bff.marketStatus = "/api/market/status"` y `market.status = "/api/v1/market/status"`.

`hooks/use-market-status.ts` (`"use client"`):
- Hace **fetch** inicial al BFF; **poll** cada `refetchMs` (default 60 000).
- **Fallback:** si el fetch falla, usa `computeMarketStatus("BMV"|"NYSE")` del motor local.
- **Tick** local cada 1 000 ms para el countdown (deriva de `nextChange.at`); al cruzar `nextChange` fuerza un refetch.
- Errores **tragados** (nunca rompe el header). API:
```ts
const { markets, status } = useMarketStatus();         // markets: MarketStatus[]
status; // "live" | "fallback" | "loading"
```

## 10. Capa 1 — `MarketStatusChip.tsx` (header)

- Muestra **ambos mercados**: `BMV ● · NYSE ●`. Punto y código teñidos por `toneOf(phase)`.
- `tone` → color por token Tailwind:
  - `open` → `text-fintech-positive` / dot `bg-fintech-positive` (#16C784)
  - `extended` → ámbar (`text-amber-400` / `bg-amber-400`) — **nuevo tono semántico**, documentarlo
  - `closed` → `text-fintech-muted` + dot `bg-fintech-negative` (#EA3943) con ícono reloj
- Contenedor: `rounded-xl border border-fintech-border bg-fintech-surface h-10 px-3` (iguala el alto del search que reemplaza, `h-10`).
- `title`/`aria-label` por mercado: “NYSE · Aftermarket · abre en 14 h 23 m”.
- Responsive: `xl` muestra códigos+puntos; `<xl` colapsa a solo puntos (igual que el search era `xl:block`). Móvil usa la fila existente del header inferior.
- **Accesibilidad:** `role="status"`, `aria-live="polite"`; no depender solo del color (el código BMV/NYSE y el texto del tooltip llevan el estado).

**Montaje (reemplazo del search):** en `protected-shell.tsx`, sustituir el bloque `L346–355` (el `<div className="relative hidden w-44 xl:block …">` con el `<input placeholder="Buscar activos, txs...">`) por:
```tsx
<MarketStatusChip className="hidden xl:flex" />
```
Queda, por orden, `DesktopBalanceSummary (+ Activo)` → `MarketStatusChip` → `Globe` → `Bell` → `Settings` → avatar. (El search móvil `search-mobile`, L524/555, se retira o se conserva según decisión de producto; este cambio solo afecta el desktop header.)

## 11. Capa 2 — `MarketStatusAnchor.tsx` (contextual)

- Props: `{ code: MarketCode; compact?: boolean }`. Lee el mismo `useMarketStatus()` (una fuente).
- Render: `<span class="inline-flex items-center gap-1.5 …"><Dot tone/> {compact ? tone : label}</span>`.
- Uso sugerido (Fintech Density, `text-[10px]`/`text-xs`):
  - `transactions-table.tsx` → columna/ף chip por fila según el mercado del activo.
  - `portfolio-widgets.tsx` / holdings → junto al símbolo.
  - Dashboard → mini-tira de estados de mercado.
- Mapear instrumento→mercado con un helper `marketOf(assetSymbol, assetType, currency)` (USD→NYSE, MXN/SIC→BMV) para no acoplar la UI a datos crudos.

## 12. Estilo (tokens reales)

| Tono | Texto | Punto | Token |
|---|---|---|---|
| open | `text-fintech-positive` | `bg-fintech-positive` | #16C784 |
| extended | `text-amber-400` | `bg-amber-400` | #FBBF24 (nuevo semántico) |
| closed | `text-fintech-muted` | `bg-fintech-negative` | #7f8aa3 / #EA3943 |

Añadir, si se quiere tokenizar, `fintech.warning: "#FBBF24"` en `tailwind.config.ts` para no usar `amber-*` crudo. Respetar densidad: chip `h-10` en header; anclajes `text-[10px]`/`text-xs`, `py-0.5 px-2`.

## 13. Feature flag y sección Mercados

- Reusar `src/lib/navigation/nav-features.ts` (`isMercadosNavEnabled()`): hoy la **sección Mercados** queda en `SOON` / deshabilitada. El **chip del header NO depende de ese flag** (va siempre).
- Fase posterior: habilitar la página `app/(protected)/mercados/page.tsx` (toggle México/EE.UU., estado en vivo, horarios regular+extendido, festivos 2026, preview) — ya prototipada — detrás de `navFeatureAvailability.mercados`.

## 14. Testing

- **Vitest unit (crítico, ≥90%)** `market-calendar.test.ts`: portar los 9 casos ya verificados (open/pre/after/early-close/weekend/holiday para NYSE; open/closed para BMV; cruce DST verano/invierno). Son deterministas (inyectar `now`).
- **Vitest** `use-market-status.test.ts`: fetch OK → `status:"live"`; fetch falla → `status:"fallback"` usando el motor; poll/abort; errores tragados.
- **Playwright (xs-mobile + visual)**: `MarketStatusChip` visible en el header tras login; estados via mock del BFF (`page.route("/api/market/status")`), incluyendo `open/extended/closed`; no rompe la densidad (alto header). Añadir el mock del BFF a `tests/e2e/helpers.ts` como se hizo con `/api/me/transactions`.
- **a11y:** axe sobre el header con el chip.

## 15. Consequences

**Más fácil:** lectura inmediata del estado de ambos mercados en cualquier módulo; base para badges de “cerrado” en precios; la sección Mercados reusa el mismo motor/fuente.
**Más difícil / a vigilar:** un endpoint nuevo que mantener; el tono `extended` (ámbar) añade un color semántico fuera de positive/negative — documentarlo en el design system; el `marketOf()` necesita cubrir SIC/ADRs con criterio de producto.
**A revisar:** calendario oficial 2026 de BMV/BIVA y NYSE (fallback); política de cache del endpoint; si el estado debe ser público (sin auth) para mostrarlo en landing.

## 16. Coordinación con Backend (GBM · Java 23)

**Estado:** contrato **ACEPTADO** por la sesión backend "Cálculo de precio efectivo unitario GBM" el **2026-10-07** (se alinea 1:1 con su **ADR-0012 backend** de calendarios bursátiles cruzados NYSE/BMV). Sin cambios de shape.

**Entregado al backend:** contrato de `GET /api/v1/market/status` (§6), enums, reglas de horarios/DST/extended/cierres anticipados (§8) y la lista de festivos 2026 del fallback — con la nota de que la **autoridad del calendario vive en backend**.

**Decisiones cerradas:**
| # | Pregunta | Decisión acordada |
|---|---|---|
| a | auth del endpoint | **PÚBLICO (sin auth)** — implementado así en F1 (contenido global/no sensible), con `permitAll` + rate limiting. |
| b | un endpoint o por `code` | **Uno solo** `/api/v1/market/status` con `markets[]` (1 llamada para el chip). `/market/{code}/calendar` queda per-code para la sección Mercados (Fase 2). |
| c | quién calcula `nextChange` | **Backend** (determinista, fuente de verdad vía `ZoneId`). El fallback client-side también lo deriva. |
| d | ETA | Diseño backend listo (ADR-0012 en *Proposed*); la **calendarización la aprueba el usuario del backend** (commits/builds/deploys). Sin fecha comprometida aún. |

**Notas del backend:** usa `java.time.ZoneId` → DST sale "gratis" (México CST fijo sin horario de verano; NYSE EST/EDT), sin offsets hardcodeados. Festivos oficiales BMV/BIVA + NYSE se siembran y verifican en backend; cierres anticipados NYSE (27-nov, 24-dic 2026 · 13:00 ET · aftermarket 17:00) con flag de medio día. BMV queda solo `OPEN|CLOSED` (`extended:null`); NYSE usa las 4 fases. **Corrección:** el stack backend es **Java 21** (no 23).

**Festivos 2026 — VERIFICADOS 1:1 por backend (2026-10-07)** contra los calendarios oficiales BMV/BIVA y NYSE: las 20 fechas correctas (BMV 9 totales · NYSE 10 totales + 2 anticipados), incluidas las reglas móviles (observadas por lunes en BMV; 3er/último lunes en NYSE), Independence Day observado el 03-jul (4-jul cae sábado → cierre total, no medio día), y BMV cerrando Jueves **y** Viernes Santo. Se omiten correctamente 12-dic (Guadalupe, no es festivo bursátil) y 02-nov (Día de Muertos, no es cierre BMV; en 2026 cae lunes). GBM la guarda como apéndice verificado de su ADR-0012. La data vive en `lib/market-calendar.data.ts` (fallback); la autoridad definitiva se siembra año a año en backend contra el PDF oficial BMV/BIVA (puede agregar algún día discrecional).

**Backend F1 IMPLEMENTADO (2026-10-08)** — `GET /api/v1/market/status` listo y verde, response **1:1** con §6. Detalles de producción:
- **Público (sin auth)**, `Cache-Control: max-age=30`.
- **Rate limit: 120 req/min por IP** → al exceder, `429 application/problem+json` con header `Retry-After`. El hook debe: **backoff + respetar Retry-After + caché local 30 s + fallback** si persiste.
- `nextChange.type` = próxima apertura/cierre de la sesión **REGULAR** (las horas extendidas NO generan evento). `nextChange.at` del **backend es la verdad** (p. ej. BMV 08:30 CDMX = `14:30Z`, CST fijo). El fallback usa `Intl`/ZoneId equivalente y coincide, pero prevalece el backend.
- Early-close NYSE: durante la sesión → `OPEN` + `reasonCode:"EARLY_CLOSE"` + `nextChange CLOSE` 13:00 ET; después → `AFTER_HOURS` hasta 17:00 ET.
- Festivos sembrados **solo 2026** (verificados). 2027+ entra con la auto-ingesta (Massive/Finnhub) o migración.

**Transporte / CORS (confirmado por backend):** el CORS global permite **un solo origen** = `${app.frontend-base-url}` (`SecurityConfig.corsConfigurationSource`), que ya cubre `/market/status`.
- **App (mismo origen):** la **llamada directa al backend funciona hoy** sin tocar nada → para el chip podemos consumir `endpoints.market.status` directo (no requiere el BFF). "Público" = sin auth, **no** significa sin CORS.
- **Landing cross-origin** (si el marketing vive en otro dominio): el navegador bloqueará la llamada directa. Opciones: (a) agregar ese origen a la allowlist CORS del backend (cambio de config del usuario backend — avisar), o (b) **BFF same-origin** (evita CORS y da cacheo en edge).
- **Decisión:** para la app, **direct**; mantener el **BFF opcional** solo si se necesita el landing cross-origin o cacheo en edge. El cliente `get-market-status.ts` puede apuntar a `market.status` (directo) o `bff.marketStatus` (proxy) sin cambiar el hook.

**Pendiente (backend):** el endpoint **aún no está desplegado** — requiere build/arranque manual del usuario backend en `localhost:8080`. Al estar arriba, se corre el **E2E real** del frontend (chip + anclajes + manejo de 429).

**Mientras tanto / como fallback permanente:** el frontend opera con `computeMarketStatus()` (§8). Al desplegarse, se consume el endpoint como **primario** y el cálculo local queda como **degradación** (429 / red caída) — sin cambios de UI.

## 17. Action Items
1. [x] Backend: `GET /api/v1/market/status` (Java 21) — **implementado y verde (F1, 2026-10-08)**, público, cache 30 s, rate-limit 120/min. Pendiente: **deploy** manual del usuario backend. (+ `/market/{code}/calendar` para la fase 2.)
2. [x] `endpoints.ts`: `market.status` + `market.calendar` + `bff.marketStatus`.
3. [ ] BFF `app/api/market/status/route.ts` — **opcional** (solo para landing cross-origin / edge cache; la app llama directo).
4. [x] `features/market/types` + `lib/market-calendar(.data).ts` (motor puro + datos fallback 2026 verificados).
5. [x] `hooks/use-market-status.ts` (store singleton: fetch + poll 30 s + fallback + backoff 429).
6. [x] `MarketStatusChip.tsx` montado en `protected-shell.tsx` reemplazando el search desktop (search móvil intacto).
7. [x] `MarketStatusAnchor.tsx` + `marketOf()` creados. **Pendiente (opcional):** colocarlos en filas de transactions/portfolio/dashboard.
8. [x] Tests Vitest: `market-calendar` (15) + `use-market-status` (3) = **18/18**. Pendiente: Playwright (chip) + mock del endpoint en `helpers.ts`.
9. [ ] (Fase 2) Habilitar sección Mercados tras `navFeatureAvailability.mercados`.
10. [x] ~~Verificar calendario oficial 2026~~ — hecho: 20/20 verificadas por backend. Opcional pendiente: tokenizar `fintech.warning`.
