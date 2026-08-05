# 🚨 PROBLEMA: Todas las Cotizaciones No Cargan - SOLUCIÓN

## 📌 El Problema Exacto

**Cuando un cliente abre:** `https://mcd-agencia.vercel.app/es/cotizacion/[TOKEN]`

**Resultado:**
```
Cotización no disponible
No se pudo cargar la cotización. El enlace puede ser inválido o haber expirado.
```

**Causa:** El backend en Render.com está retornando **503 Service Unavailable** para TODAS las solicitudes.

---

## 🔍 Diagnóstico

### Ejecuta Este Script:

```powershell
cd c:\Users\Pruebas\MCD-Agencia
.\debug_render_backend.ps1
```

**Salida esperada si todo está bien:**
```
1️⃣ Backend Health Check
   ✅ Backend is ONLINE

2️⃣ API Quote Endpoint Test
   ✅ Quote found!
   Quote #: COT-2024-001
   Status: Sent
   ...

5️⃣ Frontend Quote Page
   ✅ Page loads (HTTP 200)
```

**Salida si hay problema:**
```
1️⃣ Backend Health Check
   ❌ Backend is OFFLINE or SLOW
   Status: 503
```

---

## 🚀 Solución (Paso a Paso)

### Paso 1: Abre Render Dashboard

```
👉 https://dashboard.render.com/
```

### Paso 2: Selecciona "mcd-agencia-api"

En la lista de servicios, busca **mcd-agencia-api**

### Paso 3: Haz Manual Deploy

1. Click en "Manual Deploy" (botón en la esquina superior derecha)
2. Selecciona "Deploy latest commit"
3. **Espera 5-10 minutos** a que termine

### Paso 4: Verifica los Logs

Mientras se despliega, deberías ver:
```
🔧 Building...
📦 Installing dependencies...
▶️ Starting server...
✅ Listening on 0.0.0.0:10000
```

Si ves **errores en rojo**, anota el error completo.

### Paso 5: Verifica que Funciona

Abre en navegador:
```
https://mcd-agencia.vercel.app/es/cotizacion/[CUALQUIER_TOKEN]
```

Debería cargar la cotización (o mostrar error específico si el token no existe).

---

## ✅ Verificaciones Rápidas

### ✓ Verificación 1: ¿Está la BD conectada?

En Render Dashboard → mcd-agencia-api → Environment

Busca: `DATABASE_URL`

Si **NO existe:**
1. Ve a mcd-agencia-db (database)
2. Copia "Internal Database URL"
3. En mcd-agencia-api → Environment
4. Añade: `DATABASE_URL` = `[PEGA_AQUI]`
5. Redeploy

### ✓ Verificación 2: ¿Están las variables CORS?

En Render Dashboard → mcd-agencia-api → Environment

Busca estas dos:
- `CORS_ALLOWED_ORIGINS` = `https://mcd-agencia.vercel.app`
- `CSRF_TRUSTED_ORIGINS` = `https://mcd-agencia.vercel.app`

Si faltan, añádelas.

### ✓ Verificación 3: ¿Es Free Tier?

Si es free tier (durmilón):

**Problema:** Backend se duerme después de 15 min

**Soluciones:**
- **A) Gratis:** Script para hacer ping cada 15 min (ver abajo)
- **B) Pago:** Upgrade a $7/mes (sin sleep)

---

## 🤖 Script de Keep-Alive (Gratuito)

Si usas free tier, crea este script para mantener el backend despierto:

```powershell
# Guarda como: keep_backend_alive.ps1
$backend = "https://mcd-agencia-api.onrender.com"
$counter = 0

while($true) {
    try {
        $result = Invoke-RestMethod "$backend/health/" -TimeoutSec 5
        Write-Host "[$counter] ✅ Backend alive - $(Get-Date -Format 'HH:mm:ss')"
    } catch {
        Write-Host "[$counter] ⚠️ Backend down - $(Get-Date -Format 'HH:mm:ss')"
    }
    $counter++
    Start-Sleep -Seconds 900  # 15 minutos
}
```

**Usar:**
```powershell
cd c:\Users\Pruebas\MCD-Agencia
powershell -ExecutionPolicy Bypass -File keep_backend_alive.ps1
```

Déjalo corriendo en segundo plano.

---

## 🎯 Resumen de Acciones

| Acción | Prioridad | Tiempo | Impacto |
|--------|-----------|--------|--------|
| Ejecutar `debug_render_backend.ps1` | 🔴 AHORA | 1 min | Diagnostica el problema |
| Hacer Manual Deploy en Render | 🔴 AHORA | 10 min | Resuelve 90% de casos |
| Verificar DATABASE_URL | 🟡 Si falla deploy | 2 min | Requiere BD conectada |
| Verificar CORS variables | 🟡 Si aún falla | 2 min | Frontend puede conectar |
| Activar keep-alive script | 🟢 Si es free tier | 30 seg | Previene sleep (temporal) |
| Upgrade a paid | 🟡 Solución definitiva | $7/mes | Sin sleep, 24/7 disponible |

---

## 📞 Si Nada Funciona

### Paso 1: Recopila Información

En Render Dashboard → mcd-agencia-api → Logs:

**Copia TODO lo que ves, especialmente:**
- Errores en rojo
- Las primeras 10 líneas del deploy
- Las últimas 10 líneas de los logs

### Paso 2: Busca el Error

Busca palabras clave:
- `ERROR:` - Error de aplicación
- `CRITICAL:` - Crítico
- `Connection refused` - BD no conecta
- `ModuleNotFoundError` - Dependencia faltante
- `Permission denied` - Permisos insuficientes

### Paso 3: Crea un Issue

En GitHub o contacta a soporte con:
1. El error exacto (copia/pega del log)
2. Fecha y hora cuando pasó
3. Resultado del script `debug_render_backend.ps1`

---

## 📚 Documentación Relacionada

| Archivo | Propósito |
|---------|-----------|
| `docs/DEBUG_BACKEND_RENDER.md` | Guía completa de debugging |
| `docs/RENDER_CONFIGURATION_CHECKLIST.md` | Checklist de configuración |
| `debug_render_backend.ps1` | Script automático de diagnóstico |
| `keep_backend_alive.ps1` | Script de keep-alive (crea tú mismo) |
| `docs/debug_quote_token.py` | Debugging de cotizaciones específicas |

---

## 🎓 Referencia Rápida

```
┌─────────────────────────────────────────────────────────┐
│ FLUJO DE CARGA DE COTIZACIÓN                            │
├─────────────────────────────────────────────────────────┤
│ 1. Cliente abre URL                                     │
│    ↓                                                     │
│ 2. Vercel (Frontend) carga page.tsx                     │
│    ↓                                                     │
│ 3. Frontend llama: GET /api/v1/quotes/view/{token}/    │
│    ↓                                                     │
│ 4. Render (Backend) procesa solicitud                   │
│    ├─ ✅ 200 OK → Retorna JSON                          │
│    ├─ 🟡 404 Not Found → Token no existe o estado malo  │
│    └─ 🔴 503 Service Unavailable → Backend está caído  │
│    ↓                                                     │
│ 5. Frontend recibe respuesta                            │
│    ├─ ✅ JSON → Muestra cotización                      │
│    └─ ❌ Error → Muestra "No se pudo cargar..."        │
└─────────────────────────────────────────────────────────┘

Ahora mismo estás en: 🔴 PASO 4 - Backend retorna 503
Solución: Haz Manual Deploy en Render Dashboard
```

---

## 📞 Soporte

- **Render Support:** https://render.com/support
- **Django Docs:** https://docs.djangoproject.com
- **Next.js Docs:** https://nextjs.org/docs

---

**ÚLTIMA ACTUALIZACIÓN:** 2026-05-14  
**CRITICIDAD:** 🔴 Crítica - Todas las cotizaciones publícas no cargan  
**CAUSA:** Backend Render 503 Service Unavailable  
**SOLUCIÓN:** Manual Deploy + Verificar configuración  
**TIEMPO ESTIMADO:** 10-15 minutos  
