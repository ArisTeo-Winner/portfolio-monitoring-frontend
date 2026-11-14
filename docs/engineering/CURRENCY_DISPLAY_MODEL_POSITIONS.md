# Plan — Modelo de visualización de moneda en Posiciones (estilo Snowball)

- **Estado:** Propuesta (plan). Sin código todavía.
- **Fecha:** 2026-11-13
- **Relacionado:** ADR-0010 (presentation currency), `PresentationEnvelope`,
  `resolveDisplayCurrency`, `src/components/portfolio/portfolio-widgets.tsx`.
- **Motivación:** replicar el comportamiento de moneda de snowball-analytics,
  usado como referencia por el usuario.

---

## 1. Modelo de referencia (Snowball) — dos reglas

**Regla A — Transacciones (Operaciones): SIEMPRE en la moneda de ejecución.**
El selector de moneda base no las afecta nunca. Una compra NVDA en MXN se ve en
MXN; una GOOGL en USD se ve en USD, elija el usuario la base que elija.

**Regla B — Posiciones (Mis posiciones): toggle propio de dos modos.**
1. **"En la moneda de la posición"** (nativo): cada posición en SU moneda de
   ejecución (mezcladas en la misma tabla). Cambiar la moneda base **no** las
   convierte.
2. **"En [base]"** (p. ej. "En MXN" / "En USD"): convierte **todas** las
   posiciones a la base elegida (FX aplicado), aunque la posición sea de otra
   moneda.

> El selector de moneda base global (MXN/USD/EUR/GBP/…) solo manda sobre el modo
> B de Posiciones (y resto de agregados), nunca sobre Transacciones.

---

## 2. Estado actual de la app

| Área | Snowball | App hoy | Veredicto |
|---|---|---|---|
| **Transacciones** | siempre nativas | nativas; el selector no las toca (ADR-0010) | ✅ ya cumple la Regla A |
| **Posiciones — modo "En [base]"** | base elegible por vista | una sola moneda de presentación (`preferred_currency`); el backend convierte todo y manda el `PresentationEnvelope` por entry | ⚠️ parcial |
| **Posiciones — modo "En la moneda de la posición"** | toggle nativo por posición | **no existe**: hoy todo se muestra en la moneda de presentación única | ❌ falta |

Evidencia en código:
`portfolio-widgets.tsx:81` →
`// ADR-0010: entries arrive already converted into the backend display currency`
`const displayCurrency = resolveDisplayCurrency(entries[0]?.presentation);`
y el render usa `formatDisplayMoney(entry.currentValue, displayCurrency)`.

**Implicación central:** las posiciones **llegan ya convertidas** a la moneda de
presentación. El frontend **no tiene** el monto nativo por posición. Por lo
tanto el **modo nativo es, ante todo, una dependencia de backend**.

---

## 3. Decisiones de diseño

### 3.1 El renglón "Total" en modo nativo (el punto delicado)
ADR-0010 prohíbe **sumar/convertir entre monedas en el frontend**. En modo nativo
las filas están en monedas distintas, así que **no puede haber un único "Total"
sumado en el front**. Opciones:

- **Opción 1 (recomendada):** en modo nativo, mostrar **subtotales por moneda**
  (p. ej. `Total MXN: Mex$… · Total USD: $…`). Honesto y 100% front-safe.
- **Opción 2:** mostrar un "Total equivalente" en una moneda, pero **convertido
  por el backend** (como hace Snowball, que muestra el Total ya en la base).
  Requiere un agregado del backend; no es front-math.

> Recomendación: Opción 1 para el modo nativo; el total único convertido queda
> para el modo "En [base]" (que ya es responsabilidad del backend).

### 3.2 Modo "En [base]"
Es el modelo ADR-0010 actual: el backend convierte a la moneda de presentación y
adjunta el envelope. Para permitir **elegir la base por vista** (MXN/USD/EUR/…)
hace falta que el backend soporte FX hacia cada moneda destino. Hoy:
- MXN/USD: soportado.
- EUR: **deshabilitado** (sin FX USD/EUR).

### 3.3 Transacciones
**Sin trabajo.** Ya cumplen la Regla A. Solo se documenta/mantiene el guard de
que el selector de moneda no toca los montos de transacción.

### 3.4 Persistencia del toggle
El toggle de Posiciones (nativo vs base) es preferencia de **vista**:
- Persistir por-usuario en el cliente (localStorage) como conveniencia, con
  fallback seguro si no está disponible.
- No confundir con `users.preferred_currency` (fuente de verdad del backend para
  el modo base).

---

## 4. Dependencias de backend

1. **Montos nativos por posición (para el modo nativo).** El backend debe exponer,
   por cada entry: su **moneda nativa** y los montos en esa moneda nativa
   (`currentValue`, `totalInvested`, `totalProfitLoss`, dividendos, etc.), además
   de los ya convertidos. Hoy solo llegan los convertidos + el envelope.
   - Alternativa desaconsejada: derivar nativo = convertido / `fxRate` en el
     front (viola ADR-0010: money-math en cliente, y el envelope es global, no
     por moneda-de-posición).
2. **Agregados por moneda / total equivalente.** Si se quiere un "Total" en modo
   nativo que no sea subtotales por moneda, el backend debe entregarlo convertido.
3. **FX de base arbitraria (modo base por vista).** Soporte FX hacia cada moneda
   seleccionable (desbloquear EUR, etc.).

> Coordinar con el peer de backend (sesión "Cálculo de precio efectivo unitario
> GBM") antes de implementar el modo nativo: sin (1) no es posible sin violar
> ADR-0010.

---

## 5. Plan de frontend (cuando se apruebe implementar)

Archivos tocados (estimado):
- `src/components/portfolio/portfolio-widgets.tsx` — tabla de posiciones: añadir
  el toggle de vista, ramear el render por modo, subtotales por moneda en nativo.
- `src/features/portfolio/types/*` — extender el tipo de entry con los montos
  nativos + moneda nativa (cuando el backend los exponga).
- `src/lib/utils/currency.ts` — helper para formatear por moneda nativa
  (ya existe `formatDisplayMoney`/`resolveDisplayCurrency`; añadir el caso nativo).
- Posible store/estado de vista para el toggle + persistencia localStorage.

Reglas de implementación:
- Nunca sumar/convertir entre monedas en el front (ADR-0010).
- En nativo: cada fila con su moneda; agregados = subtotales por moneda.
- En base: usar el envelope del backend tal cual (sin FX en el front).
- Densidad Fintech: respetar alturas/paddings de la tabla actual.

Pruebas:
- E2E (xs-mobile) con portfolio mock multi-moneda (MXN + USD): alternar el toggle
  y verificar que en nativo cada fila conserva su moneda y que hay subtotales por
  moneda (no un total sumado); en base, que todo refleja la moneda de presentación.
- Transacciones: test de regresión de que el selector de moneda no altera montos.

---

## 6. Fases sugeridas

- **Fase 1 — Modo nativo en Posiciones.** Depende de backend (montos nativos por
  posición). Front: toggle + render nativo + subtotales por moneda. Total único
  convertido NO (Opción 1).
- **Fase 2 — Selector de base por vista.** Depende de FX de backend por moneda
  destino (desbloquear EUR/otras). Reusa el envelope ADR-0010.
- **Fase 0 — (ya cumplido)** Transacciones siempre nativas.

---

## 7. Preguntas abiertas

1. ¿Total en modo nativo = **subtotales por moneda** (Opción 1) o **total
   equivalente convertido por backend** (Opción 2)?
2. ¿El toggle de vista se persiste por-usuario (localStorage) o también en
   `preferred_currency`/preferencias del backend?
3. ¿Qué monedas base deben ser seleccionables en Fase 2 (solo MXN/USD, o más)?
   ¿Se desbloquea EUR (requiere FX USD/EUR en backend)?
4. ¿El backend puede exponer los montos nativos por posición sin romper el
   contrato ADR-0010 actual (aditivo)?
