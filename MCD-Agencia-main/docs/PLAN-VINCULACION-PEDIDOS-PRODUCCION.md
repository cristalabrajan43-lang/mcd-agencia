# Plan de vinculación: Pedidos ↔ Producción

**Proyecto:** MCD-Agencia  
**Estado:** Implementado (Fases 1, 2 y 3)  
**Última actualización:** Junio 2026

---

## Objetivo

Conectar el módulo comercial de **Pedidos** con el módulo operativo de **Producción** para que ventas vea el avance del taller, producción acceda al expediente del cliente, y los estados se mantengan alineados.

---

## Arquitectura

```
Pedido (Order)                    Trabajo de taller (ProductionJob)
     │                                      │
     │  status: in_production               │  status: queued → released
     │                                      │
     └──────── build_operational_plan ──────┘
                    │
                    ▼
         operational_tracks API
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  pedidos/[id]            produccion (tablero)
```

---

## Fases del plan

### Fase 1 — Enlace visual (UI)

| Ítem | Archivo | Descripción |
|------|---------|-------------|
| Botón en pedido | `frontend/src/app/[locale]/dashboard/pedidos/[id]/page.tsx` | Link a producción con `order_id` y `order_number` |
| Filtro en tablero | `frontend/src/app/[locale]/dashboard/produccion/page.tsx` | Lee `?order_id=` y filtra trabajos en cliente |
| Banner de filtro | `produccion/page.tsx` | Muestra pedido activo + botón "Ver todos" |

**URL de enlace:**
```
/es/dashboard/produccion?order_id={uuid}&order_number={numero}
```

---

### Fase 2 — Visibilidad en detalle de pedido

| Ítem | Archivo | Descripción |
|------|---------|-------------|
| API client | `frontend/src/lib/api/admin.ts` | `getOrderOperationalTracks()` + tipo `OrderOperationalTracks` |
| Constantes | `frontend/src/lib/production-status.ts` | Labels de estados y rollup |
| Componente | `frontend/src/components/orders/OrderProductionJobsSection.tsx` | Sección read-only de trabajos |
| Integración | `pedidos/[id]/page.tsx` | Fetch paralelo + sección entre conceptos y flujo |

**Endpoint:**
```
GET /api/v1/admin/orders/{id}/operational_tracks/
```

---

### Fase 3 — Sincronización automática (backend)

| Ítem | Archivo | Descripción |
|------|---------|-------------|
| Crear trabajos al enviar a producción | `backend/apps/orders/views.py` → `update_status` | Llama `build_operational_plan()` si status = `in_production` |
| Auto "Listo" al liberar trabajos | `backend/apps/orders/services/operations.py` | `maybe_auto_ready_order_from_production()` |
| Hook en actualización de job | `views.py` → `update_production_job_status` | Tras liberar todos los jobs → pedido pasa a `ready` |

---

## Permisos

| Rol | Ver sección en pedido | Botón al tablero | Mover trabajos |
|-----|----------------------|------------------|----------------|
| Admin | Sí | Sí | Sí |
| Ventas | Sí (solo lectura) | No | No |
| production_supervisors | Sí | Sí | Sí |

---

## Criterios de aceptación

- [x] Pedido con trabajos muestra lista en detalle
- [x] Compra directa muestra mensaje "no requiere producción"
- [x] Botón abre tablero filtrado (admin/producción)
- [x] Enviar a producción crea trabajos si no existen
- [x] Liberar todos los jobs mueve pedido a "Listo"

---

## Pruebas manuales

```powershell
# Datos demo (si no hay pedidos)
docker compose exec backend python manage.py shell -c "
from decimal import Decimal
from apps.users.models import User, Role
from apps.orders.models import Order, OrderLine
from apps.orders.services.operations import build_operational_plan

user = User.objects.filter(email='admin@test.local').first()
if not user:
    role = Role.objects.get(name='admin')
    user = User.objects.create_user(email='admin@test.local', password='Admin1234!', role=role, is_staff=True, is_superuser=True)

order = Order.objects.create(user=user, status='in_production', origin='quote_conversion', payment_method='transfer', subtotal=Decimal('1000'), tax_amount=Decimal('160'), total=Decimal('1160'), amount_paid=Decimal('1160'), delivery_method='shipping')
OrderLine.objects.create(order=order, sku='DEMO', name='Lonas 3x2m', quantity=1, unit_price=Decimal('1000'), line_total=Decimal('1000'), metadata={'requires_production': True})
build_operational_plan(order)
print(order.id, order.order_number)
"
```

**Rutas:**
- Pedido: `http://localhost:3000/es/dashboard/pedidos/{id}`
- Producción: `http://localhost:3000/es/dashboard/produccion`

---

## Archivos modificados

```
frontend/src/lib/api/admin.ts
frontend/src/lib/production-status.ts
frontend/src/components/orders/OrderProductionJobsSection.tsx
frontend/src/app/[locale]/dashboard/pedidos/[id]/page.tsx
frontend/src/app/[locale]/dashboard/produccion/page.tsx
backend/apps/orders/views.py
backend/apps/orders/services/operations.py
docs/PLAN-VINCULACION-PEDIDOS-PRODUCCION.md
docs/VINCULACION-PEDIDOS-PRODUCCION.md
```
