# 🔍 Guía de Debugging - Cotizaciones Públicas No Cargan

## Problema

Usuario/Cliente intenta abrir una cotización pública pero la página no carga:
```
https://mcd-agencia.vercel.app/es/cotizacion/f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1
```

Mensajes posibles de error:
- "No se pudo cargar la cotización. El enlace puede ser inválido o haber expirado."
- Página en blanco
- Loading infinito

---

## ✅ Verificación Rápida

### 1️⃣ Verificar que la cotización existe

```bash
python manage.py shell

from apps.quotes.models import Quote

# Buscar por token
quote = Quote.objects.get(token="f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1")
print(f"Encontrado: #{quote.quote_number}")
print(f"Estado: {quote.status}")
print(f"Eliminada: {quote.is_deleted}")
```

### 2️⃣ Verificar estado público

El estado DEBE ser uno de:
- `sent` ✅
- `viewed` ✅
- `accepted` ✅
- `rejected` ✅
- `changes_requested` ✅

Si está en `draft` o `cancelled` → ❌ No es visible públicamente

### 3️⃣ Verificar que no está eliminada

```bash
python manage.py shell

from apps.quotes.models import Quote

quote = Quote.objects.get(token="f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1")
print(f"Is deleted: {quote.is_deleted}")  # Debe ser False
```

---

## 🧪 Debugging Automático

Usamos el script de debugging automático:

```bash
# Opción 1: Interactivo
python manage.py shell
>>> exec(open('docs/debug_quote_token.py').read())

# Opción 2: Modificar el script
# Edita el TOKEN_TO_DEBUG en docs/debug_quote_token.py con tu token
# Luego ejecuta:
python manage.py shell < docs/debug_quote_token.py
```

Output esperado:
```
======================================================================
🔍 QUOTE TOKEN DEBUGGING TOOL
======================================================================

1️⃣  Token Format Validation
   Token: f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1
   ✅ Valid UUID format

2️⃣  Token Existence Check
   ✅ Quote found!
      ID: ...
      Number: COT-2024-001
      Status: sent

3️⃣  Public View Status Check
   ✅ Status 'sent' is public-viewable

4️⃣  Soft Delete Check
   ✅ Quote is not deleted

5️⃣  Data Completeness Check
   ✅ All required data present

6️⃣  API Response Test
   ✅ API returns 200 OK

7️⃣  Frontend Compatibility Check
   ...

✅ Quote should be publicly accessible!
```

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "No quote found with this token"

**Causa:** El token no existe o es incorrecto

**Soluciones:**
```bash
# Opción A: Listar cotizaciones recientes
python manage.py shell
>>> from apps.quotes.models import Quote
>>> recent = Quote.objects.order_by('-created_at')[:10]
>>> for q in recent:
...     print(f"#{q.quote_number} - {q.token} - {q.status}")

# Opción B: Buscar por quote_number
>>> q = Quote.objects.get(quote_number="COT-2024-001")
>>> print(f"Token: {q.token}")

# Opción C: Verificar que el cliente tenga acceso
>>> from apps.quotes.models import Quote
>>> Quote.objects.filter(customer_email="cliente@email.com").values_list('token', 'quote_number')
```

### Problema 2: "Status 'draft' is NOT public-viewable"

**Causa:** La cotización aún está en borrador

**Solución:**
```bash
python manage.py shell

from apps.quotes.models import Quote

quote = Quote.objects.get(token="...")
quote.status = 'sent'
quote.save(update_fields=['status', 'updated_at'])
print(f"✅ Updated to: {quote.status}")
```

### Problema 3: "Quote is soft-deleted"

**Causa:** La cotización fue eliminada

**Soluciones:**

a) **Recuperarla:**
```bash
python manage.py shell

from apps.quotes.models import Quote

quote = Quote.objects.get(token="...")
quote.is_deleted = False
quote.deleted_at = None
quote.save(update_fields=['is_deleted', 'deleted_at'])
print(f"✅ Quote recovered!")
```

b) **Ver qué la eliminó (auditoría):**
```bash
python manage.py shell

from apps.audit.models import AuditLog

logs = AuditLog.objects.filter(
    entity_id="<quote-uuid>",
    action='deleted'
)
for log in logs:
    print(f"Deleted by: {log.actor}")
    print(f"When: {log.created_at}")
    print(f"Metadata: {log.metadata}")
```

### Problema 4: "No quote lines"

**Causa:** Cotización creada pero sin líneas/items

**Solución:**
```bash
python manage.py shell

from apps.quotes.models import Quote

quote = Quote.objects.get(token="...")
if not quote.lines or quote.lines.count() == 0:
    print("❌ No hay líneas en la cotización")
    # Revisa cómo se creó la cotización en el backend
    # Las líneas se deben agregar al crear la cotización
```

### Problema 5: "API error 404"

**Causa:** El token en la URL es incorrecto o hay un problema con las rutas

**Soluciones:**
```bash
# Verificar que la ruta está registrada
grep -r "view/<uuid:token>" backend/

# Reiniciar backend
python manage.py runserver

# Limpiar caché de Vercel (si está en producción)
# Redeploy manualmente
```

---

## 🚀 Solución Rápida

Si el usuario reporta que no puede ver una cotización:

```bash
python manage.py shell
```

```python
from apps.quotes.models import Quote

# Reemplaza con el token del usuario
token = "f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1"

try:
    quote = Quote.objects.get(token=token)
    
    # Verificar y corregir estado
    if quote.status not in ['sent', 'viewed', 'accepted', 'rejected', 'changes_requested']:
        print(f"⚠️  Cambiar estado de '{quote.status}' a 'sent'")
        quote.status = 'sent'
        quote.save(update_fields=['status', 'updated_at'])
    
    # Verificar y corregir eliminación
    if quote.is_deleted:
        print(f"⚠️  Recuperando cotización eliminada")
        quote.is_deleted = False
        quote.deleted_at = None
        quote.save(update_fields=['is_deleted', 'deleted_at'])
    
    print(f"✅ Cotización #{quote.quote_number} ahora es visible")
    print(f"   URL: https://mcd-agencia.vercel.app/es/cotizacion/{quote.token}/")
    
except Quote.DoesNotExist:
    print(f"❌ No existe cotización con ese token")
    # Buscar cotización similar
    similar = Quote.objects.filter(
        customer_email="cliente@email.com"
    ).order_by('-created_at').first()
    if similar:
        print(f"   ¿Quisiste decir?: {similar.token}")
```

---

## 📋 Checklist de Verificación

- [ ] Token es un UUID válido
- [ ] Cotización existe en la DB
- [ ] Cotización NO está eliminada (`is_deleted = False`)
- [ ] Cotización está en estado public-viewable (`sent`, `viewed`, `accepted`, `rejected`, o `changes_requested`)
- [ ] Cotización tiene líneas (`quote.lines.count() > 0`)
- [ ] Customer email es válido
- [ ] API endpoint responde 200 OK
- [ ] Frontend puede conectarse al backend (sin CORS issues)
- [ ] URL en navegador es correcta

---

## 🔗 Rutas Relacionadas

| Ruta Backend | Método | Propósito |
|-----------|--------|----------|
| `/api/v1/quotes/view/{token}/` | GET | Ver cotización pública |
| `/api/v1/quotes/view/{token}/pdf/` | GET | Descargar PDF |
| `/api/v1/quotes/view/{token}/responses/` | GET | Ver timeline |
| `/api/v1/quotes/view/{token}/change-request/` | GET/POST | Solicitar cambios |
| `/api/v1/quotes/view/{token}/reject/` | POST | Rechazar |
| `/api/v1/quotes/{id}/accept/` | POST | Aceptar (auth required) |

---

## 📞 Contactar Soporte

Si ninguna solución funciona:

1. Ejecuta el script de debugging
2. Recopila el output
3. Contacta con: `soporte@mcd-agencia.com`
4. Incluye:
   - Token problemático
   - Output del script debug
   - Email del cliente
   - Timestamp del reporte

---

**Última actualización:** 2024-05-12
**Versión:** 1.0
