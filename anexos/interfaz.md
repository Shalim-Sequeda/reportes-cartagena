# Interfaz del sistema

## Consulta del mapa

En escritorio, el panel lateral reúne los servicios, los filtros, la leyenda y las acciones de consulta. La zona de filtros se desplaza cuando falta altura; el botón de reporte permanece accesible. En móvil, los servicios se consultan en una fila horizontal y los filtros secundarios se despliegan bajo demanda. La selección se mantiene visible al cambiar el ancho de pantalla.

El reporte ciudadano conserva tres pasos: servicio, descripción y fotografía opcional, y ubicación. Las acciones de avance permanecen visibles mientras se desplaza el contenido. El diálogo contiene el foco del teclado y lo devuelve al control de origen al cerrarse.

## Representación del calor

El peso de cada reporte es 1 + 0,5 por confirmación. La confirmación inicial del creador está incluida. Los reportes activos se agrupan a una distancia aproximada de 120 metros respecto al punto inicial del grupo, sin encadenar grupos entre barrios. El centro de la mancha se pondera con los pesos de sus reportes. Los cortes programados conservan sus marcadores y no forman parte del calor ciudadano.

La referencia de intensidad es fija: 12. El color varía de amarillo a naranja y rojo, con valores altos alrededor de un peso acumulado de 10. La opacidad interior es 0,8 para todos los colores; solo el borde se difumina.

El radio exterior se expresa en metros: r = min(300, 100 + 50 × log₂(1 + max(0, peso − 1,5) / 3)). La representación comienza en 100 metros y crece hasta 300 metros según la participación. La conversión de metros a píxeles utiliza la resolución local de la proyección Mercator y se recalcula al mover, acercar, alejar o redimensionar el mapa. El zoom no altera el radio geográfico ni el peso. La mancha muestra concentración de participación; no equivale a un perímetro de afectación verificado.

La interfaz presenta únicamente una leyenda de concentración baja a alta. Las fórmulas y los parámetros se mantienen en esta referencia técnica.

## Participación ciudadana

La ficha informa al cliente si el dispositivo actual ya confirmó el reporte. El creador aporta una confirmación automática y no dispone del botón para sumarse otra vez. El botón tampoco aparece para un dispositivo que ya confirmó. El servidor rechaza las confirmaciones duplicadas y no devuelve el identificador anonimizado del dispositivo. La respuesta personalizada no se almacena en caché. La identificación corresponde al navegador o dispositivo; el sistema no requiere cuentas ciudadanas.

## Administración

La navegación lateral permanece fija. El contenido principal tiene desplazamiento independiente y conserva el acceso al menú. Los indicadores estadísticos se presentan en una franja de resumen, sin tarjetas individuales. La distribución por servicio conserva los nombres completos y utiliza una escala numérica entera. Filtros, tablas y formularios se organizan por espaciado y jerarquía tipográfica, sin contenedores decorativos adicionales.

La consola conserva incidencias, cortes programados, estadísticas y bitácora. La sesión administrativa reside en sessionStorage y se transmite mediante Authorization. Al salir se limpian las credenciales, las tablas y el token local; se descartan las respuestas de consultas iniciadas en la sesión anterior.

## Cartografía y fotografías

La base cartográfica es Esri WorldStreetMap, con atribución visible. Leaflet presenta el mapa y una capa canvas representa el calor. Las fotografías se comprimen a un máximo de 960 píxeles y calidad JPEG 0,70. Los recursos cartográficos externos requieren conexión a internet.
