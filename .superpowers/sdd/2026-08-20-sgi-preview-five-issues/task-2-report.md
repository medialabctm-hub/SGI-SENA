# MDL-74 — Contrato estricto y accesibilidad de Solicitar Equipo

## Estado

Completada.

## Causa raíz

`normalizeLoanResponse` aceptaba tanto cuerpos directos como envelopes y solo verificaba que `equipo`, `aprendiz` y `clase` fueran truthy. Eso permitía confirmar un préstamo con arrays, objetos parciales o campos vacíos. En el formulario, los `required` nativos impedían que el manejador existente publicara sus errores inline con ARIA. El Toast podía programar más de un cierre si coincidían el autocierre y el botón. En la ronda de fix, el efecto del Toast además dependía de la identidad de `onClose`: un rerender del padre durante la transición limpiaba y cancelaba el único temporizador pendiente.

## Archivos

- `frontend/src/utils/loanRequest.js`: exige `data` y los campos que consume la confirmación.
- `frontend/src/utils/loanRequest.test.js`: pruebas del contrato y bloqueo de confirmación.
- `frontend/src/utils/api.js` y `frontend/src/utils/api.test.js`: conserva mensajes seguros/accionables, incluido 429, en la única capa API.
- `frontend/src/pages/SolicitarEquipo.jsx`: etiquetas visibles y asociaciones ARIA para documento y placa.
- `frontend/src/components/Toast.jsx`, `frontend/src/utils/toastLifecycle.js`, `frontend/src/utils/toastLifecycle.test.js` y `frontend/src/styles/components/toast.css`: cierre idempotente y mensajes largos legibles.
- `frontend/src/components/Toast.test.jsx` y `frontend/src/pages/SolicitarEquipo.test.jsx`: pruebas de componentes React reales.
- `frontend/vite.config.mjs`, `frontend/package.json` y `frontend/package-lock.json`: ejecución Vitest/JSDOM aislada de las pruebas heredadas de `node:test`.

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

5. Ronda de fix 1 — componente Toast (RED):

   ```powershell
   npx vitest run src/components/Toast.test.jsx src/pages/SolicitarEquipo.test.jsx --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
   ```

   Resultado: 5/6 pruebas pasaron y falló la regresión esperada: al cambiar la identidad de `onClose` durante los 300 ms, el callback vigente recibió 0 llamadas. La primera ejecución detectó además que el setup existente de jest-dom no tenía `expect` global; se configuró Vitest con `globals: true` antes de repetir el RED funcional.

6. Ronda de fix 1 — GREEN y verificación final:

   ```powershell
   npm test -- --pool=threads --maxWorkers=1 --minWorkers=1
   node --test src/utils/api.test.js src/utils/loanRequest.test.js src/utils/loanRequest.integration.test.js src/utils/toastLifecycle.test.js
   npx eslint src/components/Toast.jsx src/components/Toast.test.jsx src/pages/SolicitarEquipo.jsx src/pages/SolicitarEquipo.test.jsx src/utils/toastLifecycle.js src/utils/toastLifecycle.test.js vite.config.mjs
   npm run build
   ```

   Resultado: Vitest 16/16, `node --test` 18/18, ESLint focal sin errores y build correcto. La regresión comprueba un rerender del Toast con callback nuevo durante el cierre, y confirma exactamente una llamada al callback vigente.

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
- Un rerender con `onClose` inline ya no cancela un cierre en curso; `message` o `type` reinician el ciclo del Toast.
- Pruebas de componente reales cubren Toast, ambos campos del formulario, ARIA y disponibilidad de controles a 320/375 px.
- Flujo probado sin overflow a 320 y 375 px.

## Commit

`eba5c0a1893c2d1f9d4d0e5a06ee931fe01773ec` (`fix: harden autoservicio loan feedback`).

## Concerns

- Node emite advertencias de `MODULE_TYPELESS_PACKAGE_JSON`; no se modificó `package.json` porque es una configuración transversal ajena a MDL-74.
- Vite advierte un chunk final mayor a 500 kB; es una deuda previa/no bloqueante y queda fuera del alcance.
- El servidor de desarrollo informó referencias existentes bajo `/public/images`; no bloquearon el build ni la prueba de viewport y quedan fuera de este flujo.
- React Router emite dos future warnings en JSDOM; no afectan las aserciones ni el build.
- La instalación de tooling informó 22 vulnerabilidades transitivas (`npm audit`); no se ejecutó `npm audit fix` para evitar una actualización no acotada de dependencias.
