# Ajustes de interfaz

La vista de escritorio separa un panel lateral de exploración y el mapa. El panel reúne servicios, filtros, leyenda y acciones; solo la zona de filtros se desplaza cuando falta altura. La vista móvil mantiene servicios horizontales con centrado de la selección, filtros plegables y acciones inferiores etiquetadas. Zoom y ubicación se agrupan en el borde derecho del mapa. La redistribución no modifica la fórmula ni la normalización del mapa de calor.

La revisión de composición incorpora filtros secundarios plegables, una barra de acciones ciudadanas con etiquetas y un asistente de reporte con servicios en filas. El asistente conserva los tres pasos, mantiene las acciones visibles mientras se desplaza el contenido y contiene/restaura el foco del teclado al abrir/cerrar. Los controles secundarios conservan sus valores al plegarse; no cambia el contrato de consulta ni de registro. Se versionan las referencias de estilos y del módulo ciudadano para evitar combinaciones de recursos anteriores.

Se conservan los cuatro apartados de IU-04: incidencias (RF-09), cortes programados (RF-07), estadísticas (RF-10) y bitácora.

La presentación utiliza colores institucionales, controles táctiles, foco visible y diseños adaptables. El formulario de cortes permite seleccionar un barrio como referencia, ajustar el marcador y validar la relación entre fechas. La asignación territorial definitiva sigue siendo responsabilidad del servidor.

Por solicitud expresa del responsable del proyecto, la cartografía base cambia de OpenStreetMap a Esri WorldStreetMap con atribución visible. Las fotografías se comprimen a un máximo de 960 píxeles y calidad JPEG 0,70. Estas decisiones actualizan las referencias previas a OpenStreetMap y 1280 píxeles de ER_5 y el Manual del sistema; no cambian los requisitos funcionales ni sus contratos REST. Las teselas y las bibliotecas cartográficas siguen requiriendo conectividad externa.

La sesión administrativa continúa en sessionStorage y se transmite mediante Authorization. Las descripciones ciudadanas y los principales textos administrativos se codifican antes de insertarse en HTML. Esto reduce riesgos de inyección, sin sustituir la validación ni la autorización del servidor.
