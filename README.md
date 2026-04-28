# Crypto Portfolio Monitoring Frontend

Frontend Next.js del monitor de portfolio conectado al backend Spring Boot.

**Ruta local**
`C:\Users\Ortiz\OneDrive\Documentos\eclipse-workspace\crypto-portfolio-monitoring-frontend`

## Vista rapida

| Quiero... | Comando / archivo |
| --- | --- |
| correr en local | `npm install` y `npm run dev` |
| validar sin mezclar `.next` | `npm run build:isolated` |
| correr tests | `npm run test` |
| levantar en Docker | `docker compose up -d --build` |
| detener Docker | `docker compose down` |
| revisar CI | [.github/workflows/frontend-ci.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.github/workflows/frontend-ci.yml) |
| revisar secure CI | [.github/workflows/frontend-secure-ci.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.github/workflows/frontend-secure-ci.yml) |

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- Vitest

## Antes de empezar

- Node.js 22 recomendado
- npm 10+
- backend disponible en `http://localhost:8080` para desarrollo local
- Docker Desktop si vas a usar contenedores

## Arranque rapido

### Opcion 1: desarrollo local

```powershell
npm install
npm run dev
```

Frontend:
`http://localhost:3000`

Backend esperado:
`http://localhost:8080`

### Opcion 2: contenedor Docker

```powershell
docker compose up -d --build
```

App disponible en:
`http://localhost:3000`

Para detener:

```powershell
docker compose down
```

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

<details>
<summary><strong>Que valida el frontend en runtime</strong></summary>

- un frontend publicado no puede apuntar a una API `localhost`
- un frontend publicado no puede apuntar a una API sin `https`
- `NEXT_PUBLIC_APP_URL` debe coincidir con el origen real del navegador
- la sesion queda namespaced por `apiOrigin` para no mezclar tokens entre ambientes

</details>

## Scripts utiles

```powershell
npm run dev
npm run build
npm run build:isolated
npm run test
npm run lint
npm run ci:verify
```

<details>
<summary><strong>Que hace cada script</strong></summary>

- `dev`: levanta Next.js en desarrollo
- `build`: build normal de produccion
- `build:isolated`: build hacia `.next-build` para no contaminar `.next`
- `test`: corre Vitest
- `lint`: corre lint del proyecto
- `ci:verify`: ejecuta test + build aislado

</details>

## Auth y sesion

Flujos soportados:

- registro
- login por credenciales
- refresh token
- logout
- callback OAuth2 Google

Notas:

- el frontend usa `Authorization: Bearer ...`
- el refresh se hace con `X-Refresh-Token`
- si la sesion expira, redirige a `/login?session_expired=1`

## Docker

Construir imagen manualmente:

```powershell
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 -t crypto-portfolio-monitoring-frontend:local .
```

Levantar con Compose:

```powershell
docker compose up -d --build
```

Variables usadas por Compose:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `FRONTEND_PORT`

<details>
<summary><strong>Comandos de operacion rapida</strong></summary>

Rebuild:

```powershell
docker compose up -d --build
```

Detener:

```powershell
docker compose down
```

Ver contenedores:

```powershell
docker ps
```

</details>

## GitHub Actions

### Frontend CI

Workflow: [.github/workflows/frontend-ci.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.github/workflows/frontend-ci.yml)

Hace:

- `npm ci`
- `npm audit --audit-level=high`
- `npm test`
- `npm run build:isolated`
- build Docker
- smoke test con `GET /login`

Variables recomendadas en `Repository Variables`:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

### Frontend Secure CI

Workflow: [.github/workflows/frontend-secure-ci.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.github/workflows/frontend-secure-ci.yml)

Hace:

- `npm ci --include=dev`
- chequeo TypeScript estricto
- lint estricto
- build
- SBOM CycloneDX
- `npm audit --audit-level=high`
- Trivy dependency scan
- Trivy secret scan
- CodeQL

## Publicacion en Git

El repo ya queda preparado con:

- `.gitignore` afinado para Next.js, logs, caches e IDE
- `.gitattributes` para normalizar finales de linea

Secuencia tipica:

```powershell
git init
git add .
git commit -m "chore: initial frontend setup"
git branch -M main
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

## Checklist antes de conectar a produccion

### Frontend

- `NEXT_PUBLIC_API_BASE_URL` apunta al backend correcto
- `NEXT_PUBLIC_APP_URL` apunta al dominio real del frontend
- no quedan referencias activas a `localhost`
- login, refresh y logout funcionan en navegador
- las rutas protegidas redirigen si la sesion expira

### Backend / integracion

- CORS solo permite el dominio real del frontend
- callbacks OAuth registran el dominio real del frontend
- `APP_FRONTEND_BASE_URL` del backend apunta al frontend real
- Redis, PostgreSQL y JWT ya fueron validados en staging

## Mapa del repo

<details>
<summary><strong>Archivos que mas vas a tocar</strong></summary>

- [src/app](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/src/app): rutas App Router
- [src/components](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/src/components): UI y pantallas
- [src/features](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/src/features): auth, portfolio, marketdata, transactions
- [src/lib](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/src/lib): cliente API, config y utilidades
- [tests](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/tests): estructura de pruebas
- [Dockerfile](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/Dockerfile): imagen de produccion
- [docker-compose.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/docker-compose.yml): ejecucion local en contenedor

</details>

## Nota de seguridad

El flujo actual usa `localStorage` para tokens. Si luego quieres endurecer aun mas la sesion en produccion, el siguiente paso recomendado es migrar a cookies `HttpOnly` seguras.
