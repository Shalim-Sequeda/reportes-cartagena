# Cartografía territorial

La asignación de barrio y localidad se realiza en el servidor mediante las coordenadas del reporte. El archivo `src/datos/barrios-cartagena.geojson` contiene una copia de la capa pública [Barrios_Ctg](https://services5.arcgis.com/NH8goQnevWdS65Vx/ArcGIS/rest/services/Barrios_Ctg/FeatureServer/0), descargada el 25 de noviembre de 2026 en coordenadas WGS84. Incluye 213 áreas que corresponden a 211 nombres de barrios y sectores; dos sectores tienen geometrías separadas. Los campos NOMBRE y LOC relacionan cada área con su barrio y localidad.

El catálogo utiliza las localidades Histórica y del Caribe Norte, De la Virgen y Turística e Industrial y de la Bahía. La [Secretaría de Planeación](https://planeacion.cartagena.gov.co/noticias/dos-nuevas-localidades-cartagena-alcalde-dumek-turbay-fortalecera-descentralizacion-acercara-el-gobierno-comunidades-794) distingue esta división de la propuesta de crear otras localidades.

La búsqueda verifica que el punto esté dentro de un polígono, considerando sus huecos y partes separadas. No asigna el barrio por cercanía a un centroide. Si el punto no está cubierto por la cartografía, el sector queda sin identificar; la ficha lo informa expresamente. Los puntos del selector administrativo están dentro del área correspondiente.

Al iniciar el servidor se actualiza el catálogo conservando los identificadores existentes cuando coincide el nombre. Una migración transaccional vuelve a asignar el barrio de los reportes anteriores según sus coordenadas. Conserva códigos, descripciones, estados, confirmaciones e historial y registra la versión para no repetir la migración en cada inicio.

Las consultas de mapa, detalle, código y administración incluyen identificador y nombre del barrio y la localidad. El filtro por localidad se aplica sobre la relación persistida entre barrio y localidad. La asignación no acepta identificadores territoriales enviados por el navegador como sustituto de las coordenadas.

La cartografía se consulta desde disco y no requiere conexión con un geocodificador externo durante el registro. Esta cobertura corresponde a la versión incluida en el proyecto; una actualización de límites requiere revisar los datos y publicar una nueva migración.
