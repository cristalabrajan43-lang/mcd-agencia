# Guía de integración: Pedidos y Producción

Documentación paso a paso de cómo están vinculados los módulos y cómo probar la integración en Docker.

---

## 1. Resumen para el equipo

| Módulo | Pantalla | Qué gestiona |
|--------|----------|--------------|
| **Pedidos** | `/dashboard/pedidos` | Ciclo comercial: pago, en producción, listo, entregado |
| **Producción** | `/dashboard/produccion` | Trabajo de taller: cola, proceso, calidad, liberado |

**Vínculo:** cada `ProductionJob` pertenece a un `Order`. Un pedido puede tener varios trabajos (uno por línea/concepto).

---

## 2. Flujo integrado (paso a paso)

### Paso 1 — Se crea el pedido

- Desde cotización convertida o checkout.
- El backend ejecuta `build_operational_plan(order)`.
- Si el pedido requiere producción, se crean `ProductionJob` en estado **En cola**.

**Excepción:** compras directas del catálogo **no** generan trabajos de producción.

### Paso 2 — Ventas envía a producción

- En detalle del pedido: acción **"Enviar a Producción"**.
- El pedido pasa a estado comercial `in_production`.
- **[Fase 3]** Si no había trabajos, el sistema los crea en este momento.

### Paso 3 — Ventas consulta avance

- En el mismo detalle del pedido aparece la sección **"Trabajos de producción"**.
- Muestra cada trabajo, su estado y fechas.
- Ventas ve información **sin poder mover** el tablero.

### Paso 4 — Producción avanza trabajos

- En `/dashboard/produccion` el supervisor mueve tarjetas: cola → preparando → proceso → calidad → liberado.
- Cada tarjeta enlaza de vuelta al pedido.

### Paso 5 — Pedido pasa a "Listo" automáticamente

- Cuando **todos** los trabajos quedan **liberados** o **cancelados**:
- **[Fase 3]** El pedido pasa automáticamente a estado **Listo** (`ready`).
- Ventas puede continuar con logística/entrega.

### Paso 6 — Acceso rápido desde pedido

- Admin/producción ve botón **"Ver en tablero de producción"**.
- Abre el tablero filtrado solo a ese pedido.

---

## 3. Mapa de pantallas

```
/dashboard/pedidos                    Lista de pedidos (ventas)
    └── /pedidos/[id]                 Detalle del pedido
            ├── Conceptos             Líneas del pedido
            ├── Trabajos de producción  ← NUEVO (Fase 2)
            ├── Flujo operativo       Estados comerciales
            └── [Botón tablero]       ← Fase 1 (solo admin/producción)

/dashboard/produccion                 Tablero kanban (taller)
    └── ?order_id=xxx                 Filtro por pedido ← Fase 1
```

---

## 4. APIs involucradas

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/v1/admin/orders/{id}/` | Detalle del pedido |
| GET | `/api/v1/admin/orders/{id}/operational_tracks/` | Trabajos de producción del pedido |
| POST | `/api/v1/admin/orders/{id}/update_status/` | Cambiar estado comercial |
| GET | `/api/v1/admin/orders/production-jobs/` | Listado global para tablero |
| POST | `/api/v1/admin/orders/{id}/production-jobs/{jobId}/update-status/` | Mover trabajo en taller |

---

## 5. Estados: dos niveles

### Pedido (comercial)

```
pagado → en producción → listo → en camino → completado
```

### Trabajo de producción (taller)

```
en cola → preparando → en proceso → control de calidad → liberado
```

**Regla de sincronización (Fase 3):**  
Todos los trabajos **liberados** + pedido en **en producción** → pedido pasa a **listo**.

---

## 6. Cómo probar en Docker

### 6.1 Levantar el proyecto

```powershell
cd "ruta\MCD-Agencia-main"
docker compose up -d
```

### 6.2 Crear usuario y pedido de prueba

```powershell
docker compose exec backend python manage.py shell -c "
from decimal import Decimal
from django.contrib.auth.models import Group
from apps.users.models import User, Role
from apps.orders.models import Order, OrderLine
from apps.orders.services.operations import build_operational_plan

role, _ = Role.objects.get_or_create(name='admin', defaults={'display_name': 'Administrador'})
user, created = User.objects.get_or_create(email='admin@test.local', defaults={'first_name': 'Admin', 'last_name': 'Prueba', 'is_staff': True, 'is_superuser': True, 'role': role})
user.set_password('Admin1234!')
user.save()
Group.objects.get_or_create(name='production_supervisors')[0].user_set.add(user)

order = Order.objects.create(user=user, status='in_production', origin='quote_conversion', payment_method='transfer', subtotal=Decimal('1000'), tax_amount=Decimal('160'), total=Decimal('1160'), amount_paid=Decimal('1160'), delivery_method='shipping')
OrderLine.objects.create(order=order, sku='DEMO-001', name='Lonas impresas 3x2m', variant_name='Vinil premium', quantity=1, unit_price=Decimal('1000'), line_total=Decimal('1000'), metadata={'requires_production': True, 'delivery_method': 'shipping'})
build_operational_plan(order)
print('LOGIN: admin@test.local / Admin1234!')
print('PEDIDO:', order.order_number)
print('URL:', f'http://localhost:3000/es/dashboard/pedidos/{order.id}')
"
```

### 6.3 Escenario de prueba A — Ver vinculación en pedido

1. Ir a `http://localhost:3000/es/login`
2. Iniciar sesión: `admin@test.local` / `Admin1234!`
3. Abrir el pedido creado
4. Verificar sección **"Trabajos de producción"** con 1 trabajo en cola
5. Clic en **"Ver en tablero de producción"**
6. Confirmar banner: "Mostrando trabajos del pedido #..."

### 6.4 Escenario de prueba B — Sincronización automática

1. En el tablero de producción, mover el trabajo hasta **"Listo para entrega"** (liberado)
2. Volver al detalle del pedido
3. Verificar que el estado comercial cambió a **Listo**

### 6.5 Escenario de prueba C — Pedido sin producción

1. Crear pedido con `origin=direct_purchase`
2. Abrir detalle
3. Verificar mensaje: "Este pedido no requiere producción"

---

## 7. Archivos clave del código

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| UI Pedidos | `frontend/.../pedidos/[id]/page.tsx` | Detalle + botón + fetch tracks |
| UI Sección | `frontend/.../OrderProductionJobsSection.tsx` | Lista de trabajos |
| UI Producción | `frontend/.../produccion/page.tsx` | Tablero + filtro |
| API Frontend | `frontend/src/lib/api/admin.ts` | `getOrderOperationalTracks` |
| Labels | `frontend/src/lib/production-status.ts` | Textos en español |
| Lógica backend | `backend/apps/orders/services/operations.py` | Plan operativo + auto-ready |
| API Backend | `backend/apps/orders/views.py` | Endpoints admin |

---

## 8. Solución de problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| Sección vacía en pedido de cotización | No se ejecutó `build_operational_plan` | Reenviar a producción o ejecutar backfill |
| Botón no visible | Usuario es ventas, no producción | Normal: ventas ve sección, no el botón |
| Tablero vacío con filtro | Pedido sin trabajos | Verificar origen del pedido |
| Pedido no pasa a "Listo" | Falta liberar algún trabajo | Completar todos los jobs en tablero |

```powershell
docker compose exec backend python manage.py backfill_operational_tracks --max-orders 50
```

---

## 9. Referencias

- Plan técnico: [PLAN-VINCULACION-PEDIDOS-PRODUCCION.md](./PLAN-VINCULACION-PEDIDOS-PRODUCCION.md)
- Documento de presentación: `PROPUESTA-VINCULACION.md` (Escritorio)
