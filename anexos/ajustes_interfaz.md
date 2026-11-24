# Ajustes de interfaz

## Escala gradual de calor

### Visibilidad por color y confirmación propia

La representación se realiza en una capa canvas de Leaflet con campos separados de densidad y cobertura. La densidad determina el color; la cobertura determina únicamente el suavizado geométrico del borde. Amarillo, naranja y rojo tienen una opacidad interior constante de 0,8, independiente del número de confirmaciones. Se conserva la agrupación y el radio gradual de 24 a 64 píxeles, con borde adicional de 18 píxeles. No se añade otra dependencia: se sustituye el renderizado previo de Leaflet.heat. La capa cancela cuadros pendientes y libera los canvas al retirarse del mapa.

La consulta por identificador y por código informa confirmadoPorMi como booleano derivado de la tabla de confirmaciones y del identificador anonimizado del dispositivo de la petición. El creador ya aporta una confirmación automática y por ello no ve el botón para confirmarse de nuevo. Tampoco lo ve otro dispositivo que ya confirmó; tras una confirmación exitosa se retira inmediatamente. El servidor conserva el rechazo de duplicados y la ficha personalizada usa Cache-Control: no-store. No se devuelve el hash del dispositivo. Al ser un sistema sin cuentas ciudadanas, esta identificación se aplica al mismo dispositivo/navegador, no a una persona entre dispositivos diferentes.

Se conserva el peso del dominio: 1 + 0,5 por confirmación, incluida la confirmación automática del creador. Se elimina la división por el máximo de la consulta: el servidor normaliza cada punto contra una referencia fija de 12. La representación del cliente utiliza el peso bruto y la misma referencia. Los puntos activos de fallas imprevistas se agrupan a un máximo aproximado de 120 m del punto inicial del grupo, con centro visual ponderado; no se encadenan agrupaciones entre barrios. Los cortes programados conservan sus marcadores y se excluyen del calor ciudadano.

El peso de la agrupación es la suma de sus reportes y confirmaciones. Amarillo corresponde a valores bajos, naranja a valores intermedios y rojo a un peso cercano a 10 o superior. El radio visual crece de 24 a 64 píxeles según la fórmula acotada 24 + 12 × log₂(1 + max(0, peso − 1,5) / 3), redondeada a pasos de 4 píxeles, con difuminado de 18 píxeles. Se renderizan únicamente las bandas de radio presentes, con máximo 11 bandas; la intensidad no se amplifica al acercar el mapa entre los niveles 11 y 18. El borde difuminado siempre es menos intenso que el centro. Las manchas próximas pueden superponerse.

Ejemplos aislados: un reporte con la confirmación del creador tiene peso 1,5 y radio 24 px; con 5 confirmaciones tiene peso 3,5 y radio 32 px; con 11, peso 6,5 y radio 40 px; con 23, peso 12,5 y radio 52 px. La intensidad se satura en 12 y el radio se limita a 64 px. Esta superficie expresa concentración de participación, no una delimitación geográfica verificada ni severidad oficial. La capa se recalcula tras consultar o confirmar.

La vista de escritorio separa un panel lateral de exploración y el mapa. El panel reúne servicios, filtros, leyenda y acciones; solo la zona de filtros se desplaza cuando falta altura. La vista móvil mantiene servicios horizontales con centrado de la selección, filtros plegables y acciones inferiores etiquetadas. Zoom y ubicación se agrupan en el borde derecho del mapa. La redistribución no modifica la fórmula ni la normalización del mapa de calor.

La revisión de composición incorpora filtros secundarios plegables, una barra de acciones ciudadanas con etiquetas y un asistente de reporte con servicios en filas. El asistente conserva los tres pasos, mantiene las acciones visibles mientras se desplaza el contenido y contiene/restaura el foco del teclado al abrir/cerrar. Los controles secundarios conservan sus valores al plegarse; no cambia el contrato de consulta ni de registro. Se versionan las referencias de estilos y del módulo ciudadano para evitar combinaciones de recursos anteriores.

Se conservan los cuatro apartados de IU-04: incidencias (RF-09), cortes programados (RF-07), estadísticas (RF-10) y bitácora.

La presentación utiliza colores institucionales, controles táctiles, foco visible y diseños adaptables. El formulario de cortes permite seleccionar un barrio como referencia, ajustar el marcador y validar la relación entre fechas. La asignación territorial definitiva sigue siendo responsabilidad del servidor.

Por solicitud expresa del responsable del proyecto, la cartografía base cambia de OpenStreetMap a Esri WorldStreetMap con atribución visible. Las fotografías se comprimen a un máximo de 960 píxeles y calidad JPEG 0,70. Estas decisiones actualizan las referencias previas a OpenStreetMap y 1280 píxeles de ER_5 y el Manual del sistema; no cambian los requisitos funcionales ni sus contratos REST. Las teselas y las bibliotecas cartográficas siguen requiriendo conectividad externa.

La sesión administrativa continúa en sessionStorage y se transmite mediante Authorization. Las descripciones ciudadanas y los principales textos administrativos se codifican antes de insertarse en HTML. Esto reduce riesgos de inyección, sin sustituir la validación ni la autorización del servidor.
