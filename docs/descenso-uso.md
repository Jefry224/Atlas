# Elegir destino, evaluar con análogo, aterrizar y explorar

Preview local: `http://localhost:8031/`. Desde Atlas, `npm start -- --host 0.0.0.0 --port 8031` sirve la aplicación y `/api/health`; `npm run dev -- --port 8031` activa recarga de desarrollo. La sesión es local y se reinicia al recargar.

## Destino primero

Elegí **Luna o Marte** en los cuatro escenarios A.R.E.S.: Marius Hills, Shackleton, Jezero o Valles Marineris. La secuencia del mando es **Preparar misión (zona → carga y resumen) → Confirmar preparación → Iniciar descenso → Revisar y desplegar → Explorar con rover espejo**. El catálogo de catorce sitios conserva su exploración directa con rover.

Cada escenario asocia automáticamente una referencia terrestre: La Corona, Wright Valley, Atacama o Wadi Rum. El texto explica qué rasgos permiten el ensayo y qué rompe la analogía: terreno y navegación pueden contrastarse; gravedad, atmósfera y contexto térmico difieren. No se hace una búsqueda ni un ranking global de análogos.

**Comparar análogo · opcional** abre la región terrestre en el visor y su explicación, con acceso a datos, análisis y M2. Activarlo no inicia otro vuelo, no cambia la sesión y no es condición para lanzar. La Tierra es una referencia estática en superficie durante el descenso: no tiene nave, lectura de vuelo vacía, selección de contacto ni combustible.

El mando queda junto al visor en escritorio y antes del visor en móvil. **Ver aterrizaje** lleva al terreno sin desplazar automáticamente la página durante el vuelo. El visor móvil tiene pausa/reanudación y regreso al mando; en comparación permite alternar Tierra y destino. La guía de primer uso usa la versión `target-preparation-v3`, conservada en localStorage, para explicar los dos pasos aunque antes se haya ocultado una guía antigua. Tab y Shift+Tab permanecen dentro del diálogo; Escape devuelve el foco sin confirmar.

## Preparar solo el destino

**Preparar misión** abre un diálogo sobre el visor, con dos etapas: **Zona del destino** y **Carga y resumen**. Se abre automáticamente cuando termina la carga del escenario; cerrar con × o Escape no confirma ni inicia. El contenido se desplaza dentro del diálogo en pantallas pequeñas, con etapas y acciones siempre visibles. No hay un segundo mapa debajo de la página. La primera etapa contiene el mapa 2D del DEM objetivo. Tres candidatos numerados y sus cartas comparten selección; azul indica elevación relativa, el diamante rosa marca ciencia. Ejes locales: x este, z sur, en metros. No es imagen satelital. Tierra y objetivo tienen marcos independientes.

Clic o tap elige un candidato. Tab entra al mapa; flechas recorren candidatos elegibles y Enter/Espacio confirma. La selección cambia pendiente, desnivel, distancia a ciencia y destino del descenso, conservando el punto científico. Candidatos no evaluables quedan desactivados. Después de revisar la zona, **Carga y resumen →** muestra cuerpo, zona, pendiente, desnivel, kg de propelente y masa inicial. **← Zona del destino** permite volver. **Confirmar preparación** cierra el diálogo y habilita **Iniciar descenso**, dejando la nave detenida. El inicio bloquea zona y carga; reiniciar abre una preparación nueva.

Un único slider carga **0–100 % del propelente de la nave objetivo**, mostrando kg de propelente y masa inicial. Por ejemplo, Luna al 80 % usa 144 kg y 994 kg de masa inicial; Marte al 100 % usa 260 kg y 1110 kg. Cambia la condición inicial del motor y del registro, sin modificar el perfil propuesto. El porcentaje no es probabilidad ni garantía de contacto. La malla NASA no determina masa.

**Ensayos avanzados de fallo** ofrece combustible objetivo cero, con un aviso explícito de fallo deliberado antes de confirmar; **Restablecer 100 %** devuelve la carga nominal. Tierra no necesita una carga ni un aterrizaje adicional.

## Descender y revisar

**Iniciar descenso** usa la preparación confirmada de la sesión activa, evalúa brevemente la región e inicia el tramo propulsado final del destino. Confirmar por sí solo no arranca el motor. Todas las entradas de producto —mando, CTA del resumen, play, controles del visor, teclado y transmisión— respetan el mismo gate central, además de las restricciones de contacto y despliegue.

**Preparar misión** permite editar antes del vuelo. Cambiar zona o carga invalida la confirmación, incluso si después se revierte la edición: hay que confirmar de nuevo. Reiniciar, cambiar escenario o recargar sus datos también la invalida. Cambiar cámara, velocidad de vuelo o comparación terrestre no la invalida. Sin DEM objetivo o candidato elegible no se puede confirmar ni forzar el vuelo. El catálogo terrestre conserva su inicio directo. El visor predeterminado muestra solo su terreno y nave esquemática. No hay controles manuales de motor ni contacto prefijado.

El vuelo empieza a **1× SIM**, con **0,5× / 1× / 2× / 4×**, pausa/reanudación y cámaras Exterior, Inferior y Orbital. Cambiar velocidad afecta al avance futuro y queda registrado; no reescribe historia. UTC, segundos SIM del vuelo y tiempo rover **20×** son distintos. Las lecturas del destino muestran AGL, velocidades, propelente, masa y tiempo SI. Una velocidad vertical negativa indica descenso.

Las animaciones de etapas y cámara preservan foco e instrumentos. `prefers-reduced-motion` elimina animaciones decorativas e interpolación visual; el descenso deliberado sigue funcionando. Ocultar la página o salir de la vista pausa el vuelo; volver exige reanudar. **Interrumpir** detiene el ensayo, sin maniobra de escape.

Un **contacto nominal del destino** basta para llegar a **Revisar el contacto**. El estado espera sin temporizador y el rover permanece retenido. Solo **Desplegar rover** autoriza: otros botones de inicio, reanudación, conducción o transmisión no eluden esa puerta. Se conservan las tolerancias del modelo, sin afirmar seguridad ni EDL completo.

Si el destino falla, no hay despliegue aunque exista un DEM terrestre válido. **Volver a preparar** reinicia carga 100 %, vuelo 1× y selección editable. El fallo nunca pasa a contacto al reanudar.

## Rover de ensayo terrestre y espejo del destino

Tras la autorización se despliega en el **contacto real calculado del objetivo** y el visor abre la pareja. **Tierra: Rover de ensayo** es la autoridad de conducción; **Luna/Marte: Rover espejo · simulado** refleja su desplazamiento relativo en tiempo real. No existe hardware enlazado.

El rover terrestre inicia en `explorationOrigins.earth`, centro válido del DEM con elevación medida por interpolación, rol `analogue-test-origin`. Es un origen de ensayo en superficie, sin evaluación de aterrizaje ni certificación. El rover objetivo parte de `explorationOrigins.target`, rol `target-contact`, calculado por el contacto SI. La nave queda en ese contacto planetario.

La relación es `poseObjetivo = contactoObjetivo + (poseTierra − origenEnsayoTierra)`. No se copian coordenadas absolutas ni se supone homología. Cada rover evalúa pendiente y actitud en su propio DEM y posición. `S.rover`, consumo, batería, gravedad de conducción y meteorología del ensayo siguen siendo terrestres. El clima actual del proveedor es **modelo meteorológico terrestre**, no telemetría de hardware ni fuerza del descenso marciano.

**Conducir rover** abre los controles existentes: autónomo o manual con WASD/flechas y pad táctil. Los rovers sincronizan desplazamiento; la distancia a ciencia usa sus marcos propios. La transmisión simulada, cámaras de rover, galería NASA, copiloto y laboratorio manual M2 se conservan.

Sin origen terrestre válido se puede aterrizar y desplegar en el destino, pero **la conducción espejo no está disponible**. Se explica la ausencia y no se inventa un origen terrestre. Fuera de cobertura del objetivo no se extrapola el espejo. Reiniciar abre una sesión nueva y vuelve a retener los rovers.

## Límites y descargas

Amarillo indica candidato, naranja precaución y gris no evaluable. La clasificación es heurística, sin probabilidad de éxito. Línea discontinua: previsión esquemática; continua: muestras del vuelo SI. Relieve ×2 y nave ×6 son escalas visuales. El rover conserva su escala y perfil de 350 kg.

Los DEM regionales a 37,5 m no resuelven patas, rocas, paredes ni el pozo de Marius. Solo se ensaya descenso propulsado final: Luna en vacío; Marte sin entrada, paracaídas, viento ni aerodinámica. Estado y DEM idealmente conocidos; sin TRN NASA implementada. Ver [modelo, dominio y fuentes](descenso-modelo.md).

Sin WebGL funcionan mapa 2D, radar, controles, lecturas, motor y exportaciones. Si falta DEM objetivo se identifica como no evaluable; si falta DEM terrestre solo se pierde ensayo/espejo.

**Exportar JSON**, dossier JSON/Markdown y Excel M2 conservan la identidad de la sesión activa. El evento `preparation-confirmed` de la bitácora M2 incluye sesión, escenario, cuerpo, zona, carga porcentual, kg y masa inicial. Las ediciones confirmadas anteriormente dejan un evento `preparation-invalidated`; un reset crea otra sesión sin confirmaciones obsoletas. El JSON de misión añade `preparation` con la confirmación vigente, y el vuelo refleja la misma zona y condición inicial. `runs.earth` y `history[].earth` son `null`; no son vuelos pendientes. `rover.body=earth` conserva coordenadas del ensayo y `targetRover.body` indica Luna/Marte cuando existe espejo. Los orígenes y contacto objetivo quedan explícitos. Excel conserva sus doce hojas base y añade Descenso, Trayectoria y Zona_ensayo cuando hay vuelo; Tierra aparece como referencia, sin trayectoria inventada. M2 y el copiloto usan el contacto objetivo primario y el mismo registro.

Se guardan hasta 1200 muestras a un máximo de 4 Hz reales y 300 eventos. UTC, tiempos SI, tasa y eventos se conservan; no se incluyen rasters ni mallas. Las georreferencias solo aparecen cuando existe marco verificable. Los nulos no se convierten en ceros.

## Verificación reproducible

Después de integrar controlador y reportes, `npm run check` ejecuta sintaxis y la suite local. Con Orca y preview abiertos:

```sh
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --preparation-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --desktop-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --mobile-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --motion-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --fallback-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --extras-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --mirror-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --visual-only
python3 scripts/qa-preparation-exports.py
```

Sin selector ejecuta escritorio, movimiento reducido y fallbacks; móvil se ejecuta con su selector. Después de preparación/escritorio, `python3 scripts/qa-preparation-final.py PAGE_ID http://localhost:8031/` ejecuta visual, móvil, fallbacks, movimiento y extras de forma secuencial; `--resume` reutiliza únicamente grupos terminados con exitCode 0. El resumen se guarda en `qa-final-run.json`. Los scripts QA anteriores redirigen al recorrido vigente. Capturas, descargas UI y números quedan en [evidencias de misión al destino](evidencias/mision-destino/informe.md). La revisión de preparación guarda capturas y descargas en [preparación y rendimiento](evidencias/preparacion-rendimiento/informe.md). Son ejecuciones de una simulación local, no observaciones de misión real.

La vista usa `renderState()` readonly con revisiones del plan e historial, compartida por escena, cámara y HUD en cada frame. La ruta espejo y los buffers se actualizan cuando cambian sus datos; las copias completas quedan para exportación. No se reducen DEM, física SI, subpasos, tasas, muestras, NASA ni animaciones para aliviar el render. La comparación de coste medido y los límites del host están en el informe; los clics de QA no constituyen una medición de FPS.
