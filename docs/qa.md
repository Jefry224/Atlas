# Verificación de Analog Atlas V1

Fecha: 14 de noviembre de 2026.

## Resultado local

`npm run check`: **9 pruebas aprobadas; 0 fallos**. Se ejecutaron además `node --check app.js` y `node --check data.js`.

Comprobado de forma automatizada:

- 14 registros con IDs únicos, coordenadas numéricas acotadas y fuentes HTTPS.
- Tres perfiles; criterios sin duplicados y pesos positivos que suman 100.
- Puntajes reproducibles y contribuciones reconciliadas; etiquetas faltantes no suman puntos.
- Desempates por evidencia del perfil y nombre; el resultado no depende del orden de entrada.
- Ejemplos: Merzouga/Dumont, Black Point y Atacama/ARADS conservan su evidencia del perfil.
- Pampa de La Joya no recibe los 55 puntos de hiper-aridez sin soporte puntual.
- En DOM simulado: 14 marcadores y 14 entradas para cada perfil; selección de cada sitio desde ambos controles mantiene sincronizados el detalle y `aria-pressed`.
- En DOM simulado: cambios de perfil y selecciones repetidas no duplican entradas ni selecciones activas.
- Recursos locales, destinos de anclas, aviso de alcance, alternativa sin JavaScript y reglas de foco/movimiento reducido presentes.

La auditoría documental está en [source-audit.md](source-audit.md). Los límites de coordenadas y de evidencia se indican explícitamente; no se ha hecho una auditoría geoespacial del catálogo completo.

## Revisión de navegador pendiente

El entorno local impidió iniciar Chromium (creación de sockets no permitida). El navegador conectado no alcanzó los servidores locales y no admite el esquema `file:`. Por eso **no se afirma una revisión visual de escritorio o móvil**, ni pruebas de teclado reales, ausencia de desbordamiento horizontal o conformidad WCAG. El arnés DOM anterior no comprueba CSS ni píxeles.

Checklist para completar desde una URL de demo accesible:

- [ ] Escritorio, 1440 × 900: encabezado, mapa, lista, detalle y método legibles, sin cortes.
- [ ] Móvil, 390 × 844 y 320 × 568: sin desplazamiento horizontal; todos los controles accesibles.
- [ ] En cada perfil, seleccionar un punto del mapa y una entrada de la lista; misma ficha y selección activa.
- [ ] Acceder a los marcadores superpuestos desde el listado y con teclado.
- [ ] Tab/Mayús+Tab, Enter/Espacio: foco visible, orden lógico y selección funcional.
- [ ] «Ver ficha» y «Saltar al explorador» llevan al destino correcto.
- [ ] Cambiar los tres perfiles y repetir clics; sin duplicados ni estado desincronizado.
- [ ] Movimiento reducido: no depende de transiciones; sin JavaScript se muestra el mensaje alternativo.
- [ ] CSS/JS sirven correctamente y no hay errores de consola.
- [ ] Revisar contraste y lectores de pantalla; una pasada visual no demuestra conformidad completa.

## Publicación

La verificación del repositorio público, commit remoto, GitHub Pages y sus recursos depende del entorno de publicación. Este informe local no acredita esos pasos. Completar aquí o en la entrega el enlace y hash realmente verificados.
