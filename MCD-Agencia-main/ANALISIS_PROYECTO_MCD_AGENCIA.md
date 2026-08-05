# Análisis Estructurado - Proyecto MCD-Agencia
**Plataforma de E-commerce y Cotizaciones para Medios Impresos y Publicidad Exterior**

**Fecha**: Marzo 22, 2026  
**Versión**: 1.0  
**Autor**: Análisis Automatizado

---

## Tabla de Contenidos
1. [Roles de Usuario](#roles-de-usuario)
2. [Módulos y Funcionalidades](#módulos-y-funcionalidades)
3. [Procesos de Negocio Principales](#procesos-de-negocio-principales)
4. [Integraciones Externas](#integraciones-externas)
5. [Modelos de Datos Clave](#modelos-de-datos-clave)
6. [Flujos de Trabajo Principales](#flujos-de-trabajo-principales)

---

## Roles de Usuario

### 1. **Visitante (No Autenticado)**
- **Permisos**: Vista pública del sitio, catálogo de productos, landing page
- **Acciones**:
  - Navegar catálogo público
  - Completar contacto/formularios
  - Acceder a información general
  - Iniciar sesión/registro

### 2. **Cliente (Customer)**
- **Permisos**: Acceso a funcionalidades de cliente autenticado
- **Rol BD**: `Role.CUSTOMER`
- **Acciones**:
  - ✅ Solicitar cotizaciones (Quote Requests)
  - ✅ Ver mis cotizaciones y su estado
  - ✅ Aceptar/Rechazar cotizaciones
  - ✅ Comprar productos del catálogo
  - ✅ Realizar pagos (Mercado Pago/PayPal)
  - ✅ Ver historial de pedidos
  - ✅ Ver estado de pedidos en producción
  - ✅ Gestionar mi perfil y dirección de envío
  - ✅ Recibir notificaciones in-app
  - ✅ Usar chatbot para consultas

### 3. **Vendedor (Sales)**
- **Permisos**: Gestión de operaciones comerciales
- **Rol BD**: `Role.SALES`
- **Acciones**:
  - ✅ Revisar y asignar solicitudes de cotización
  - ✅ Crear y enviar cotizaciones
  - ✅ Gestionar cambios en cotizaciones solicitados por clientes
  - ✅ Convertir cotización aceptada a pedido
  - ✅ Ver historial de clientes
  - ✅ Gestionar leads capturados
  - ✅ Ver reportes de ventas
  - ✅ Recibir notificaciones de pedidos nuevos
  - ✅ Ver inventario disponible

### 4. **Administrador (Admin)**
- **Permisos**: Acceso completo del sistema
- **Rol BD**: `Role.ADMIN`
- **Acciones**:
  - ✅ Gestionar usuarios (crear, editar, desactivar)
  - ✅ Asignar roles y permisos
  - ✅ Gestionar catálogo completo (productos, categorías, variantes)
  - ✅ Gestión de inventario y alertas de stock
  - ✅ Procesar rembolsos y pagos especiales
  - ✅ Ver todos los pedidos y cotizaciones
  - ✅ Gestionar contenido (CMS): carrusel, testimonios, FAQs
  - ✅ Ver reportes y analytics del sistema
  - ✅ Ver bitácora de auditoría completa
  - ✅ Configurar parámetros del sistema
  - ✅ Gestionar configuración de pagos

### 5. **Superadmin (Deprecated)**
- **Nota**: Consolidado en `Role.ADMIN` para simplificar arquitectura
- **Migración**: Usar `ADMIN` para nuevas asignaciones

---

## Módulos y Funcionalidades

### 📦 **1. CATALOG (Catálogo de Productos)**
**Propósito**: Gestión centralizada de productos y servicios para venta directa y cotizaciones

| Funcionalidad | Descripción |
|---|---|
| **Categorías Jerárquicas** | Estructura MPPT (Multi-level) para navegación intuitiva (Ej: Publicidad Exterior > Espectaculares > Iluminados) |
| **Productos/Servicios** | Items con múltiples variantes (SKU, precio, atributos) |
| **Variantes** | SKU específico con atributos (tamaño, material, color, acabado) |
| **Atributos Configurables** | Flexibilidad para diferentes tipos de productos |
| **Imágenes Múltiples** | Galería por producto/variante |
| **Datos SEO** | Meta titles, descriptions para cada item |
| **Stock Disponible** | Integración con inventario en tiempo real |
| **Modos de Venta** | BUY (venta directa), QUOTE (solo cotización), HYBRID (ambos) |
| **Galería de Categorías** | Imágenes destacadas por categoría |

**Casos de Uso**:
- 📍 Cliente explora productos
- 📍 Vendedor gestiona catálogo
- 📍 Admin configura categorías

---

### 💬 **2. QUOTES (Sistema de Cotizaciones - RFQ)**
**Propósito**: Solicitud, gestión y seguimiento de cotizaciones personalizadas

| Funcionalidad | Descripción |
|---|---|
| **Quote Request (Solicitud)** | Cliente solicita cotización con especificaciones personalizadas |
| **Estados del Pedido** | `draft → pending → assigned → in_review → info_requested → quoted → accepted/rejected/expired/cancelled` |
| **Asignación Automática** | Por especialidad, carga de vendedor, fallback |
| **Generación de PDF** | Cotización bilingüe (ES/EN) con logo y datos fiscales |
| **Tokens Públicos** | Link compartible para cliente sin autenticación |
| **Solicitudes de Cambio** | Cliente puede solicitar ajustes en cotización |
| **Validez** | Cotizaciones expiran automáticamente (default: 15 días) |
| **Líneas de Cotización** | Items individuales con cantidad, descripción, precio unitario |
| **Historial de Versiones** | Seguimiento de cambios en cotización |
| **Conversión a Orden** | Cotización aceptada → Orden automática |

**Estados Workflow**:
```
QuoteRequest:
  draft → pending → assigned → in_review → info_requested 
  → quoted → accepted/rejected/expired/cancelled
  
Urgency: normal | medium | high
```

**Línea de Cotización**:
- Descripción personalizada
- Cantidad solicitada
- Dimensiones/Especificaciones
- Material
- Instalación incluida (sí/no)
- Precio unitario
- Subtotal por línea

---

### 📋 **3. ORDERS (Gestión de Pedidos)**
**Propósito**: Administración del ciclo completo de pedidos (directos o de cotizaciones)

| Funcionalidad | Descripción |
|---|---|
| **Carrito de Compras** | Compras de catálogo directo, persistente por usuario |
| **Checkout** | Validación de stock, cálculo de impuestos (IVA 16%) |
| **Número de Orden** | Identificador único humanizado |
| **Estados FSM** | `Draft → PendingPayment → Paid → InProduction → Ready → Completed` |
| **Líneas de Orden** | Items con variante, cantidad, precio |
| **Dirección de Envío** | Default o personalizada por orden |
| **Historial de Cambios** | Auditoría de todos los cambios de estado |
| **Reembolsos** | Gestión de devoluciones y reembolsos |
| **Seguimiento** | Cliente ve estado en tiempo real |
| **Balance Debido** | Cálculo automático de saldo pendiente |

**Estados Workflow**:
```
Draft → PendingPayment → Paid/PartiallyPaid 
→ InProduction → Ready → Completed
Cualquier estado pre-producción → Cancelled
Paid/Completed → Refunded
```

---

### 💳 **4. PAYMENTS (Pagos en Línea)**
**Propósito**: Integración con pasarelas de pago internacionales

| Proveedor | Estado | Métodos | Modo |
|---|---|---|---|
| **Mercado Pago** | ✅ Activo | Tarjeta crédito/débito, transferencia, dinero en cuenta | Sandbox + Live |
| **PayPal** | ✅ Activo | Tarjeta, cuenta PayPal, alternativas locales | Sandbox + Live |

| Funcionalidad | Descripción |
|---|---|
| **Iniciación de Pago** | Crear preferencia/orden en gateway |
| **Redirección** | Cliente redirigido al portal seguro del proveedor |
| **Webhooks** | Notificaciones síncronas de cambios de estado |
| **Estados** | `pending → approved/rejected/in_process → [refunded]` |
| **Idempotencia** | Eventos duplicados procesados una sola vez |
| **Depósitos Parciales** | Pagos por monto específico (no automático) |
| **Metadata** | Orden/Cotización ID, usuario ID, rastreable |
| **Logging Completo** | Bitácora de webhook events y procesamiento |

**Estados de Pago**:
```
pending → approved (éxito)
pending → rejected (rechazado)
pending → in_process (en validación)
Any → refunded (reembolso)
```

---

### 📦 **5. INVENTORY (Control de Inventario)**
**Propósito**: Gestión de stock con trazabilidad completa

| Funcionalidad | Descripción |
|---|---|
| **Movimientos de Stock** | IN, OUT, ADJUSTMENT con razones codificadas |
| **Auditoría Completa** | Cada movimiento registra: usuario, razón, antes/después |
| **Motivos Estándar** | Venta, devolución, compra, uso interno, daño, expiración, etc. |
| **Actualizaciones Automáticas** | Stock ajustado automáticamente al confirmar orden/pago |
| **Alertas de Stock Bajo** | Notificaciones cuando llega a umbral mínimo |
| **Reservas** | Stock reservado en carrito antes de confirmar |
| **Referencias** | Vinculación a orden, cotización, compra |
| **Reporte de Stock** | Vista actual y movimientos históricos |

---

### 🔔 **6. NOTIFICATIONS (Sistema de Notificaciones)**
**Propósito**: Comunicacióne in-app en tiempo real para usuarios

| Tipo de Notificación | Destinatario | Trigger |
|---|---|---|
| **Quote Request** | Sales | Nueva solicitud de cotización recibida |
| **Quote Sent** | Customer | Cotización enviada/disponible |
| **Quote Accepted** | Sales + Admin | Cliente acepta cotización |
| **Quote Rejected** | Customer | Vendedor rechaza solicitud |
| **Change Request** | Sales | Cliente solicita cambios en cotización |
| **Order Created** | Customer | Orden confirmada |
| **Order Status Changed** | Customer | Cambio de estado en orden |
| **Order Completed** | Customer | Orden lista/completada |
| **Payment Received** | Admin/Sales | Pago procesado exitosamente |
| **New User** | Admin | Nuevo usuario registrado |
| **Catalog Purchase** | Admin | Nuevos pedidos de catálogo |
| **Quote Expiring** | Customer | Cotización vence en 2 días |
| **Request Unattended** | Admin | Solicitud sin asignar por X tiempo |

**Estado**: con flag `is_read` para tracking de lectura

---

### 🤖 **7. CHATBOT (Captura de Leads)**
**Propósito**: Conversación automatizada para consultas y captura de información

| Funcionalidad | Descripción |
|---|---|
| **Lead Capture** | Recopila nombre, email, teléfono, empresa, mensaje |
| **Fuentes de Lead** | Chatbot, Formulario de Contacto, Solicitud de Cotización, WhatsApp, Teléfono, Referencia |
| **Estados** | `new → contacted → qualified → converted/lost` |
| **Asignación** | Vendedor asignado para seguimiento |
| **Conversión** | Lead → Usuario registrado → Cliente activo |
| **Historial** | Conversación completa guardada |
| **Campos Rastreables** | IP, User Agent, UTM source/medium (para marketing) |
| **Analytics** | Tracking de tasa de conversión |

---

### 📊 **8. ANALYTICS (Tracking y Análisis)**
**Propósito**: Recopilar datos de comportamiento usuario para insights de negocio

| Métrica | Descripción |
|---|---|
| **Page Views** | Cada visita de página registrada con duración, referrer |
| **Track Events** | Eventos personalizados (CTA click, form step, scroll depth) |
| **Session Tracking** | Sesión anónima vía session_id (cookie) |
| **User Tracking** | User ID vinculado si está autenticado |
| **UTM Parameters** | Captura de source, medium, campaign |
| **Device Info** | Desktop/Tablet/Mobile, screen size |
| **Geolocalización** | País/Ciudad (derivada de IP) |
| **Dashboards** | Agregación rápida para reportes |

**Datos Capturados**: URL, path, referrer, UTM, user agent, IP, device type, screen size, país, ciudad, timestamp, duración

---

### 🔍 **9. AUDIT (Auditoría y Compliance)**
**Propósito**: Registro irrevocable de operaciones sensibles para compliance

| Funcionalidad | Descripción |
|---|---|
| **Append-only** | No se pueden modificar o eliminar registros |
| **Entidades Auditadas** | CatalogItem, Order, Quote, Payment, User, Inventory, etc. |
| **Acciones Registradas** | `created, updated, deleted, state_changed, login, logout, payment_processed, email_sent` |
| **Before/After State** | Snapshot JSON de valores antes/después |
| **Diff Calculado** | Qué exactamente cambió (reporteable) |
| **Actor Info** | Usuario, IP, User Agent, email (preservada si user se borra) |
| **Metadata** | Contexto adicional (razón, notas, referencia) |
| **Filtrable** | Por usuario, entidad, acción, fecha, IP |
| **Exportable** | CSV/JSON para auditorías externas |
| **Compliance** | GDPR/LFPDPPP ready |

---

### 💰 **10. CONTENT (CMS - Gestión de Contenido)**
**Propósito**: Administración de contenido dinámico en landing page y sitio público

| Funcionalidad | Descripción |
|---|---|
| **Carrusel héroe** | Slides con título, subtítulo, imagen, CTA, enlace a servicio |
| **Testimonios** | Quotes de clientes con foto, autor, empresa, rating |
| **Logos de Clientes** | Carrusel de clientes destacados |
| **FAQs** | Preguntas frecuentes por categoría |
| **Ubicaciones** | Sucursales/oficinas con datos de contacto |
| **Páginas Legales** | Términos, privacidad, LFPDPPP, etc. |
| **Configuración Global** | Meta tags, favicon, logos, contacto |
| **Multiidioma** | Cada elemento en ES/EN |
| **Ordenamiento** | Posición manual en carrusel, FAQs, etc. |
| **Activación/Desactivación** | Control de visibilidad sin eliminar |

---

### 👥 **11. USERS (Gestión de Usuarios y Autenticación)**
**Propósito**: Administración de cuentas, autenticación y control de acceso

| Funcionalidad | Descripción |
|---|---|
| **Email-based Auth** | Autenticación por email, no username |
| **JWT (SimpleJWT)** | Token-based authentication para API |
| **Google OAuth** | Login social vía Google (django-allauth) |
| **Email Verification** | Confirmación de email en registro |
| **Password Reset** | Recuperación de contraseña vía email |
| **Perfil de Usuario** | Nombre, apellido, teléfono, empresa, fecha nacimiento |
| **Dirección Default** | Dirección de envío guardada para cotizaciones |
| **Rol RBAC** | Foreign key a modelo Role |
| **Consentimientos** | GDPR/LFPDPPP (consentimiento marketing) |
| **Datos Fiscales** | RFC, nombre fiscal para CFDI (facturación) |
| **Avatar** | Foto de perfil |
| **Idioma Preferido** | ES/EN |
| **Soft Delete** | No eliminación física, flag `deleted_at` |
| **Últimas Actividades** | Tracks login IP, timestamp |
| **Desactivación** | Deshabilitar sin eliminar |

---

### 🏛️ **12. CORE (Fundamentos del Sistema)**
**Propósito**: Modelos y utilidades base reutilizables

| Componente | Descripción |
|---|---|
| **TimeStampedModel** | Mixin con `created_at`, `updated_at` automático |
| **SoftDeleteModel** | Mixin con `deleted_at` para borrado lógico |
| **SEOModel** | Meta title, meta description, og:image |
| **OrderedModel** | Campo `position` para ordenamiento manual |
| **ERPIntegrationModel** | Campos para sincronización con ERP externo |
| **Pagination** | StandardPagination configurable |
| **Excepciones Personalizadas** | Manejo uniforme de errores |
| **RecaptchaValidator** | Validación anti-spam en formularios públicos |

---

## Procesos de Negocio Principales

### 🔄 **Proceso 1: Venta Directa (E-commerce)**

```
Cliente
  ↓
[Navega Catálogo] → Ver productos disponibles
  ↓
[Agrega a Carrito] → Stock validado en tiempo real
  ↓
[Checkout] → Ingresa dirección, valida stock final
  ↓
[Selecciona Pago] → Mercado Pago o PayPal
  ↓
[Pagar] → Redirige a portal seguro proveedor
  ↓
[Webhook Notification] ← Proveedor notifica resultado
  ↓
[Orden Confirmada] → Estado: PendingPayment
  ↓
[Pago Aprobado] → Estado: Paid → InProduction
  ↓
[Fabricación] → Inventario ajustado
  ↓
[Listo para Envío] → Estado: Ready
  ↓
[Completado] → Notificación a cliente
```

**Actores**: Cliente, Sistema de Pagos, Admin/Operaciones

---

### 📝 **Proceso 2: Solicitud y Gestión de Cotizaciones (RFQ)**

```
Cliente (Autenticado o Guest)
  ↓
[Solicita Cotización] → Completa QuoteRequest
                        (producto, cantidad, especificaciones)
  ↓
[Email Confirmación] → Brevo API
  ↓
Sistema Asigna
  ↓
[Asignación Automática] → Por especialidad/carga
  ├─ AUTOMATIC_BY_SPECIALTY
  ├─ AUTOMATIC_BY_LOAD
  ├─ FALLBACK
  └─ MANUAL (si debe estar en draft)
  ↓
[Vendedor Revisa] → Estado: assigned/in_review
  ↓
[¿Falta Información?]
  ├─ SÍ → info_requested (email al cliente)
  │        Cliente proporciona datos
  │        Volvemos a in_review
  └─ NO → Crea Quote (cotización)
  ↓
[Cotización Creada] → Genera PDF (ES/EN via ReportLab)
  ↓
[Email + Link Público] → Con token público para ver sin login
  ↓
[Cliente Revisa] → Puede aceptar o solicitar cambios
  ├─ ACEPTA → Estado: accepted
  │            Se crea Order automática
  │            Cliente procede a pagar
  │
  ├─ SOLICITA CAMBIOS → ChangeRequest
  │                     Vendedor revisa y actualiza
  │
  └─ RECHAZA → Estado: rejected
  ↓
[Pago] → Order → Payment workflow
  ↓
[Completado] → Orden en producción
```

**Actores**: Cliente, Vendedor, Sistema, Email Service

**Urgencia**: normal | medium | high (para priorización)

**Validez**: 15 días (configurable) → auto-expira

---

### 📦 **Proceso 3: Gestión de Inventario**

```
Entrada de Stock
  ├─ Compra a Proveedor
  ├─ Devolución de Cliente
  ├─ Producción Interna
  └─ Transferencia entre ubicaciones
       ↓
[InventoryMovement creado] → movement_type: IN
                              reason: purchase/return/production/transfer_in
                              quantity: +100 (ej)
                              stock_before: X
                              stock_after: X+100
       ↓
Salida de Stock
  ├─ Venta → Cuando pago confirmado
  ├─ Devolución → Cuando refund procesado
  ├─ Uso Interno
  ├─ Daño/Expiración
  └─ Pérdida
       ↓
[InventoryMovement creado] → movement_type: OUT
                              reason: sale, damaged, etc.
                              quantity: -50 (ej)
                              stock_before: Y
                              stock_after: Y-50
       ↓
Alertas
  ├─ Stock ≤ Mínimo → Notificación admin
  ├─ Stock = 0 → Ocultar producto catálogo
  └─ Backorder → Cliente espera reabastecimiento
```

**Casos Especiales**:
- Reserva temporal en carrito
- Stock negativo en modo de pedido anticipado
- Reconciliación física vs sistema

---

### 💬 **Proceso 4: Gestión de Leads (Chatbot)**

```
Cliente Anónimo
  ↓
[Completa Chatbot/Contacto] → name, email, phone, company, message
  ↓
[Lead Creado] → estado: new
                 source: chatbot/contact_form/quote_request
                 ip_address, user_agent capturados
                 utm_source, utm_medium capturados
  ↓
[Admin Asignado] → Lead → Vendedor específico
  ├─ assigned_to: user_id
  └─ status: contacted
  ↓
[Vendedor Sigue] → Llama, email, WhatsApp
                   status: qualified/lost
  ↓
[¿Interesado?]
  ├─ SÍ → Invita a registrarse
  │        Cliente se registra → User creado
  │        lead.user = user_id
  │        status: converted
  │        Lead → Cliente activo
  └─ NO → status: lost
```

**Rastreo**: UTM parameters en referrer → Analytics

---

### 💳 **Proceso 5: Procesamiento de Págos**

```
Cliente Inicia Pago
  ↓
[Payment creado] → provider: mercadopago/paypal
                   status: pending
                   amount, currency, metadata
  ↓
[Llamada a Gateway] → Crear preferencia (MP) / Crear orden (PP)
  ↓
[Respuesta Gateway] → provider_order_id, init_point/approval_url
  ↓
[Cliente Redirigido] → Portal seguro MP/PayPal
  ↓
[Cliente Completa Pago] → en portal del proveedor
  ↓
[Proveedor Webhook] → POST a nuestro endpoint
                      Event: payment.completed/payment.failed
  ↓
[Webhook Handler]
  ├─ Log webhook event (WebhookLog)
  ├─ Verificar firma/autenticidad
  ├─ Idempotencia (¿ya procesado?)
  └─ Procesar cambio de estado
       ↓
[Payment Status Updated] → approved/rejected/in_process
       ↓
[Cascade Updates] → Order/Quote estado actualizado
                    Inventario ajust ado
                    Notificaciones enviadas
                    AuditLog registrado
  ↓
[Confirmación Email] → Brevo API
```

**Seguridad**:
- Firma HMAC verificada
- Idempotencia con event_id
- Logging completo
- Retry logic en caso de fallo

---

## Integraciones Externas

### 🌐 **1. Mercado Pago**

| Aspecto | Detalle |
|---|---|
| **Tipos de Pago** | Tarjeta crédito/débito, Mercado Pago wallet, transferencia bancaria |
| **Modo** | Sandbox (testing) + Live (producción) |
| **Integración** | Preferencia API → Redirección al checkout hosted |
| **Webhook** | Notificaciones de cambio de estado |
| **Status Soportados** | pending, approved, in_process, rejected, refunded |
| **Fee** | Configurable por proveedor; capturado en Payment.fee_amount |
| **Currencies** | MXN (mexicanos) |
| **URL Checkout** | `https://www.mercadopago.com.mx/checkout/v1/redirect?preference-id=XXX` |
| **Testing** | Tarjetas de prueba disponibles en sandbox |

**Datos Mapeados**:
```python
{
    "provider": "mercadopago",
    "provider_order_id": preference_id,
    "provider_payment_id": payment_id,
    "payment_method_type": "credit_card",
    "payment_method_id": "visa",
    "metadata": {
        "order_id": "xxx",
        "order_number": "ORD-001",
        "user_id": "xxx"
    }
}
```

---

### 🏦 **2. PayPal**

| Aspecto | Detalle |
|---|---|
| **Tipos de Pago** | Tarjeta crédito/débito, PayPal wallet, mejoras financieras |
| **Modo** | Sandbox + Live |
| **Integración** | Orders API → Redirección a aprobación |
| **Webhook** | Event subscriptions para notificaciones |
| **Status Soportados** | CREATED, APPROVED, COMPLETED, VOIDED, EXPIRED |
| **Fee** | Capturado automáticamente |
| **Currencies** | MXN, USD (multicurrency) |
| **URL Aprobación** | Link en respuesta order creation |

---

### 📧 **3. Brevo (Email API)**

| Aspecto | Detalle |
|---|---|
| **Límite Gratuito** | 300 emails/día |
| **Integración** | HTTP API vía django-anymail |
| **Tipos de Email** | Transaccionales, marketting, confirmación |
| **Plantillas** | EmailTemplates configurables |
| **Destinatarios** | Contactos, clientes, equipo interno |
| **Envío** | Sincrónico o vía Celery (async) |
| **Rastreo** | Opens/clicks registrados |
| **Attachments** | PDF cotizaciones, facturas |

**Emails Principales**:
- Confirmación de registro (Email Verification)
- Restablecimiento de contraseña
- Cotización enviada (con PDF)
- Cambios en cotización
- Confirmación de orden
- Estado de pago
- Notificaciones de cambio de estado orden
- Recordatorios de cotización expirando

---

### 💾 **4. Cloudflare R2 (Object Storage)**

| Aspecto | Detalle |
|---|---|
| **Tipo** | S3-compatible object storage |
| **Uso Principal** | Media files (imágenes productos, avatares, PDFs) |
| **Integración** | django-storages + boto3 |
| **Rutas** | `/catalog/`, `/quotes/`, `/content/`, etc. |
| **URLs Presignadas** | Para descargas privadas de PDFs |
| **CDN** | Cloudflare CDN automático |
| **Rendimiento** | Bajo costo, alto rendimiento |

---

### 🗺️ **5. Google OAuth**

| Aspecto | Detalle |
|---|---|
| **Integración** | django-allauth |
| **Flujo** | Redirect → Google Login → Token → Create/Update User |
| **Datos** | Email, nombre, foto de perfil |
| **Verificación** | Email automáticamente verificado |
| **Uso** | Social login en landing page |

---

### 📊 **6. Analytics (Propia - No Externalizada)**

| Aspecto | Detalle |
|---|---|
| **Modelo** | PageView + TrackEvent |
| **Almacenamiento** | PostgreSQL (tables analytics_pageview, analytics_trackevent) |
| **Privacidad** | Anónimo por defecto (session_id), User ID opcional |
| **Datos** | URLs, referrer, UTM, device, geolocalización |
| **Agregación** | Consultas rápidas para dashboards |

---

## Modelos de Datos Clave

### **User** (Autenticación y Perfil)
```
id: UUID
email: EmailField (PK)
first_name, last_name: CharField
phone: CharField
company: CharField
default_delivery_address: JSONField
date_of_birth: DateField
role: ForeignKey(Role)
is_active: Boolean
is_email_verified: Boolean
preferred_language: es|en
avatar: ImageField
last_login_ip: GenericIPAddressField
```

### **Role** (Control de Acceso)
```
id: UUID
name: admin | sales | customer | (deprecated: superadmin, operations)
display_name: CharField
description: TextField
permissions: JSONField
is_system: Boolean
```

### **CatalogItem** (Producto/Servicio)
```
id: UUID
name, name_en: CharField
slug: SlugField
description, description_en: TextField
category: ForeignKey(Category)
tags: ManyToMany(Tag)
mode: BUY | QUOTE | HYBRID
is_active: Boolean
images: ManyToMany(CatalogImage)
seo_*: SEOModel fields
```

### **ProductVariant** (SKU)
```
id: UUID
catalog_item: ForeignKey
sku: CharField (unique)
name: CharField (variante específica)
attribute_values: ManyToMany(AttributeValue)
price: DecimalField
stock_available: IntegerField (calculado desde InventoryMovement)
```

### **QuoteRequest** (Solicitud)
```
id: UUID
request_number: CharField (unique)
status: draft|pending|assigned|in_review|info_requested|quoted|accepted|rejected|expired|cancelled
customer_name, customer_email, customer_phone, customer_company: CharField/EmailField
catalog_item: ForeignKey (producto/servicio solicitado)
quantity: IntegerField
dimensions, material: CharField
includes_installation: Boolean
description: TextField
assigned_to: ForeignKey(User)
urgency: normal|medium|high
user: ForeignKey(User) (si autenticado)
ip_address: GenericIPAddressField
```

### **Quote** (Cotización)
```
id: UUID
quote_number: CharField (unique)
quote_request: ForeignKey
lines: ManyToOne(QuoteLine)
status: draft|sent|accepted|rejected|expired  
validity_date: DateField
pdf_file: FileField (stored in R2)
public_token: CharField (para link compartible sin login)
subtotal, tax, total: DecimalField
created_by: ForeignKey(User)  # Vendedor
```

### **Order** (Pedido)
```
id: UUID
order_number: CharField (unique)
user: ForeignKey(User)
lines: ManyToOne(OrderLine)
status: draft|pending_payment|paid|partially_paid|in_production|ready|completed|cancelled|refunded
address: ForeignKey(Address)
subtotal, tax, total: DecimalField
balance_due: DecimalField (calculated)
created_from_quote: ForeignKey(Quote) - null si e-commerce directo
```

### **Payment**
```
id: UUID
order: ForeignKey(Order) - nullable
quote: ForeignKey(Quote) - nullable
user: ForeignKey(User)
provider: mercadopago | paypal
status: pending|approved|rejected|cancelled|refunded|in_process
amount: DecimalField
currency: varchar (MXN/USD)
provider_payment_id: CharField
provider_order_id: CharField
metadata: JSONField
approved_at: DateTimeField
```

### **Lead**
```
id: UUID
name, email, phone, company: CharField/EmailField
source: contact_form|chatbot|quote_request|whatsapp|phone|referral
status: new|contacted|qualified|converted|lost
message: TextField
assigned_to: ForeignKey(User)  # Vendedor
user: ForeignKey(User)  # Converted user
utm_source, utm_medium: CharField
ip_address, user_agent: GenericIPAddressField / TextField
```

### **InventoryMovement**
```
id: UUID
variant: ForeignKey(ProductVariant)
movement_type: IN|OUT|ADJUSTMENT
quantity: IntegerField (positive/negative)
reason: CodeField (purchase, sale, return, damaged, etc.)
reference_type: order|quote|manual|system
reference_id: CharField
stock_before, stock_after: IntegerField
created_by: ForeignKey(User)
```

### **AuditLog**
```
id: UUID
timestamp: DateTimeField (auto)
actor: ForeignKey(User)
actor_email: EmailField
actor_ip: GenericIPAddressField
entity_type: CharField (Catalog Item, Order, Payment, etc.)
entity_id: CharField
action: created|updated|deleted|state_changed|login|payment_processed
before_state: JSONField
after_state: JSONField
diff: JSONField
metadata: JSONField
```

---

## Flujos de Trabajo Principales

### 🎯 **Flujo 1: Nuevo Cliente - Registro**
```
1. Visitante completa formulario de contacto
2. Lead creado en sistema
3. Email confirmación enviado vía Brevo
4. Opcionalmente convierte a Usuario registrado
5. Email verificado
6. Usuario obtiene Role=customer
7. Puede solicitar cotizaciones o comprar directamente
```

### 🎯 **Flujo 2: Cliente - Solicita Cotización**
```
1. Cliente autenticado accede función "Solicitar Cotización"
2. Selecciona producto/servicio
3. Ingresa cantidad, especificaciones (dimensiones, material, etc.)
4. Opcionalmente agrega instalación incluida
5. Envía solicitud
6. QuoteRequest se crea con status=draft
7. Sistema asigna a vendedor automáticamente
8. Email notificación enviada al vendedor
9. Vendedor revisa y crea Quote con PDF bilingüe
10. Cliente recibe email con link público + PDF
11. Cliente acepta o pide cambios
12. Si acepta → Order creada automáticamente
13. Cliente procede a pagar
```

### 🎯 **Flujo 3: Cliente - Compra Directa del Catálogo**
```
1. Cliente navega catálogo público
2. Agrega producto a carrito (stock validado)
3. Revisa carrito
4. Procede a checkout
5. Ingresa dirección de envío
6. Selecciona método de pago (MP/PayPal)
7. Paga
8. Webhook confirma pago aprobado
9. Order creada con status=paid
10. Estado cambia a in_production
11. Admin/Operaciones fabrica
12. Stock descontado automáticamente
13. Cuando listo → estado=ready
14. Cuando enviado → estado=completed
15. Cliente notificado en cada cambio
```

### 🎯 **Flujo 4: Admin - Gestión de Inventario**
```
1. Llega nueva compra a proveedor
2. Admin ingresa recepción → InventoryMovement creado (IN)
3. Stock se incrementa automáticamente
4. Si stock cayó debajo del mínimo → alerta desaparece
5. Si algún producto sin stock → falta producción
6. Admin marca como listo → InventoryMovement (OUT)
7. Stock decrementa
```

### 🎯 **Flujo 5: Vendedor - Gestión de Solicitudes**
```
1. Nuevas solicitudes asignadas aparecen en dashboard
2. Vendedor revisa especificaciones
3. Si falta info → Envía mensaje (info_requested)
4. Cliente responde
5. Vendedor crea cotización con detalles
6. Admin revisa y aprueba (si requiere)
7. Se genera PDF ES/EN
8. Se envía email con link público
9. Vendedor puede ver aceptaciones/rechazos en real-time
10. Cuando acepta → Crea orden y notifica al cliente
```

---

## Tabla de Mapeo: Usuarios → Acciones

| Acción | Visitante | Cliente | Vendedor | Admin |
|--------|-----------|---------|----------|-------|
| Ver catálogo público | ✅ | ✅ | ✅ | ✅ |
| Solicitar cotización | ❌ | ✅ | ❌ | ✅ |
| Ver mis cotizaciones | ❌ | ✅ | ❌ | ✅ |
| Crear cotización | ❌ | ❌ | ✅ | ✅ |
| Comprar del catálogo | ❌ | ✅ | ❌ | ✅ |
| Ver mis pedidos | ❌ | ✅ | ❌ | ✅ |
| Ver todas pedidos | ❌ | ❌ | ✅* | ✅ |
| Procesar pago | ❌ | ✅ | ❌ | ✅ |
| Gestionar inventario | ❌ | ❌ | ❌ | ✅ |
| Crear/editar usuarios | ❌ | ❌ | ❌ | ✅ |
| Gestionar catálogo | ❌ | ❌ | ❌ | ✅ |
| Ver auditoría | ❌ | ❌ | ❌ | ✅ |
| Ver analytics | ❌ | ❌ | ✅* | ✅ |

*Limitado a su scope

---

## Conclusión

MCD-Agencia es una plataforma **omnicanal** que integra:
1. **E-commerce directo** para productos estándar
2. **Sistema RFQ** para cotizaciones personalizadas
3. **Control de inventario robusto** con trazabilidad
4. **Pagos seguros** vía MP/PayPal
5. **RBAC completo** con 3 roles activos
6. **Auditoría y compliance** para requerimientos legales
7. **Analytics integrado** para insights de negocio
8. **CMS flexible** para gestión de contenido

Toda la lógica está **documentada en modelos Django** con:
- Permisos granulares vía Role.permissions JSON
- Estados FSM para Order/Quote workflows
- Auditoria append-only para compliance
- Notificaciones in-app reactivas
- Integración con servicios externos (pagos, email, storage)

Este documento proporciona la **base estructurada** para generar historias de usuario profesionales, tickets de desarrollo, y especificaciones funcionales detalladas.
