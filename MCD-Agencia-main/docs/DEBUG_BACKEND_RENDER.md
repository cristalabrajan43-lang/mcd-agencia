# 🔍 Guía de Debugging - Backend Render Offline

## 🚨 Síntoma

**TODAS las cotizaciones públicas fallan con:**
```
Cotización no disponible
No se pudo cargar la cotización. El enlace puede ser inválido o haber expirado.
```

**Causa:** Backend en Render retorna **503 Service Unavailable**

---

## 🔧 Verificación Rápida

### 1️⃣ Verificar Estado del Backend

```powershell
# Ping al health endpoint
Invoke-RestMethod -Uri "https://mcd-agencia-api.onrender.com/health/" -Method Get
```

**Resultado esperado:**
```json
{"status": "ok"}
```

**Si falla con 503:**
→ El backend está caído

---

## 📋 Puntos de Verificación en Render.com

1. **Ir a:** https://dashboard.render.com/
2. **Seleccionar servicio:** `mcd-agencia-api`
3. **Revisar:**

| Punto | ¿Dónde? | Qué buscar |
|-------|---------|-----------|
| **Estado del deploy** | Logs → Latest Deploys | ¿Dice "Deploy successful"? |
| **Build errors** | Logs → Build | ¿Hay errores de compilación? |
| **Base de datos** | Services → mcd-agencia-db | ¿Está "Active"? |
| **Variables de entorno** | mcd-agencia-api → Environment | ¿DATABASE_URL está presente? |
| **Health check** | Settings → Health Check Endpoint | ¿Es `/health/`? |

---

## 🔴 Problema 1: Backend en "Free Tier Sleeping"

**Síntoma:** Funciona después de 30-60 segundos

**Solución:** Haz ping cada 15 minutos
```powershell
# Script para mantener el backend despierto
$timer = 0
while($true) {
    Invoke-RestMethod -Uri "https://mcd-agencia-api.onrender.com/health/" `
        -Method Get -ErrorAction SilentlyContinue | Out-Null
    Write-Host "Ping #$($timer++)" (Get-Date)
    Start-Sleep -Seconds 900  # 15 minutos
}
```

---

## 🔴 Problema 2: DATABASE_URL No Configurada

**Síntoma:** 503 + Logs muestran "psycopg2: could not connect to server"

**Solución:**
1. En Render Dashboard → mcd-agencia-api
2. Environment → Buscar `DATABASE_URL`
3. Si no existe:
   - Ir a mcd-agencia-db (base de datos)
   - Copiar "Internal Database URL"
   - Ir a mcd-agencia-api → Environment
   - Agregar variable: `DATABASE_URL` = `postgresql://...`

---

## 🔴 Problema 3: Build Failed

**Síntoma:** Logs muestran errores de compilación

**Solución:**
1. En Render Dashboard → mcd-agencia-api
2. Click en "Manual Deploy" → "Deploy latest commit"
3. Esperar a que termine
4. Revisar Logs para errores

---

## 🟢 Verificación de Configuración

### ✅ Checklist

```bash
# En local (con venv activado)
cd backend

# Test 1: ¿Puedo importar Django?
python -c "import django; print('✅ Django OK')"

# Test 2: ¿Puedo conectar a la BD?
python manage.py dbshell
> SELECT 1;  # Debería retornar 1
> \q

# Test 3: ¿Funciona el health endpoint?
python manage.py runserver
# En otra terminal:
curl http://localhost:8000/health/

# Test 4: ¿Funciona el quote endpoint?
curl http://localhost:8000/api/v1/quotes/view/f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1/
```

---

## 🚀 Soluciones Rápidas

### Opción A: Redeploy en Render (Recomendado)

1. Dashboard Render → mcd-agencia-api
2. Settings → Deploy Hook
3. Copiar URL y ejecutar:
   ```powershell
   Invoke-RestMethod -Uri "<DEPLOY_HOOK_URL>" -Method Post
   ```

### Opción B: Manualmente en Render

1. Dashboard → mcd-agencia-api
2. Click "Manual Deploy" → "Deploy latest commit"
3. Esperar logs:
   ```
   === Building mcd-agencia-api ===
   ...
   === Starting server ===
   Listening on 0.0.0.0:XXXX
   ```

### Opción C: Upgradear a Paid Plan

**Problema:** Free tier en Render duerme después de 15 min
**Solución:** Upgrade a $7/mes (sin sleep, siempre activo)

---

## 📊 Verificación Final

Después de redeploy, verifica que TODO funciona:

```powershell
# 1️⃣ Health check
Invoke-RestMethod https://mcd-agencia-api.onrender.com/health/

# 2️⃣ Quote endpoint (con token válido)
Invoke-RestMethod https://mcd-agencia-api.onrender.com/api/v1/quotes/view/[TOKEN]/

# 3️⃣ Abre en navegador
Start-Process "https://mcd-agencia.vercel.app/es/cotizacion/[TOKEN]"
```

---

## 🔗 Variables de Entorno Críticas

| Variable | Valor | Dónde obtenerlo |
|----------|-------|-----------------|
| `DATABASE_URL` | postgresql://... | mcd-agencia-db → Internal URL |
| `CORS_ALLOWED_ORIGINS` | https://mcd-agencia.vercel.app | Tu dominio Vercel |
| `ALLOWED_HOSTS` | mcd-agencia-api.onrender.com | Tu dominio Render |
| `CSRF_TRUSTED_ORIGINS` | https://mcd-agencia.vercel.app | Tu dominio Vercel |
| `FRONTEND_URL` | https://mcd-agencia.vercel.app | Tu dominio Vercel |
| `BACKEND_URL` | https://mcd-agencia-api.onrender.com | Tu dominio Render |

---

## 📞 Si Nada Funciona

1. En Render Dashboard → mcd-agencia-api → Logs
2. Busca la PRIMERA línea roja (error)
3. Copia el error completo
4. Abre issue o contacta soporte Render

---

**Última actualización:** 2026-05-14
**Status:** Backend 503 - Crítico
