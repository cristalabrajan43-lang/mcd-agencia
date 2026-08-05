# 💳 Guía de Testing de Pagos

Esta guía explica cómo probar el sistema de pagos sin necesidad de credenciales reales de Mercado Pago o PayPal.

## 📋 Tabla de Contenidos

1. [Setup Inicial](#setup-inicial)
2. [Modo Mock (Recomendado para Desarrollo)](#modo-mock-recomendado-para-desarrollo)
3. [Endpoints de Admin para Testing](#endpoints-de-admin-para-testing)
4. [Flujos de Testing Completos](#flujos-de-testing-completos)
5. [Validaciones Implementadas](#validaciones-implementadas)
6. [Migración a Producción](#migración-a-producción)

---

## Setup Inicial

### 1. Verificar que NO tienes credenciales configuradas

En tu `.env.local` o archivo de entorno de desarrollo:

```env
# Verifica que estas URLs estén vacías o no configuradas
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=

PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=
```

### 2. Habilitar modo Mock (Opcional)

En `backend/config/settings/local.py`, puedes forzar el modo mock:

```python
# Force mock payment gateway for development
USE_MOCK_PAYMENTS = True
```

Si no lo configuras, el sistema auto-detectará que faltan credenciales y usará mock automáticamente.

### 3. Crear usuario admin para testing

```bash
# En el directorio del backend
python manage.py createsuperuser
# Username: admin
# Email: admin@test.local
# Password: tu_password_segura
```

---

## Modo Mock (Recomendado para Desarrollo)

### ¿Qué es el Mock Gateway?

Es un simulador que emula el comportamiento de Mercado Pago y PayPal **sin hacer llamadas reales a sus APIs**. Perfecto para:

- ✅ Desarrollo local
- ✅ Testing de flujos completos
- ✅ Validaciones de seguridad
- ✅ CI/CD sin credenciales

### Características:

- Genera IDs muy realistas
- Almacena estado en memoria durante sesión
- Proporciona webhooks para simulate
- Registra todos los eventos en auditoría
- Modo de detección automático

---

## Endpoints de Admin para Testing

Todos estos endpoints requieren autenticación con usuario admin y están plenamente auditados.

### 1. Simular Pago Aprobado

```bash
POST /api/v1/payments/{payment_id}/test_simulate_approved/
Authorization: Bearer {admin_token}
```

**Propósito**: Marcar un pago como aprobado y procesar la orden.

**Response**:
```json
{
  "id": "payment-uuid",
  "status": "approved",
  "amount": "1500.00",
  "provider": "mercadopago",
  "approved_at": "2026-03-21T14:30:00Z",
  "metadata": {
    "simulator": true,
    "simulated_at": "2026-03-21T14:30:00Z",
    "order_id": "order-uuid",
    "order_number": "PED-0001"
  }
}
```

### 2. Simular Pago Rechazado

```bash
POST /api/v1/payments/{payment_id}/test_simulate_rejected/
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "reason": "declined"
}
```

**Propósito**: Marcar un pago como rechazado.

**Razones válidas**:
- `declined` - Tarjeta rechazada
- `insufficient_funds` - Fondos insuficientes
- `card_restricted` - Tarjeta restringida
- `bank_error` - Error del banco

### 3. Ver Pagos Mock Actuales

```bash
GET /api/v1/payments/test_mock_payments/
Authorization: Bearer {admin_token}
```

**Propósito**: Ver todos los pagos creados en memoria en sesión actual.

**Response**:
```json
{
  "count": 3,
  "payments": [
    {
      "id": "mock-uuid-1",
      "status": "pending",
      "amount": 1500.00,
      "currency": "MXN",
      "created_at": "2026-03-21T14:20:00Z"
    }
  ]
}
```

---

## Flujos de Testing Completos

### Flujo 1: Testing Mercado Pago Completo

```bash
# 1. Obtener token de admin
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu_password"}'
# Respuesta: {"token":"admin_token_here"}

# Guardar token
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

# 2. Crear un pedido (como usuario normal)
# [Esto se hace desde el frontend]

# 3. Iniciar pago Mercado Pago
curl -X POST http://localhost:8000/api/v1/payments/initiate/ \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER_UUID_HERE",
    "provider": "mercadopago"
  }'

# Respuesta:
# {
#   "payment_id": "payment-uuid-123",
#   "status": "pending",
#   "init_point": "https://mock-checkout.mercadopago.com/?pref_id=mock-...",
#   "is_mock": true
# }

PAYMENT_ID="payment-uuid-123"

# 4. Simular que el usuario pagó en MP (como admin)
curl -X POST http://localhost:8000/api/v1/payments/${PAYMENT_ID}/test_simulate_approved/ \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"

# 5. Verificar que orden cambió de estado
curl -X GET http://localhost:8000/api/v1/orders/ORDER_UUID_HERE/ \
  -H "Authorization: Bearer {user_token}"
# status debería ser "paid"
```

### Flujo 2: Testing PayPal Completo

```bash
# 1-2. [Mismo que Mercado Pago]

# 3. Iniciar pago PayPal
curl -X POST http://localhost:8000/api/v1/payments/initiate/ \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER_UUID",
    "provider": "paypal"
  }'

# Respuesta:
# {
#   "payment_id": "payment-uuid-456",
#   "status": "pending",
#   "approval_url": "https://mock-sandbox.paypal.com/checkoutnow?token=mock-...",
#   "is_mock": true
# }

PAYMENT_ID="payment-uuid-456"

# 4. Simular que usuario aprobó en PayPal
curl -X POST http://localhost:8000/api/v1/payments/${PAYMENT_ID}/test_simulate_approved/ \
  -H "Authorization: Bearer ${TOKEN}"

# 5. Simular rechazo (otra prueba)
curl -X POST http://localhost:8000/api/v1/payments/${PAYMENT_ID}/test_simulate_rejected/ \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "insufficient_funds"}'
```

### Flujo 3: Testing Transferencia Bancaria

```bash
# 1. Crear pago (sin usar provider MP/PayPal)
# Desde el frontend, usuario selecciona "Transferencia"
# Ingresa referencia: "SPEI-58294011"
# Adjunta imagen de recibo

# 2. Marcar como completo (admin verifica transferencia real)
# En admin panel, ir a Payments
# Buscar pago con status "pending"
# Click "Test Approve" para simular verificación

# 3. Backend automáticamente:
# - Marca pago como approved
# - Actualiza orden a "paid"
# - Notifica al cliente
```

### Flujo 4: Testing Efectivo

```bash
# 1. Usuario selecciona efectivo en frontend
# 2. Elige sucursal: "Agencia MCD Costa Azul"
# 3. Se genera comprobante con datos de sucursal
# 4. Admin después va a sucursal y recibe efectivo
# 5. Admin marca pago como recibido (test_simulate_approved)
```

---

## Validaciones Implementadas

### Seguridad de Propiedad

```
❌ Usuario A NO puede pagar orden de Usuario B
❌ Usuario NO puede pagar si no es dueño de la cotización
```

### Validaciones de Estado

```
❌ NO se puede pagar orden ya pagada (is_fully_paid=true)
❌ NO se puede pagar orden cancelada
❌ NO se puede pagar cotización no aceptada
```

### Validaciones de Monto

```
❌ NO se puede pagar menos de $50 (excepto depósitos)
❌ NO se puede pagar más que el balance due
❌ NO se puede pagar monto negativo
```

### Validaciones por Método

```
❌ Transferencia: Requiere referencia O imagen (ambos opcionales pero al menos uno)
❌ Efectivo: Requiere seleccionar sucursal
❌ MP/PayPal: Requiere credenciales (o usa mock automáticamente)
```

---

## Migración a Producción

### Paso 1: Obtener Credenciales de Mercado Pago

1. Ir a https://www.mercadopago.com.mx/
2. Crear cuenta si no tienes
3. Dashboard → Configuración → Credenciales
4. Copiar:
   - Access Token (sandbox)
   - Public Key (sandbox)
   - Webhook Secret

```env
# .env.prod
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1234565-abcdef...
MERCADOPAGO_PUBLIC_KEY=APP_USR_PUBLIC_KEY...
MERCADOPAGO_WEBHOOK_SECRET=tu_secret_aqui
```

### Paso 2: Obtener Credenciales de PayPal

1. Ir a https://developer.paypal.com/
2. Crear cuenta + sandbox
3. Ir a Apps & Credentials
4. Copiar:
   - Client ID (sandbox)
   - Client Secret (sandbox)

```env
PAYPAL_CLIENT_ID=AbCdEfGhIjKlMnOpQrStUv...
PAYPAL_CLIENT_SECRET=EBgJ...
PAYPAL_MODE=sandbox  # cambiar a "live" cuando liste
```

### Paso 3: Configurar Webhooks

#### Mercado Pago Webhook

```bash
# Dashboard → Configuración → Webhooks
# URL: https://tuapp.com/api/v1/payments/webhooks/mercadopago/
# Eventos: payment
```

#### PayPal Webhook

```bash
# Dashboard → Webhooks → Create Webhook
# URL: https://tuapp.com/api/v1/payments/webhooks/paypal/
# Eventos: PAYMENT.CAPTURE.COMPLETED
```

### Paso 4: Cambiar a Modo Live

```env
# En producción
DEBUG=False
PAYPAL_MODE=live
# Sistema automáticamente usa credenciales "live" en lugar de mock
```

### Paso 5: Tests en Producción (IMPORTANTE)

```bash
# 1. Nunca probar con dinero real primero
# 2. Usar dinero de prueba:

# Mercado Pago prueba:
# Tarjeta: 4111111111111111
# CVV: cualquiera
# Fecha: cualquiera futura

# PayPal prueba:
# Usa cuenta sandbox de testing
# NO es dinero real

# 3. Después de verificar todo, ir a live
```

---

## Preguntas Frecuentes

### P: ¿Se puede saber si un pago fue simulado?

R: Sí. En `payment.metadata` hay un campo `'simulator': true` que lo indica. Solo admins pueden crear estos.

### P: ¿Qué pasa si se caen mis credenciales?

R: El sistema auto-detecta que faltan y automáticamente usa MockPaymentGateway. Los usuarios verán URLs mock pero todo funciona para testing.

### P: ¿Puedo ver logs de todos los pagos?

R: Sí. Cada pago se registra en `AuditLog`. En admin panel:
```
Django Admin → Audit Logs → Filtrar por entity_type="Payment"
```

### P: ¿Cómo reseteo todos los mock pagos?

R: En shell de Django:
```python
from apps.payments.services import MockPaymentGateway
MockPaymentGateway.clear_mock_payments()
```

### P: ¿Los usuarios ven que es simulado?

R: NO. Desde su perspectiva es un pago real. Solo el admin ve que es simulado en el dashboard.

---

## Próximos Pasos

1. ✅ Testing básico con endpoints
2. ✅ Testing de seguridad (intentar pagar orden de otro)
3. ✅ Testing de validaciones (monto bajo, estado inválido)
4. 🔄 Testing de webhooks (cuando obtengas credenciales)
5. 🔄 Testing E2E con Cypress/Playwright

¡Happy testing! 🚀
