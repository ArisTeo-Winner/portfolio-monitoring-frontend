# 🚀 FRONTEND MIGRATION PLAN – FINTECH GRADE

## 🎯 Objetivo

Migrar el frontend actual (Next.js 15 + React 19 + TypeScript) a una arquitectura:

- Modular Clean Frontend
- Mobile-First real
- OWASP ASVS Level 2 compliant
- Secure token handling
- BFF-ready
- Test-driven & CI gated
- Fintech-grade maintainability

---

# 📌 FASE 0 – PREPARACIÓN

## 0.1 Crear rama de migración

git checkout -b refactor/frontend-fintech-grade

## 0.2 Activar reglas estrictas

- Strict TypeScript
- ESLint + security plugins
- Prettier enforcement
- Husky pre-commit

Instalar:

npm install -D eslint-plugin-security eslint-plugin-sonarjs

---

# 🔐 FASE 1 – HARDENING INMEDIATO

## 1.1 Seguridad de Tokens

Objetivo:
- Access token en memoria (no localStorage)
- Refresh token en HttpOnly cookie
- Cross-tab logout sync

Acciones:

- Eliminar cualquier uso de localStorage para JWT
- Implementar session store en Zustand:
  src/state/session.store.ts

- Agregar BroadcastChannel API para sincronización multi-tab

---

## 1.2 Content Security Policy

Agregar headers en next.config.ts:

headers: async () => [
  {
    source: "/(.*)",
    headers: [
      {
        key: "Content-Security-Policy",
        value: "default-src 'self'; script-src 'self'; connect-src 'self' https://crypto-portfolio-monitoring.onrender.com"
      },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
    ]
  }
]

---

## 1.3 Zod Validation Global

Crear:

src/core/validation/

- schemas/
- error-mapper.ts

Todo form debe:
- Validar con Zod
- Mapear error backend → UI error model
- Nunca confiar solo en backend

---

# 🧱 FASE 2 – REESTRUCTURACIÓN ARQUITECTÓNICA

## 2.1 Nueva estructura

Refactor a:

src/
 ├─ app/
 ├─ core/
 │   ├─ api/
 │   ├─ config/
 │   ├─ security/
 │   ├─ types/
 │   ├─ error/
 │
 ├─ features/
 │   ├─ portfolio/
 │   │   ├─ domain/
 │   │   ├─ application/
 │   │   ├─ infrastructure/
 │   │   ├─ ui/
 │
 ├─ design-system/
 │   ├─ primitives/
 │   ├─ layout/
 │   ├─ tokens/
 │
 ├─ state/

---

## 2.2 Separación por capas

UI:
- Solo renderiza

Application:
- Orquesta casos de uso

Infrastructure:
- Llama API

Domain:
- Modelos + reglas puras

Ejemplo:

PortfolioDashboard.tsx
   ↓
usePortfolioService()
   ↓
portfolioApi.fetch()
   ↓
backend

---

# 📱 FASE 3 – MOBILE-FIRST REAL

## 3.1 Rediseñar Layout Principal

Base:

flex flex-col min-h-screen

Desktop enhancement:

md:flex-row

---

## 3.2 Sidebar móvil

- Drawer controlado
- No sidebar fija en mobile

---

## 3.3 Tablas → Responsive Pattern

Implementar:

- Mobile: Card-based list
- Desktop: Table

Nunca overflow horizontal sin control.

---

# 🧪 FASE 4 – TESTING COMPLETO

## 4.1 Unit Tests

- Testing Library
- Vitest o Jest
- Cobertura mínima 80%

## 4.2 Integration Tests

- Mock API con MSW
- Validar estados loading/error/success

## 4.3 E2E

- Playwright
- Login
- CRUD transacciones
- Logout
- Token expiration

---

# 🛡 FASE 5 – OWASP ASVS L2 CHECKLIST

Validar:

- No sensitive data en localStorage
- CSP activa
- XSS prevention
- No inline scripts
- Error mapping sin stack traces visibles

---

# 📦 FASE 6 – SUPPLY CHAIN SECURITY

## 6.1 Generar SBOM

npx @cyclonedx/cyclonedx-npm

## 6.2 Integrar en CI

GitHub Actions:
- npm audit
- dependency review
- CodeQL

Bloquear merge si:

- Vulnerabilidad HIGH o CRITICAL

---

# 🚀 FASE 7 – PREPARACIÓN BFF FUTURO

Eliminar fetch directos externos:

- Toda API call debe pasar por:
  /api/* route handler (Next.js)

Esto prepara arquitectura para:

- Edge runtime
- Mobile app futura
- Microfrontends

---

# 📈 FASE 8 – MONITOREO

Integrar:

- Sentry
- LogRocket opcional
- Error boundary global

---

# 🎯 DEFINICIÓN DE DONE

Migración se considera completa cuando:

- Arquitectura por capas aplicada
- Mobile-first validado en 320px
- CSP activa
- Tokens seguros
- Tests >= 80%
- CI con security gates
- Sin localStorage para datos sensibles
- No llamadas directas a APIs externas desde componentes

---

# 🔥 RESULTADO FINAL

El frontend debe quedar:

- Modular
- Escalable
- Mobile-first real
- Fintech-hardened
- ASVS L2 compliant
- CI protegido
- BFF-ready
- Preparado para app móvil futura