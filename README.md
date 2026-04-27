# Crypto Portfolio Monitoring Frontend

Frontend Next.js para el monitor de portfolio conectado al backend Spring Boot.

Ruta local:
`C:\Users\Ortiz\OneDrive\Documentos\eclipse-workspace\crypto-portfolio-monitoring-frontend`

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

## Variables de entorno

### Desarrollo local
Usa [.env.local.example](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.env.local.example):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Staging / Render
Usa [.env.render.example](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.env.render.example):

```env
NEXT_PUBLIC_API_BASE_URL=https://crypto-portfolio-monitoring.onrender.com
NEXT_PUBLIC_APP_URL=https://your-frontend-staging.example.com
```

## Guardrails de entorno ya activos

El frontend ahora valida en runtime:

- que un frontend publicado no apunte a una API `localhost`
- que un frontend publicado no apunte a una API sin `https`
- que `NEXT_PUBLIC_APP_URL` coincida con el dominio real del navegador
- que las sesiones no se mezclen entre ambientes

La sesión en `localStorage` queda namespaced por `apiOrigin`, así staging y producción no comparten tokens por accidente.

## Auth y sesión

Flujos soportados:
- registro
- login por credenciales
- refresh token
- logout
- callback OAuth2

Notas:
- el frontend usa `Authorization: Bearer ...`
- el refresh se hace con `X-Refresh-Token`
- si la sesión expira, redirige a `/login?session_expired=1`

## Desarrollo

```powershell
npm install
npm run dev
```

Frontend local:
`http://localhost:3000`

## Build estable sin contaminar `.next`

Para validar sin romper `next dev`, usa:

```powershell
npm run build:isolated
```

Eso genera el build en `.next-build` y evita mezclar artefactos de desarrollo con producción.

## Workflows

El repo ya queda listo para CI en GitHub Actions con [.github/workflows/frontend-ci.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.github/workflows/frontend-ci.yml).

Ese workflow hace:
- `npm ci`
- `npm audit --audit-level=high`
- `npm test`
- `npm run build:isolated`
- build de imagen Docker
- smoke test levantando el contenedor y validando `GET /login`

Variables recomendadas en GitHub Actions (`Repository Variables`):
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

Si no existen, el workflow usa defaults seguros de staging para no quedar bloqueado.

## Docker

```powershell
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 -t crypto-portfolio-monitoring-frontend:local .
docker compose up -d --build
```

## Checklist antes de conectar directo a producción

### Frontend
- `NEXT_PUBLIC_API_BASE_URL` apunta al backend correcto
- `NEXT_PUBLIC_APP_URL` apunta al dominio real del frontend
- no quedan referencias activas a `localhost`
- login, refresh y logout funcionan en navegador
- las rutas protegidas redirigen si la sesión expira

### Backend / integración
- CORS solo permite el dominio real del frontend
- callbacks OAuth registran el dominio real del frontend
- cookies / headers / CSP revisados por ambiente
- Redis / PostgreSQL / JWT ya validados en staging

## Pendiente recomendado AppSec

El flujo actual funciona bien con `localStorage`, pero si luego quieres endurecer más la sesión en producción, el siguiente paso recomendado es migrar a cookies `HttpOnly` seguras.
