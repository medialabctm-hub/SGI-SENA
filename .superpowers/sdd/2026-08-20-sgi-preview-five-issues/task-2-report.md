# MDL-74 — Contrato estricto y accesibilidad de Solicitar Equipo

## Estado

Completada. El commit final se registra en la sección correspondiente tras el amend del reporte.

## Causa raíz

`normalizeLoanResponse` aceptaba tanto cuerpos directos como envelopes y solo verificaba que `equipo`, `aprendiz` y `clase` fueran truthy. Eso permitía confirmar un préstamo con arrays, objetos parciales o campos vacíos. En el formulario, los `required` nativos impedían que el manejador existente publicara sus errores inline con ARIA. El Toast podía programar más de un cierre si coincidían el autocierre y el botón.

## Archivos

- `frontend/src/utils/loanRequest.js`: exige `data` y los campos que consume la confirmación.
- `frontend/src/utils/loanRequest.test.js`: pruebas del contrato y bloqueo de confirmación.
- `frontend/src/utils/api.js` y `frontend/src/utils/api.test.js`: conserva mensajes seguros/accionables, incluido 429, en la única capa API.
- `frontend/src/pages/SolicitarEquipo.jsx`: etiquetas visibles y asociaciones ARIA para documento y placa.
- `frontend/src/components/Toast.jsx`, `frontend/src/utils/toastLifecycle.js`, `frontend/src/utils/toastLifecycle.test.js` y `frontend/src/styles/components/toast.css`: cierre idempotente y mensajes largos legibles.

## RED → GREEN

1. Contrato de préstamo (RED):

   ```powershell
   node --test src/utils/loanRequest.test.js src/utils/api.test.js
   ```

   Resultado: 13 pasaron, 2 fallaron. `normalizeLoanResponse` no lanzó ante envelope ausente/datos incompletos y `submitLoanRequest` devolvió `success`.

2. Contrato de préstamo (GREEN): mismo comando, resultado 15/15 pasando.

3. Toast (RED):

   ```powershell
   node --test src/utils/toastLifecycle.test.js
   ```

   Resultado: falló con `ERR_MODULE_NOT_FOUND` para el controlador de ciclo de vida aún inexistente.

4. Toast (GREEN) y verificación final:

   ```powershell
   node --test src/utils/toastLifecycle.test.js src/utils/loanRequest.test.js src/utils/loanRequest.integration.test.js src/utils/api.test.js
   npx eslint src/utils/toastLifecycle.js src/utils/toastLifecycle.test.js src/utils/loanRequest.js src/utils/loanRequest.test.js src/utils/api.test.js src/pages/SolicitarEquipo.jsx src/components/Toast.jsx
   npm run build
   ```

   Resultado: 18/18 pruebas pasando; ESLint focal sin errores; build de Vite correcto.

## Accesibilidad y viewport

Prueba interactiva local en `/solicitar-equipo`:

- RED a 320 px: el `required` nativo bloqueó el submit, por lo que no apareció el error inline ni atributos ARIA.
- GREEN a 320 px: error `El documento es obligatorio`, `aria-invalid="true"`, `aria-describedby="documento-error"` y `role="alert"` enlazado.
- A 320 y 375 px: `scrollWidth === viewportWidth`; no hay desbordamiento horizontal.

## Criterios cubiertos

- Envelope `data` estricto y objetos/campos de confirmación válidos.
- Respuestas inválidas no alcanzan la confirmación.
- Mensajes accionables para 404, 409, 429 y 500 preservados mediante `buildErrorMessage` sin capa API duplicada.
- Etiquetas visibles, estado inválido y descripción de error accesible para documento y placa.
- Temporizadores del Toast idempotentes y limpiados al desmontar; contenido largo puede partirse sin desplazar el botón de cierre.
- Flujo probado sin overflow a 320 y 375 px.

## Commit

Pendiente de registrar tras crear el commit.

## Concerns

- Node emite advertencias de `MODULE_TYPELESS_PACKAGE_JSON`; no se modificó `package.json` porque es una configuración transversal ajena a MDL-74.
- Vite advierte un chunk final mayor a 500 kB; es una deuda previa/no bloqueante y queda fuera del alcance.
