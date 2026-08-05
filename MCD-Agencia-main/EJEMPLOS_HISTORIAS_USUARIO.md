# Ejemplos de Historias de Usuario - MCD-Agencia

**Objetivo**: Proporcionar templates listos para usar y ejemplos completamente desarrollados de historias de usuario profesionales para cada módulo del proyecto.

---

## Tabla de Contenidos

1. [Historias de Autenticación](#1-historias-de-autenticación)
2. [Historias de Catálogo](#2-historias-de-catálogo)
3. [Historias de Cotizaciones](#3-historias-de-cotizaciones)
4. [Historias de Órdenes y E-commerce](#4-historias-de-órdenes-y-e-commerce)
5. [Historias de Pagos](#5-historias-de-pagos)
6. [Historias de Inventario](#6-historias-de-inventario)
7. [Historias de Leads y Chatbot](#7-historias-de-leads-y-chatbot)
8. [Historias de Admin](#8-historias-de-admin)

---

## 1. Historias de Autenticación

### US-AUTH-001: Cliente se registra con email y contraseña

| Campo | Valor |
|-------|-------|
| **ID** | US-AUTH-001 |
| **Épica** | EP-05: Autenticación y Gestión de Usuarios |
| **Prioridad** | Must Have |
| **Story Points** | 3 |
| **Rol Primario** | Visitante |
| **Dependencias** | Ninguna |

**Historia de Usuario:**
> Como **visitante**, quiero crear una cuenta usando mi email y contraseña  
> para acceder a funcionalidades exclusivas como solicitar cotizaciones y comprar productos.

**Descripción Detallada:**

El visitante accede a la página de registro. Completa un formulario con:
- Email (único en sistema)
- Nombre
- Apellido  
- Teléfono (opcional para registro, requerido después)
- Contraseña (con validación de fortaleza)
- Aceptación de términos y privacidad

Tras enviar, recibe email de confirmación. Al confirmar, su cuenta está lista para usar y obtiene rol `customer`.

**Criterios de Aceptación:**

| # | Criterio | Verificación |
|:-:|----------|:----------:|
| AC-1 | Email no puede estar registrado ya. Sistema muestra error si existe | ✅ |
| AC-2 | Contraseña debe cumplir requisitos mínimos (8 caracteres, mayúscula, número) | ✅ |
| AC-3 | Se envía email de confirmación vía Brevo con link válido 24 horas | ✅ |
| AC-4 | Usuario debe confirmar email antes de acceder a funciones | ✅ |
| AC-5 | Al confirmar, user.role = customer y is_email_verified = true | ✅ |
| AC-6 | Sistema crea entrada en AuditLog con action=created | ✅ |
| AC-7 | Si no confirma en 24 horas, email puede solicitarse de nuevo | ✅ |

**Notas Técnicas:**

- **Entidades**: User, Role, AuditLog
- **Endpoints**: 
  - `POST /api/v1/auth/register/`
  - `POST /api/v1/auth/confirm-email/{token}/`
  - `POST /api/v1/auth/resend-verification-email/`
- **Email Template**: `templates/emails/email_verification.html`
- **Validaciones**: 
  - Email unique en User.email
  - Password strength validator (django-password-validators)
  - RecaptchaValidator en form público
- **Seguridad**: Token firmado con Django signing framework, TTL 24h

**Tareas Técnicas:**

| ID | Tarea | SP |
|----|-------|----|
| TASK-1 | Crear serializer RegisterSerializer con validaciones | 2 |
| TASK-2 | Implementar endpoint POST /auth/register/ | 2 |
| TASK-3 | Crear email template y envío vía Brevo | 2 |
| TASK-4 | Implementar endpoint confirmación email con token | 2 |
| TASK-5 | Agregar RecaptchaValidator a formulario público | 1 |
| TASK-6 | Escribir testes automatizados (80%+ coverage) | 3 |

**Aceptable Cuando:**

- ✅ Registros funcionan end-to-end sin errores
- ✅ Emails se envían y reciben correctamente  
- ✅ Token expira correctamente
- ✅ Intentos de acceso sin confirmar son bloqueados
- ✅ AuditLog registra el evento

---

### US-AUTH-002: Cliente inicia sesión con Google OAuth

| Campo | Valor |
|-------|-------|
| **ID** | US-AUTH-002 |
| **Épica** | EP-05: Autenticación |
| **Prioridad** | Should Have |
| **Story Points** | 5 |
| **Rol Primario** | Visitante |
| **Dependencias** | US-AUTH-001 (opcional, puede ser primer login) |

**Historia de Usuario:**
> Como **visitante**, quiero iniciar sesión usando mi cuenta de Google  
> para acceder rápidamente sin recordar contraseña.

**Descripción:**

En landing page, botón "Continuar con Google" redirige a Google OAuth. Usuario aprueba acceso. Si email no existe, se crea User automáticamente con:
- Email de Google
- Nombre/apellido de Google
- Email auto-verificado (no necesita confirmar)
- Role: customer

Si email ya existe, se linkea con Google account.

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Button "Sign in with Google" visible en login page |
| AC-2 | Redirect a Google OAuth flow correcto |
| AC-3 | Si usuario nuevo: auto-crea User con email verificado |
| AC-4 | Si usuario existe: linkea Google account |
| AC-5 | Login exitoso genera JWT token válido |
| AC-6 | AuditLog registra login con action=login |
| AC-7 | Datos sensibles no se logguean (solo email, id) |

**Notas Técnicas:**

- **Librerías**: django-allauth, SimpleJWT
- **Flow**: Authorization Code con PKCE
- **Datos**: Sincroniza email, first_name, last_name, picture (avatar)
- **Error Handling**: Si usuario rechaza permiso, redirige a login con mensaje

---

### US-AUTH-003: Cliente recupera contraseña olvidada

| Campo | Valor |
|-------|-------|
| **ID** | US-AUTH-003 |
| **Épica** | EP-05 |
| **Prioridad** | Must Have |
| **Story Points** | 2 |
| **Rol Primario** | Visitante |
| **Dependencias** | Ninguna |

**Historia de Usuario:**
> Como **cliente olvidadizo**, quiero resetear mi contraseña  
> para recuperar acceso a mi cuenta.

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Link "¿Olvidaste tu contraseña?" en login page |
| AC-2 | Usuario ingresa email, recibe email de reset |
| AC-3 | Link en email válido solo 30 minutos |
| AC-4 | Click en link abre página de nueva contraseña |
| AC-5 | Nueva contraseña válida → clave actualizada |
| AC-6 | AuditLog registra action=password_changed |
| AC-7 | Email anterior se invalida (solo último link funciona) |

---

## 2. Historias de Catálogo

### US-CAT-001: Admin crea nueva categoría de producto

| Campo | Valor |
|-------|-------|
| **ID** | US-CAT-001 |
| **Épica** | EP-07: Catálogo de Productos |
| **Prioridad** | Must Have |
| **Story Points** | 2 |
| **Rol Primario** | Admin |
| **Dependencias** | Ninguna |

**Historia de Usuario:**
> Como **administrador**, quiero crear categorías de productos con estructura jerárquica  
> para organizar el catálogo de forma intuitiva.

**Descripción:**

Admin accede a panel "Gestión de Catálogo" → "Categorías". Crea nueva categoría con:
- Nombre (ES/EN)
- Slug único (auto-generado)
- Descripción (ES/EN)
- Categoría padre (opcional, para subcategorías)
- Imagen destacada
- Posición en menú

Ejemplo: 
```
Publicidad Exterior (root)
  ├─ Espectaculares (parent: Publicidad Exterior)
  │  ├─ Iluminados
  │  └─ No iluminados
  └─ Vallas (parent: Publicidad Exterior)
```

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Slug debe ser único y se genera automáticamente de nombre |
| AC-2 | Soporta estructura MPPT (parent = otra categoría) |
| AC-3 | Imagen se guarda en Cloudflare R2 /catalog/categories/ |
| AC-4 | Categoría se puede establecer como activa/inactiva |
| AC-5 | Cambios se registran en AuditLog |
| AC-6 | Al crear con parent, posición se actualiza automáticamente |
| AC-7 | Titles/descriptions en ES e EN opcional |

---

### US-CAT-002: Admin agrega producto al catálogo

| Campo | Valor |
|-------|-------|
| **ID** | US-CAT-002 |
| **Épica** | EP-07 |
| **Prioridad** | Must Have |
| **Story Points** | 3 |
| **Rol Primario** | Admin |
| **Dependencias** | US-CAT-001 |

**Historia de Usuario:**
> Como **administrador**, quiero agregar productos/servicios al catálogo  
> para que clientes puedan verlos y solicitar cotizaciones o comprar.

**Descripción:**

Admin crea producto con:
- Nombre (ES/EN), slug
- Descripción completa (ES/EN)
- Categoría (FK)
- Tags (múltiples)
- Modo de venta: BUY | QUOTE | HYBRID
- Imágenes (múltiples, orden configurable)
- SEO: meta title, meta description, og:image

Luego crea **variantes (SKU)** del producto:
- SKU: "ESPE-2024-IL-5M" (humanizado)
- Nombre variante: "Espectacular 5m Iluminado"
- Atributos: Alto=5m, Ancho=10m, Iluminación=LED
- Precio
- Stock inicial (vía InventoryMovement IN)

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | CatalogItem con ES/EN obligatorio |
| AC-2 | Producto debe estar en una categoría |
| AC-3 | Modo venta HYBRID permite compra directa Y cotización |
| AC-4 | Mínimo 1 variante (SKU) por producto |
| AC-5 | Stock inicial crea InventoryMovement(IN, initial_stock) |
| AC-6 | Imágenes se guardan en R2 /catalog/products/{product_id}/ |
| AC-7 | Cambios en AuditLog con before/after state |

---

### US-CAT-003: Cliente navega catálogo y filtra productos

| Campo | Valor |
|-------|-------|
| **ID** | US-CAT-003 |
| **Épica** | EP-07 |
| **Prioridad** | Must Have |
| **Story Points** | 5 |
| **Rol Primario** | Customer/Visitante |
| **Dependencias** | US-CAT-002 |

**Historia de Usuario:**
> Como **cliente**, quiero navegar el catálogo y filtrar por categoría, precio y atributos  
> para encontrar rápidamente lo que busco.

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Categorías se muestran en menú jerárquico (MPPT) |
| AC-2 | Click en categoría filtra productos de esa rama |
| AC-3 | Filtro por rango de precio (min-max slider) |
| AC-4 | Filtro por atributos (tamaño, material, color) |
| AC-5 | Búsqueda por texto en nombre/descripción |
| AC-6 | Resultados paginados (10/25/50 items) |
| AC-7 | Stock = 0 muestra "Agotado" pero no oculta producto |
| AC-8 | Modo QUOTE muestra botón "Solicitar Cotización" |
| AC-9 | Modo BUY muestra botón "Agregar al Carrito" |

---

## 3. Historias de Cotizaciones

### US-QUOTE-001: Cliente solicita cotización personalizada

| Campo | Valor |
|-------|-------|
| **ID** | US-QUOTE-001 |
| **Épica** | EP-06: Sistema de Cotizaciones |
| **Prioridad** | Must Have |
| **Story Points** | 3 |
| **Rol Primario** | Customer |
| **Dependencias** | US-CAT-003 |

**Historia de Usuario:**
> Como **cliente**, quiero solicitar una cotización personalizada  
> para obtener precio de un producto/servicio con mis especificaciones.

**Descripción:**

Cliente ve producto en catálogo con modo QUOTE. Click en "Solicitar Cotización" abre modal con:
- Producto seleccionado (prefilled)
- Cantidad deseada
- Especificaciones: Dimensiones, Material, Acabado
- ¿Incluye instalación?
- Descripción adicional
- Datos de contacto (prefilled si autenticado)

Al enviar:
1. Crea QuoteRequest con status=draft
2. Sistema asigna automáticamente a vendedor (specialty/load balancing)
3. Email a vendedor
4. Email de confirmación a cliente

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Formulario contiene todos los campos especificados |
| AC-2 | Si cliente autenticado: email/nombre prefilled |
| AC-3 | Si guest: captcha requerido para anti-spam |
| AC-4 | QuoteRequest creado con status=draft |
| AC-5 | Asignación automática según especialidad/carga |
| AC-6 | Vendedor recibe Notification tipo quote_request |
| AC-7 | Cliente recibe email con número de solicitud |
| AC-8 | AuditLog registra action=created |

**Notas Técnicas:**

- **Entidades**: QuoteRequest, Notification, AuditLog
- **Endpoints**: `POST /api/v1/quote-requests/`
- **Asignación Logic**: 
  ```python
  # Por especialidad del vendedor
  if assignment_method == 'auto_specialty':
      sellers = User.objects.filter(
          role='sales',
          specialties__contains='espectaculares'
      ).order_by('assigned_quotes_count')
  ```
- **Validaciones**: Cantidad > 0, especificaciones mínimas

---

### US-QUOTE-002: Vendedor crea y envía cotización

| Campo | Valor |
|-------|-------|
| **ID** | US-QUOTE-002 |
| **Épica** | EP-06 |
| **Prioridad** | Must Have |
| **Story Points** | 5 |
| **Rol Primario** | Sales |
| **Dependencias** | US-QUOTE-001 |

**Historia de Usuario:**
> Como **vendedor**, quiero crear una cotización profesional con detalles y precio  
> para enviarla al cliente y cerrar la venta.

**Descripción:**

Vendedor accede a solicitud asignada. Revisa especificaciones. Crea Quote con:
- Líneas: descripción, cantidad, precio unitario, subtotal por línea
- Sustotal (sum de líneas)
- Impuestos (IVA 16%)
- Total
- Términos y condiciones (configurable)
- Validez: 5-30 días (default 15)

Sistema genera:
- PDF bilingüe (ES/EN) con logo empresa, datos fiscales
- Token público único para compartir sin login
- Email a cliente con link "Ver Cotización"

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Quote contiene al menos 1 línea con precio > 0 |
| AC-2 | PDF se genera con ReportLab (ES/EN) |
| AC-3 | PDF incluye: empresa, cliente, líneas, total, T&C |
| AC-4 | Token público único (UUID) para link sin auth |
| AC-5 | Cliente recibe email con link y PDF |
| AC-6 | Validez configurable en rango autorizado |
| AC-7 | Status: draft → sent al enviar email |
| AC-8 | AuditLog registra cambio de estado |
| AC-9 | PDF se almacena en R2 /quotes/ |

**Notas Técnicas:**

- **PDF Generation**: ReportLab, templates en `/templates/pdf/quote_*.html`
- **Endpoints**: `POST /api/v1/quotes/`, `POST /api/v1/quotes/{id}/send/`
- **Email**: Vía Brevo con PDF adjunto
- **Storage**: Cloudflare R2 presigned URLs

---

### US-QUOTE-003: Cliente acepta cotización y se crea orden

| Campo | Valor |
|-------|-------|
| **ID** | US-QUOTE-003 |
| **Épica** | EP-06 |
| **Prioridad** | Must Have |
| **Story Points** | 3 |
| **Rol Primario** | Customer |
| **Dependencias** | US-QUOTE-002 |

**Historia de Usuario:**
> Como **cliente**, quiero aceptar una cotización  
> para convertirla en orden y proceder al pago.

**Descripción:**

Cliente recibe email con cotización. Clic en link (con public token) abre página con PDF.

Opciones:
1. **Aceptar** → Order creada automáticamente, cliente redirigido a pago
2. **Solicitar Cambios** → Crea ChangeRequest, vendedor notificado
3. **Rechazar** → Quote status = rejected

Si acepta:
- Quote.status = accepted
- Se crea Order (status=pending_payment, total=quote.total)
- Ordenes líneas = Quote líneas
- Cliente redirigido a checkout de pago
- Ambos (cliente, vendedor) reciben Notifications

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Link público accesible sin login |
| AC-2 | Botones: Aceptar, Solicitar Cambios, Rechazar |
| AC-3 | Aceptar: Order creada con status=pending_payment |
| AC-4 | Order.created_from_quote = quote_id |
| AC-5 | Cliente redirigido a /checkout?order_id=XXX |
| AC-6 | Notifications enviadas a vendedor + admin |
| AC-7 | AuditLog: Quote status=accepted, Order action=created |

---

## 4. Historias de Órdenes y E-commerce

### US-ORDER-001: Cliente agrega producto a carrito

| Campo | Valor |
|-------|-------|
| **ID** | US-ORDER-001 |
| **Épica** | EP-08: Carrito, Pedidos y Pagos |
| **Prioridad** | Must Have |
| **Story Points** | 2 |
| **Rol Primario** | Customer |
| **Dependencias** | US-CAT-003 |

**Historia de Usuario:**
> Como **cliente**, quiero agregar productos al carrito  
> para comprar múltiples items juntos.

**Descripción:**

Cliente ve producto modo BUY. Selecciona:
- Variante (si hay múltiples)
- Cantidad

Click "Agregar al Carrito":
- Valida stock (>= cantidad solicitada)
- Crea CartItem si no existe
- Incrementa cantidad si ya existe
- Carrito persiste en BD (no sesión)
- Notificación visual: "Agregado: 2x Producto"
- Contador de carrito actualizado

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Stock validado en tiempo real |
| AC-2 | Si stock = 0: botón deshabilitado, tooltip "Agotado" |
| AC-3 | CartItem aggregado si ya existe (qty++) |
| AC-4 | Carrito persiste entre sesiones (BD) |
| AC-5 | Total carrito se recalcula automáticamente |
| AC-6 | Cliente puede ver resumen en navbar |

---

### US-ORDER-002: Cliente completa checkout y crea orden

| Campo | Valor |
|-------|-------|
| **ID** | US-ORDER-002 |
| **Épica** | EP-08 |
| **Prioridad** | Must Have |
| **Story Points** | 3 |
| **Rol Primario** | Customer |
| **Dependencias** | US-ORDER-001 |

**Historia de Usuario:**
> Como **cliente**, quiero completar el checkout  
> para confirmar mi compra.

**Descripción:**

Cliente accede a /checkout con carrito. Pasos:
1. **Resumen** (items, precios, stock final)
2. **Dirección** (default o agregar nueva)
3. **Confirmación** (total con impuestos)

Al confirmar:
- Valida stock final (puede cambiar)
- Crea Order (status=pending_payment, order_number=humanizado)
- Crea OrderLines de CartItems
- AuditLog: Order action=created
- Carrito se vacía
- Redirige a selección de pago

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Stock revalidado antes de crear orden |
| AC-2 | Si stock cambió: mostrar alert, permitir revisar |
| AC-3 | Impuesto IVA 16% calculado correctamente |
| AC-4 | Order.status = pending_payment |
| AC-5 | order_number único y humanizado (ORD-20260322-001) |
| AC-6 | Cliente recibe email de confirmación |
| AC-7 | Carrito vaciado (logicamente) |

---

## 5. Historias de Pagos

### US-PAY-001: Cliente paga con Mercado Pago

| Campo | Valor |
|-------|-------|
| **ID** | US-PAY-001 |
| **Épica** | EP-08 |
| **Prioridad** | Must Have |
| **Story Points** | 5 |
| **Rol Primario** | Customer |
| **Dependencias** | US-ORDER-002 |

**Historia de Usuario:**
> Como **cliente**, quiero pagar mi orden con Mercado Pago  
> para completar la compra de forma segura.

**Descripción:**

Cliente en checkout final. Elige "Pagar con Mercado Pago". Sistema:
1. Crea Payment(status=pending, provider=mercadopago)
2. Llama MP API para crear preference
3. Recibe preference_id e init_point
4. Redirige a init_point en MP checkout
5. Cliente completa pago en MP (tarjeta, cuenta, etc.)
6. MP redirige a success URL con payment_id
7. Sistema valida y procesa webhook
8. Payment.status = approved
9. Order.status = paid
10. Notificaciones a cliente + admin

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Payment.provider = mercadopago en BD |
| AC-2 | Redirect a initpoint URL correcto |
| AC-3 | Cliente redirigido a success_url con payment_id |
| AC-4 | Webhook recibido y procesado correctamente |
| AC-5 | Payment.provider_payment_id = payment_id MP |
| AC-6 | Order.status cambia a paid automáticamente |
| AC-7 | Cliente notificado por email |
| AC-8 | En caso de fallo: Payment.status = rejected |
| AC-9 | AuditLog: action=payment_processed |

**Notas Técnicas:**

- **MP SDK**: Usar SDK oficial Python de Mercado Pago
- **Webhook**: POST /webhooks/mercadopago/ valida firma HMAC
- **Idempotencia**: event_id único por MP event
- **Error Handling**: Reintentos con backoff exponencial

---

### US-PAY-002: Admin procesa reembolso manual

| Campo | Valor |
|-------|-------|
| **ID** | US-PAY-002 |
| **Épica** | EP-08 |
| **Prioridad** | Should Have |
| **Story Points** | 3 |
| **Rol Primario** | Admin |
| **Dependencias** | US-PAY-001 |

**Historia de Usuario:**
> Como **administrador**, quiero procesar reembolso de pago  
> para resolver devoluciones o problemas de clientes.

**Descripción:**

Admin ve Order pagada. Decide reembolsar (cliente solicita devolución). Admin:
1. Revisa Payment vinculado
2. Click "Procesar Reembolso"
3. Valida que Payment.status = approved
4. Ingresa razón de reembolso
5. Click "Confirmar"

Sistema:
- Crea Refund record
- Llamadas a MP/PayPal API para refund
- Payment.status = refunded
- Order.status = refunded (si aplica)
- Stock reintroducido (InventoryMovement IN)
- Cliente notificado por email
- AuditLog completo

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Solo Admin puede procesar reembolsos |
| AC-2 | Solo Orders pagadas pueden reembolsarse |
| AC-3 | Razón de reembolso registrada |
| AC-4 | MP/PayPal API reembolso llamada exitosa |
| AC-5 | Stock reinserido: InventoryMovement(IN, refund) |
| AC-6 | Cliente recibe email de reembolso |
| AC-7 | AuditLog registra acción con detalles |

---

## 6. Historias de Inventario

### US-INV-001: Admin registra entrada de stock

| Campo | Valor |
|-------|-------|
| **ID** | US-INV-001 |
| **Épica** | EP-07: Inventario |
| **Prioridad** | Must Have |
| **Story Points** | 2 |
| **Rol Primario** | Admin |
| **Dependencias** | US-CAT-002 |

**Historia de Usuario:**
> Como **administrador**, quiero registrar entrada de stock  
> para actualizar disponibilidad cuando llegan compras a proveedor.

**Descripción:**

Admin accede a "Gestión de Inventario" → "Entrada de Stock". Selecciona:
- Variante (SKU)
- Cantidad entrada
- Razón: compra_proveedor | devolución_cliente | producción_interna
- Referencia (PO número, ticket devolución, etc.)
- Notas

Al confirmar:
- InventoryMovement creado(type=IN, quantity=+100)
- stock_after calculado: stock_before + quantity
- Stock en ProductVariant.stock_available actualizado
- Alert (si existía) desaparece

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Variante debe existir en sistema |
| AC-2 | Cantidad > 0 obligatorio |
| AC-3 | Razón seleccionada de lista estándar |
| AC-4 | Movement creado con stock_before y stock_after |
| AC-5 | ProductVariant.stock_available actualizado |
| AC-6 | Si stock ahora > mínimo: alerta removida |
| AC-7 | AuditLog registra cambio |

---

### US-INV-002: Admin recibe alerta de stock bajo

| Campo | Valor |
|-------|-------|
| **ID** | US-INV-002 |
| **Épica** | EP-07 |
| **Prioridad** | Should Have |
| **Story Points** | 3 |
| **Rol Primario** | Admin |
| **Dependencias** | US-INV-001 |

**Historia de Usuario:**
> Como **administrador**, quiero recibir alertas cuando stock es bajo  
> para procurar reabastecimiento a tiempo.

**Descripción:**

En ProductVariant se configura:
- stock_minimum: 10 (ej)

Cuando sale stock y stock_available ≤ stock_minimum:
1. StockAlert creada (if not already exists)
2. Notification creada para ALL Admin users
3. Email enviado con detalles del producto alertado

Notificación: "Stock bajo: Espectacular 5m (5 unidades) - Stock mínimo: 10"

Click en notificación abre detalle del producto. Admin puede:
- Ver historial de movimientos
- Crear entrada de stock
- Cambiar stock mínimo

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | StockAlert creada cuando stock ≤ minimum |
| AC-2 | Notification sent a ALL admin users (bulk) |
| AC-3 | Email enviado vía Brevo |
| AC-4 | Alert solo se crea UNA VEZ (no duplicatas) |
| AC-5 | Click notificación abre detalles producto |
| AC-6 | Admin puede marcar alerta resuelta |

---

## 7. Historias de Leads y Chatbot

### US-LEAD-001: Visitante completa formulario de contacto

| Campo | Valor |
|-------|-------|
| **ID** | US-LEAD-001 |
| **Épica** | EP-10: Chatbot e Inteligencia Artificial |
| **Prioridad** | Must Have |
| **Story Points** | 2 |
| **Rol Primario** | Visitante |
| **Dependencias** | Ninguna |

**Historia de Usuario:**
> Como **visitante**, quiero enviar un mensaje de contacto  
> para consultar sobre productos/servicios sin registrarme.

**Descripción:**

En landing page, formulario "Contacto" con:
- Nombre
- Email
- Teléfono
- Mensaje
- reCAPTCHA

Al enviar:
- Lead creado(status=new, source=contact_form)
- Email confirmación al visitante
- Email a sales+admin con detalles
- Lead asignado MANUALMENTE a vendedor (pool)

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | reCAPTCHA validado |
| AC-2 | Email y nombre requeridos |
| AC-3 | Lead creado en BD |
| AC-4 | IP y User Agent capturados |
| AC-5 | Confirmación email a lead |
| AC-6 | Notificación a Sales users (bulk) |
| AC-7 | AuditLog registra Lead.created |

---

### US-LEAD-002: Vendedor califica y convierte lead

| Campo | Valor |
|-------|-------|
| **ID** | US-LEAD-002 |
| **Épica** | EP-10 |
| **Prioridad** | Should Have |
| **Story Points** | 3 |
| **Rol Primario** | Sales |
| **Dependencias** | US-LEAD-001 |

**Historia de Usuario:**
> Como **vendedor**, quiero gestionar leads asignados  
> para calificarlos y convertirlos en clientes.

**Descripción:**

Vendedor ve lead asignado. Llama/emilia al cliente. Registra seguimiento (notas en Lead.notes):
- Contactó: sí/no
- Interés: alto/medio/bajo
- Siguiente paso: cotización, demo, etc.

Estados:
1. new → contacted (cuando vendedor acusa recibo)
2. contacted → qualified (si cliente tiene interés real)
3. qualified → converted (si cliente se registra y compra)
4. any → lost (si no hay interés)

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Solo Sales/Admin pueden editar lead |
| AC-2 | Status solo puede viajar forward (no retroceso) |
| AC-3 | Notas pueden editarse sin cambiar status |
| AC-4 | Si converted: Lead.user = nuevo User |
| AC-5 | AuditLog registra cambios de status |
| AC-6 | Email notificación a admin si converted |

---

## 8. Historias de Admin

### US-ADMIN-001: Admin gestiona usuarios y roles

| Campo | Valor |
|-------|-------|
| **ID** | US-ADMIN-001 |
| **Épica** | EP-05: Autenticación |
| **Prioridad** | Must Have |
| **Story Points** | 5 |
| **Rol Primario** | Admin |
| **Dependencias** | US-AUTH-001 |

**Historia de Usuario:**
> Como **administrador**, quiero gestionar usuarios y asignar roles  
> para controlar quién tiene acceso a cada funcionalidad.

**Descripción:**

Admin panel Gestión de Usuarios. Puede:
- Listar todos los usuarios (paginado)
- Crear nuevo usuario (email, nombre, rol)
- Editar usuario (cambiar nombre, teléfono, rol)
- Desactivar usuario (is_active=false)
- Resetear contraseña (envía link reset por email)

Roles disponibles:
- admin (full access)
- sales (ventas)
- customer (cliente)
- operations (deprecated, migrar a admin)

Cambiar usuario.role:
- Auto-sync con Role.permissions JSON
- AuditLog: action=permission_changed
- Email notificación a usuario

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Solo Admin puede ver/editar usuarios |
| AC-2 | Filtros: por rol, por estado (active/inactive) |
| AC-3 | Cambio de rol registrado en AuditLog |
| AC-4 | Desactivar no elimina físicamente (soft delete) |
| AC-5 | Usuario desactivado no puede loguearse |
| AC-6 | Reset contraseña envía email |
| AC-7 | Cambios de permisos se aplican inmediatamente (JWT refresh needed) |

---

### US-ADMIN-002: Admin ve dashboard de analytics

| Campo | Valor |
|-------|-------|
| **ID** | US-ADMIN-002 |
| **Épica** | EP-11: Notificaciones y Analytics |
| **Prioridad** | Should Have |
| **Story Points** | 8 |
| **Rol Primario** | Admin |
| **Dependencias** | Múltiples (todos los módulos) |

**Historia de Usuario:**
> Como **administrador**, quiero ver dashboard con métricas del negocio  
> para tomar decisiones informadas.

**Descripción:**

Dashboard principal con widgets:
1. **Ventas** (últimos 7/30 días)
   - Total vendido
   - Número de órdenes
   - Ticket promedio

2. **Cotizaciones** (estado)
   - Pendientes de atención
   - En revisión
   - Aceptadas últimas 7 días

3. **Usuarios Nuevos** (últimas 7/30 días)
   - Registros por día
   - Leads convertidos

4. **Inventario** (alertas)
   - Items stock bajo
   - Items sin stock

5. **Gráficos** (charts con Chart.js o similar)
   - Ventas trend (últimos 7 días)
   - Top 5 productos
   - Fuentes de traffic (UTM origin)

6. **Rendimiento**
   - Tasa de conversión: Leads→Customers
   - Valor promedio por orden
   - Tiempo promedio para cotizar

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Dashboard carga en < 3 segundos |
| AC-2 | Datos actualizados en real-time (WebSocket/polling) |
| AC-3 | Filtros: por fecha, por rol (sales), por categoría |
| AC-4 | Gráficos interactivos (zoom, tooltip) |
| AC-5 | Datos agregados desde PageView, Order, Payment, Lead |
| AC-6 | Exportar datos a CSV |
| AC-7 | Mobile-responsive |

---

### US-ADMIN-003: Admin accede a bitácora de auditoría

| Campo | Valor |
|-------|-------|
| **ID** | US-ADMIN-003 |
| **Épica** | EP-12: Documentación Técnica (compliance) |
| **Prioridad** | Must Have |
| **Story Points** | 3 |
| **Rol Primario** | Admin |
| **Dependencias** | Múltiples |

**Historia de Usuario:**
> Como **administrador**, quiero consultar la bitácora de auditoría  
> para verificar quién hizo qué y cuándo (compliance).

**Descripción:**

Panel Auditoría con tabla de AuditLogs. Columnas:
- Timestamp (cuándo)
- Actor (quién - email)
- Entidad (qué - Order, Quote, User, etc.)
- Acción (created, updated, deleted, etc.)
- IP Address
- Before/After state (expandible)

Filtros:
- Por fecha (rango)
- Por actor (usuario)
- Por entidad (tipo)
- Por acción
- Por IP

Click en fila → Detalle con JSON before/after diff

Exportar → CSV con todos los registros (filtrados)

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | Tabla muestra AuditLog append-only (no deleteable) |
| AC-2 | Filtros funcionan en combinación |
| AC-3 | Pasos 10/25/50 customizable |
| AC-4 | Click expande before/after JSON |
| AC-5 | Diff highlight (verde=added, rojo=removed) |
| AC-6 | Exportar CSV con all filtros aplicados |
| AC-7 | Timestamps en timezone local admin |

---

## Template Genérico para Nuevas Historias

```markdown
### US-XXX: [Título breve y descriptivo]

| Campo | Valor |
|-------|-------|
| **ID** | US-XXX |
| **Épica** | EP-XX: [Nombre] |
| **Prioridad** | Must/Should/Could |
| **Story Points** | 1/2/3/5/8/13 |
| **Rol Primario** | [Rol] |
| **Interdependencias** | [Otras US] |

**Historia de Usuario:**
> Como **[rol]**, quiero **[funcionalidad]**  
> para que **[beneficio/valor]**.

**Descripción:**

[Contexto detallado de lo que hace el usuario, paso a paso]

**Criterios de Aceptación:**

| # | Criterio |
|:-:|----------|
| AC-1 | [Descripción concreta verificable] |
| AC-2 | [...] |
| AC-N | [...] |

**Notas Técnicas:**

- **Entidades**: [Modelos Django involucrados]
- **Endpoints**: [URLs API]
- **Integraciones**: [Servicios externos]
- **Validaciones**: [Reglas de negocio]
- **Seguridad**: [Consideraciones de seguridad]

**Tareas Técnicas:**

| ID | Tarea | SP |
|----|-------|----|
| TASK-1 | [Descripción] | SP |
| TASK-2 | [...] | SP |

**Aceptable Cuando:**

- ✅ [Cumple AC-1]
- ✅ [Cumple AC-2]
- ✅ [Testeado]
```

---

## Convenciones Aplicadas

✅ **Prioridad MoSCoW**: Must (crítico) | Should (importante) | Could (nice-to-have) | Won't (excluído)

✅ **Story Points Fibonacci**: 1, 2, 3, 5, 8, 13

✅ **Criterios SMART**: Específicos, Medibles, Alcanzables, Relevantes, con Tiempo

✅ **Trazabilidad**: Cada US linkea a Épica, Entidades, y AuditLog

✅ **Compliance**: Mención de auditoría, seguridad, validaciones

✅ **Multicanal**: Consideraciones para API, Web, Email, Webhooks

---

**Documento de Referencia para Desarrollo**  
**Versión**: 1.0  
**Último updated**: Marzo 22, 2026
