---
name: project-architecture
description: Reglas arquitectónicas del frontend de crypto-portfolio-monitoring. Aplicar siempre que se cree, modifique o refactorice código en este repo — incluye dónde van los componentes, cómo se consumen los design tokens, dónde viven los stores, cómo se estructuran las features, cómo se llama al backend y cómo se organiza el App Router. Activar también cuando el usuario pida "haz un componente", "agrega una feature", "crea un endpoint", "agrega una pantalla" o cualquier tarea de implementación dentro de este repo.
---

Este skill codifica las convenciones reales del repo `crypto-portfolio-monitoring-frontend`. Las reglas reflejan el estado actual del código tras la auditoría arquitectónica de mayo 2026 — no son aspiracionales. Si una regla parece chocar con el código existente, primero consultar al usuario antes de aplicarla.

## 1. Ubicación de componentes

**Regla canónica:** los componentes específicos de un dominio van en `src/components/{dominio}/`. Los dominios actuales son `auth/`, `portfolio/`, `transactions/`, `settings/`, `market/`, `charts/`, `layout/`, `public/`, `shared/`.

**Excepción condicional:** una feature puede tener su propia carpeta `components/` solo cuando se cumple esta condición: **el o los consumidores de esos componentes pertenecen a un dominio distinto al de la feature**.

Ejemplo válido: `src/features/portfolio-chart/components/` es consumido por `src/app/(protected)/dashboard/page.tsx`. Dashboard ≠ portfolio-chart → excepción aplica.

Ejemplo inválido (no hacer esto): un componente que solo se consume desde `/portfolio/[symbol]/page.tsx` no debe vivir en `features/asset-chart/components/`. El consumidor pertenece al dominio portfolio, así que el componente va a `src/components/portfolio/`, no a una feature nueva.

**Antes de crear `components/` dentro de una feature, identifica explícitamente quién la va a consumir. Si todos los consumidores son del mismo dominio, los componentes van a `src/components/{dominio}/`, no a la feature.**

**Regla derivada:** al crear un componente nuevo, primero identificar a qué dominio pertenece. Si lo va a consumir solo ese dominio, va a `src/components/{dominio}/`. Si la feature es autónoma y la consume otro dominio, va dentro de `src/features/{name}/components/`.

**Primitivos UI:** `src/components/ui/` contiene los primitivos del design system (`button`, `input`, `card`, `badge`, `modal`, `table`, `problem-alert`). No inventar primitivos nuevos sin consultar — si falta uno, justificar y proponer agregarlo a `ui/`. Todos los primitivos aceptan `className` override vía `cn()` desde `@/lib/utils/cn`.

## 2. Design tokens y colores

**Regla dura:** prohibido usar hex codes literales (`#xxxxxx`) o clases Tailwind arbitrarias (`text-[#abc]`, `bg-[#def]`) en archivos nuevos o modificados. Toda referencia de color debe pasar por el sistema de tokens.

**Fuente de verdad:** `tailwind.config.ts`, namespace `fintech.*`. Para JSX/CSS usar las clases semánticas:

```tsx
// CORRECTO
<div className="bg-fintech-card text-fintech-muted" />
<span className="text-fintech-positive">+1.23%</span>

// INCORRECTO
<div className="bg-[#111317] text-[#7f8aa3]" />
<span style={{ color: "#16C784" }}>+1.23%</span>
```

**Bridge para librerías JS:** cuando una librería necesita hex literales (lightweight-charts, recharts inline props, atributos SVG `fill`/`stroke`/`stopColor`, o estilos inline ineludibles), importar desde `@/lib/design-tokens`:

```tsx
import { tokens } from "@/lib/design-tokens";

// chart config (requiere hex):
layout: { textColor: tokens.muted }
grid: { vertLines: { color: tokens.grid }, horzLines: { color: tokens.grid } }

// SVG (requiere hex):
<stop stopColor={tokens.positive} stopOpacity="0.22" />

// JSX en el mismo componente (usa Tailwind):
<p className="text-fintech-muted">...</p>
```

**Si falta un token:** primero agregarlo a `tailwind.config.ts` bajo `fintech.*` y a `src/lib/design-tokens.ts` con el mismo valor. Después consumirlo. Nunca hardcodear "temporalmente".

**Convenciones semánticas de los tokens existentes:**
- `positive` (#16C784): ganancias, P&L positivo, estados de éxito
- `negative` (#EA3943): pérdidas, errores, estados destructivos
- `loss` (#ff5b6e): variante suave de negativo para contextos de trading
- `muted` (#7f8aa3): texto secundario
- `dim` (#71819b): texto terciario, deshabilitado
- `card` (#111317): fondo de card
- `input` (#0f1217): fondo de inputs/botones
- `deep` (#0d1016): fondo más profundo, contraste con card
- `active` (#151d2a): estado activo de toggle/tab
- `grid` (#1a1f29): grid lines de charts (solo JS)

**Deuda viva reconocida:** existen archivos legacy con hex codes en `className`. Al modificar cualquiera de ellos por otra razón, migrar las referencias de color a tokens en el mismo PR. No es necesario migrarlos preventivamente.

## 3. Stores de estado

**Ubicación canónica:** `src/state/`. Único patrón válido: Zustand. La carpeta `src/store/` fue eliminada y no debe recrearse.

**Patrón de referencia:** `src/state/session.store.ts`. Sigue Zustand + BroadcastChannel (sincronización entre pestañas) + sessionStorage namespaced por `apiOrigin`. Exporta el hook del store y helpers tipo `getX`/`setX`/`clearX` para acceso imperativo.

**Reglas:**
- Un store por dominio funcional, no por componente
- Estado UI efímero (modales abiertos, focus, hover) va en `useState`/`useReducer` local, no en stores globales
- Estado de servidor (datos del backend) va en TanStack Query, no en stores Zustand
- Stores Zustand solo para: sesión, preferencias del usuario persistidas, estado UI compartido entre rutas

## 4. Features

**Estructura canónica:** `src/features/{name}/` con las siguientes subcarpetas según necesidad:

- `api/` — funciones que llaman al backend, una por endpoint. **Obligatoria** si la feature consume el backend.
- `types/` — tipos TypeScript del dominio. **Obligatoria.**
- `hooks/` — hooks de React específicos de la feature (incluye wrappers de TanStack Query). Opcional.
- `lib/` — lógica pura, helpers, normalizers. Opcional.
- `mappers/` — transformaciones DTO backend ↔ tipo de dominio. Crear cuando hay diferencia de forma; si DTO === tipo de dominio, no hace falta.
- `schemas/` — schemas zod específicos de la feature (validación de input de formularios, parsing de respuestas). Crear cuando la feature tiene validación propia.
- `components/` — solo si la feature es consumida por otro dominio (ver sección 1).

**Imports cross-feature:** prohibidos los imports directos entre features (`features/A` no importa de `features/B`). Si A necesita algo de B, ese algo debe extraerse a `src/lib/` o `src/core/`. Las features se comunican vía estado compartido (stores en `src/state/`) o vía props desde la página que las orquesta.

**Validación con zod:** schemas comunes y reutilizables van en `src/core/validation/schemas/`. Schemas específicos de una feature (forma de un formulario, parsing de un endpoint particular) van en `features/{name}/schemas/`. La regla: si lo usa más de una feature, sube a `core/`.

## 5. Cliente API y endpoints

**Punto único de entrada:** `src/lib/api/client.ts`. Toda llamada al backend debe pasar por este cliente. Nunca usar `fetch` o `axios` directamente desde un componente, hook o función de feature.

**Razones:** el cliente centraliza header `Authorization: Bearer`, refresh con `X-Refresh-Token`, manejo de expiración con redirect a `/login?session_expired=1`, y parsing de Problem Details para errores.

**Paths:** centralizados en `src/lib/api/endpoints.ts`. Las funciones en `features/{name}/api/` consumen las constantes de endpoints, no strings literales.

**Validación de respuesta:** cuando la respuesta del backend tenga forma estable y crítica (datos financieros, sesión, transacciones), validar con zod antes de retornar. Si la respuesta difiere del tipo de dominio frontend, transformar vía un mapper en `features/{name}/mappers/`.

**URLs base:** prohibido hardcodear URLs. Todo va vía `NEXT_PUBLIC_API_BASE_URL` leído desde `src/lib/config/env.ts`. La validación runtime ya rechaza URLs `localhost` o sin `https` en producción — no intentar evadirla.

## 6. App Router

**Grupos de ruta:** `(protected)` y `(public)` son los dos grupos canónicos. `(protected)` aplica el shell de auth y verifica sesión. `(public)` es para login, register y rutas marketing.

**Páginas son thin:** los archivos `page.tsx` orquestan, no implementan. Su trabajo es: leer params/searchParams, llamar hooks de feature, componer componentes de `src/components/{dominio}/` o `features/{name}/components/`. La lógica de UI compleja vive en componentes; la lógica de datos vive en hooks de feature.

**Server vs Client Components:** por defecto Server. Marcar con `'use client'` solo cuando se necesita estado, efectos, event handlers o hooks del navegador. Si un componente padre es Server y un hijo necesita ser Client, mover solo ese hijo a Client — no propagar `'use client'` hacia arriba.

**API routes en `src/app/api/`:** son proxies o endpoints propios del frontend (auth, OAuth callbacks, integraciones con CoinGecko). No replicar lógica del backend Spring Boot — si el backend ya expone el endpoint, llamarlo directo desde el cliente API.

## 7. TypeScript

- Prohibido `any`. Si una respuesta de API es desconocida, validar con zod y derivar el tipo con `z.infer`.
- Tipos de dominio en `features/{name}/types/{dominio}.types.ts`.
- Branded types o nominal types recomendados para valores financieros sensibles (`Money`, `Price`, `Quantity`) cuando se introduzcan — no romper la API existente para retrofittear.

## 8. Convenciones de naming

- Componentes: PascalCase con extensión `.tsx`. Archivos kebab-case si tienen guiones (ej: `holding-trading-workspace.tsx`).
- Hooks: camelCase empezando con `use` (ej: `usePortfolioHistory.ts`).
- **Funciones de api: verbo-recurso en kebab-case.** Esta regla contradice la convención general de JavaScript (camelCase) — sigue la del repo, no la general.
  - ✓ `get-portfolio.ts`, `get-asset-history.ts`, `create-transaction.ts`, `get-crypto-market-feed.ts`
  - ✗ `getPortfolio.ts`, `getAssetHistory.ts`, `createTransaction.ts`
  - La función exportada dentro del archivo sigue siendo camelCase (`export async function getAssetHistory(...)`); solo el nombre del archivo es kebab-case.
- Schemas: `{dominio}.schemas.ts`.
- Stores: `{dominio}.store.ts`.

## 9. Cuando algo no encaja en estas reglas

Si una tarea no encaja claramente en este skill — patrón nuevo, dominio nuevo, decisión arquitectónica que afecta a varias features — preguntar al usuario antes de inventar convención. La consistencia con el código existente vale más que la elegancia local. 