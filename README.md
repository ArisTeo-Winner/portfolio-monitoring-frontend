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
- Vitest

## Requisitos

- Node.js 22 recomendado
- npm 10+
- Backend disponible en `http://localhost:8080` para desarrollo local
- Docker Desktop si vas a usar contenedores

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

## Guardrails de entorno

El frontend valida en runtime:

- que un frontend publicado no apunte a una API `localhost`
- que un frontend publicado no apunte a una API sin `https`
- que `NEXT_PUBLIC_APP_URL` coincida con el dominio real del navegador
- que las sesiones no se mezclen entre ambientes

La sesion en `localStorage` queda namespaced por `apiOrigin`, asi staging y produccion no comparten tokens por accidente.

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

## Desarrollo local

Instalacion:

```powershell
npm install
```

Servidor de desarrollo:

```powershell
npm run dev
```

Frontend local:
`http://localhost:3000`

## Scripts utiles

```powershell
npm run dev
npm run build
npm run build:isolated
npm run test
npm run lint
npm run ci:verify
```

`build:isolated` genera artefactos en `.next-build` para no mezclar el build de CI con `.next`.

## Docker

Construir imagen:

```powershell
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 -t crypto-portfolio-monitoring-frontend:local .
```

Levantar contenedor con Compose:

```powershell
docker compose up -d --build
```

Detener contenedores:

```powershell
docker compose down
```

Puerto por defecto:
`http://localhost:3000`

Variables usadas por Compose:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `FRONTEND_PORT`

## Jenkins

El [Jenkinsfile](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/Jenkinsfile) ejecuta:

- `npm ci`
- `npm test`
- `npm run build`
- `docker build`
- smoke test de la imagen
- despliegue opcional del contenedor

Parametros del pipeline:

- `NEXT_PUBLIC_API_BASE_URL`
- `FRONTEND_PORT`
- `DEPLOY_CONTAINER`

## GitHub Actions

### Frontend CI

El workflow [.github/workflows/frontend-ci.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.github/workflows/frontend-ci.yml) hace:

- `npm ci`
- `npm audit --audit-level=high`
- `npm test`
- `npm run build:isolated`
- build de imagen Docker
- smoke test con `GET /login`

Repository Variables recomendadas:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

### Frontend Secure CI

El workflow [.github/workflows/frontend-secure-ci.yml](C:/Users/Ortiz/OneDrive/Documentos/eclipse-workspace/crypto-portfolio-monitoring-frontend/.github/workflows/frontend-secure-ci.yml) hace:

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

El repo ya queda preparado para publicar con:

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

## Nota de seguridad

El flujo actual usa `localStorage` para tokens. Si quieres endurecer aun mas la sesion en produccion, el siguiente paso recomendado es migrar a cookies `HttpOnly` seguras.
