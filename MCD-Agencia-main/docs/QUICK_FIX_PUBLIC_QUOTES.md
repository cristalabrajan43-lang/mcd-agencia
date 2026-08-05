# ⚡ INSTRUCCIONES RÁPIDAS - Cotizaciones Públicas No Cargan

## 🎯 El Problema

```
Las cotizaciones están en estado "DRAFT" (borrador)
↓
Los links públicos requieren estado "SENT" (enviado)
↓
Por eso muestran: "No se pudo cargar la cotización"
```

---

## 🔧 La Solución (3 Opciones)

### OPCIÓN 1️⃣: Usar el Comando Django (RECOMENDADO)

**Paso 1:** Abre terminal y ejecuta:

```bash
cd c:\Users\Pruebas\MCD-Agencia\backend

# Ver qué se cambiaría
python manage.py publish_draft_quotes --dry-run

# Hacer el cambio (con confirmación)
python manage.py publish_draft_quotes

# Cuando pregunte, escribe: yes
```

**Paso 2:** Verifica en navegador:

```
https://mcd-agencia.vercel.app/es/cotizacion/f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1/
```

✅ **Debería cargar ahora**

---

### OPCIÓN 2️⃣: Manual (Desde el Shell Django)

```bash
cd c:\Users\Pruebas\MCD-Agencia\backend
python manage.py shell
```

```python
from apps.quotes.models import Quote
from django.utils import timezone

# Obtener todas las cotizaciones draft
quotes = Quote.objects.filter(status='draft')

print(f"Cambiando {quotes.count()} cotizaciones a 'sent'...")

# Cambiarlas a sent
for q in quotes:
    q.status = 'sent'
    q.sent_at = timezone.now()
    q.save()
    print(f"  ✅ {q.quote_number}")

print(f"\n✅ Listo! {quotes.count()} cotizaciones publicadas")
exit()
```

---

### OPCIÓN 3️⃣: Crear Endpoint API (Para el Futuro)

Esto requiere crear un endpoint en `backend/apps/quotes/views.py`:

```python
@action(detail=True, methods=['post'])
def publish(self, request, pk=None):
    """Publish a quote (change status from draft to sent)."""
    if not request.user.is_staff:
        return Response(status=status.HTTP_403_FORBIDDEN)
    
    quote = self.get_object()
    if quote.status != 'draft':
        return Response(
            {'error': 'Only draft quotes can be published'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    quote.status = 'sent'
    quote.sent_at = timezone.now()
    quote.save()
    
    return Response(QuoteSerializer(quote).data)
```

Luego desde el admin dashboard podrías hacer:

```
POST /api/v1/quotes/{id}/publish/
```

---

## ✅ Verificación

Después de ejecutar cualquiera de las opciones:

**Terminal:**
```bash
cd backend
python manage.py shell
```

```python
from apps.quotes.models import Quote

# Ver el estado ahora
for q in Quote.objects.all():
    print(f"{q.quote_number}: {q.status}")

# Debería mostar "sent" en lugar de "draft"
```

**Navegador:**
1. Abre: `https://mcd-agencia.vercel.app/es/cotizacion/[TOKEN]/`
2. Debería cargar la cotización ✅

---

## 🚨 Si Aún No Funciona

**Paso 1:** Verifica que Render tiene las cotizaciones:

```bash
# En local, simula que eres Render (con la misma BD)
# Si usas BD remota, puedes conectar directamente

# Opción A: Conectar a BD Render vía Render Dashboard
# Settings → Database → Connect → Credentials

# Opción B: Usar comando con --dry-run para ver
python manage.py publish_draft_quotes --dry-run
```

**Paso 2:** Si no ves cotizaciones en `--dry-run`:

Significa que en Render no hay cotizaciones draft. Probablemente:
- Están todas en estado "sent" ya → Deberían funcionar
- No existen cotizaciones en Render → Necesita crearlas
- Fueron eliminadas → Necesita crear nuevas

**Paso 3:** Verifica el endpoint manualmente:

```powershell
$token = "f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1"
Invoke-RestMethod "https://mcd-agencia-api.onrender.com/api/v1/quotes/view/$token/" -Method Get
```

---

## 📋 Resumen

| Problema | Causa | Solución |
|----------|-------|----------|
| Link público muestra error 404 | Status = "draft" | `publish_draft_quotes --confirm` |
| Comando no encuentra cotizaciones | BD vacía en local | Crear cotizaciones o conectar BD remota |
| Aún falla después del fix | Endpoint no actualizado | Hacer redeploy en Render |

---

**ACCIÓN INMEDIATA:**

```bash
cd c:\Users\Pruebas\MCD-Agencia\backend
python manage.py publish_draft_quotes --dry-run
```

Ejecuta esto y pégame la salida → Te diré el siguiente paso.

---

**Archivo creado:** `docs/SOLUCION_DRAFT_QUOTES_PUBLIC.md`
