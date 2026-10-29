# ADR-0001: Prevención de Broken Access Control y bypass de lógica de negocio (lección "Saberes MX")

**Status:** Proposed
**Date:** 2026-09-10
**Deciders:** Backend (Spring Boot) owner · Frontend owner · Seguridad

---

## Context

La plataforma pública **Saberes MX** fue comprometida por una falla de **control de acceso roto**. El
patrón reportado:

1. Crear un usuario legítimo.
2. Obtener `userId`, `courseId` y el token de sesión.
3. Enviar **peticiones directas al servidor** para marcar el progreso al 100%.
4. Generar y descargar la constancia oficial **sin cursar nada**.

La clave no es un "hack" sofisticado: el atacante **ignora la UI** y llama a la API directamente con su
propio token válido. El servidor confía en datos que debería derivar él mismo y no verifica que el recurso
pertenezca al usuario autenticado.

Esto es exactamente el mismo principio que aplica a nuestro canal **"GBM · Mercado nacional" deshabilitado**:
esconder el botón en el frontend **no** protege el endpoint `/api/v1/me/broker/gbm/statements`, que sigue
vivo y es invocable con `fetch`/Postman.

Este ADR mapea esa clase de vulnerabilidad a **crypto-portfolio-monitoring** y fija los controles que deben
existir. **Regla rectora: todo endpoint es directamente accesible; asume que la UI no existe.**

### Clases OWASP API Security en juego
- **API1 — Broken Object Level Authorization (BOLA/IDOR):** actuar sobre el recurso de otro usuario cambiando un ID.
- **API3 — Broken Object Property Level Auth (mass assignment):** el cliente inyecta campos que el servidor debería controlar (montos, estado, progreso, `userId`).
- **API5 — Broken Function Level Authorization:** llamar operaciones administrativas o restringidas sin rol.
- **Business-logic bypass:** confiar en estado que el cliente reporta en lugar de derivarlo en el servidor.

---

## Decision

Adoptar **defensa en profundidad con autorización server-authoritative**: cada operación valida
identidad + propiedad + reglas de negocio **en el backend**, independientemente de lo que muestre o esconda
el frontend. El frontend se trata como una capa de UX, nunca como control de seguridad.

---

## Diagnóstico del sistema actual

### Frontend — lo que YA está bien (evidencia en código)

| Control | Evidencia |
|---|---|
| El servidor es autoritativo del dinero | `create-transaction.ts` envía `quantity`/`pricePerUnit`/`fee`; **nunca** `totalValue`. Los tipos de `FrictionBreakdown`/`TransactionResponse` documentan *"calculated server-side; the UI never performs arithmetic on money"*. |
| Sin `userId` de cliente | El frontend no envía `userId` en ningún body; solo aparece como campo de **respuesta** (`portfolio.types.ts`). Todo va por `/users/me` y `/me/...`. |
| Sin autorización en el cliente | No hay `isAdmin`/`hasRole`/`ROLE_` que decidan permisos; no se exponen endpoints admin/roles/lista-de-usuarios. No hay control que *bypassear* del lado cliente. |
| Tokens fuera del alcance de JS | Access token solo en memoria; refresh como cookie HttpOnly vía BFF (ver trabajo BFF↔backend). Nada de tokens en `localStorage`/DOM. |
| Idempotencia | `X-Idempotency-Key` en creación de transacciones evita duplicados por reintento. |
| Errores controlados | El cliente nunca expone stack traces ni el `detail` crudo del backend. |

**Conclusión frontend:** la superficie de "bypass de control **de cliente**" es baja — no hay lógica de
autorización en el navegador que se pueda saltar. El GBM deshabilitado es la única excepción (gating de UX,
asumido y aceptado).

### Dónde vive el riesgo real (backend — NO verificable desde este repo)

La superficie IDOR/BOLA está en **cada endpoint con `{id}` en la ruta**. El prefijo `/me/` *sugiere* scoping
por usuario autenticado, pero **eso debe verificarse en el servidor**, no asumirse:

| Endpoint (desde `endpoints.ts`) | Riesgo si el backend no valida propiedad |
|---|---|
| `PUT/DELETE /api/v1/me/transactions/{transactionId}` | Editar/borrar transacciones de otro usuario. |
| `GET /api/v1/me/transactions/details/{id}` | Leer transacciones ajenas. |
| `DELETE /api/v1/me/sessions/{sessionId}` | Revocar sesiones de otro usuario. |
| `GET .../import-jobs/{jobId}`, `POST .../{jobId}/retry` | Ver/re-disparar jobs de importación ajenos. |
| `GET .../portfolio/{portfolioId}/holdings-performance` | Leer rendimiento de carteras ajenas. |
| `GET .../portfolio/{symbol}` , `.../portfolio/cetes/{transactionId}/mark-to-market` | Leer posiciones ajenas. |

El equivalente directo al ataque Saberes MX en nuestro dominio **no** es una constancia, pero la mecánica es
idéntica: **peticiones directas + ownership no verificado + estado confiado al cliente**.

---

## Controles requeridos (checklist accionable)

### Backend (donde se cierra la vulnerabilidad — bloqueante)
- [ ] **Object-level authZ en TODA operación con `{id}`:** derivar el `userId` **del token**, nunca del request; validar `resource.ownerId == token.userId` antes de leer/mutar. Devolver `404` (no `403`) para no filtrar existencia.
- [ ] **Estado autoritativo del servidor:** progreso, estado de job, montos, P&L, "completado", constancias/reportes — **derivados en el servidor**. Nunca aceptar del cliente un campo que represente un logro o un valor de dinero.
- [ ] **Anti mass-assignment:** whitelist explícito de campos por endpoint (DTOs de entrada); ignorar/rechazar `userId`, `status`, `totalValue`, `ownerId`, `role`, etc. si llegan en el body.
- [ ] **Function-level authZ:** endpoints admin (`/users`, `/roles`, `delete_user`, …) exigen rol server-side; no depender de que el frontend "no los muestre".
- [ ] **Gating real de features:** si "GBM · Mercado nacional" debe estar cerrado, que `/statements` responda `403/404` mientras el flag esté off — no solo ocultarlo en la UI.
- [ ] **Rate limiting + idempotencia** en creación/mutación (ya hay `X-Idempotency-Key`; el server debe honrarlo).
- [ ] **Validación de token en cada request** (firma, expiración, revocación); no confiar en `userId`/`courseId`-equivalentes del cliente.
- [ ] **Logging/alerta** de accesos denegados por ownership (señal de enumeración de IDs).

### Frontend (mantener la postura actual)
- [ ] Nunca enviar `userId` ni valores de dinero/estado computados por el cliente (ya se cumple — no regresar).
- [ ] No introducir autorización solo-cliente que "proteja" datos; el gating de UI es UX, no seguridad.
- [ ] Mantener tokens fuera de JS/DOM/storage (postura BFF actual).
- [ ] IDs opacos/no adivinables en respuestas cuando sea posible (UUID, no secuenciales) para subir el costo de enumeración.

### Verificación (tests)
- [ ] Suite de **BOLA**: usuario A intenta `GET/PUT/DELETE` recursos de usuario B por ID → debe dar `404`.
- [ ] Suite de **mass-assignment**: enviar `userId`/`totalValue`/`status` en bodies → el server los ignora.
- [ ] Test de **feature-flag**: con GBM off, `POST /statements` → `403/404`.

---

## Trade-off Analysis

- **Autorización server-authoritative** cuesta trabajo de backend, pero es el **único** punto donde se cierra la clase completa (BOLA + bypass + mass-assignment). Cualquier control de cliente es evadible por definición.
- **`404` vs `403`** en recursos ajenos: `404` no filtra existencia (mejor contra enumeración) a costa de mensajes menos precisos para el usuario legítimo — aceptable.
- **IDs opacos** suben el costo de enumeración pero no sustituyen la verificación de propiedad; son complemento, no control primario.

## Consequences
- **Más fácil:** razonar la seguridad ("el servidor decide, siempre"); el frontend queda libre de responsabilidad de authZ.
- **Más difícil / trabajo nuevo:** el backend debe auditar cada endpoint `{id}`; se requiere una suite de tests BOLA/mass-assignment que hoy no existe en este repo (es backend).
- **A revisar:** el gating de features (GBM) queda a medias mientras no haya enforcement server-side; documentarlo como riesgo aceptado o cerrarlo en backend.

## Action Items
1. [ ] Backend: auditar los endpoints `{id}` de la tabla de riesgo y confirmar verificación de ownership (o corregir).
2. [ ] Backend: añadir suite de tests BOLA + mass-assignment (usuario A vs B).
3. [ ] Backend: decidir el gating real de "GBM · Mercado nacional" (flag server-side) o registrar como riesgo aceptado.
4. [ ] Frontend: mantener las invariantes de esta ADR en revisión de PR (no `userId`/dinero desde cliente; no authZ solo-cliente).
5. [ ] Seguridad: revisión periódica contra OWASP API Top 10 (API1/API3/API5) como parte del quality gate.
