# Crypto Portfolio Monitoring Frontend

Frontend separado del backend Spring Boot.

Ruta:
`C:\Users\Ortiz\OneDrive\Documentos\eclipse-workspace\crypto-portfolio-monitoring-frontend`

## Stack previsto
- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

## Backend esperado
- Base URL: `http://localhost:8080`
- Variable: `NEXT_PUBLIC_API_BASE_URL`

## Docker
Construir la imagen:

```powershell
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 -t crypto-portfolio-monitoring-frontend:local .
```

Levantar con Docker Compose:

```powershell
docker compose up -d --build
```

La app queda disponible en `http://localhost:3000`.

Variables utiles:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:8080"
$env:FRONTEND_PORT="3000"
```

## Jenkins
El `Jenkinsfile` ejecuta:

- `npm ci`
- `npm test`
- `npm run build`
- `docker build`
- smoke test de la imagen generada

Parametros del pipeline:

- `NEXT_PUBLIC_API_BASE_URL`: backend usado por el build de Next.js.
- `FRONTEND_PORT`: puerto del host cuando se despliega desde Jenkins.
- `DEPLOY_CONTAINER`: si esta activo, Jenkins reemplaza y levanta `crypto_portfolio_frontend`.

## Proximo foco
- Login/Register
- Portfolio dashboard
- Add Transaction modal
