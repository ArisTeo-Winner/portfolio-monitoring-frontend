Actúa como auditor técnico senior frontend con experiencia en arquitectura modular Next.js + React + TypeScript en sistemas fintech tipo CoinMarketCap, TradingView o Binance.

Contexto:
Este repositorio es un Portfolio Tracker profesional (NO exchange, NO wallet custodial). El frontend está organizado como modular monolith orientado a features. Se requiere crear un protocolo permanente de auditoría técnica exclusivo para frontend que obligue a cualquier agente (Claude Code, Codex, Cursor, Antigravity) a respetar arquitectura, contrato backend y estándar visual fintech.

Objetivo:
Generar un archivo completo en Markdown listo para guardarse en:

/docs/FRONTEND_AUDIT_PROTOCOL.md

El contenido debe ser continuo, estructurado, profesional, sin comentarios fuera del archivo. Solo el contenido final del .md.

Requisitos obligatorios del documento:

1) Título claro:
   FRONTEND AUDIT PROTOCOL
   Portfolio Monitoring – Governance Standard

2) Debe incluir secciones formales con numeración estricta:

1. Mandatory Pre-Change Audit
   - Siempre revisar estructura real del repo antes de modificar
   - Confirmar boundaries por feature
   - Detectar acoplamientos indebidos
   - Confirmar stack real (Next.js, TS, Tailwind, modular feature architecture)

2. Architecture Rules
   - Feature-oriented structure obligatoria
   - API functions en /features/{domain}/api
   - Hooks en /features/{domain}/hooks
   - Components UI reutilizables en /components/ui
   - Components ligados a dominio en /components/{domain}
   - Prohibición de cross-feature imports directos
   - Prohibición de lógica financiera en frontend

3. Data Contract Enforcement
   - Contrato estricto:
     type HoldingsHistoryPoint = { time: number; value: number }
   - No transformar epoch seconds a ms
   - No interpolar valores falsos
   - No recalcular holdings en cliente
   - No mutar estructura del JSON backend

4. Chart Governance (Fintech Standard)
   - Curva suave
   - Sin escalones artificiales
   - Sin jitter
   - Tooltip monetario formateado profesionalmente
   - Escala Y dinámica refinada
   - Sin padding vertical excesivo
   - No fake smoothing

5. Mobile-First Design Enforcement
   Breakpoints oficiales:
   sm 640px
   md 768px
   lg 1024px
   xl 1280px
   2xl 1536px
   - Mobile como base
   - md+ solo extiende
   - No duplicar layouts
   - Densidad compacta estilo Binance

6. Naming Convention
   - kebab-case para archivos
   - PascalCase para componentes
   - camelCase para hooks
   - Prohibición de mezcla inconsistente

7. Performance Rules
   - No múltiples fetch por cambio de rango
   - No re-render en cascada
   - Memoización obligatoria donde aplique
   - Validación con React DevTools Profiler

8. Visual Governance Checklist
   - Padding consistente
   - Sin espacio vertical innecesario
   - Sin secciones duplicadas
   - Jerarquía estricta
   - Consistencia tipográfica tabla + chart

9. Prohibitions
   - No romper contrato backend
   - No introducir interpolación artificial
   - No hardcodear datos
   - No lógica financiera en cliente
   - No romper modular boundaries

10. Agent Operating Mode
   - Siempre auditar repo antes de modificar
   - Corregir inconsistencias estructurales antes de agregar features
   - Mantener coherencia global
   - Pensar en estándar enterprise fintech

11. Quality Standard Definition
   UI debe cumplir:
   Profesional
   Compacta
   Determinista
   Sin ruido visual
   Escalable

Formato requerido:
- Markdown limpio
- Sin texto explicativo fuera del documento
- Sin comentarios adicionales
- Documento continuo
- Profesional
- Nivel enterprise

Entrega únicamente el contenido final del archivo Markdown.