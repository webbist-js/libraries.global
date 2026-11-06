/**
 * Spanish Knowledge copy (neutral international Spanish, usted form) for the
 * free-participation, verified-staff, paid-API and sponsorship model. Figures
 * come from `v` (see `accessValues` in `sponsored-access-content.mjs`), so the
 * copy follows the agreed catalogue.
 *
 * Markdown subset: `## ` and `### ` headings, blank-line paragraphs, `- ` and
 * `1. ` lists, `[label](/path)` links, `**bold**`, `inline code` and fenced
 * code blocks. This module mirrors the keys of the English module exactly.
 */
export default (v) => ({
  articles: {
    "plans-and-pro": {
      title: "Planes y precios",
      summary:
        "Qué es gratuito, qué se obtiene al contribuir, qué recibe el personal verificado de las bibliotecas y qué cubren la API de pago y el patrocinio.",
      body: `Libraries Global es una infraestructura pública y gratuita. Consultar las fichas de bibliotecas, buscar, usar el Atlas y contribuir no cuesta nada. Solo hay dos cosas de pago: el acceso automatizado a través de la API y el patrocinio de organizaciones que quieren financiar el servicio público. Pagar nunca compra confianza, posición en las búsquedas, trato editorial ni autoridad como personal.

## Explorer: todas las cuentas gratuitas

Puede consultar las páginas de bibliotecas, buscar y usar el mapa sin una cuenta. Una cuenta gratuita le convierte en Explorer y añade herramientas que antes eran de pago:

- comparaciones, vistas guardadas y búsquedas guardadas (hasta ${v.savedViews} de cada tipo)
- alertas, notas e historial detallado de cambios en las páginas de bibliotecas
- capas de contexto del Atlas, como la densidad de población, las comparaciones de acceso a bibliotecas, la privación y los hogares sin coche, donde haya datos disponibles
- exportaciones de hasta ${v.exportRows} filas cada vez, y hasta ${v.exportsPerDay} exportaciones en cualquier periodo de 24 horas

Explorer no incluye los cálculos de tiempos de desplazamiento de Reach. Su ejecución es costosa, por lo que quienes contribuyen y los clientes de la API los reciben en cantidades limitadas.

## Contributor y Supporter: se ganan, nunca se compran

Su primera contribución aceptada le convierte en Contributor. Quienes son Contributor pueden ejecutar ${v.contributorReach} nuevos cálculos de Reach de una sola biblioteca en cualquier periodo de siete días. Volver a abrir un resultado guardado idéntico no consume la cuota. No se incluye Reach por servicio ni por red.

Al llegar a ${v.supporterThreshold} contribuciones aceptadas recibe el reconocimiento de Supporter. Supporter es un agradecimiento: no añade herramientas, cuota ni autoridad. En [Reconocimiento de Contributor y Supporter](/knowledge/contributing/earned-recognition-and-rewards) se explica qué cuenta.

## Personal verificado: gratuito para el personal de las bibliotecas

El personal cuya relación con una biblioteca se ha verificado mantiene su ficha de forma gratuita: horarios, servicios, accesibilidad, avisos, feeds de eventos y paradas de bibliotecas móviles. Un espacio de trabajo gratuito para el personal permite que los compañeros colaboren, publiquen elementos incrustables y widgets, y vean quién más participa. Estas herramientas solo se aplican a las bibliotecas incluidas en su propio acceso verificado como personal. Unirse al espacio de trabajo de una organización no le permite, por sí solo, editar sus bibliotecas. Consulte [Personal verificado y espacios de trabajo gratuitos](/knowledge/governance/teams-for-library-services).

## Acceso a la API: ${v.price} al mes

La API está pensada para programas que leen datos de bibliotecas, proponen cambios o ejecutan análisis de forma programada o a gran escala. Cuesta ${v.price} al mes, impuestos incluidos en el precio base en GBP; Stripe muestra el importe final, con los impuestos locales que correspondan, antes de que pague. Cada periodo de facturación incluye ${v.requests} solicitudes correctas, ${v.mib} de datos de respuesta y ${v.credits} créditos de análisis. El uso adicional se rechaza, salvo que active el excedente con tope.

Una cuenta de API pertenece a una organización. Si compra como particular, al pagar se crea para usted una organización de un solo miembro. No necesita antes un espacio de trabajo para el personal ni ninguna otra compra. Empiece por [La API de Libraries Global](/knowledge/data-api/the-public-api) y [Límites, excedentes y facturación de la API](/knowledge/data-api/team-api-access).

## Patrocinio

Las organizaciones pueden financiar el servicio público mediante un acuerdo anual. Con el consentimiento del patrocinador, le damos reconocimiento público e informamos sobre el trabajo que su financiación hace posible. El patrocinio no incluye acceso a la API ni da influencia alguna sobre las fichas, la posición en las búsquedas, la verificación o las decisiones editoriales. Consulte [Patrocinar Libraries Global](/knowledge/governance/sponsoring-libraries-global).

## Lo que el pago nunca cambia

Los puntos, las insignias, el reconocimiento, los roles, la moderación y la verificación del personal nunca se venden. Una clave de API de pago autentica un programa; no identifica a una persona ni otorga autoridad como personal. Los datos de las bibliotecas siguen siendo de consulta gratuita y se mantienen bajo sus licencias publicadas.

## Durante la beta cerrada

Mientras continúe la beta cerrada, el pago de la API usa el modo de prueba de Stripe y no se cobra ningún importe real. Algunas funciones de la API se introducen por fases; las páginas para desarrolladores muestran qué está habilitado para su cuenta.`,
    },

    "earned-recognition-and-rewards": {
      title: "Reconocimiento de Contributor y Supporter",
      summary:
        "Cómo las contribuciones aceptadas le convierten en Contributor y, al llegar a 100, en Supporter, qué le aporta cada estado y qué no le aporta nunca.",
      body: `El reconocimiento es una forma de dar las gracias por el trabajo que mejora el registro compartido. Se gana mediante contribuciones aceptadas y no se puede comprar.

## Contributor

Su primera contribución aceptada le convierte en Contributor. Quienes son Contributor pueden ejecutar en el Atlas ${v.contributorReach} nuevos cálculos de Reach de una sola biblioteca en cualquier periodo de siete días. Abrir un resultado guardado idéntico es gratuito y no consume la cuota. No se incluye Reach por servicio ni por red.

## Supporter

Al llegar a ${v.supporterThreshold} contribuciones aceptadas recibe el reconocimiento de Supporter. Se mantiene en su cuenta y no caduca si se toma un descanso. Su perfil muestra por separado si ha contribuido en los últimos ${v.activityDays} días. Supporter no añade herramientas, ni cuota adicional, ni autoridad. Cuando el sitio muestra públicamente a quienes son Supporter, se aplican las opciones de privacidad de su perfil.

## Qué cuenta

Contamos las contribuciones aceptadas, una por cada envío o sugerencia aceptados, no su total de puntos. Cuentan las bibliotecas nuevas aceptadas, las ediciones y correcciones de fichas, las comprobaciones verificadas de horarios o de estado, las fotos con una licencia adecuada, las fuentes, los textos, ediciones y traducciones para Knowledge y Journal, las tareas y propuestas de campañas, los hilos de debate, respuestas y ediciones revisados, las conexiones de feeds de eventos y las sugerencias aceptadas de opciones para listas de comprobación.

Nunca cuentan: los ajustes administrativos de puntos, las rachas diarias, las bonificaciones automáticas, como los premios por completar una campaña, los votos, las reacciones, los borradores ni los envíos que siguen pendientes de revisión. Cada contribución aceptada se cuenta una sola vez, aunque se vuelva a revisar o llegue con retraso.

## Puntos e insignias

Los puntos, los niveles y las insignias se mantienen para la clasificación y su perfil. Los niveles siguen ajustando límites de contribución, como el número de envíos que pueden estar a la espera de revisión. Los puntos y los niveles nunca desbloquean herramientas de pago, y una insignia no es un estado de reconocimiento.

## Retirada

Los moderadores pueden retirar el reconocimiento cuando las contribuciones eran fraudulentas o estaban duplicadas, por ejemplo, el mismo cambio enviado varias veces para inflar el recuento. La retirada elimina el estado de Contributor y de Supporter. No elimina los datos públicos ya publicados, y puede ponerse en contacto con nosotros si cree que se trata de un error.

## Lo que el reconocimiento nunca otorga

El reconocimiento nunca otorga derechos de edición, verificación como personal, moderación, un rol en la comunidad ni acceso automatizado a la API. Los roles proceden de las concesiones de roles y de las reclamaciones de bibliotecas aprobadas. Consulte [Cómo funciona la revisión](/knowledge/governance/how-review-works) y [Puntos, rachas y niveles](/knowledge/contributing/points-streaks-and-tiers).`,
    },

    "teams-for-library-services": {
      title: "Personal verificado y espacios de trabajo gratuitos",
      summary:
        "Herramientas gratuitas para el personal verificado de las bibliotecas, cómo funcionan los espacios de trabajo del personal y por qué unirse a una organización nunca otorga por sí solo autoridad para editar.",
      body: `El personal y los voluntarios que mantienen la ficha de una biblioteca usan Libraries Global de forma gratuita. El pago no interviene en el acceso del personal.

## Cómo obtener la verificación como personal

Reclame su biblioteca desde su página o desde [Reclamar una biblioteca](/staff/claim). Un moderador revisa la reclamación. Una vez aprobada, tendrá acceso como personal a esa biblioteca, como propietario o como editor. Un organizador también puede asignarle a una biblioteca que cubra su espacio de trabajo verificado. En ambos casos, su acceso queda registrado para bibliotecas concretas.

## Qué puede hacer el personal verificado

En las bibliotecas incluidas en su acceso como personal, puede actualizar los horarios, los servicios y la información de accesibilidad, publicar avisos, conectar feeds de eventos y gestionar las rutas y paradas de las bibliotecas móviles. La mayoría de las ediciones se publican directamente; los cambios delicados, como trasladar una biblioteca o cerrarla de forma definitiva, siguen pasando por un moderador. También puede revisar las sugerencias de otras personas sobre su propia biblioteca.

## Espacios de trabajo gratuitos para el personal

Un espacio de trabajo para el personal es el espacio compartido de una organización: su nombre, sus miembros, uno o varios organizadores y las bibliotecas que cubre. Cualquier cuenta con una dirección de correo electrónico verificada puede crear uno gratis. Para cubrir una biblioteca sigue siendo necesaria la autoridad verificada como propietario de esa biblioteca.

Los espacios de trabajo permiten a los compañeros ver quién participa, compartir elementos incrustables y widgets, como buscadores de bibliotecas y gráficos comparativos, usar la carga masiva y consultar informes de tráfico cuando estén disponibles. Todas estas herramientas funcionan solo con las bibliotecas incluidas en el propio acceso verificado como personal de cada persona.

## Organizadores y miembros

Los organizadores gestionan el espacio de trabajo: su nombre, sus miembros, las invitaciones y las bibliotecas cubiertas. Los miembros pueden ver el espacio de trabajo y usar las herramientas para el personal que su propio acceso les permite. Ser organizador o miembro no otorga, por sí solo, autoridad para editar ninguna biblioteca. Antes de que el último organizador elimine su cuenta, debe ceder el rol a otro miembro.

## Espacios de trabajo y la API

Una misma organización también puede tener una cuenta de API, pero son cosas independientes. Un espacio de trabajo no incluye acceso a la API, y comprar acceso a la API nunca verifica al personal ni otorga derechos de edición. Consulte [Planes y precios](/knowledge/governance/plans-and-pro) y [La API de Libraries Global](/knowledge/data-api/the-public-api).

## Sin cargos por puesto

Los espacios de trabajo ya no tienen cargos por puesto, límites de puestos ni facturación anual. Las herramientas para el personal no dependen de ningún pago.`,
    },

    "the-public-api": {
      title: "La API de Libraries Global",
      summary:
        "Qué ofrece la API de pago, a quién va dirigida, cómo se organizan las cuentas de API y qué funciones se introducen por fases.",
      body: `La API ofrece a los programas acceso versionado a la información publicada de las bibliotecas. Las páginas de bibliotecas, la búsqueda y el Atlas siguen siendo gratuitos para las personas; la API está pensada para aplicaciones que necesitan los datos de forma programada o a gran escala.

## Qué puede hacer

- buscar bibliotecas publicadas y listar registros con una paginación estable
- leer registros de bibliotecas concretas y explorar las bibliotecas por lugar
- leer los servicios y redes de bibliotecas publicados y sus bibliotecas miembro
- enviar propuestas de bibliotecas nuevas y correcciones a la cola de moderación
- ejecutar análisis acotados, incluido Reach para una biblioteca o un servicio

Cada solicitud usa una clave con el ámbito correspondiente. Algunas funciones se introducen por fases y puede que todavía no estén habilitadas; [la referencia de la API](/developers/reference) y su panel muestran qué puede usar su cuenta.

## Precio y cuotas

El acceso a la API cuesta ${v.price} al mes, impuestos incluidos en el precio base en GBP. Cada periodo de facturación incluye ${v.requests} solicitudes correctas, ${v.mib} de datos de respuesta y ${v.credits} créditos de análisis, compartidos entre todas sus claves. Cuando se agota una cuota, las solicitudes siguientes se rechazan, salvo que haya activado el excedente con tope. Consulte [Límites, excedentes y facturación de la API](/knowledge/data-api/team-api-access).

## Cuentas de API y organizaciones

Una cuenta de API pertenece a una organización. Si compra como particular, al pagar se crea para usted una organización de un solo miembro. Los organizadores gestionan la facturación, las claves y los ajustes de excedente; los miembros pueden ver el uso. Una organización puede tener una suscripción de API activa. No necesita un espacio de trabajo para el personal, y un espacio de trabajo para el personal no incluye acceso a la API.

## Lo que una clave no hace

Una clave autentica su programa. No es una sesión de usuario y no identifica a una persona. No otorga autoridad como personal, ni acceso a cuentas o datos privados, ni permite publicar cambios directamente. Las propuestas enviadas a través de la API se revisan igual que las de cualquier otra persona.

## Licencias y atribución

Las respuestas incluyen la atribución y los registros de las fuentes, con la licencia y las condiciones de redistribución de cada conjunto de datos. Consérvelos junto con los datos. Una suscripción de pago no sustituye la licencia de una fuente. Consulte la [licencia de datos](/legal/data-licence).

## Primeros pasos

[Cree su primera clave y haga una solicitud](/knowledge/data-api/team-api-quickstart) y, después, lea la guía de [referencia, ámbitos y solución de problemas](/knowledge/data-api/team-api-reference). Durante la beta cerrada, el pago usa el modo de prueba de Stripe y no se cobra ningún importe real.`,
    },

    "team-api-quickstart": {
      title: "API: su primera clave y su primera solicitud",
      summary:
        "Compre el acceso a la API, cree una clave con los ámbitos adecuados y haga su primera solicitud autenticada.",
      body: `Esta guía le lleva de una cuenta gratuita a una solicitud a la API que funciona.

## 1. Cree y verifique su cuenta

Cree una cuenta en [Registrarse](/auth/register) y siga las instrucciones del correo de verificación. Durante la beta cerrada también necesita una invitación a la beta para acceder al sitio. Una invitación a la beta, una cuenta y una clave de API son tres cosas distintas.

## 2. Compre el acceso a la API

Abra [Desarrolladores](/developers) y elija suscribirse. Si ya organiza una organización, puede comprar para ella; si no, se crea para usted una organización de un solo miembro. Revise el precio de ${v.price} al mes, las cuotas incluidas y las [condiciones de compra de la API](/legal/membership), confirme su aceptación y continúe a Stripe Checkout.

El acceso solo empieza cuando el pago se ha confirmado. La página a la que vuelve después del pago no lo activa por sí sola. Si la confirmación tarda, actualice la página de uso en lugar de volver a pagar. Durante la beta cerrada, use solo los datos de pago de prueba de Stripe; no se cobra ningún importe real.

## 3. Cree una clave

Abra [Claves de API](/developers/keys), ponga a la clave el nombre de la aplicación que la usará y elija sus ámbitos. Las claves nuevas reciben por defecto los ámbitos de lectura: \`search:read\`, \`libraries:read\` y \`services:read\`. El análisis (\`analysis:run\`) y los envíos (\`submissions:write\`) deben confirmarse por separado, porque consumen créditos o crean propuestas.

Copie la clave completa cuando aparezca. Solo se muestra una vez; nosotros conservamos únicamente un resumen criptográfico y un prefijo corto. Guárdela en el almacén de secretos de su servidor. No la ponga nunca en código del navegador, en un repositorio público, en una URL ni en un mensaje al servicio de asistencia.

## 4. Haga una solicitud

Esta solicitud lee una ficha de biblioteca publicada. Necesita una clave con \`libraries:read\`.

\`\`\`bash
read -r -s -p 'Libraries Global API key: ' LIBRARIES_API_KEY
export LIBRARIES_API_KEY
printf '\\n'
curl --fail-with-body --include 'https://libraries.global/api/v1/libraries?locale=en&limit=1' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY"
\`\`\`

Una búsqueda necesita \`search:read\`. Una matriz \`data\` vacía es una búsqueda correcta sin resultados.

\`\`\`bash
curl --fail-with-body 'https://libraries.global/api/v1/search/libraries' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '{"q":"Bristol","locale":"en","limit":2}'
\`\`\`

## 5. Compruebe su uso

Abra [Uso](/developers/usage). Sus solicitudes correctas y los bytes de respuesta se descuentan de la cuota del periodo. Las solicitudes fallidas no consumen la cuota, pero cada intento cuenta para el límite de frecuencia.

## Próximos pasos

Lea [Límites, excedentes y facturación de la API](/knowledge/data-api/team-api-access), la guía de [referencia, ámbitos y solución de problemas](/knowledge/data-api/team-api-reference) y [Uso del entorno de pruebas de la API](/knowledge/data-api/api-playground).`,
    },

    "team-api-access": {
      title: "Límites, excedentes y facturación de la API",
      summary:
        "Cuotas incluidas, límites de frecuencia, periodos de facturación, excedente con tope opcional y lo que nunca se cobra.",
      body: `Una cuenta de API tiene una única cuota compartida entre todas sus claves y aplicaciones. Añadir o regenerar claves nunca la amplía ni la reinicia.

## Incluido en cada periodo de facturación

- ${v.requests} solicitudes correctas
- ${v.mib} (${v.bytes} bytes) de datos de respuesta JSON sin comprimir
- ${v.credits} créditos de análisis

El periodo de facturación es el periodo pagado de su suscripción, desde su hora de inicio hasta su hora de finalización, sin incluirla, en UTC. Sigue la fecha de su pago, no el mes natural. Un primer periodo parcial recibe las cuotas completas. Las cuotas de un nuevo periodo solo empiezan cuando su pago se ha confirmado; un pago fallido no abre un uso gratuito. Las cuotas no utilizadas no se acumulan para el periodo siguiente.

## Límites de frecuencia y de tamaño

Su cuenta puede hacer hasta ${v.attemptsPerMinute} intentos de solicitud por minuto y ${v.concurrent} solicitudes a la vez. Una respuesta puede ocupar como máximo ${v.maxResponse}, y una página incluye como máximo ${v.pageSize} registros. Pida una página más pequeña si una respuesta fuera a ser demasiado grande.

## Qué cuenta

Cada respuesta correcta cuenta como una solicitud y su tamaño JSON sin comprimir se suma a los datos de respuesta, incluidas las solicitudes repetidas y las respuestas almacenadas en caché. Los créditos de análisis solo se consumen cuando se completa un trabajo nuevo. Las solicitudes fallidas, rechazadas o que superan el tiempo de espera no se descuentan de sus cuotas, pero cada intento cuenta para el límite de frecuencia.

## Cuando se agota una cuota

Sin excedente, la siguiente solicitud que superaría una cuota se rechaza con HTTP 429 y un código que indica la cuota. Su panel muestra lo que queda y cuándo se reinicia el periodo. Se muestran avisos al llegar al 50 %, al 80 % y al 100 % de cada cuota.

## Excedente con tope

El excedente está desactivado hasta que un organizador lo activa y acepta las condiciones del excedente. Por encima de las cantidades incluidas, cuesta ${v.requestRate} por solicitud, ${v.mibRate} por MiB de datos de respuesta y ${v.creditRate} por crédito de análisis, impuestos no incluidos. El excedente de datos se calcula sobre el número exacto de bytes adicionales, sin redondear al alza por solicitud.

Debe elegir un tope mensual entre ${v.capMin} y ${v.capMax}, en tramos de ${v.capStep}. Se sugiere ${v.capDefault}, pero no se activa nada hasta que usted lo confirma. El tope cubre el excedente combinado de solicitudes, datos y créditos, impuestos no incluidos. Cuando la siguiente solicitud o el siguiente trabajo pudieran hacerle superar el tope, se rechazan. Se muestran avisos al llegar al 50 %, al 80 % y al 100 % del tope. Puede reducir el tope o desactivar el excedente en cualquier momento; así se detiene el uso de pago posterior, pero no se cancelan los cargos ya generados. El panel muestra el excedente acumulado y una estimación de su próxima factura.

## Lo que nunca se cobra

No cobramos el trabajo fallido, rechazado, que supera el tiempo de espera o que se reintenta internamente, y nunca hay un descubierto sin tope. Si la confirmación de la facturación se retrasa, la aplicación sigue aplicando sus límites.

## Pago y facturas

El acceso a la API cuesta ${v.price} al mes, impuestos incluidos en el precio base en GBP; Stripe muestra el cargo final antes de que pague. El excedente, si está activado, aparece en la siguiente factura. Los organizadores gestionan los datos de pago, las facturas y la cancelación desde [Desarrolladores](/developers). Consulte [Cancelar el acceso a la API y reembolsos](/knowledge/data-api/api-cancellation-and-refunds) y las [condiciones de compra de la API](/legal/membership).

## Reach en el navegador para los organizadores de la API

Mientras su cuenta de API tenga cobertura confirmada, sus organizadores también reciben una cuota de Reach en el navegador, en el Atlas: ${v.apiReachPerHour} cálculos nuevos por hora, hasta ${v.serviceLibraries} bibliotecas elegibles por servicio, con un máximo combinado de ${v.apiReachPerDay} cálculos nuevos al día para la cuenta de API. Los miembros no la heredan. Es independiente de los créditos de análisis de la propia API.`,
    },

    "team-api-reference": {
      title: "Referencia de la API: ámbitos, errores y solución de problemas",
      summary:
        "Autenticación, ámbitos de las claves, paginación, cabeceras de respuesta, códigos de error y qué hacer cuando falla una solicitud.",
      body: `Use \`https://libraries.global\` a través de HTTPS y envíe \`Authorization: Bearer YOUR_API_KEY\` con cada solicitud. La [referencia de solicitudes](/developers/reference) enumera todos los endpoints, parámetros y campos de respuesta. Esta guía explica las reglas que tienen en común.

## Ámbitos

- \`search:read\`: búsqueda de bibliotecas
- \`libraries:read\`: registros de bibliotecas, listas y lugares
- \`services:read\`: servicios y redes de bibliotecas publicados
- \`analysis:run\`: trabajos de análisis y de Reach, que consumen créditos de análisis
- \`submissions:write\`: propuestas de bibliotecas nuevas y correcciones para moderación

Las claves nuevas reciben por defecto los tres ámbitos de lectura. El análisis y los envíos deben confirmarse al crear la clave. Dé a cada aplicación su propia clave, solo con los ámbitos que necesite.

## Paginación y registros

Las listas devuelven como máximo ${v.pageSize} registros. Pase \`meta.nextCursor\` como \`after\` hasta que sea nulo, manteniendo el mismo idioma y los mismos filtros. Trate los cursores como valores opacos. Los registros cambian mientras pagina, así que guarde el \`entityRef\` y el \`updatedAt\` de cada registro. Codifique un \`entityRef\` como un único segmento de ruta, por ejemplo con \`encodeURIComponent\`. Solo se aceptan los idiomas de contenido activos.

## Cabeceras de respuesta

Las respuestas correctas incluyen \`X-Request-Id\` y cabeceras que muestran la cuota restante y cuándo se reinicia el periodo. Las respuestas son privadas para su clave y no deben almacenarse en una caché compartida.

## Errores

Los errores tienen la forma \`{"error":{"code":"..."}}\`. Compruebe el estado HTTP y el código antes de reintentar.

- 400: la solicitud está mal formada o usa un idioma, un filtro o un cursor no admitidos. Corríjala antes de reintentar.
- 401: falta la clave o está mal formada, caducada, revocada o sustituida. No siga reintentando con la misma clave.
- 403: la clave no tiene el ámbito necesario, o la cuenta de API no tiene cobertura confirmada. Consulte a un organizador.
- 404: el registro, el servicio, el trabajo o el envío no existe o no es suyo.
- 413: el cuerpo de la solicitud es demasiado grande.
- 429: se ha alcanzado un límite. \`rate_limit\` y \`concurrency_limit\` significan que debe reducir el ritmo. \`quota_requests\`, \`quota_bytes\` y \`quota_analysis\` significan que se ha agotado una cuota. \`overage_cap\` significa que el siguiente cargo superaría su tope. Respete \`Retry-After\` cuando se indique.
- 502 o 503: un problema en un servicio previo o en la contabilidad, o una respuesta que superaría ${v.maxResponse}. Reintente con espera progresiva o pida una página más pequeña.

Las solicitudes fallidas no consumen sus cuotas ni sus créditos.

## Solución de problemas

- **Nada funciona después de pagar:** espere a que el panel muestre el acceso confirmado. La página a la que vuelve después del pago no activa la API por sí sola.
- **Error 401 justo después de regenerar una clave:** todas las aplicaciones deben pasar a la clave nueva; la antigua deja de funcionar de inmediato.
- **Error 403 en una función nueva:** compruebe que su clave tiene el ámbito y que la función está habilitada para su cuenta.
- **Errores 429 repetidos:** reduzca las solicitudes en paralelo a ${v.concurrent}, distribuya las solicitudes en el tiempo o compruebe si se ha alcanzado una cuota o su tope de excedente.

Cuando escriba a info@libraries.global, indique el endpoint, el estado HTTP, el código de error y el \`X-Request-Id\`. No envíe nunca su clave, la cabecera Authorization ni datos de pago.`,
    },

    "api-playground": {
      title: "Uso del entorno de pruebas de la API",
      summary:
        "Pruebe solicitudes reales a la API en el navegador con su propia clave. Las solicitudes del entorno de pruebas se contabilizan como cualquier otra.",
      body: `El [entorno de pruebas](/developers/playground) envía solicitudes reales a la API versionada desde su navegador, para que pueda probar los endpoints antes de escribir código.

## Antes de empezar

Necesita una cuenta de API con cobertura confirmada y una clave ya creada. Pegue la clave en el entorno de pruebas. Solo se conserva en la memoria de la página: no se guarda, no se registra y no se envía a ningún sitio salvo a la API. Al recargar la página se borra.

## Las solicitudes del entorno de pruebas cuentan

El entorno de pruebas no tiene ningún atajo gratuito ni privado. Cada solicitud usa los ámbitos, los límites de frecuencia y las cuotas de su clave, exactamente igual que lo haría su aplicación. Las solicitudes correctas y sus datos de respuesta se descuentan de su cuota; los trabajos de análisis consumen créditos; con el excedente activado, también pueden sumarse al excedente. Las solicitudes fallidas no consumen la cuota. No se ejecuta nada hasta que elija Ejecutar.

## Explorar

Explore los lugares desde los países hasta las regiones y las zonas, busque bibliotecas, liste las bibliotecas de un lugar y abra un registro. Cada paso es una solicitud normal. Si su cuenta tiene las funciones habilitadas, también puede leer servicios, comprobar el estado de un envío o iniciar un trabajo de análisis.

## Pasar a su propio código

Copie en su aplicación la solicitud que muestra el entorno de pruebas. Mantenga la clave en su servidor. Lea la guía de [referencia, ámbitos y solución de problemas](/knowledge/data-api/team-api-reference) para conocer los errores y los límites.`,
    },

    "api-services-submissions-and-analysis": {
      title: "Datos de servicios, propuestas y créditos de análisis",
      summary:
        "Lea los servicios de bibliotecas, proponga bibliotecas nuevas y correcciones para su revisión, y ejecute análisis acotados y trabajos de Reach con créditos de análisis.",
      body: `Estas funciones de la API se introducen por fases y se habilitan por separado. Su panel y la [referencia de solicitudes](/developers/reference) muestran cuáles están disponibles para su cuenta.

## Servicios y redes de bibliotecas

Con \`services:read\` puede listar los servicios y redes de bibliotecas publicados, leer uno por su referencia estable y listar sus bibliotecas miembro publicadas. No todas las redes son un servicio de bibliotecas públicas: la respuesta indica de qué tipo es. La pertenencia procede de nuestros registros, no de su solicitud. Que una biblioteca pertenezca a un servicio no otorga autoridad como personal. Conserve la atribución de las fuentes junto con los datos.

## Envíos

Con \`submissions:write\` puede proponer una biblioteca nueva o una corrección de un registro publicado. Incluya sus pruebas o su fuente y una clave de idempotencia única, para que un reintento no cree una segunda propuesta. Se rechazan los campos protegidos y los campos arbitrarios.

Toda propuesta entra en la cola de moderación habitual. Nunca se publica directamente y se revisa de la misma manera que la sugerencia de cualquier otra persona. Una clave no puede afirmar que actúa en nombre del personal de una biblioteca. Puede comprobar el estado de una propuesta, pero no verá las notas de los revisores ni datos privados. Los envíos no generan puntos ni reconocimiento para la cuenta de API. Los textos y datos aceptados se publican bajo la [licencia de datos](/legal/data-licence), así que envíe solo material que tenga derecho a compartir.

## Análisis y Reach

Con \`analysis:run\` puede solicitar un análisis resumido de un servicio o una zona publicados, y Reach para una biblioteca o para un servicio completo. El trabajo más costoso se ejecuta como un trabajo en segundo plano: recibe un ID de trabajo, comprueba su estado y después obtiene el resultado.

Los créditos de análisis solo se consumen cuando se completa un trabajo nuevo:

- resumen sencillo: ${v.summaryCredits} crédito; resumen más completo: ${v.richSummaryCredits} créditos
- Reach de una biblioteca: ${v.libraryReachCredits} créditos
- Reach de un servicio: ${v.serviceReachCredits} créditos
- Reach de una red, cuando se habilite tras una revisión de capacidad independiente: ${v.networkReachCredits} créditos

Un resultado idéntico almacenado en caché no consume créditos, pero obtenerlo cuenta como una solicitud y como datos de respuesta. Volver a obtener un resultado completado nunca consume otro crédito. Un trabajo que no cabría en los créditos que le quedan o en su tope de excedente se rechaza antes de empezar. Un trabajo fallido, cancelado o caducado devuelve los créditos reservados.

Las entradas están acotadas. La API no acepta polígonos arbitrarios, listas de coordenadas, pertenencias a servicios elegidas por usted ni lotes sin límite. Los resultados se mantienen por debajo de ${v.maxResponse}; la geometría de gran tamaño no está disponible a través de la API básica. Los resultados completados se conservan durante un tiempo limitado, que se indica en el estado del trabajo, y después se eliminan.

## Interpretar los resultados

Reach modela la proximidad geográfica. No mide visitas, admisión ni accesibilidad sin escalones, y los resultados parciales siguen siendo parciales. Lea [Reach a pie, en bicicleta y por servicio](/knowledge/data-api/understanding-library-reach) antes de publicar una cifra.`,
    },

    "exporting-from-the-atlas": {
      title: "Exportaciones del Atlas y límites de Reach",
      summary:
        "Exporte selecciones filtradas de bibliotecas, descargue resultados de Reach y conozca quién puede ejecutar Reach y en qué cantidad.",
      body: `Cualquier cuenta con la sesión iniciada puede exportar una selección filtrada del Atlas en CSV o GeoJSON. Las descargas de fichas de bibliotecas concretas siguen siendo públicas. Exportar fichas y descargar un resultado de Reach son acciones distintas.

## Exportar la selección de bibliotecas

Acote la selección con los filtros o el mapa, cambie a Lista y elija Exportar. El formato CSV es adecuado para hojas de cálculo; GeoJSON conserva los puntos del mapa. Cada exportación puede incluir hasta ${v.exportRows} bibliotecas, y puede hacer hasta ${v.exportsPerDay} exportaciones en cualquier periodo de 24 horas. Acote antes una selección más grande. Estos límites son para las personas que usan el Atlas; para extracciones periódicas o más grandes, use la API.

## Conservar las fuentes y el alcance

Las exportaciones incluyen los identificadores de las bibliotecas, los datos de visita y de contacto disponibles, las ubicaciones y la información de las fuentes. Conserve junto con los datos los registros de las fuentes, la atribución, las licencias y las fechas de obtención. Un campo vacío significa que la ficha no tiene ese dato, no que la respuesta sea No.

## Quién puede ejecutar Reach

Reach es costoso de calcular, por lo que tiene sus propias cuotas:

- Cuentas Explorer: sin cálculos de Reach
- Contributor: ${v.contributorReach} cálculos nuevos de una sola biblioteca en cualquier periodo de siete días; sin Reach por servicio ni por red
- Organizadores de una cuenta de API con cobertura confirmada: ${v.apiReachPerHour} cálculos nuevos por hora, incluido Reach por servicio, con un máximo combinado de ${v.apiReachPerDay} al día para la cuenta de API

Abrir un resultado guardado idéntico no consume un cálculo nuevo. La condición de personal verificado no cambia estas cuotas.

## Límites de tamaño de los servicios

Reach por servicio admite hasta ${v.serviceLibraries} bibliotecas elegibles. Con los cuatro tiempos de desplazamiento, el servicio y su área de análisis deben caber en ${v.area4} y en una extensión de ${v.span4}. Si elige un solo tiempo de desplazamiento, el límite es de ${v.area1} y ${v.span1}. Son rectángulos envolventes conservadores, no superficies de terreno. El tiempo de cálculo, las celdas ráster y la cola compartida también están limitados, por lo que una solicitud dentro de estos tamaños puede no estar disponible.

## Descargar los resultados de Reach

Use Descargas en el panel de Reach para obtener CSV, GeoJSON de visualización o JSON de análisis. El JSON de análisis conserva la selección, los filtros, las ediciones de las fuentes y los resultados sin redondear. Los recuentos acumulados se solapan y no deben sumarse. Los polígonos de visualización están simplificados. Publique con cualquier cifra el año de la fuente, el área de análisis, el servicio y el modo de desplazamiento, y conserve con el resultado los avisos de datos parciales.`,
    },

    "api-cancellation-and-refunds": {
      title: "Cancelar el acceso a la API y reembolsos",
      summary:
        "Cómo detener la renovación de la API, qué ocurre con el acceso y el excedente, y cómo solicitar un reembolso.",
      body: `Detener la renovación y solicitar un reembolso son cosas distintas. Esta guía trata ambas.

## Detener la renovación

Un organizador abre [Desarrolladores](/developers), elige Gestionar la facturación de la API y cancela la renovación en la página de facturación de Stripe. No necesita eliminar su cuenta. El acceso continúa hasta el final del periodo pagado. Sus claves dejan de funcionar cuando termina la cobertura, y puede revocarlas en cualquier momento.

## El excedente al cancelar

El excedente ya utilizado en el periodo actual sigue siendo pagadero y aparece en la factura final. Para detener de inmediato cualquier excedente adicional, desactive el excedente o reduzca el tope. Desactivarlo no anula los cargos ya generados.

## Reembolsos y derecho de desistimiento

Si es usted consumidor en el Reino Unido, normalmente dispone de 14 días desde la compra para cancelar. Pedir que el acceso empiece de inmediato no elimina ese derecho, pero es posible que se le pida pagar por el servicio ya prestado. Según el lugar donde viva, pueden aplicarse otros derechos. Solicite un reembolso a través de la vía de asistencia para transacciones que figura en su recibo de Stripe, o escríbanos a info@libraries.global. Indique la referencia de la factura y el correo electrónico de su cuenta; no envíe nunca datos de tarjeta ni contraseñas.

Un reembolso completo del periodo actual, o una disputa de pago, pone fin al acceso de pago durante ese periodo. Los reembolsos parciales y los reembolsos de periodos anteriores no eliminan un periodo de pago posterior.

## Problemas con el pago

Una renovación fallida no abre una nueva cuota; las solicitudes se rechazan hasta que se confirme el pago. Antes de volver a pagar tras un pago dudoso, revise su página de facturación y su recibo de Stripe. Consulte la [política de cancelación y reembolsos](/legal/cancellation-refunds) y las [condiciones de compra de la API](/legal/membership).`,
    },

    "deleting-an-account-with-api-access": {
      title: "Eliminar una cuenta que gestiona el acceso a la API",
      summary:
        "Qué hacer antes de eliminar una cuenta que organiza una cuenta de API o un espacio de trabajo para el personal, y qué se conserva después.",
      body: `Eliminar su cuenta es permanente. Si organiza una cuenta de API o un espacio de trabajo para el personal, antes deben hacerse algunas cosas para que nadie más pierda el acceso por sorpresa.

## Antes de eliminarla

- Si es el único organizador de una cuenta de API, nombre organizador a otro miembro, o cancele la suscripción a la API y espere a que termine.
- Si es el último organizador de un espacio de trabajo para el personal, ceda el rol de organizador a otro miembro o elimine el espacio de trabajo si ya no se usa.
- Revoque las claves de API que ya no necesite. Las claves pertenecen a la cuenta de API, no a usted, así que siguen funcionando para la organización si esta continúa.

La eliminación se rechaza mientras sea usted el único organizador del que dependen otras personas, o mientras no pueda confirmarse que la facturación se ha detenido.

## Una cuenta de API de un solo miembro

Si compró el acceso a la API como particular, la eliminación cancela primero la suscripción y revoca sus claves. El excedente ya generado sigue siendo pagadero. La eliminación no conlleva un reembolso automático; solicítelo por separado si cree que le corresponde.

## Qué se conserva

Los datos públicos publicados y las contribuciones aceptadas se mantienen, sin su nombre. Se conservan referencias mínimas de facturación durante seis años por motivos fiscales y contables, que no permiten iniciar sesión ni restablecer el acceso. Los registros de uso no contienen el texto de las solicitudes, sus cuerpos, direcciones IP ni claves. Stripe conserva sus propios registros financieros conforme a sus condiciones de privacidad.

Consulte [Eliminar su cuenta](/knowledge/getting-started/deleting-your-account) y el [aviso de privacidad](/legal/privacy).`,
    },

    "sponsoring-libraries-global": {
      title: "Patrocinar Libraries Global",
      summary:
        "Cómo pueden las organizaciones financiar el servicio público, qué reciben los patrocinadores y las normas de independencia que se aplican a todo patrocinio.",
      body: `El patrocinio financia Libraries Global como infraestructura pública y gratuita. Sufraga programas como el acceso público, la mejora de la calidad de los datos, la traducción, la cobertura geográfica y las herramientas abiertas.

## Niveles orientativos

Hablamos de cada patrocinio de forma individual. Como punto de partida:

- Patrocinador comunitario: ${v.sponsorCommunity} al año
- Patrocinador de servicio: ${v.sponsorService} al año
- Patrocinador fundador: ${v.sponsorFounding} al año

Son propuestas para iniciar una conversación, no paquetes con ventajas automáticas. Cada acuerdo se presupuesta y se contrata por separado, normalmente mediante factura, y su tratamiento fiscal se confirma en el propio acuerdo.

## Qué reciben los patrocinadores

Con el consentimiento del patrocinador, publicamos su nombre, y su logotipo si lo desea, en nuestros agradecimientos a patrocinadores, con una descripción objetiva de lo que apoya el patrocinio. Los patrocinadores reciben informes trimestrales de actividad, un informe anual de impacto y reuniones informativas.

## Independencia

El patrocinio nunca influye en las fichas de bibliotecas, los resultados o la posición en las búsquedas, la verificación del personal, la moderación ni las decisiones editoriales. Los patrocinadores no revisan el contenido antes de su publicación. Podemos rechazar o terminar un patrocinio que comprometa esa independencia.

## No es una donación

El patrocinio es un acuerdo comercial. No es una donación benéfica y no debe considerarse deducible a efectos fiscales, salvo que cambie nuestra situación jurídica y así lo indiquemos.

## El acceso a la API es independiente

El patrocinio no incluye acceso a la API ni capacidad de análisis. Un patrocinador que necesite la API se suscribe a ella como cualquier otro cliente, o acuerda por escrito una modalidad con un precio independiente.

## Contacto

Envíe una consulta a través del formulario de contacto o escriba a info@libraries.global indicando el nombre de su organización y qué le gustaría apoyar.`,
    },
  },

  /** Short managed note added to related existing guides. */
  relatedNote: {
    heading: "Reconocimiento y planes",
    text: "Las contribuciones aceptadas le dan el estado de Contributor y, al llegar a 100, el reconocimiento de Supporter. El reconocimiento nunca desbloquea derechos de edición ni herramientas de pago.",
    links: [
      [
        "Reconocimiento de Contributor y Supporter",
        "/knowledge/contributing/earned-recognition-and-rewards",
      ],
      ["Planes y precios", "/knowledge/governance/plans-and-pro"],
    ],
  },

  /** Link labels left by earlier rollouts, renamed when related guides are scrubbed. */
  linkLabels: {
    "Planes y Pro": "Planes y precios",
    "Planes & Pro": "Planes y precios",
    "Acceso a la API de Team": "Límites, excedentes y facturación de la API",
    "Plans and Pro": "Planes y precios",
    "Plans & Pro": "Planes y precios",
    "Team API access": "Límites, excedentes y facturación de la API",
    "Team API access and allowances":
      "Límites, excedentes y facturación de la API",
    "Signup, API keys and your first request":
      "API: su primera clave y su primera solicitud",
    "Team API request reference":
      "Referencia de la API: ámbitos, errores y solución de problemas",
  },
})
