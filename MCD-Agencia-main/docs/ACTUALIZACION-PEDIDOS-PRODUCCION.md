# ¿Qué se actualizó? — Pedidos y Producción
## Guía visual y práctica (sin tecnicismos)

**Agencia MCD · Junio 2026**

---

## En una frase

Ahora **ventas y producción ven el mismo pedido** desde sus pantallas, con enlaces directos y menos trabajo manual.

---

## Antes vs Ahora

```
ANTES
─────
  VENTAS                         PRODUCCIÓN
  Pedido "En prod."    ──?──►    Tablero (buscar a mano)
  ❌ No se veía el avance del taller
  ❌ Había que preguntar "¿cómo va?"
  ❌ Marcar "Listo" a mano

AHORA
─────
  VENTAS                         PRODUCCIÓN
  Pedido + Trabajos    ──1 clic──► Tablero filtrado
  ✅ Sección "Trabajos de producción" en el pedido
  ✅ Botón directo al tablero
  ✅ Pedido pasa a "Listo" solo al terminar en taller
```

---

## Las 3 mejoras

### 1. Botón "Ver en tablero de producción"
- **Dónde:** detalle del pedido (arriba a la derecha)
- **Quién:** admin y producción
- **Qué hace:** abre el tablero ya filtrado a ese pedido

### 2. Sección "Trabajos de producción"
- **Dónde:** dentro del pedido, entre Conceptos y Flujo operativo
- **Quién:** ventas (consulta) y admin
- **Qué muestra:** producto, estado en taller, fechas

### 3. Sincronización automática
- Al enviar a producción → se crean trabajos si faltaban
- Al liberar todos los trabajos → pedido pasa a "Listo" solo

---

## Cómo probar (Docker)

| Paso | Acción |
|------|--------|
| 1 | Abrir http://localhost:3000/es/login |
| 2 | Entrar con `admin@test.local` / `Admin1234!` |
| 3 | Ir a Dashboard → Pedidos → abrir pedido `MCD-20260603-2560` |
| 4 | Ver sección "Trabajos de producción" |
| 5 | Clic en "Ver en tablero de producción" |
| 6 | Mover trabajo a "Listo para entrega" y verificar que el pedido queda "Listo" |

**URL directa del pedido demo:**
```
http://localhost:3000/es/dashboard/pedidos/239e042c-66b6-4ff6-a8b0-2c6fe13641f9
```

---

## Quién puede hacer qué

| Acción | Ventas | Producción | Admin |
|--------|--------|------------|-------|
| Ver trabajos en pedido | ✅ | ✅ | ✅ |
| Botón al tablero | ❌ | ✅ | ✅ |
| Mover tablero | ❌ | ✅ | ✅ |
| Cambiar estado pedido | ✅ | ❌ | ✅ |

---

## Si algo falla

| Problema | Solución |
|----------|----------|
| Docker no responde | Ejecutar `iniciar_proyecto.bat` |
| Sin trabajos | Reenviar pedido a "En producción" |
| Sin pedidos demo | Pedir a TI ejecutar seed en backend |

---

*Copia en escritorio: `ACTUALIZACION-PEDIDOS-PRODUCCION.md`*
