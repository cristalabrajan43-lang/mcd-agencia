# Cronograma de Actividades — MCD-Agencia

**Proyecto**: Sistema Web para Agencia de Publicidad MCD  
**Periodo**: 12 de enero – 24 de abril de 2026 (15 semanas)  
**Metodología**: Desarrollo iterativo incremental  
**Responsable**: Desarrollo full-stack

---

## Diagrama de Gantt

| # | Actividad | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 | S13 | S14 | S15 |
|---|-----------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Revisión de los procesos manuales actuales requeridos en el sistema | ██ | | | | | | | | | | | | | | |
| 2 | Levantamiento y abstracción de requerimientos | | ██ | | | | | | | | | | | | | |
| 3 | Selección de las herramientas de desarrollo y metodología | | ██ | ██ | | | | | | | | | | | | |
| 4 | Definición de la arquitectura del sistema y BD | | | ██ | ██ | | | | | | | | | | | |
| 5 | Diseño de integración con servicios externos | | | | ██ | | | | | | | | | | | |
| 6 | Diseño de las interfaces de usuario (UI/UX) | | | | ██ | ██ | | | | | | | | | | |
| 7 | Sitio web público y sistema de autenticación | | | | | ██ | ██ | | | | | | | | | |
| 8 | Sistema de cotizaciones y generación de PDF | | | | | | ██ | ██ | | | | | | | | |
| 9 | Catálogo de productos e inventario | | | | | | | ██ | ██ | | | | | | | |
| 10 | Carrito, pedidos y pasarelas de pago | | | | | | | | ██ | ██ | | | | | | |
| 11 | CMS, chatbot y sistema de notificaciones | | | | | | | | | ██ | ██ | | | | | |
| 12 | Documentación del código y del sistema | | | | | | | | | | ██ | ██ | ██ | | | |
| 13 | Pruebas, retroalimentación y modificaciones | | | | | | | | | | | | ██ | ██ | | |
| 14 | Despliegue de la solución en producción | | | | | | | | | | | | | ██ | ██ | |
| 15 | Entrega del sistema y capacitación al equipo | | | | | | | | | | | | | | ██ | ██ |

---

## Calendario de Semanas

| Semana | Periodo | Fase |
|--------|---------|------|
| S1 | 12 – 18 Ene | Análisis |
| S2 | 19 – 25 Ene | Análisis / Planeación |
| S3 | 26 Ene – 1 Feb | Planeación / Diseño |
| S4 | 2 – 8 Feb | Diseño |
| S5 | 9 – 15 Feb | Diseño / Desarrollo |
| S6 | 16 – 22 Feb | Desarrollo |
| S7 | 23 Feb – 1 Mar | Desarrollo |
| S8 | 2 – 8 Mar | Desarrollo |
| S9 | 9 – 15 Mar | Desarrollo |
| S10 | 16 – 22 Mar | Desarrollo / Documentación |
| S11 | 23 – 29 Mar | Documentación |
| S12 | 30 Mar – 5 Abr | Documentación / Pruebas |
| S13 | 6 – 12 Abr | Pruebas / Despliegue |
| S14 | 13 – 19 Abr | Despliegue / Entrega |
| S15 | 20 – 24 Abr | Entrega / Capacitación |

---

## Descripción de Actividades

### 1. Revisión de los procesos manuales actuales requeridos en el sistema (S1)

**Objetivo**: Identificar y documentar los procesos operativos actuales de la agencia de publicidad MCD que requieren ser digitalizados o automatizados, detectando ineficiencias y áreas de oportunidad para justificar el desarrollo del sistema.

Análisis de los procesos actuales de la agencia de publicidad MCD: gestión de clientes, generación de cotizaciones, control de inventario de material publicitario y comunicación con prospectos. Identificación de áreas de oportunidad donde una solución digital puede optimizar la operación: automatización de cotizaciones, catálogo en línea, seguimiento de pedidos y captación de leads.

**Entregable**: Documento de diagnóstico con procesos manuales identificados y áreas de mejora.

---

### 2. Levantamiento y abstracción de requerimientos (S2)

**Objetivo**: Definir de manera clara y estructurada los requerimientos funcionales y no funcionales del sistema, estableciendo el alcance del proyecto y las reglas de negocio que regirán cada módulo.

Definición de los requerimientos funcionales y no funcionales del sistema a partir del diagnóstico. Se documentan los casos de uso principales: registro de usuarios, solicitud y gestión de cotizaciones, catálogo de productos, carrito de compras, pagos en línea, gestión de inventario, CMS para contenido dinámico, chatbot para captación de leads, y panel de administración con control de acceso basado en roles (RBAC).

**Entregable**: Especificación de requerimientos del sistema (funcionales, no funcionales, reglas de negocio).

---

### 3. Selección de las herramientas de desarrollo y metodología (S2–S3)

**Objetivo**: Evaluar y seleccionar el stack tecnológico más adecuado para el desarrollo del sistema, considerando escalabilidad, costos, comunidad de soporte y compatibilidad entre tecnologías, así como definir la metodología de trabajo.

Evaluación y selección del stack tecnológico:
- **Frontend**: Next.js 14 (React 18, App Router, Server Components), TypeScript, Tailwind CSS
- **Backend**: Django 5.0 con Django REST Framework, Python 3.11+
- **Base de datos**: PostgreSQL (producción), SQLite (desarrollo)
- **Almacenamiento**: Cloudflare R2 (compatible S3) para imágenes y archivos
- **Email**: Brevo (API HTTP) para correos transaccionales
- **Pagos**: MercadoPago y PayPal (APIs REST)
- **Despliegue**: Render (backend), Vercel (frontend)
- **Metodología**: Desarrollo iterativo incremental con control de versiones Git

**Entregable**: Documento de arquitectura tecnológica y justificación de herramientas.

---

### 4. Definición de la arquitectura del sistema y BD (S3–S4)

**Objetivo**: Diseñar la arquitectura general del sistema y el modelo de base de datos, definiendo la estructura de módulos, la comunicación entre frontend y backend, el esquema de autenticación y la estrategia de almacenamiento.

Diseño de la arquitectura general del sistema:
- Arquitectura cliente-servidor con API REST (separación frontend/backend)
- Modelado de base de datos: 11 apps Django (users, catalog, quotes, orders, payments, inventory, chatbot, content, notifications, audit, core)
- Diseño de endpoints RESTful con versionado
- Esquema de autenticación JWT (access + refresh tokens) con soporte OAuth2 (Google)
- Sistema RBAC con roles: administrador, vendedor, cliente
- Estrategia de almacenamiento de archivos en la nube (Cloudflare R2)

**Entregable**: Diagrama de arquitectura, modelo entidad-relación, diseño de API.

---

### 5. Diseño de integración con servicios externos (S4)

**Objetivo**: Planificar la integración del sistema con cada servicio externo requerido, definiendo los flujos de comunicación, protocolos de seguridad y mecanismos de respaldo para garantizar la operación continua.

Planificación de las integraciones con servicios de terceros:
- **Brevo**: Envío de correos de verificación, confirmación de pedidos, notificaciones de cotizaciones. Plantillas HTML responsivas con soporte bilingüe (es/en)
- **Cloudflare R2**: Almacenamiento de imágenes de productos, logos de cotizaciones, archivos de catálogo. Configuración de buckets y políticas CORS
- **MercadoPago**: Creación de preferencias de pago, webhooks de confirmación, reembolsos
- **PayPal**: Órdenes de pago, captura, webhooks IPN
- **Google OAuth**: Flujo de autenticación social para registro e inicio de sesión

**Entregable**: Documento de integraciones con diagramas de secuencia por servicio.

---

### 6. Diseño de las interfaces de usuario (UI/UX) (S4–S5)

**Objetivo**: Diseñar interfaces intuitivas, responsivas y alineadas a la identidad visual de la agencia MCD, asegurando una experiencia de usuario óptima en todos los dispositivos y para cada rol del sistema.

Diseño de las interfaces del sistema siguiendo los lineamientos de marca de la agencia MCD:
- **Sitio público**: Landing page, página de servicios, catálogo, contacto
- **Portal del cliente**: Registro, login, mis cotizaciones, mis pedidos, carrito
- **Panel de administración**: Dashboard con métricas, gestión de usuarios, cotizaciones, pedidos, inventario, CMS, auditoría
- Diseño responsivo (mobile-first) con Tailwind CSS
- Sistema de diseño con componentes reutilizables
- Soporte de internacionalización (español e inglés) con `next-intl`

**Entregable**: Wireframes y mockups de las interfaces principales.

---

### 7. Sitio web público y sistema de autenticación (S5–S6)

**Objetivo**: Desarrollar el sitio web público de la agencia con toda la información comercial y un sistema de autenticación seguro con verificación por correo, roles diferenciados y soporte para inicio de sesión con Google.

Implementación del sitio público y el módulo de usuarios:
- **Landing page**: Hero section, servicios, portafolio, testimonios, call-to-action, footer con información de contacto
- **Páginas estáticas**: Nosotros, servicios, contacto con formulario y reCAPTCHA
- **Registro de usuarios**: Formulario con validación, verificación de correo electrónico mediante token firmado (Django Signing Framework, 24h de expiración)
- **Login**: Autenticación JWT con refresh automático, inicio de sesión con Google OAuth
- **Gestión de roles**: Admin, vendedor, cliente con permisos diferenciados por endpoint
- **Perfil de usuario**: Edición de datos personales, cambio de contraseña, foto de perfil
- **Middleware de auditoría**: Registro automático de acciones por usuario (IP, método, endpoint)

**Entregable**: Sitio público funcional con sistema de autenticación y roles operativo.

---

### 8. Sistema de cotizaciones y generación de PDF (S6–S7)

**Objetivo**: Implementar un sistema completo de cotizaciones que permita a los clientes solicitarlas, a los vendedores crearlas con ítems detallados, y al sistema generar documentos PDF profesionales con flujo de aprobación, versionamiento y solicitudes de cambio.

Implementación del módulo de cotizaciones (RFQ):
- **Solicitud de cotización**: Formulario para clientes con descripción del proyecto, tipo de servicio, cantidad, fecha deseada, archivos adjuntos
- **Gestión por vendedor/admin**: Crear cotización con ítems detallados (producto, cantidad, precio unitario, descuento), condiciones, vigencia
- **Versionamiento**: Historial de versiones de cada cotización con comparación de cambios
- **Solicitudes de cambio**: El cliente puede solicitar modificaciones; el vendedor responde con nueva versión
- **Generación de PDF**: Documento profesional con ReportLab — logo, datos del cliente, tabla de ítems, subtotal/IVA/total, condiciones, vigencia
- **Vista pública**: URL firmada para que el cliente vea y acepte/rechace la cotización sin autenticarse
- **Notificaciones**: Correo automático al enviar, aceptar, rechazar o solicitar cambios

**Entregable**: Sistema de cotizaciones completo con generación de PDF y flujo de aprobación.

---

### 9. Catálogo de productos e inventario (S7–S8)

**Objetivo**: Desarrollar un catálogo de productos en línea con gestión de variantes, imágenes optimizadas y filtros avanzados, junto con un sistema de inventario que permita controlar movimientos de stock y generar alertas automáticas de stock bajo.

Implementación de los módulos de catálogo e inventario:
- **Catálogo**: CRUD de productos con categorías jerárquicas, variantes (talla, color, material), imágenes múltiples almacenadas en Cloudflare R2
- **Procesamiento de imágenes**: Conversión automática a WebP, generación de thumbnails, optimización de tamaño
- **Vista pública del catálogo**: Grid de productos con filtros, búsqueda, paginación, detalle del producto
- **Inventario (backend)**: Movimientos de stock (entrada, salida, ajuste, devolución), trazabilidad por usuario
- **Alertas de stock bajo**: Umbrales configurables por producto, notificación automática a administradores
- **Proveedores**: Gestión de proveedores asociados a productos con información de contacto y lead time
- **Dashboard de inventario**: Tabla de movimientos, filtros por tipo/producto/fecha, acciones rápidas

**Entregable**: Catálogo en línea y sistema de inventario con alertas de stock.

---

### 10. Carrito, pedidos y pasarelas de pago (S8–S9)

**Objetivo**: Implementar el flujo completo de comercio electrónico, desde el carrito de compras hasta la confirmación del pedido, integrando las pasarelas de pago MercadoPago y PayPal con manejo de webhooks, reembolsos y deducción automática de inventario.

Implementación del flujo completo de e-commerce:
- **Carrito de compras**: Agregar/eliminar productos, modificar cantidades, persistencia por sesión y usuario
- **Checkout**: Selección de dirección de envío, resumen del pedido, selección de método de pago
- **Pedidos**: Creación automática al completar el pago, estados (pendiente, pagado, en preparación, enviado, entregado, cancelado)
- **MercadoPago**: Integración con API de preferencias, redirect al checkout de MP, webhooks de confirmación
- **PayPal**: Integración con API de órdenes, captura de pago, webhooks IPN
- **Reembolsos**: Solicitud y procesamiento de reembolsos parciales/totales a través de las APIs de los proveedores
- **Emails transaccionales**: Confirmación de pedido, confirmación de pago, actualización de estado
- **Deducción automática de inventario**: Al confirmar un pedido se descuenta el stock correspondiente

**Entregable**: Flujo e-commerce funcional con pagos en línea (sandbox).

---

### 11. CMS, chatbot y sistema de notificaciones (S9–S10)

**Objetivo**: Dotar al sistema de un gestor de contenido para que el administrador pueda actualizar el sitio sin intervención técnica, un chatbot para captación de prospectos y atención automatizada, y un sistema de notificaciones multicanal para mantener informados a todos los actores.

Implementación de módulos complementarios:
- **CMS**: Gestión de secciones dinámicas del sitio (hero, servicios, testimonios, FAQ), editor de contenido con imágenes, preview en tiempo real
- **Chatbot**: Motor de respuestas basado en reglas e intents, detección de palabras clave, respuestas contextuales sobre servicios, precios y horarios, captura de datos del prospecto (lead)
- **Notificaciones por correo**: Templates HTML responsivos vía Brevo para cada evento del sistema (verificación, cotización, pedido, pago)
- **Notificaciones in-app**: Sistema de notificaciones internas con marca de leído/no leído, polling periódico, panel en el header
- **Analytics**: Dashboard con métricas clave — cotizaciones por periodo, pedidos, ingresos, usuarios activos, productos más vistos

**Entregable**: CMS operativo, chatbot funcional, sistema de notificaciones por email y en la app.

---

### 12. Documentación del código y del sistema (S10–S12)

**Objetivo**: Elaborar la documentación técnica y funcional completa del sistema, incluyendo arquitectura, historial de cambios, guías de despliegue, documentación de API y manual de usuario, garantizando la mantenibilidad y transferencia de conocimiento.

Elaboración de la documentación técnica y funcional:
- **Documentación del código**: Docstrings en modelos, serializers y views de Django. Comentarios en componentes React clave
- **Arquitectura del sistema**: Documento ARCHITECTURE.md con diagrama de infraestructura, flujos de datos, stack tecnológico, estrategia de despliegue
- **Historial de cambios**: CHANGELOG.md con todas las fases de desarrollo organizadas cronológicamente
- **Guía de despliegue**: Instrucciones para replicar el entorno en Render (backend) y Vercel (frontend), variables de entorno requeridas
- **Documentación de API**: Endpoints disponibles con métodos HTTP, parámetros, respuestas esperadas y códigos de error
- **Manual de usuario**: Guía para el equipo de ventas sobre el uso del panel de administración

**Entregable**: Documentación técnica completa (ARCHITECTURE.md, CHANGELOG.md, README.md, manual de usuario).

---

### 13. Pruebas, retroalimentación y modificaciones (S12–S13)

**Objetivo**: Validar la calidad, seguridad y rendimiento del sistema mediante pruebas automatizadas y manuales, recopilar retroalimentación del equipo de la agencia, y aplicar las correcciones y ajustes necesarios antes del despliegue final.

Ejecución de pruebas y ciclo de retroalimentación:
- **Pruebas unitarias (backend)**: Tests con `pytest-django` para modelos, serializers y views de cada módulo
- **Pruebas unitarias (frontend)**: Tests con Jest y React Testing Library para componentes y servicios
- **Pruebas de integración**: Flujos completos end-to-end: registro → compra → pago, solicitud → cotización → aprobación
- **Pruebas de seguridad**: Verificación de permisos por rol, protección CSRF/XSS, validación de tokens JWT, rate limiting
- **Pruebas de rendimiento**: Auditoría con Lighthouse (Performance, Accessibility, SEO, Best Practices)
- **Pruebas responsive**: Verificación en dispositivos móviles (iOS Safari, Android Chrome) y tablets
- **Retroalimentación del equipo**: Presentación al equipo de ventas y gerencia, recolección de observaciones sobre usabilidad y flujos
- **Modificaciones**: Ajustes en interfaces y corrección de bugs reportados durante la revisión

**Entregable**: Reporte de pruebas con resultados, bugs encontrados, correcciones aplicadas y aprobación del equipo.

---

### 14. Despliegue de la solución en producción (S13–S14)

**Objetivo**: Poner en producción el sistema completo con configuración de dominio, SSL, bases de datos, almacenamiento en la nube, servicio de correo y pasarelas de pago, asegurando la operación estable y el monitoreo continuo.

Puesta en producción del sistema completo:
- **Backend en Render**: Despliegue con Docker, PostgreSQL administrado, variables de entorno de producción, build automático desde rama `main`
- **Frontend en Vercel**: Despliegue con integración Git, dominio personalizado `agenciamcd.mx`, optimización automática de assets
- **Dominio y SSL**: Configuración de DNS en Cloudflare, certificados SSL automáticos, redirects HTTP → HTTPS
- **Almacenamiento**: Bucket de Cloudflare R2 en producción con políticas de acceso configuradas
- **Email**: Verificación del servicio Brevo en producción con dominio autenticado
- **Monitoreo**: Configuración de health checks, alertas de caída, logs centralizados
- **Pasarelas de pago**: Activación de credenciales de producción (MercadoPago y PayPal) con transacción de prueba real
- **Carga de contenido real**: Catálogo de productos con precios e imágenes definitivas, contenido del CMS

**Entregable**: Sistema desplegado y operativo en producción con dominio, SSL y pagos activos.

---

### 15. Entrega del sistema y capacitación al equipo (S14–S15)

**Objetivo**: Realizar la entrega formal del proyecto al equipo de la agencia MCD, capacitar al personal operativo en el uso de todas las funcionalidades del sistema según su rol, y proporcionar la documentación necesaria para la operación autónoma.

Transferencia de conocimiento y cierre del proyecto:
- Sesión de capacitación para el equipo de ventas: gestión de cotizaciones, pedidos, clientes, leads
- Sesión de capacitación para administradores: catálogo, inventario, CMS, usuarios, roles, reportes, auditoría
- Entrega del manual de usuario impreso/digital
- Entrega de credenciales de acceso y documentación de las plataformas (Render, Vercel, Cloudflare, Brevo)
- Verificación final del sistema en producción con datos reales
- Periodo de soporte post-lanzamiento para resolución de dudas
- Entrega formal del proyecto con acta de cierre

**Entregable**: Equipo capacitado, documentación entregada, proyecto cerrado formalmente.
