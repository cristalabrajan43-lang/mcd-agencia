# Manual de Usuario — Agencia MCD

**Sistema Web para Agencia de Publicidad MCD**  
**URL del sitio**: [https://agenciamcd.mx](https://agenciamcd.mx)  
**Versión**: 1.0  
**Fecha**: Febrero 2026

---

## Tabla de Contenido

1. [Introducción](#1-introducción)
   - 1.1 [Objetivo General](#objetivo-general)
   - 1.2 [Objetivos Específicos](#objetivos-específicos)
   - 1.3 [Roles del sistema](#roles-del-sistema)
   - 1.4 [Requisitos del navegador](#requisitos-del-navegador)
2. [Acceso al Sistema](#2-acceso-al-sistema)
   - 2.1 [Crear una cuenta](#21-crear-una-cuenta)
   - 2.2 [Verificar correo electrónico](#22-verificar-correo-electrónico)
   - 2.3 [Iniciar sesión](#23-iniciar-sesión)
   - 2.4 [Iniciar sesión con Google](#24-iniciar-sesión-con-google)
   - 2.5 [Recuperar contraseña](#25-recuperar-contraseña)
   - 2.6 [Sesión y tiempo de inactividad](#26-sesión-y-tiempo-de-inactividad)
3. [Sitio Público](#3-sitio-público)
   - 3.1 [Página principal (Landing)](#31-página-principal-landing)
   - 3.2 [Catálogo de productos](#32-catálogo-de-productos)
   - 3.3 [Detalle de producto](#33-detalle-de-producto)
   - 3.4 [Solicitar cotización](#34-solicitar-cotización)
   - 3.5 [Chatbot](#35-chatbot)
   - 3.6 [Cambio de idioma](#36-cambio-de-idioma)
4. [Guía del Cliente](#4-guía-del-cliente)
   - 4.1 [Mi Perfil](#41-mi-perfil)
   - 4.2 [Mis Cotizaciones](#42-mis-cotizaciones)
   - 4.3 [Ver y responder una cotización](#43-ver-y-responder-una-cotización)
   - 4.4 [Solicitar cambios a una cotización](#44-solicitar-cambios-a-una-cotización)
   - 4.5 [Carrito de compras](#45-carrito-de-compras)
   - 4.6 [Proceso de compra (Checkout)](#46-proceso-de-compra-checkout)
   - 4.7 [Mis Pedidos](#47-mis-pedidos)
   - 4.8 [Configuración de la cuenta](#48-configuración-de-la-cuenta)
5. [Guía del Vendedor](#5-guía-del-vendedor)
   - 5.1 [Panel de Control (Dashboard)](#51-panel-de-control-dashboard)
   - 5.2 [Gestión de Solicitudes de Cotización](#52-gestión-de-solicitudes-de-cotización)
   - 5.3 [Crear una cotización](#53-crear-una-cotización)
   - 5.4 [Gestión de Cotizaciones](#54-gestión-de-cotizaciones)
   - 5.5 [Enviar cotización al cliente](#55-enviar-cotización-al-cliente)
   - 5.6 [Responder solicitudes de cambio](#56-responder-solicitudes-de-cambio)
   - 5.7 [Convertir cotización en pedido](#57-convertir-cotización-en-pedido)
   - 5.8 [Gestión de Pedidos](#58-gestión-de-pedidos)
   - 5.9 [Gestión de Clientes](#59-gestión-de-clientes)
   - 5.10 [Gestión de Leads](#510-gestión-de-leads)
6. [Guía del Administrador](#6-guía-del-administrador)
   - 6.1 [Todo lo del vendedor, más...](#61-todo-lo-del-vendedor-más)
   - 6.2 [Gestión de Catálogo](#62-gestión-de-catálogo)
   - 6.3 [Gestión de Usuarios](#63-gestión-de-usuarios)
   - 6.4 [Gestión de Contenido (CMS)](#64-gestión-de-contenido-cms)
   - 6.5 [Analítica](#65-analítica)
   - 6.6 [Auditoría](#66-auditoría)
   - 6.7 [Notificaciones](#67-notificaciones)
7. [Preguntas Frecuentes](#7-preguntas-frecuentes)

---

## 1. Introducción

El sistema web de **Agencia MCD** es una plataforma integral para la gestión de servicios de publicidad. Permite a los clientes explorar el catálogo de productos, solicitar cotizaciones personalizadas, realizar compras en línea y dar seguimiento a sus pedidos. Para el equipo de ventas y administración, ofrece herramientas para gestionar cotizaciones, pedidos, inventario, contenido del sitio y más.

### Objetivo General

Desarrollar e implementar un sistema web integral para la Agencia de Publicidad MCD que digitalice y automatice los procesos de gestión de cotizaciones, venta de productos publicitarios, control de pedidos y administración de contenido, mediante una arquitectura cliente-servidor con tecnologías modernas (Next.js y Django REST Framework), con el fin de optimizar la operación comercial, reducir tiempos de respuesta al cliente y centralizar la información del negocio en una plataforma accesible, segura y escalable.

### Objetivos Específicos

1. **Analizar los procesos operativos actuales** de la agencia de publicidad MCD, identificando las actividades manuales en la gestión de cotizaciones, atención a clientes, control de inventario y seguimiento de pedidos, para documentar las áreas de oportunidad que justifiquen la digitalización mediante el sistema web.

2. **Diseñar la arquitectura del sistema y el modelo de base de datos** utilizando un enfoque de API REST con separación frontend/backend, definiendo los módulos del sistema (usuarios, catálogo, cotizaciones, pedidos, pagos, inventario, contenido, chatbot, notificaciones y auditoría), el esquema de autenticación basado en JWT con control de acceso por roles (RBAC), y la estrategia de almacenamiento en la nube.

3. **Desarrollar un sitio web público bilingüe (español/inglés)** que presente los servicios de la agencia, el catálogo de productos con filtros avanzados de búsqueda, un formulario de solicitud de cotización con campos dinámicos según el tipo de servicio, y un chatbot para la captación de prospectos (leads), mejorando la presencia digital de la empresa y facilitando el primer contacto con los clientes.

4. **Implementar un sistema de gestión de cotizaciones** que permita al equipo de ventas crear, editar, enviar y dar seguimiento a cotizaciones personalizadas con generación automática de PDF profesional, firma electrónica del cliente, control de vigencia, manejo de versiones mediante solicitudes de cambio, y conversión directa de cotizaciones aceptadas en pedidos.

5. **Desarrollar el módulo de comercio electrónico** que integre un carrito de compras, proceso de checkout con dirección de envío, y pasarelas de pago (MercadoPago y PayPal), permitiendo a los clientes adquirir productos de venta directa de manera autónoma y segura, con confirmación automática por correo electrónico.

6. **Construir un panel de administración con control de acceso basado en roles** que brinde al equipo de ventas herramientas para gestionar solicitudes, cotizaciones, pedidos y clientes, y al administrador funcionalidades adicionales para administrar el catálogo de productos, gestionar usuarios, editar contenido del sitio (CMS), consultar métricas de analítica web y revisar el registro de auditoría de todas las acciones del sistema.

7. **Integrar servicios externos** para el envío de correos transaccionales (Brevo), almacenamiento de archivos multimedia en la nube (Cloudflare R2), procesamiento de pagos en línea (MercadoPago y PayPal) y autenticación social (Google OAuth), garantizando una comunicación segura y confiable entre el sistema y los proveedores de servicios.

8. **Desplegar el sistema en un entorno de producción** utilizando servicios de hospedaje en la nube (Render para el backend y Vercel para el frontend) con dominio personalizado (agenciamcd.mx), certificados SSL, base de datos PostgreSQL gestionada y almacenamiento distribuido, asegurando la disponibilidad, rendimiento y seguridad de la plataforma para su uso en condiciones reales.

9. **Elaborar la documentación técnica y el manual de usuario** que describan la arquitectura del sistema, las instrucciones de instalación y configuración, y las guías de uso para los tres roles del sistema (cliente, vendedor y administrador), facilitando el mantenimiento futuro del sistema y la capacitación del equipo de trabajo de la agencia.

### Roles del sistema

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **Cliente** | Usuarios que solicitan cotizaciones, compran productos y dan seguimiento a sus pedidos | Sitio público + Mi Cuenta |
| **Vendedor** | Equipo de ventas que atiende solicitudes, crea cotizaciones y gestiona pedidos | Todo lo del cliente + Panel de Control |
| **Administrador** | Control total del sistema: catálogo, usuarios, contenido, analítica, auditoría | Todo lo del vendedor + secciones exclusivas de admin |

### Requisitos del navegador

- Google Chrome 90+ (recomendado)
- Mozilla Firefox 90+
- Safari 15+
- Microsoft Edge 90+
- Conexión a internet estable

---

## 2. Acceso al Sistema

### 2.1 Crear una cuenta

1. Haga clic en **"Crear Cuenta"** en el menú superior o vaya a `/registro`.
2. Complete el formulario:

   | Campo | Obligatorio | Descripción |
   |-------|:-----------:|-------------|
   | Nombre | ✅ | Su nombre de pila |
   | Apellido | ✅ | Su apellido |
   | Correo electrónico | ✅ | Debe ser un correo válido. Se usará para iniciar sesión |
   | Teléfono | ✅ | Número de contacto |
   | Fecha de nacimiento | ❌ | Opcional |
   | Contraseña | ✅ | Mínimo 8 caracteres, al menos 1 mayúscula y 1 número |
   | Confirmar contraseña | ✅ | Debe coincidir con la contraseña |
   | Acepto términos y condiciones | ✅ | Requerido para continuar |
   | Acepto política de privacidad | ✅ | Requerido para continuar |
   | Deseo recibir comunicaciones | ❌ | Consentimiento para emails de marketing |

3. Haga clic en **"Crear Cuenta"**.
4. Si el correo ya está registrado, verá un aviso: *"Ya existe una cuenta con este correo electrónico"*.

### 2.2 Verificar correo electrónico

Después de registrarse:

1. Recibirá un correo de **verificación** en la bandeja de entrada del correo que proporcionó.
2. Abra el correo y haga clic en el enlace **"Verificar mi correo"**.
3. Será redirigido a la página de verificación que confirmará: *"¡Email verificado correctamente!"*.
4. **Importante**: No podrá iniciar sesión hasta que verifique su correo.

> **¿No recibió el correo?** Intente iniciar sesión; aparecerá un banner con el botón **"Reenviar correo de verificación"**. También revise la carpeta de spam.

> **El enlace expira en 24 horas.** Si el enlace ya expiró, use el botón de reenvío para obtener uno nuevo.

### 2.3 Iniciar sesión

1. Haga clic en **"Iniciar Sesión"** en el menú superior o vaya a `/login`.
2. Ingrese su **correo electrónico** y **contraseña**.
3. Opcionalmente marque **"Recordarme"** para mantener la sesión activa.
4. Haga clic en **"Iniciar Sesión"**.

### 2.4 Iniciar sesión con Google

1. En la pantalla de login, haga clic en **"Continuar con Google"**.
2. Se abrirá una ventana de Google para seleccionar o confirmar su cuenta.
3. Si es la primera vez, se creará una cuenta automáticamente con su información de Google.
4. Será redirigido al sistema ya autenticado.

### 2.5 Recuperar contraseña

1. En la pantalla de login, haga clic en **"¿Olvidaste tu contraseña?"**.
2. Ingrese su correo electrónico registrado.
3. Haga clic en **"Enviar enlace"**.
4. Recibirá un correo con un enlace para restablecer su contraseña.
5. Siga el enlace, ingrese su nueva contraseña y confírmela.

### 2.6 Sesión y tiempo de inactividad

- La sesión se mantiene activa mientras use el sistema.
- Después de **15 minutos de inactividad** (sin mover el mouse, escribir o hacer clic), aparecerá una ventana de advertencia con una cuenta regresiva de **2 minutos**.
- Haga clic en **"Continuar"** para mantener la sesión activa.
- Si no responde, la sesión se cerrará automáticamente y será redirigido a la pantalla de login.

---

## 3. Sitio Público

### 3.1 Página principal (Landing)

La página principal muestra toda la información de la agencia organizada en secciones:

| Sección | Contenido |
|---------|-----------|
| **Encabezado** | Logo, menú de navegación (Inicio, Catálogo, Servicios, Nosotros, Contacto), selector de idioma, acceso a cuenta |
| **Carrusel principal** | Imágenes promocionales con títulos y botones de acción |
| **Servicios** | 9 categorías de servicios con imágenes en carrusel: Fabricación de Anuncios, Espectaculares, Publicidad Móvil, Impresión Gran Formato, Señalización, Rotulación Vehicular, Corte/Grabado CNC/Láser, Diseño Gráfico, Impresión Offset/Serigrafía |
| **Nosotros** | Información sobre la empresa |
| **Portafolio** | Videos de trabajos realizados |
| **Clientes** | Logotipos de clientes en carrusel |
| **Preguntas Frecuentes** | Acordeón con preguntas y respuestas |
| **Formulario de cotización** | Formulario rápido para solicitar cotización (ver §3.4) |
| **Sucursales** | Direcciones, teléfonos, horarios y mapa de ubicación |
| **Pie de página** | Información de contacto, redes sociales, enlaces legales |

**Botón flotante de WhatsApp**: En la esquina inferior derecha, permite abrir una conversación directa con la agencia por WhatsApp.

### 3.2 Catálogo de productos

Acceda al catálogo desde el menú **"Catálogo"** o visite `/catalogo`.

**Herramientas de búsqueda y filtrado**:

| Herramienta | Descripción |
|-------------|-------------|
| **Buscador** | Escriba el nombre del producto para buscar |
| **Categoría** | Filtre por categoría de producto |
| **Modo de venta** | Filtre por: Todos, Compra directa, Cotización, Ambos |
| **Atributos** | Filtros dinámicos según los atributos disponibles (material, color, etc.) |
| **Rango de precios** | Establezca precio mínimo y máximo |
| **Ordenar por** | Más recientes, Nombre A-Z, Nombre Z-A |
| **Vista** | Cambie entre vista de cuadrícula o lista |

Cada producto muestra: imagen, nombre, categoría, precio (o "Solicitar cotización"), e indicador del modo de venta.

### 3.3 Detalle de producto

Haga clic en un producto del catálogo para ver su detalle completo:

- **Galería de imágenes**: Imagen principal con miniaturas. Haga clic en la imagen para ampliarla.
- **Información**: Nombre, descripción corta, descripción completa (expandible), información de instalación.
- **Variantes**: Si el producto tiene variantes (talla, color, material), seleccione la combinación deseada en los menús desplegables. El precio se actualiza según la variante seleccionada.
- **Precio**: Se muestra el precio actual. Si hay precio de comparación, se muestra tachado.

**Acciones disponibles según el modo de venta**:

| Modo de venta | Acciones |
|---------------|----------|
| **Compra directa** | Seleccione cantidad → "Agregar al carrito" |
| **Cotización** | Se muestra banner *"Este producto requiere cotización personalizada"* → botón "Cotizar" |
| **Ambos (Híbrido)** | Puede agregar al carrito O solicitar cotización |

### 3.4 Solicitar cotización

Puede solicitar una cotización de dos formas:
- Desde el botón **"Cotizar"** en un producto
- Desde el formulario en la página principal o visitando `/cotizar`

**Paso 1 — Datos de contacto**:

| Campo | Obligatorio | Descripción |
|-------|:-----------:|-------------|
| Nombre completo | ✅ | Su nombre |
| Empresa | ❌ | Nombre de su empresa (si aplica) |
| Teléfono | ✅ | Número de contacto |
| Correo electrónico | ✅ | Correo para recibir la cotización |
| Fecha requerida | ✅ | Fecha en que necesita el producto/servicio (debe ser hoy o posterior) |
| Servicio | ✅ | Seleccione el servicio deseado del menú desplegable |

**Paso 2 — Detalles del servicio**:

Al seleccionar un servicio, se muestran campos específicos. Por ejemplo:

**Espectaculares**: Tipo de espectacular (unipolar, azotea, mural, otro), ubicación, medidas, tiempo de exhibición, opciones de impresión e instalación.

**Fabricación de Anuncios**: Tipo (cajas de luz, letras 3D, anuncios 2D, bastidores, toldos, neón, otro), medidas, uso (interior/exterior), opciones de iluminación e instalación.

**Publicidad Móvil**: Subtipo (vallas móviles, publibuses, perifoneo), con campos específicos por cada uno. Incluye un **selector de rutas** con mapa interactivo para trazar el recorrido deseado.

**Impresión Gran Formato**: Material (lona, vinil, tela, otro), medidas, cantidad, disponibilidad de archivo.

**Señalización**: Tipo (interior, exterior, vial, otro), medidas, cantidad, instalación.

**Rotulación Vehicular**: Tipo de vehículo, tipo de rotulación (completa, parcial, vinil recortado, impresión digital, otro), diseño.

**Corte/Grabado CNC/Láser**: Tipo de proceso, medidas, cantidad, archivo.

**Diseño Gráfico**: Tipo (logotipos, papelería, redes sociales, otro), número de piezas, uso, cambios incluidos.

**Impresión Offset/Serigrafía**: Producto (tarjetas, volantes, otro), cantidad, tipo de impresión, archivo.

**Agregar múltiples servicios**:

Si necesita cotizar más de un servicio en la misma solicitud:

1. Complete los datos del primer servicio (tipo, detalles, método de entrega, fecha requerida).
2. Haga clic en el botón **"Agregar otro servicio"**.
3. El servicio actual se guardará y aparecerá un **resumen** debajo del formulario mostrando los servicios agregados.
4. El formulario se limpiará para que pueda seleccionar y configurar un nuevo servicio.
5. Repita el proceso para cada servicio adicional.
6. Para eliminar un servicio guardado, haga clic en el botón **"×"** junto al servicio en el resumen.

> **Nota**: Cada servicio tiene su propio tipo, detalles específicos, método de entrega y fecha requerida independientes.

**Paso 3 — Información adicional**:

| Campo | Obligatorio |
|-------|:-----------:|
| Comentarios adicionales | ❌ |
| Archivos adjuntos | ❌ (máximo 5 archivos, 10 MB cada uno, formatos: JPG, PNG, PDF). Puede arrastrar y soltar archivos. |
| Acepto la política de privacidad | ✅ |

Haga clic en **"Enviar solicitud"**. Recibirá una confirmación en pantalla y un equipo de ventas le contactará con su cotización personalizada.

### 3.5 Chatbot

El **chatbot** es un asistente virtual **potenciado con inteligencia artificial (Google Gemini)**, disponible como un botón flotante en la esquina inferior derecha de todas las páginas.

1. Haga clic en el **icono de chat** (💬) para abrirlo.
2. Se presenta un mensaje de bienvenida y un menú con **acciones rápidas**:

   | Opción | Qué hace |
   |--------|----------|
   | 🎨 Servicios | Información detallada sobre los servicios de la agencia |
   | 📋 Cotizar | Lo guía al formulario de cotización o a contactar por WhatsApp |
   | 🛒 Catálogo | Lo dirige al catálogo de productos |
   | 📍 Ubicación | Muestra direcciones, horarios y datos de contacto de las sucursales |
   | 💬 Asesor | Ofrece contactar vía WhatsApp con un asesor humano |

3. **Escriba libremente** en el campo de texto. El asistente de IA responderá de forma inteligente con información precisa sobre los servicios, productos, ubicaciones, horarios y más de Agencia MCD.
4. Si el asistente no puede resolver su duda o usted solicita hablar con un humano, se mostrarán **botones de WhatsApp** para contactar directamente con la sucursal de Acapulco o Tecoanapa.
5. El chatbot responde en **español e inglés** según el idioma seleccionado en el sitio.
6. Para minimizar el chat, haga clic en el botón **"−"**. Para cerrarlo, haga clic en **"×"**.

> **Nota**: El chatbot utiliza inteligencia artificial para proporcionar respuestas contextuales. Si el servicio de IA no está disponible temporalmente, el chatbot funciona con respuestas predefinidas como respaldo.

### 3.6 Cambio de idioma

El sistema está disponible en **español** e **inglés**.

- En el encabezado, haga clic en el **icono de globo terráqueo** (🌐) junto a "ES" o "EN".
- Todo el contenido del sitio se actualiza al idioma seleccionado.
- Las cotizaciones y correos también se envían en el idioma preferido del usuario.

---

## 4. Guía del Cliente

Después de iniciar sesión como cliente, tiene acceso a todas las funciones del sitio público más su **panel personal** en "Mi Cuenta".

### 4.1 Mi Perfil

Acceda desde el menú de usuario → **"Mi Perfil"** o visite `/mi-cuenta`.

En esta sección puede ver y editar su información personal:

| Campo | Editable | Descripción |
|-------|:--------:|-------------|
| Nombre | ✅ | Su nombre |
| Apellido | ✅ | Su apellido |
| Teléfono | ✅ | Número de contacto |
| Correo electrónico | ❌ | Solo lectura. Se muestra con un indicador de verificación (✓) |
| Fecha de nacimiento | ❌ | Solo lectura |
| Idioma preferido | ❌ | Solo lectura |
| Miembro desde | ❌ | Solo lectura. Fecha de registro |
| Comunicaciones de marketing | ✅ | Active o desactive el consentimiento para recibir correos promocionales |

Haga clic en **"Guardar Cambios"** para actualizar su información.

### 4.2 Mis Cotizaciones

Acceda desde el menú lateral → **"Mis Cotizaciones"** o visite `/mi-cuenta/cotizaciones`.

Aquí verá todas las cotizaciones que le han enviado.

**Filtrar por estado**: Use las pestañas superiores para filtrar:

| Estado | Color | Significado |
|--------|-------|-------------|
| Enviada | 🔵 Azul | La cotización fue enviada y espera su revisión |
| Vista | 🟣 Morado | Usted ya abrió la cotización |
| Aceptada | 🟢 Verde | Usted aceptó la cotización |
| Rechazada | 🔴 Rojo | Usted rechazó la cotización |
| Expirada | ⚫ Gris | La cotización venció sin respuesta |
| Cambios Solicitados | 🟡 Amarillo | Usted solicitó modificaciones |

Cada cotización muestra: número, estado, fecha de creación, vigencia y monto total.

Haga clic en una cotización para ver su detalle completo.

### 4.3 Ver y responder una cotización

Al abrir una cotización (desde "Mis Cotizaciones" o desde el enlace recibido por correo), verá:

**Información general**:
- Número de cotización y estado
- Fecha de creación y fecha de vigencia
- Datos de la empresa emisora

**Tabla de conceptos**:

| Columna | Descripción |
|---------|-------------|
| Concepto | Nombre del producto o servicio |
| Descripción | Detalle del ítem |
| Cantidad | Unidades solicitadas |
| Unidad | Tipo de unidad (pieza, m², metro lineal, hora, servicio) |
| Precio Unitario | Precio por unidad |
| Total | Cantidad × Precio Unitario |

**Resumen financiero**: Subtotal, IVA (16%), Envío (si aplica, sin IVA), Total.

**Condiciones**: Términos de la cotización, condiciones de pago, tiempo de entrega estimado.

**Acciones disponibles**:

| Acción | Requisito | Descripción |
|--------|-----------|-------------|
| **Descargar PDF** | — | Descarga la cotización en formato PDF profesional |
| **Aceptar** | Debe estar autenticado | Abre un formulario donde debe firmar electrónicamente (dibujando su firma en un recuadro), ingresar su nombre completo y opcionalmente agregar notas |
| **Rechazar** | Debe estar autenticado | Debe ingresar un motivo del rechazo (obligatorio) |
| **Solicitar cambios** | Debe estar autenticado | Ver siguiente sección (§4.4) |

> **Nota**: Si accede a la cotización por enlace sin haber iniciado sesión, verá la cotización pero para aceptar o rechazar se le pedirá iniciar sesión primero.

### 4.4 Solicitar cambios a una cotización

Si desea modificaciones a la cotización antes de aceptarla:

1. En la vista de la cotización, busque la sección de **solicitud de cambios**.
2. Describa los cambios que desea en el editor de texto.
3. Haga clic en **"Enviar solicitud de cambios"**.
4. El equipo de ventas recibirá su solicitud y creará una nueva versión de la cotización con los ajustes.
5. Recibirá un correo cuando la nueva versión esté lista para su revisión.

### 4.5 Carrito de compras

El carrito está disponible para productos con modo de venta **"Compra directa"** o **"Ambos"**.

**Agregar productos**:
1. Desde el detalle de un producto, seleccione la variante y cantidad.
2. Haga clic en **"Agregar al carrito"**.
3. Un icono de carrito en el encabezado muestra la cantidad de ítems.

**Cajón rápido del carrito**: Haga clic en el **icono del carrito** (🛒) en el encabezado para abrir un panel lateral con el resumen de sus productos. Desde ahí puede ajustar cantidades o proceder al pago.

**Página del carrito** (`/cart`):

| Elemento | Descripción |
|----------|-------------|
| Lista de productos | Imagen, nombre, variante, SKU, precio unitario |
| Controles de cantidad | Botones −/+ y campo de entrada directa |
| Eliminar | Icono de papelera para remover un producto |
| Resumen | Subtotal, Descuento (si aplica), Impuestos (IVA 16%), Total |
| "Proceder al pago" | Continúa al checkout |

> **Nota**: El carrito funciona incluso sin iniciar sesión. Si agrega productos como visitante y luego inicia sesión, sus productos se combinarán con los de su cuenta.

**Carrito vacío**: Si no tiene productos, verá un mensaje *"Tu carrito está vacío"* con un botón para explorar el catálogo.

### 4.6 Proceso de compra (Checkout)

Después de hacer clic en **"Proceder al pago"** desde el carrito:

**Paso 1 — Dirección de envío**:
- Seleccione una dirección guardada **o** cree una nueva:

  | Campo | Obligatorio |
  |-------|:-----------:|
  | Nombre completo | ✅ |
  | Teléfono | ✅ |
  | Calle | ✅ |
  | Número exterior | ✅ |
  | Número interior | ❌ |
  | Colonia | ✅ |
  | Ciudad | ✅ |
  | Estado | ✅ (seleccione de la lista) |
  | Código postal | ✅ |
  | Referencia | ❌ |

**Paso 2 — Método de pago**:

| Opción | Descripción |
|--------|-------------|
| **MercadoPago** | Pague con tarjeta de crédito/débito, OXXO, transferencia bancaria u otros métodos disponibles en MercadoPago |
| **PayPal** | Pague con su cuenta PayPal o tarjeta a través de PayPal |

**Paso 3 — Confirmación**:
- Revise el resumen: productos, cantidades, precios, dirección de envío, método de pago.
- Acepte los **términos y condiciones** (obligatorio).
- Haga clic en **"Confirmar Pedido"**.
- Será redirigido a la plataforma de pago seleccionada para completar la transacción.
- Al completar el pago exitosamente, recibirá un correo de confirmación con los detalles de su pedido.

### 4.7 Mis Pedidos

Acceda desde el menú lateral → **"Mis Pedidos"** o visite `/mi-cuenta/pedidos`.

**Filtrar por estado**: Use las pestañas para filtrar:

| Estado | Significado |
|--------|-------------|
| Pago pendiente | El pedido fue creado, falta completar el pago |
| Pagado | El pago fue recibido exitosamente |
| En producción | Su pedido está siendo preparado/fabricado |
| Listo | Su pedido está listo para envío |
| En entrega | Su pedido está en camino |
| Completado | Pedido entregado con éxito |
| Cancelado | Pedido cancelado |

**Detalle del pedido** — Haga clic en un pedido para ver:

| Sección | Contenido |
|---------|-----------|
| **Productos** | Nombre, variante, SKU, precio unitario, cantidad |
| **Línea de tiempo** | Historial de cambios de estado con fecha, hora y quién realizó el cambio |
| **Resumen financiero** | Subtotal, IVA, Total, Monto pagado, Saldo pendiente |
| **Dirección de envío** | Dirección completa registrada |
| **Número de rastreo** | Si está disponible, con enlace directo al sitio de la paquetería |
| **Método de pago** | MercadoPago, PayPal o transferencia |
| **Notas** | Notas adicionales del pedido |

**Cancelar pedido**: Solo puede cancelar un pedido que esté en estado **"Pago pendiente"**. Haga clic en **"Cancelar pedido"** y confirme.

### 4.8 Configuración de la cuenta

Acceda desde el menú lateral → **"Configuración"** o visite `/mi-cuenta/configuracion`.

**Cambiar contraseña**:
1. Ingrese su contraseña actual.
2. Ingrese la nueva contraseña (mínimo 8 caracteres, 1 mayúscula, 1 número).
3. Confirme la nueva contraseña.
4. Haga clic en **"Cambiar contraseña"**.

**Cerrar todas las sesiones**: Si sospecha que alguien más tiene acceso a su cuenta, haga clic en **"Cerrar todas las sesiones"**. Esto invalida todos los tokens activos y deberá iniciar sesión nuevamente.

**Eliminar cuenta**: Haga clic en **"Eliminar mi cuenta"**. Se le pedirá confirmar ingresando su contraseña. **Esta acción es irreversible**.

---

## 5. Guía del Vendedor

Los vendedores tienen acceso a todo lo descrito en la sección del Cliente (§4), más el **Panel de Control** para gestionar la operación comercial.

### 5.1 Panel de Control (Dashboard)

Acceda desde el menú de usuario → **"Panel de Control"** o visite `/dashboard`.

El panel muestra un resumen de la actividad:

| Indicador | Descripción |
|-----------|-------------|
| **Solicitudes Pendientes** | Cantidad de solicitudes de cotización sin atender |
| **Sin Respuesta** | Solicitudes que no han tenido ninguna acción |
| **Tasa de Conversión** | Porcentaje de cotizaciones aceptadas vs. enviadas |
| **Total Aprobado** | Monto total de cotizaciones aceptadas |

**Solicitudes urgentes**: Lista de solicitudes pendientes ordenadas por urgencia, mostrando indicadores de color:
- 🔴 **Alta**: Requiere atención inmediata
- 🟡 **Media**: Atención prioritaria
- ⚪ **Normal**: Atención estándar

**Solicitudes de cambio pendientes**: Lista de solicitudes de cambio enviadas por clientes que requieren respuesta.

> **Nota para vendedores**: El panel muestra únicamente las solicitudes asignadas a usted. Los administradores ven todas las solicitudes.

### 5.2 Gestión de Solicitudes de Cotización

Acceda desde el menú lateral → **"Solicitudes"** o visite `/dashboard/solicitudes`.

Esta sección tiene **dos pestañas**:

#### Pestaña: Solicitudes de Cotización

**Filtros disponibles**:
- **Búsqueda**: Busque por número de solicitud, nombre, correo o empresa del cliente
- **Estado**: Pendiente, Asignada, En revisión, Cotizada, Aceptada, Rechazada, Cancelada
- **Urgencia**: Alta, Media, Normal

**Tabla de solicitudes**: Cada fila muestra el número de solicitud, datos del cliente (nombre, correo, empresa), servicio solicitado, indicador de urgencia, estado y fecha.

**Ver detalle de una solicitud** — Haga clic en una solicitud para ver toda la información:

| Sección | Contenido |
|---------|-----------|
| **Datos del cliente** | Nombre, correo, teléfono, empresa |
| **Servicio principal** | Tipo de servicio y todos los campos específicos completados por el cliente (medidas, materiales, cantidades, rutas, etc.) |
| **Servicios solicitados** | Si el cliente agregó múltiples servicios, se muestra una lista numerada con el tipo de servicio, parámetros específicos, método de entrega, fecha requerida y archivos adjuntos por servicio |
| **Archivos adjuntos** | Archivos subidos por el cliente, descargables |
| **Estado actual** | Badge de estado con color |

**Acciones disponibles**:

| Acción | Descripción |
|--------|-------------|
| **Marcar en revisión** | Cambia el estado a "En revisión" para indicar que está trabajando en ella |
| **Asignar a vendedor** | Solo administradores. Seleccione el vendedor responsable del menú desplegable |
| **Crear cotización** | Abre el formulario de nueva cotización prellenado con los datos del cliente y la solicitud |
| **Eliminar solicitud** | Solo administradores. Elimina la solicitud (solo si no ha sido cotizada o aceptada). Requiere confirmación |

#### Pestaña: Solicitudes de Cambio

Muestra las solicitudes de cambio enviadas por clientes sobre cotizaciones existentes.

| Filtro | Opciones |
|--------|----------|
| Estado | Pendiente, Aprobada, Rechazada |

Cada solicitud muestra: número de cotización, cliente, descripción del cambio, fecha y estado.

### 5.3 Crear una cotización

Desde la lista de solicitudes, haga clic en **"Crear cotización"**, o desde Cotizaciones → **"Nueva Cotización"**.

**Formulario de cotización**:

**Datos del cliente**:

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre del cliente (prellenado si viene de una solicitud) |
| Email | Correo del cliente |
| Empresa | Empresa del cliente |

**Conceptos (ítems)**:

Para cada ítem, ingrese:

| Campo | Descripción |
|-------|-------------|
| Concepto | Nombre del producto/servicio. Puede buscar en el catálogo o servicios para prellenar |
| Descripción | Detalle del ítem |
| Cantidad | Número de unidades |
| Unidad | Seleccione: pieza, m², metro lineal, hora, servicio |
| Precio unitario | Precio por unidad (sin IVA) |
| Costo de envío | Costo de envío para este ítem (sin IVA). Se suma al total sin aplicarle impuesto |
| Fecha estimada de entrega | Fecha estimada de entrega para este ítem específico |

El sistema calcula automáticamente el **total por línea** y el **total general** (subtotal + IVA 16% + envío).

- Haga clic en **"+ Agregar ítem"** para agregar más conceptos.
- Use el icono **🗑️** para eliminar un concepto.

**Condiciones de la cotización**:

| Campo | Descripción |
|-------|-------------|
| Días de vigencia | Número de días que la cotización será válida |
| Modo de pago | Pago completo (fijo) |
| Condiciones de pago | Texto libre con las condiciones de pago |
| Tiempo de entrega | Tiempo estimado de entrega general (ej. "5-7 días hábiles") |

**Términos y notas**:

| Campo | Descripción |
|-------|-------------|
| Términos (Español) | Texto de términos y condiciones que verá el cliente |
| Términos (Inglés) | Versión en inglés de los términos |
| Notas internas | Notas visibles solo para el equipo (no las ve el cliente) |

**Guardar la cotización**:

| Botón | Descripción |
|-------|-------------|
| **Guardar como borrador** | Guarda sin enviar. Puede editar posteriormente |
| **Guardar y enviar** | Guarda y envía la cotización al cliente por correo electrónico |

### 5.4 Gestión de Cotizaciones

Acceda desde el menú lateral → **"Cotizaciones"** o visite `/dashboard/cotizaciones`.

**Herramientas**:
- **"Nueva Cotización"**: Crea una cotización sin solicitud previa
- **"Exportar Excel"**: Descarga las cotizaciones en formato Excel

**Filtros**:
- **Búsqueda**: Número de cotización, nombre/correo/empresa del cliente
- **Estado**: Borrador, Enviada, Vista, Aceptada, Rechazada, Expirada, Cambios Solicitados, Convertida

**Tabla de cotizaciones**: Cada fila muestra acciones, número, cliente, estado (badge de color), total y fecha.

**Acciones por cotización**:

| Acción | Disponible cuando | Descripción |
|--------|--------------------|-------------|
| **Ver** | Siempre | Ver el detalle completo |
| **Editar** | Solo en borrador | Modificar la cotización |
| **Enviar al cliente** | Solo en borrador | Envía la cotización por correo |
| **Duplicar** | Siempre | Crea una copia como nuevo borrador |
| **Descargar PDF** | Siempre | Descarga el PDF profesional |
| **Regenerar PDF** | Siempre | Regenera el archivo PDF si hubo cambios |
| **Adjuntar archivo** | Siempre | Sube un archivo adicional a la cotización |
| **Eliminar** | Solo en borrador | Elimina la cotización permanentemente |

### 5.5 Enviar cotización al cliente

1. Desde el detalle de una cotización en estado **Borrador**, haga clic en **"Enviar al cliente"**.
2. El sistema:
   - Genera el PDF de la cotización con el logo, datos del cliente, tabla de conceptos agrupados por servicio/método de entrega (con encabezados de entrega por grupo), totales desglosados (subtotal, IVA, envío si aplica, total) y condiciones.
   - Envía un correo electrónico al cliente con un enlace único para ver la cotización.
   - Cambia el estado a **"Enviada"**.
3. El cliente recibirá un correo con el enlace para revisar, aceptar, rechazar o solicitar cambios.

### 5.6 Responder solicitudes de cambio

Cuando un cliente solicita cambios a una cotización:

1. Verá la solicitud en **Dashboard → Solicitudes de cambio pendientes** o en la pestaña **"Solicitudes de Cambio"** del módulo de Solicitudes.
2. Revise la descripción de los cambios solicitados.
3. Opciones:
   - **Aprobar**: Acepta los cambios y crea una nueva versión de la cotización con los ajustes.
   - **Rechazar**: Rechaza la solicitud con una justificación.
4. Si aprobó, edite la cotización para reflejar los cambios y envíe la nueva versión al cliente.

### 5.7 Convertir cotización en pedido

Cuando un cliente **acepta** una cotización:

1. En el detalle de la cotización aceptada, aparece el botón **"Convertir en pedido"**.
2. Haga clic para crear automáticamente un pedido con los datos de la cotización.
3. El pedido se crea en estado **"Pago pendiente"** y el cliente es notificado.

### 5.8 Gestión de Pedidos

Acceda desde el menú lateral → **"Pedidos"** o visite `/dashboard/pedidos`.

**Indicadores rápidos** (tarjetas en la parte superior):

| Indicador | Descripción |
|-----------|-------------|
| Pago Pendiente | Pedidos esperando pago |
| En Producción | Pedidos en proceso de fabricación |
| Listos / En Camino | Pedidos listos para entrega o en tránsito |
| Completados | Pedidos entregados |

**Filtros**: Búsqueda por número de pedido o datos del cliente, filtro por estado.

**Detalle del pedido** — Haga clic en un pedido para ver toda la información y gestionar su estado.

**Cambiar el estado de un pedido**:

1. En el detalle del pedido, ubique la sección **"Cambiar estado"**.
2. Seleccione el nuevo estado del menú desplegable (solo muestra los estados válidos según el estado actual):

   | Estado actual | Puede cambiar a |
   |---------------|-----------------|
   | Pago pendiente | Pagado, Parcialmente pagado, Cancelado |
   | Pagado | En producción |
   | En producción | Listo, Cancelado |
   | Listo | En entrega, Completado |
   | En entrega | Completado |

3. Opcionalmente agregue notas sobre el cambio de estado.
4. Haga clic en **"Actualizar"**.

**Agregar número de rastreo**:

1. En el detalle del pedido, ubique los campos de **"Número de rastreo"** y **"URL de rastreo"**.
2. Ingrese el número proporcionado por la paquetería y la URL de seguimiento.
3. El cliente podrá ver el enlace de rastreo en su detalle de pedido.

### 5.9 Gestión de Clientes

Acceda desde el menú lateral → **"Clientes"** o visite `/dashboard/clientes`.

**Indicadores** (tarjetas superiores):

| Indicador | Descripción |
|-----------|-------------|
| Total Clientes | Cantidad total de clientes registrados |
| Activos | Clientes con actividad reciente |
| Ingresos | Ingresos totales generados |
| Ticket Promedio | Monto promedio por pedido |

**Lista de clientes**: Cada tarjeta muestra avatar, nombre, correo, teléfono, empresa y estadísticas (número de pedidos, cotizaciones y monto total gastado).

Use el **buscador** para encontrar clientes por nombre o correo.

### 5.10 Gestión de Leads

Acceda desde `/dashboard/leads`.

Los leads son prospectos captados a través del chatbot, formulario de contacto o solicitudes de cotización.

**Filtros**:
- **Búsqueda**: Nombre, correo, empresa
- **Estado**: Nuevo, Contactado, Calificado, Convertido, Perdido
- **Fuente**: Formulario de contacto, Chatbot, Solicitud de cotización, WhatsApp, Teléfono, Referido, Otro

**Tabla de leads**: Muestra nombre, correo, empresa, fuente, estado y fecha de captación.

**Gestionar un lead**: Haga clic en un lead para abrir un panel lateral con:
- Información completa del lead
- Cambiar estado (menú desplegable)
- Historial de contacto

---

## 6. Guía del Administrador

### 6.1 Todo lo del vendedor, más...

El administrador tiene acceso a **todas las funciones del vendedor** (§5) con las siguientes capacidades adicionales en esas secciones:

- **Solicitudes**: Puede asignar solicitudes a cualquier vendedor.
- **Cotizaciones**: Acceso a todas las cotizaciones (no solo las asignadas).
- **Pedidos**: Acceso a todos los pedidos y todas las transiciones de estado.

Además, tiene acceso exclusivo a las siguientes secciones del Panel de Control:

### 6.2 Gestión de Catálogo

Acceda desde el menú lateral → **"Catálogo"** o visite `/dashboard/catalogo`.

> 🔒 **Solo administradores** — Los vendedores ven esta opción bloqueada en el menú.

**Filtros**:
- **Búsqueda**: Nombre o SKU del producto
- **Tipo**: Producto o Servicio
- **Modo de venta**: Compra directa, Cotización, Ambos (Híbrido)

**Lista de productos**: Cada producto muestra imagen, nombre, categoría, tipo, modo de venta, precio e interruptor de activo/inactivo.

#### Crear o editar un producto

Haga clic en **"Nuevo Producto"** o en el botón de editar de un producto existente.

**Información básica**:

| Campo | Obligatorio | Descripción |
|-------|:-----------:|-------------|
| Tipo | ✅ | Producto o Servicio |
| Nombre (Español) | ✅ | Nombre que se muestra en el catálogo |
| Nombre (Inglés) | ❌ | Nombre en inglés para usuarios en ese idioma |
| Descripción corta (ES/EN) | ❌ | Resumen breve del producto |
| Descripción completa (ES/EN) | ❌ | Descripción detallada con formato |
| Categoría | ❌ | Categoría del producto (seleccione de la lista) |
| Tags | ❌ | Etiquetas para organización y búsqueda |
| Modo de venta | ✅ | Compra directa, Cotización, o Ambos (Híbrido) |
| Precio base | ❌ | Precio principal del producto |
| Precio de comparación | ❌ | Precio anterior (se muestra tachado) |
| SKU | ❌ | Código único de identificación |
| Activo | — | Interruptor para mostrar/ocultar del catálogo |
| Destacado | — | Interruptor para marcar como producto destacado |
| Posición | ❌ | Número para controlar el orden en el catálogo |

**Imágenes**:
- Haga clic en **"Subir imágenes"** o arrastre y suelte archivos.
- Las imágenes se **optimizan automáticamente** (se comprimen y convierten a formato WebP).
- Arrastre las imágenes para cambiar el orden. La primera es la imagen principal.
- Haga clic en el icono **🗑️** para eliminar una imagen.

**Variantes**:

Si su producto tiene opciones (por ejemplo, diferentes tamaños o colores):

1. En la sección de **"Atributos"**, defina los atributos (ej. Color, Talla, Material) y sus valores (ej. Rojo, Azul, Verde).
2. En la sección de **"Variantes"**, cree combinaciones de atributos.
3. Para cada variante puede definir: precio individual, stock, SKU e imágenes específicas.

#### Gestión de categorías

Desde el catálogo puede administrar las categorías de productos:
- Crear nuevas categorías con nombre (ES/EN) e imagen.
- Las categorías pueden ser jerárquicas (categoría padre → subcategoría).
- Reordenar las categorías mediante el campo de posición.

### 6.3 Gestión de Usuarios

Acceda desde el menú lateral → **"Usuarios"** o visite `/dashboard/usuarios`.

> 🔒 **Solo administradores**.

**Filtros**:
- **Búsqueda**: Nombre o correo electrónico
- **Rol**: Cliente, Vendedor, Administrador
- **Estado**: Activo, Inactivo

**Tabla de usuarios**: Cada fila muestra avatar, nombre, correo, rol (badge), estado (activo/inactivo), número de pedidos y fecha de registro.

**Acciones por usuario**:

| Acción | Descripción |
|--------|-------------|
| **Ver detalle** | Información completa del usuario |
| **Activar/Desactivar** | Habilitar o deshabilitar el acceso del usuario al sistema |
| **Cambiar rol** | Promover o cambiar el rol del usuario (ej. de Cliente a Vendedor) |

> **Precaución**: Cambiar el rol de un usuario le otorga o restringe acceso inmediatamente. Asegúrese antes de promover a alguien al rol de Vendedor o Administrador.

### 6.4 Gestión de Contenido (CMS)

Acceda desde el menú lateral → **"Contenido"** o visite `/dashboard/contenido`.

> 🔒 **Solo administradores**.

Esta sección permite editar todo el contenido dinámico del sitio público sin necesidad de modificar código.

#### Pestaña: Hero / Carrusel Principal

| Campo por slide | Descripción |
|----------------|-------------|
| Servicio asociado | Qué servicio se promociona |
| Título (ES/EN) | Texto grande del slide |
| Subtítulo | Texto secundario |
| Imagen | Imagen de fondo del slide |
| Texto del botón | Texto del botón de acción (CTA) |
| URL del botón | Enlace al hacer clic en el botón |
| Posición | Orden del slide (arrastre para reordenar) |
| Activo | Interruptor para mostrar/ocultar |

#### Pestaña: Servicios

Los 9 servicios se sincronizan automáticamente. Para cada servicio puede:
- Editar la descripción (ES/EN).
- Gestionar las **imágenes del carrusel** del servicio: subir, reordenar, eliminar.
- Gestionar las imágenes por **subcategoría** del servicio.
- Activar o desactivar el servicio.

#### Pestaña: Videos del Portafolio

| Campo | Descripción |
|-------|-------------|
| Título | Nombre del video |
| URL | Enlace de YouTube o Vimeo |
| Miniatura | Imagen de preview |
| Posición | Orden de aparición |
| Activo | Mostrar/ocultar |

#### Contenido adicional gestionable (vía API del backend):

| Entidad | Campos principales |
|---------|-------------------|
| **Testimonios** | Autor, texto, foto, posición |
| **Logos de clientes** | Nombre del cliente, imagen del logo, URL, posición |
| **Preguntas frecuentes** | Pregunta (ES/EN), respuesta (ES/EN), categoría, posición |
| **Sucursales** | Nombre, dirección, teléfono, horarios, coordenadas del mapa, posición |
| **Páginas legales** | Política de privacidad, términos y condiciones (contenido editable) |
| **Configuración del sitio** | Parámetros globales del sistema |

### 6.5 Analítica

Acceda desde el menú lateral → **"Analítica"** o visite `/dashboard/analytics`.

> 🔒 **Solo administradores**.

**Seleccione el periodo**: 7 días, 14 días, 30 días o 90 días.

**Indicadores principales** (tarjetas):

| Indicador | Descripción |
|-----------|-------------|
| Vistas de Página | Total de páginas visitadas en el periodo |
| Sesiones Únicas | Cantidad de visitantes únicos |
| Clics en CTA | Clics en botones de acción |
| Cotizaciones Enviadas | Formularios de cotización enviados |

**Gráficas y reportes**:

| Gráfica | Tipo | Descripción |
|---------|------|-------------|
| **Vistas por Día** | Línea | Evolución de visitas diarias |
| **Top Páginas** | Barras | Páginas más visitadas |
| **Dispositivos** | Dona | Distribución entre escritorio, móvil y tablet |
| **Embudo de Cotizaciones** | Embudo | Visualiza el flujo: inicio → envío → abandono → error |
| **Top Eventos** | Barras | Eventos más frecuentes (clics, interacciones) |
| **Fuentes de Tráfico** | Tabla | Origen de visitas por parámetros UTM (campaña, medio, fuente) |

### 6.6 Auditoría

Acceda desde el menú lateral → **"Auditoría"** o visite `/dashboard/auditoria`.

> 🔒 **Solo administradores**.

El sistema registra automáticamente todas las acciones realizadas. Esta sección permite consultar el historial completo.

**Tabla de eventos**:

| Columna | Descripción |
|---------|-------------|
| Fecha/Hora | Cuándo ocurrió la acción |
| Usuario | Nombre y correo de quién realizó la acción |
| Acción | Tipo de acción: creado, actualizado, eliminado, cambio de estado, login, logout |
| Entidad | Tipo de objeto afectado: Usuario, Pedido, Cotización, Producto, Pago, Movimiento de inventario |
| ID Entidad | Identificador del objeto afectado |
| Detalle | Resumen del cambio |

**Filtros**:
- **Entidad**: Filtre por tipo de objeto (Usuario, Pedido, Cotización, etc.)
- **Acción**: Filtre por tipo de acción (creado, actualizado, eliminado, etc.)

**Ver detalle**: Haga clic en un evento para ver:
- Estado anterior y posterior del objeto (formato JSON).
- Vista de diferencias (qué cambió exactamente).
- Dirección IP del usuario.
- Navegador utilizado (user agent).

**Exportar**: Haga clic en **"Exportar"** para descargar los registros de auditoría.

### 6.7 Notificaciones

El icono de **campana** (🔔) en el encabezado muestra el número de notificaciones sin leer.

> Las notificaciones solo son visibles para el equipo interno (administradores y vendedores).

**Tipos de notificación**:

| Notificación | Cuándo se genera |
|-------------|-------------------|
| Nueva solicitud de cotización | Un cliente envía un formulario de cotización |
| Cotización aceptada | Un cliente acepta una cotización |
| Cotización rechazada | Un cliente rechaza una cotización |
| Cambio de estado de pedido | Un pedido cambia de estado |
| Pago recibido | Se confirma un pago |
| Pedido completado | Un pedido se marca como completado |
| Compra en catálogo | Un cliente realiza una compra desde el catálogo |
| Nuevo usuario registrado | Un usuario se registra en el sistema |

**Acciones**:
- Haga clic en una notificación para ir directamente al objeto relacionado.
- Haga clic en **"Marcar como leída"** para quitar el indicador.
- Use **"Marcar todas como leídas"** para limpiar todas las notificaciones.

---

## 7. Preguntas Frecuentes

### General

**¿En qué navegadores funciona el sistema?**  
Google Chrome, Mozilla Firefox, Safari y Microsoft Edge en sus versiones recientes. Recomendamos Google Chrome para la mejor experiencia.

**¿El sistema funciona en dispositivos móviles?**  
Sí. El sitio es completamente responsivo y se adapta a teléfonos y tabletas.

**¿El sistema está disponible en inglés?**  
Sí. Puede cambiar el idioma haciendo clic en el icono de globo (🌐) en el encabezado.

### Cuenta

**No recibí el correo de verificación, ¿qué hago?**  
1. Revise su carpeta de spam o correo no deseado.  
2. Intente iniciar sesión; aparecerá un botón para **reenviar** el correo de verificación.  
3. Si después de varios intentos no lo recibe, contacte al equipo de soporte.

**¿Puedo cambiar mi correo electrónico?**  
Actualmente no es posible cambiar el correo electrónico desde el panel. Contacte al administrador del sistema.

**Olvidé mi contraseña.**  
En la pantalla de login, haga clic en "¿Olvidaste tu contraseña?" e ingrese su correo. Recibirá un enlace para restablecerla.

### Cotizaciones

**¿Cuánto tiempo es válida una cotización?**  
Cada cotización tiene una fecha de vigencia específica que se muestra en el documento. Una vez vencida, la cotización expira automáticamente.

**¿Puedo pedir cambios a una cotización?**  
Sí. En la vista de la cotización, puede enviar una solicitud de cambios describiendo las modificaciones deseadas. El equipo de ventas le enviará una versión actualizada.

**¿Necesito crear una cuenta para ver una cotización?**  
Puede ver la cotización sin cuenta usando el enlace recibido por correo. Sin embargo, para **aceptar**, **rechazar** o **solicitar cambios**, debe iniciar sesión.

### Compras

**¿Qué métodos de pago aceptan?**  
MercadoPago (tarjetas de crédito/débito, OXXO, transferencia) y PayPal.

**¿Puedo cancelar un pedido?**  
Solo puede cancelar pedidos en estado "Pago pendiente". Una vez que el pago se ha procesado, contacte al equipo de ventas para solicitar una cancelación o reembolso.

**¿Cómo sigo el estado de mi pedido?**  
En "Mi Cuenta" → "Mis Pedidos", haga clic en su pedido para ver la línea de tiempo completa y, si está disponible, el número de rastreo.

### Para Vendedores

**¿Puedo ver cotizaciones de otros vendedores?**  
Los vendedores solo ven las solicitudes y cotizaciones asignadas a ellos (excepto solicitudes de urgencia alta). Los administradores ven todo.

**¿Cómo convierto una cotización en pedido?**  
Solo las cotizaciones **aceptadas** por el cliente pueden convertirse en pedido. En el detalle de la cotización aceptada, haga clic en "Convertir en pedido".

---

*Manual de Usuario — Agencia MCD v1.0 — Febrero 2026*
