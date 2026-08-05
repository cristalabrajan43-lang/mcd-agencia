# 🔓 SOLUCIÓN: Cotizaciones No Cargan por Link Público

## 🎯 El Problema Real (Encontrado)

**Síntomas:**
- ✅ Cotizaciones cargan perfectamente desde el panel (cliente autenticado)
- ❌ Cotizaciones NO cargan por link público
- Mensaje: "No se pudo cargar la cotización"

**Causa Raíz:**
Las cotizaciones están en estado **DRAFT** (borrador) en la BD de Render.

**Por qué falla:**
```
Link público: GET /api/v1/quotes/view/{token}/
             ↓
Backend busca: Quote donde status IN ['sent', 'viewed', 'accepted', 'rejected', 'changes_requested']
             ↓
Quote está en 'draft' → NO cumple filtro
             ↓
Retorna: 404 Not Found
             ↓
Frontend muestra: "No se pudo cargar la cotización"
```

---

## ✅ SOLUCIÓN (Paso a Paso)

### Opción 1: Publicar Cotizaciones Locales (Rápido)

Si tienes cotizaciones en BD local (para testing):

```bash
cd backend

# Ver cuántas draft quotes hay
python manage.py publish_draft_quotes --dry-run

# Publicarlas (con confirmación)
python manage.py publish_draft_quotes

# O sin confirmación
python manage.py publish_draft_quotes --confirm
```

**Resultado:**
```
📊 Found 5 draft quote(s):

  • COT-2024-001 | Juan García | Token: abc123...
  • COT-2024-002 | María López | Token: def456...
  ...

❓ Change 5 quote(s) to "sent"? (yes/no): yes

✅ Successfully published 5 quote(s)!

📌 Public links are now active:

  🔗 https://mcd-agencia.vercel.app/es/cotizacion/abc123.../
  🔗 https://mcd-agencia.vercel.app/es/cotizacion/def456.../
```

### Opción 2: Publicar Cotizaciones en Render (Producción)

**Paso 1:** Conectar a BD Render vía SSH/Render Dashboard

En Render Dashboard → mcd-agencia-api → Shell (si disponible):

```bash
python manage.py publish_draft_quotes --confirm
```

**Paso 2:** Si no hay shell, desplegar el comando:

1. Asegurate que `publish_draft_quotes.py` está en el repo
2. Push a GitHub
3. Render auto-deploya
4. Luego conéctate vía CLI y ejecuta el comando

### Opción 3: Crear Endpoint API para Publicar (Más Seguro)

Para poder cambiar estados desde el frontend administrativo, crearé un endpoint:

```python
POST /api/v1/quotes/{id}/publish/
```

¿Quieres que lo implemente?

---

## 🔍 Diagnóstico: Verificar Estados Actuales

```bash
cd backend
python manage.py shell
```

```python
from apps.quotes.models import Quote

# Ver distribución de estados
for status, label in Quote.STATUS_CHOICES:
    count = Quote.objects.filter(status=status).count()
    print(f"{label}: {count}")

# Ver quotes específicas
Quote.objects.values('quote_number', 'status', 'customer_email').order_by('-created_at')[:10]
```

---

## 📋 Estados Válidos para Links Públicos

| Estado | Público | Descripción |
|--------|---------|-------------|
| `draft` | ❌ NO | Borrador interno, solo para admins/vendedores |
| `sent` | ✅ SÍ | Enviada al cliente, puede verla públicamente |
| `viewed` | ✅ SÍ | Cliente abrió el link |
| `accepted` | ✅ SÍ | Cliente aceptó la cotización |
| `rejected` | ✅ SÍ | Cliente rechazó |
| `changes_requested` | ✅ SÍ | Cliente pidió cambios |

---

## 🔧 Opciones del Comando

```bash
# Listar lo que se cambiaría (sin hacer cambios)
python manage.py publish_draft_quotes --dry-run

# Publicar solo para un cliente específico
python manage.py publish_draft_quotes --filter-email=cliente@example.com

# Publicar sin confirmación (para scripts)
python manage.py publish_draft_quotes --confirm

# Combinar opciones
python manage.py publish_draft_quotes --filter-email=cliente@example.com --dry-run
```

---

## 🚀 Flujo Correcto (Después del Fix)

```
Admin/Vendedor crea Quote → Status: DRAFT
         ↓
Admin/Vendedor revisa → OK
         ↓
Admin/Vendedor envía → Status: SENT (o usa publish_draft_quotes)
         ↓
Sistema genera link público
         ↓
Sistema envía email a cliente con link
         ↓
Cliente abre link → GET /api/v1/quotes/view/{token}/
         ↓
Backend filtra: status='sent' ✅ CUMPLE
         ↓
Backend retorna Quote JSON
         ↓
Frontend muestra cotización ✅
```

---

## 📞 Si Aún Falla

Después de ejecutar `publish_draft_quotes`:

1. **Verifica que se cambió:**
   ```bash
   python manage.py shell
   from apps.quotes.models import Quote
   Quote.objects.filter(quote_number="COT-2024-001").values('status', 'sent_at')
   ```

2. **Intenta acceder públicamente:**
   ```
   https://mcd-agencia.vercel.app/es/cotizacion/[TOKEN]
   ```

3. **Revisa la consola del navegador (F12):**
   - Network tab → Ve si API retorna 200 o 404
   - Console → Ve si hay errores JavaScript

---

## 🔐 Seguridad

El comando `publish_draft_quotes`:
- ✅ Solo cambia estado a 'sent' (público permitido)
- ✅ Registra la acción en AuditLog
- ✅ Requiere confirmación (--confirm para forzar)
- ✅ Tiene --dry-run para preview
- ✅ Soporta filtro por email

**No es peligroso usarlo.** Puedes revertir cambiando `status` nuevamente si es necesario.

---

**Última actualización:** 2026-05-14  
**Archivo:** `backend/apps/quotes/management/commands/publish_draft_quotes.py`
