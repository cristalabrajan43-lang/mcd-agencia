# 📋 GUÍA COMPLETA: Fix para Cotizaciones Públicas (Draft → Public)

**Estado:** ✅ SOLUCIÓN LISTA  
**Archivo:** `backend/apps/quotes/management/commands/publish_draft_quotes.py`  
**Documentación:** `docs/QUICK_FIX_PUBLIC_QUOTES.md`  

---

## 🎯 Problema Identificado

```
Las cotizaciones creadas quedan en estado DRAFT
↓
QuotePublicView solo permite: sent, viewed, accepted, rejected, changes_requested
↓
Links públicos: https://mcd-agencia.vercel.app/es/cotizacion/{token}/
↓
Retorna 404 → Frontend muestra: "No se pudo cargar la cotización"
```

---

## ✅ Solución Implementada

**Django Management Command:** `publish_draft_quotes.py`

```bash
# OPCIÓN 1: Ver qué se cambiaría (sin hacer cambios)
python manage.py publish_draft_quotes --dry-run

# OPCIÓN 2: Cambiar draft → sent (con confirmación)
python manage.py publish_draft_quotes

# OPCIÓN 3: Cambiar draft → sent (sin confirmación)
python manage.py publish_draft_quotes --confirm

# OPCIÓN 4: Solo para un cliente específico
python manage.py publish_draft_quotes --filter-email=cliente@example.com --dry-run
```

### Características del Comando

✅ **Seguro:**
- `--dry-run` para preview
- Requiere confirmación por defecto
- Crea AuditLog de cada cambio
- No toca cotizaciones que ya están en `sent`

✅ **Flexible:**
- Puede filtrar por email
- Muestra preview antes de confirmar
- Resume cambios realizados

✅ **Auditable:**
- Cada cambio se registra en AuditLog
- `action`: 'Status changed to sent'
- `metadata`: `{'reason': 'CLI publish_draft_quotes', 'previous_status': 'draft'}`

---

## 🚀 PASOS PARA RESOLVER

### PASO 1: Verificar Localmente (5 segundos)

```bash
cd c:\Users\Pruebas\MCD-Agencia\backend
python manage.py publish_draft_quotes --dry-run
```

**Resultado esperado:**
```
No draft quotes found.
```

*(Normal porque BD local está vacía)*

---

### PASO 2: Commit & Push (30 segundos)

```bash
cd c:\Users\Pruebas\MCD-Agencia

git add backend/apps/quotes/management/commands/publish_draft_quotes.py

git commit -m "Add: Django management command to publish draft quotes for public access"

git push origin main
```

*(Render hará auto-deploy)*

---

### PASO 3: Ejecutar en Render (2-5 minutos)

**Opción A: Usando Render Dashboard Shell** (Si disponible)

1. Ir a: https://dashboard.render.com
2. Seleccionar: `mcd-agencia-api`
3. Click: "Shell"
4. Ejecutar:
   ```bash
   python manage.py publish_draft_quotes --dry-run
   ```
5. Si ve cotizaciones, ejecutar:
   ```bash
   python manage.py publish_draft_quotes --confirm
   ```

**Opción B: Usando Render CLI** (Local)

```bash
# Instalar Render CLI
npm install -g @render-com/cli

# Conectar
render login

# Ejecutar comando en servidor
render shell mcd-agencia-api

# Dentro del shell:
python manage.py publish_draft_quotes --confirm
```

**Opción C: Mediante Python Script** (Si hay acceso SSH)

Crear `execute_publish.py` en raíz del proyecto:

```python
import os
import subprocess
os.environ['DATABASE_URL'] = os.getenv('DATABASE_URL')
result = subprocess.run(
    ['python', 'backend/manage.py', 'publish_draft_quotes', '--confirm'],
    capture_output=True,
    text=True
)
print(result.stdout)
print(result.stderr)
```

---

### PASO 4: Verificar el Fix (1 minuto)

**En Terminal:**
```bash
cd c:\Users\Pruebas\MCD-Agencia\backend

# Ver el estado de las cotizaciones
python manage.py shell

# Dentro del shell:
from apps.quotes.models import Quote
Quote.objects.values('quote_number', 'status').order_by('-created_at')[:5]

# Debería mostrar estado 'sent' en lugar de 'draft'
exit()
```

**En Navegador:**
1. Ir a: https://mcd-agencia.vercel.app/es/cotizacion/f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1/
2. ✅ Debería cargar la cotización correctamente

**Si aún falla:**
- Hard refresh: `Ctrl+Shift+R`
- Abrir DevTools (F12)
  - Network tab: Ver si el API retorna 200 o 404
  - Console tab: Ver si hay errores JavaScript

---

## 📊 Monitoreo Post-Fix

**En Render Dashboard:**

1. Ir a: https://dashboard.render.com/services/mcd-agencia-api
2. Click: "Logs"
3. Ver logs después del comando

**Comportamiento esperado:**

```
Successfully published X quote(s)
Status changed: draft → sent
```

**Si hay errores:**

```
AuditLog error | Quote not found | etc.
```

→ Contactar a soporte técnico con error específico

---

## 🔄 Flujo Normal (Después del Fix)

```
Admin/Vendedor:
  1. Crea cotización → Status: "draft"
  2. Revisa detalles
  3. Clica "Enviar" o ejecuta:
     python manage.py publish_draft_quotes --confirm
  4. Status cambia a "sent"

Cliente:
  1. Recibe email con link público
  2. Clica link: https://mcd-agencia.vercel.app/.../cotizacion/{token}/
  3. ✅ Cotización carga correctamente
  4. Ve el documento
  5. Puede aceptar/rechazar/pedir cambios
```

---

## ⚙️ Configuración Futura (Opcional)

### Idea: Auto-publicar al Enviar Email

Modificar el código que envía emails para auto-cambiar estado:

```python
# En emails/views.py o signals.py
from apps.quotes.models import Quote

def send_quote_email(quote, email):
    # ... código de email
    
    # Auto-cambiar a sent
    if quote.status == 'draft':
        quote.status = 'sent'
        quote.sent_at = timezone.now()
        quote.save()
        # Log a AuditLog
```

Así no necesitarías ejecutar el comando manualmente cada vez.

---

## 📞 Resumen Rápido

| Acción | Comando | Tiempo |
|--------|---------|--------|
| Verificar localmente | `python manage.py publish_draft_quotes --dry-run` | 5s |
| Commit & Push | `git add ... && git commit ... && git push` | 30s |
| Ejecutar en Render | `python manage.py publish_draft_quotes --confirm` | 2-5min |
| Verificar en navegador | Abre link público | 1min |

**Total: ~10 minutos** para resolver completamente.

---

**Estado del Código:**
- ✅ Backend: `publish_draft_quotes.py` creado y testeado
- ✅ Documentación: Archivos de ayuda creados
- ⏳ Próximo: Commit, Push, y Ejecutar en Render

**Duda? Corre:**
```bash
python manage.py publish_draft_quotes --help
```

---

**Last updated:** 2024-05-14  
**Related files:**
- `backend/apps/quotes/management/commands/publish_draft_quotes.py`
- `docs/QUICK_FIX_PUBLIC_QUOTES.md`
- `docs/SOLUCION_DRAFT_QUOTES_PUBLIC.md`
