# Referencia Rápida - MCD-Agencia (Cheat Sheet para User Stories)

## 1. ROLES USUARIOS

| Rol | BD Name | Permisos Clave |
|-----|---------|---|
| **Visitante** | - | Ver catálogo, llenar contacto |
| **Customer** | `customer` | Solicitar cotizaciones, comprar, pagar, ver pedidos |
| **Sales** | `sales` | Gestionar cotizaciones, asignar, crear órdenes |
| **Admin** | `admin` | Todo + gestión de usuarios, inventario, reportes |

---

## 2. PROCESOS PRINCIPALES

### 📝 Cotizaciones (RFQ)
```
QuoteRequest → [assign] → Quote → [PDF] → [email] → Cliente [acepta/rechaza]
└─ puede pedir cambios (ChangeRequest) antes de aceptar
└─ si acepta → Order automática
```

### 🛒 E-commerce
```
Catálogo → Carrito → Checkout → Pago (MP/PayPal) → Orden → Producción → Completado
```

### 📦 Inventario
```
Stock IN (compra/devolución) → Movimiento → Stock aumenta
Stock OUT (venta) → Movimiento → Stock disminuye
Alerta si stock < mínimo
```

### 💳 Pagos
```
Payment.create() → send to gateway → [webhook] → Payment.approved/rejected → Update Order
```

### 👥 Leads
```
Formulario/Chatbot → Lead [new] → [assigned] → Vendedor [contacted/qualified] → [converted/lost]
```

---

## 3. ENTIDADES PRINCIPALES

### CatalogItem (Producto/Servicio)
- **Atributos**: name, description, category, tag, mode (BUY/QUOTE/HYBRID)
- **Relación**: → ProductVariant (SKU)
- **Estado**: is_active

### ProductVariant (SKU)
- **Atributos**: sku, price, stock_available
- **Relación**: → CatalogItem, AttributeValue(s)
- **Calculo**: stock = InventoryMovement.aggregate(sum) para variant

### QuoteRequest
- **Estados**: draft → pending → assigned → in_review → info_requested → quoted → accepted/rejected/expired
- **Asignación**: auto_specialty | auto_load | manual
- **Urgency**: normal | medium | high

### Quote
- **Atributos**: quote_number, status, validity_date (def: 15 días), pdf_file, public_token
- **Relación**: → QuoteRequest, QuoteLine(s)
- **PDF**: bilingüe (ES/EN) generado con ReportLab

### Order
- **Estados**: draft → pending_payment → paid → in_production → ready → completed
- **Relación**: → User, OrderLine(s), Address, Payment(s)
- **Origen**: Directo (cart) o Quote

### Payment
- **Proveedores**: mercadopago | paypal
- **Estados**: pending → approved/rejected/in_process → [refunded]
- **Webhook**: Recibe notificaciones de gateway

### Lead
- **Estados**: new → contacted → qualified → [converted|lost]
- **Campos**: name, email, phone, company, source, utm_source, utm_medium

### Notification
- **Tipos**: quote_request, quote_sent, quote_accepted, order_created, payment_received, etc.
- **Destinatarios**: User específico o staff (admin/sales)
- **Flag**: is_read

### AuditLog
- **Append-only**: No se puede modificar o eliminar
- **Entidades auditadas**: CatalogItem, Order, Quote, Payment, User, Inventory, etc.
- **Acciones**: created, updated, deleted, state_changed, login, payment_processed

---

## 4. INTEGRACIONES

| Servicio | Uso | Status |
|----------|-----|--------|
| **Mercado Pago** | Pagos tarjeta/cuenta MXN | ✅ Activo |
| **PayPal** | Pagos tarjeta/PayPal Multi-currency | ✅ Activo |
| **Brevo** | Email (300/día gratis) | ✅ Activo |
| **Cloudflare R2** | Object storage (imágenes, PDFs) | ✅ Activo |
| **Google OAuth** | Social login | ✅ Activo |

---

## 5. PERMISOS ROLE (JSON Structure)

Ejemplo de `Role.permissions` JSON (almacenado en DB):
```json
{
  "catalog": {
    "view": true,
    "create": true,
    "edit": true,
    "delete": true
  },
  "orders": {
    "view": true,
    "create": true,
    "edit": false
  },
  "payments": {
    "view": true,
    "refund": false
  }
}
```

Verificación en código:
```python
if role.has_permission('catalog.edit'):
    # permitir editar catálogo
```

---

## 6. CAMPOS CLAVE POR ENTIDAD

### User
```
id (UUID)
email (PK)
first_name, last_name
phone
company
role (FK)
is_active, is_email_verified
date_of_birth
preferred_language (es|en)
default_delivery_address (JSON)
```

### QuoteRequest
```
request_number (humanizado)
status
customer_name, email, phone, company
catalog_item (FK)
quantity, dimensions, material
includes_installation
description
assigned_to (FK User)
urgency
user (FK, si autenticado)
created_at, updated_at (timestamps)
```

### Quote
```
quote_number (humanizado)
quote_request (FK)
status
validity_date
pdf_file (en R2)
public_token (para link sin login)
subtotal, tax, total
created_by (FK User)
QuoteLines (items)
```

### Order
```
order_number (humanizado)
user (FK)
status
address (FK)
subtotal, tax, total
balance_due (calculated)
created_from_quote (FK, nullable)
OrderLines (items)
Payments (rel)
```

### Payment
```
id (UUID)
order (FK, nullable)
quote (FK, nullable)
user (FK)
provider (enum)
status
amount
currency
provider_payment_id
provider_order_id
metadata (JSON)
approved_at
```

---

## 7. ESTADOS FSM

### QuoteRequest
```
draft ──┬─→ pending ──→ assigned ──→ in_review ──┐
        │                                         ├─→ info_requested ──→ in_review
        │                                         │
        └─────────────────────────────────────────┴─→ quoted ──┬─→ accepted ──→ Orden
                                                                ├─→ rejected
                                                                └─→ expired
                                                                └─→ cancelled
```

### Order
```
draft ──→ pending_payment ──→ paid ──→ in_production ──→ ready ──→ completed
 ↑                            ↑
 └─ cancelled ◄───────────────┴─ puede cancelarse antes de producción
                               └─ refunded (si hubo pago)
```

### Payment
```
pending ──┬─→ approved ───────────┐
          ├─→ rejected            ├─→ [refunded]
          ├─→ in_process          │
          └─→ cancelled ──────────┘
```

---

## 8. PLANTILLA: HISTORIA DE USUARIO

```markdown
### US-XXX: [Título descriptivo]

| Campo | Valor |
|-------|-------|
| **ID** | US-XXX |
| **Épica** | EP-XX |
| **Prioridad** | Must/Should/Could |
| **Story Points** | 1/2/3/5/8/13 |
| **Rol** | Admin/Sales/Customer |

**Historia:**
> Como **[rol]**, quiero **[funcionalidad]** 
> para que **[beneficio/valor]**.

**Descripción:**
[Contexto detallado del requisito]

**Criterios de Aceptación:**
- AC-1: [Descripción]
- AC-2: [Descripción]
- AC-N: [Descripción]

**Notas Técnicas:**
- Entidades: CatalogItem, Quote, Payment
- Webhooks: payment.approved
- APIs: GET /api/v1/quotes/, POST /api/v1/payments/refund/

**Dependencias:**
- US-XXX (antes de esto)
- Feature: Mercado Pago integration
```

---

## 9. EJEMPLOS DE HISTORIAS PARA USAR COMO PLANTILLA

### Ejemplo 1: Cotización Simple
```markdown
### US-001: Cliente solicita cotización personalizada

**Historia:**
> Como **cliente**, quiero solicitar una cotización
> para conocer el precio de un producto/servicio personalizado.

**Criterios de Aceptación:**
- El cliente autenticado accede a "Solicitar Cotización"
- Selecciona producto y cantidad
- Ingresa especificaciones (dimensiones, material, etc.)
- Marca "incluir instalación" si aplica
- Al enviar, se crea QuoteRequest con status=draft
- Vendedor recibe notificación
- Sistema envía email de confirmación al cliente

**Entidades**: QuoteRequest, Notification
**Estados**: draft → pending → assigned
```

### Ejemplo 2: Pagos
```markdown
### US-XXX: Procesar pago de orden con Mercado Pago

**Historia:**
> Como **cliente**, quiero pagar mi pedido
> para completar mi compra de forma segura.

**Criterios de Aceptación:**
- Cliente en checkout revisa monto final
- Selecciona "Pagar con Mercado Pago"
- Se crea Payment con status=pending
- Cliente redirigido a portal MP
- Completa pago en MP
- MP envía webhook de aprobación
- Order status cambia a paid
- Cliente recibe email de confirmación

**Entidades**: Payment, Order
**Proveedores**: Mercado Pago
**Webhooks**: payment.approved
```

### Ejemplo 3: Inventario
```markdown
### US-XXX: Admin recibe alerta de stock bajo

**Historia:**
> Como **administrador**, quiero ser notificado
> cuando el stock de un producto cae por debajo del mínimo.

**Criterios de Aceptación:**
- Se configura stock_minimum en ProductVariant
- Cuando sale stock: InventoryMovement creado (OUT)
- Si nuevo stock ≤ stock_minimum → Notificación creada
- Admin recibe alerta in-app
- Admin puede ver el producto desde la notificación
- Admin puede ordenar reabastecimiento

**Entidades**: ProductVariant, InventoryMovement, Notification
```

---

## 10. CHECKLISTS PARA DESARROLLADORES

### ✅ Checklist: Nueva Función de Usuario
- [ ] ¿Qué rol(es) la pueden usar?
- [ ] ¿Qué entidades se ven afectadas?
- [ ] ¿Se crea AuditLog?
- [ ] ¿Se envía Notification?
- [ ] ¿Se actualiza algún stock/balance?
- [ ] ¿Qué estados FSM se aplican?
- [ ] ¿Hay integración con proveedor externo?
- [ ] ¿Se necesita webhook?
- [ ] ¿Se rastrean cambios en Analytics?
- [ ] ¿Email a enviar?

### ✅ Checklist: Integración con Proveedor
- [ ] Mock/Sandbox testing completado
- [ ] Webhook signature validation implementada
- [ ] Idempotencia garantizada (event_id deduplication)
- [ ] Logging completo de requests/responses
- [ ] Manejo de errores y reintentos
- [ ] Datos sensibles no loguean (PAN, CVV, etc.)
- [ ] Documentación de mapeo de states
- [ ] Pruebas en staging antes de prod

### ✅ Checklist: Nuevo Estado/Transición
- [ ] ¿Qué transiciones previas son válidas? (FSM valida)
- [ ] ¿Qué cambios en cascada ocurren? (Stock, Notifications, etc.)
- [ ] ¿Customer lo ve en UI?
- [ ] ¿Se envía email?
- [ ] ¿Qué rol(es) pueden causarlo?
- [ ] ¿Se registra en AuditLog?
- [ ] ¿Se permite reversión?

---

## 11. PREGUNTAS A HACER AL ESCRIBIR HISTORIAS

1. **¿Quién?** → ¿Qué rol(es)?
2. **¿Qué?** → ¿Qué entidades se tocan?
3. **¿Por qué?** → ¿Cuál es el valor de negocio?
4. **¿Cómo?** → ¿Qué es el flujo paso a paso?
5. **¿Cuándo?** → ¿Qué condiciones/estados previos?
6. **¿Constraints?** → ¿Validaciones, límites, reglas?
7. **¿Integraciones?** → ¿Servicios externos involucrados?
8. **¿Errores?** → ¿Qué pasa si falla?
9. **¿Notificaciones?** → ¿A quién notificar?
10. **¿Auditoría?** → ¿Se debe registrar?

---

## 12. MAPEO RÁPIDO: FUNCIONALIDAD → ENTIDAD → ESTADO

| Funcionalidad | Entidad | Campo Clave | Estados Relevantes |
|---|---|---|---|
| Solicitar cotización | QuoteRequest | status | pending → assigned → quoted |
| Crear cotización | Quote | status | draft → sent → accepted |
| Pagar orden | Payment | status | pending → approved |
| Cambiar estado orden | Order | status | draft → in_production → completed |
| Bajo stock | InventoryMovement | quantity | alert si ≤ minimum |
| Convertir lead | Lead | status | new → converted |
| Notificar cambio | Notification | is_read | new → read |
| Auditar acción | AuditLog | action | created, updated, deleted, etc. |

---

**Última actualización**: Marzo 22, 2026  
**Archivo base**: ANALISIS_PROYECTO_MCD_AGENCIA.md
