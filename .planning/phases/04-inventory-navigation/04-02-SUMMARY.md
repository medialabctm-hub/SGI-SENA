---
phase: 04-inventory-navigation
plan: 02
status: verified_local_external_gates_pending
date: 2026-09-28
issues: [MDL-238, MDL-239, MDL-240]
branch: codex/sgi-diseno-uat
base: 35ebfba
---

# Correcciones de diseño: evidencia local

## Entrega

- MDL-238: SVG decorativos por acción; acciones con texto y destinos/permisos conservados; cierre exterior/Escape y foco de retorno; filtros, menú y tabla contenidos, tarjetas móviles sin desbordamiento global.
- MDL-239: FormDialog reutilizable en body por portal, cabecera estable, scroll interno, ancho adaptable, bloqueo del scroll de fondo y navegación Tab/Escape. Integrado en edición de Usuarios y creación/edición de Aprendices. Selectores por encima del modal; no desplazan ancestros al resaltar opciones y devuelven el foco al seleccionar.
- MDL-240: alias manana/mañana para el badge existente. Aprendices y categorías usan DestructiveConfirmModal institucional, frase explícita, errores mediante Toast, Cancelar sin DELETE y bloqueo de doble envío. Foco estable al terminar eliminación y recarga; frase inválida asociada al campo con ARIA.

## Verificación

- Vitest frontend: 29 archivos, 123 pruebas PASS; incluye regresión existente y nuevos casos. Se observaron fallas antes de implementar iconos, diálogos, confirmaciones y foco/scroll de selectores.
- Node tests de utilidades: 22/22 PASS.
- Navegador Chromium local: 22/22 PASS. Equipos: anchos 320/375/768/1024/1280/1864, última fila, SVG, objetivos alcanzables y sin desbordamiento horizontal de página. Edición de Aprendices/Usuarios: 320x640, 375x667, 640x360, 768x600, 1366x600, 1864x930; campos dentro del ancho del diálogo, Guardar alcanzable, selectores utilizables y primer/segundo Escape. Badge Mañana y cancelación institucional sin petición DELETE.
- Build frontend PASS; mantiene advertencia de chunks mayores a 500 kB.
- ESLint focal: 14 archivos, 0 errores, 15 advertencias; no se declara lint sin advertencias.
- git diff --check PASS.
- Revisión independiente: MDL-238 sin hallazgos; FormDialog e integración sin hallazgos. MDL-240 detectó foco posterior a eliminación y asociación del error; corregidos con tests. La prueba de doble clic verifica el comportamiento observable del bloqueo, no aisladamente el guard useRef.

## Reproducción

Desde frontend, con las dependencias ya instaladas: ejecutar Vitest con vite.config.mjs, build con Vite y ESLint focal. Utilidades con node --test src/utils/*.test.js (expandir archivos en PowerShell).

Levantar Vite local en 127.0.0.1:5175. Ejecutar node e2e/sgi-design-uat.cjs con Playwright disponible en NODE_PATH o node_modules. El harness rechaza hosts remotos, intercepta todas las APIs con datos sintéticos y bloquea orígenes externos; no requiere backend, credenciales ni base de datos. Evidencias generadas en directorio temporal configurable con DESIGN_UAT_OUTPUT. No se añadieron dependencias ni lockfiles.

## Pendientes y límites

- El usuario autorizó publicar un PR hacia PR3S1G4zZ/Encuentro para vista previa. Se prepara como borrador: GSD verification.status devuelve missing para la fase; no se declara ship formal ni aceptación remota. PR54 es la entrega anterior ya incorporada en la base. No merge ni cambios de producción autorizados en esta tanda.
- Pendiente UAT de Railway, pruebas autenticadas reales, dispositivos físicos, teclado virtual, zoom real 200%, lector de pantalla y formularios con mensajes largos. Las capturas locales pueden mostrar fuentes de respaldo al bloquear orígenes externos.
- MDL-237 (Roles y Áreas/permisos) y MDL-241 (clasificación/adaptación/retirada de APIs) no implementados. No hubo cambios backend, contratos de API, SQL, autenticación, variables Railway o datos reales.
- El milestone general sigue en progreso; no se confunde evidencia local con aceptación remota.
