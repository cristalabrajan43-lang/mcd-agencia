# ⚙️ Configuración de Render - Checklist Completo

## 🎯 Objetivo
Verificar que el backend en Render.com está correctamente configurado para servir cotizaciones públicas.

---

## 📋 Checklist Pre-Deployment

### 1️⃣ Ir a Render Dashboard
```
https://dashboard.render.com/
```

### 2️⃣ Seleccionar el Servicio `mcd-agencia-api`

### 3️⃣ Revisar Configuración

| Elemento | Estado | Qué Verificar |
|----------|--------|---------------|
| **Status** | Debe decir "Running" en verde | ¿Dice "Running"? Si no, haz deploy |
| **Build Logs** | Último deploy | ¿Dice "Deploy successful"? |
| **Runtime Logs** | Los últimos 50 líneas | ¿Hay errores en rojo? |
| **Health Check** | Settings → Health Check Path | Debe ser `/health/` |
| **Start Command** | Settings → Start Command | Debe ser el `gunicorn` del render.yaml |
| **Database Link** | Environment → DATABASE_URL | ¿Existe? ¿Está completa? |

---

## 🔧 Variables de Entorno Críticas

Ve a: **mcd-agencia-api → Environment**

Verifica que TODAS existan (aunque sea con valores placeholder):

```
✅ DJANGO_ENV = cloud
✅ DJANGO_SECRET_KEY = (generado automáticamente)
✅ PYTHON_VERSION = 3.11.7

✅ DATABASE_URL = postgresql://...  ← CRÍTICA
✅ ALLOWED_HOSTS = mcd-agencia-api.onrender.com
✅ CORS_ALLOWED_ORIGINS = https://mcd-agencia.vercel.app
✅ CSRF_TRUSTED_ORIGINS = https://mcd-agencia.vercel.app

✅ FRONTEND_URL = https://mcd-agencia.vercel.app
✅ BACKEND_URL = https://mcd-agencia-api.onrender.com

✅ EMAIL_HOST = smtp.gmail.com
✅ EMAIL_PORT = 587
✅ EMAIL_HOST_USER = (tu email)
✅ EMAIL_HOST_PASSWORD = (tu contraseña de app)
✅ DEFAULT_FROM_EMAIL = (tu email)

✅ GOOGLE_CLIENT_ID = (si usas Google OAuth)
✅ GOOGLE_CLIENT_SECRET = (si usas Google OAuth)

✅ AWS_ACCESS_KEY_ID = (si usas Cloudflare R2)
✅ AWS_SECRET_ACCESS_KEY = (si usas Cloudflare R2)
✅ AWS_STORAGE_BUCKET_NAME = (si usas Cloudflare R2)
✅ AWS_S3_ENDPOINT_URL = (si usas Cloudflare R2)

✅ DJANGO_SUPERUSER_EMAIL = (admin email)
✅ DJANGO_SUPERUSER_PASSWORD = (admin contraseña)

✅ GEMINI_API_KEY = (si usas chatbot)
✅ GEMINI_MODEL = gemini-2.5-flash
✅ CHATBOT_AI_PROVIDER = auto

(Opcionales si usas pagos/Sentry):
⏸ MERCADOPAGO_ACCESS_TOKEN
⏸ PAYPAL_CLIENT_ID
⏸ SENTRY_DSN
```

---

## 🚨 Problemas Comunes & Soluciones

### Problema 1: DATABASE_URL Missing

**Síntoma:** Logs muestran:
```
could not translate host name "None" to address: nodename nor servname provided
```

**Solución:**
1. Ve a servicios → `mcd-agencia-db` (la base de datos)
2. Copia la "Internal Database URL"
3. En `mcd-agencia-api` → Environment
4. Añade variable: `DATABASE_URL` = `postgresql://mcd_user:PASSWORD@HOST:5432/mcd_agencia`

---

### Problema 2: CORS Blocking

**Síntoma:** Frontend muestra error pero network tab muestra 200 OK

**Solución:**
1. En `mcd-agencia-api` → Environment
2. Verifica `CORS_ALLOWED_ORIGINS` = `https://mcd-agencia.vercel.app`
3. Si no existe, añádela
4. Redeploy

---

### Problema 3: 503 Service Unavailable

**Síntoma:** Todos los endpoints retornan 503

**Causa Más Común:** Free tier en Render duerme después de 15 min

**Soluciones:**

#### A. Keep-Alive Script (Temporal)
```powershell
# Ejecutar en terminal cada 15 min
$url = "https://mcd-agencia-api.onrender.com/health/"
while($true) {
    try {
        Invoke-RestMethod $url | Out-Null
        Write-Host "✅ Ping $(Get-Date)"
    } catch {
        Write-Host "❌ Down at $(Get-Date)"
    }
    Start-Sleep -Seconds 900  # 15 minutos
}
```

#### B. Upgrade a Paid Plan (Permanente)
- Dashboard → mcd-agencia-api
- Settings → Plan
- Cambiar a $7/mes (sin sleep)

---

### Problema 4: Build Failed

**Síntoma:** Logs muestran errores durante build

**Pasos:**
1. Abre terminal local
   ```bash
   cd backend
   python -c "import django; print('OK')"
   ```
   Si falla, tienes error de dependencias

2. En Render, haz click "Manual Deploy" → "Deploy latest commit"

3. Revisa Logs línea por línea

4. Si persiste el error, abre issue en GitHub

---

## ✅ Verificación Post-Deploy

Después de hacer deploy, verifica:

### 1️⃣ Health Endpoint
```powershell
Invoke-RestMethod https://mcd-agencia-api.onrender.com/health/
```

Esperado: `{"status": "ok"}`

### 2️⃣ Quote Endpoint
```powershell
$token = "f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1"
$url = "https://mcd-agencia-api.onrender.com/api/v1/quotes/view/$token/"
Invoke-RestMethod $url
```

Esperado: JSON con datos de la cotización

### 3️⃣ Frontend
```
https://mcd-agencia.vercel.app/es/cotizacion/[TOKEN]
```

Debe cargar sin errores.

---

## 📊 Monitoreo Continuo

### Ve a mcd-agencia-api → Logs

Busca estas líneas al iniciar:
```
✅ Listening on 0.0.0.0:XXXX
✅ Database connection OK
✅ Running migrations...
```

Si ves errores rojos, Render te mostrará el problema exacto.

---

## 🔗 Enlaces Útiles

| Recurso | URL |
|---------|-----|
| Render Dashboard | https://dashboard.render.com/ |
| Render Docs | https://render.com/docs |
| PostgreSQL Status | Ver en dashboard → mcd-agencia-db |
| Vercel Frontend | https://mcd-agencia.vercel.app |

---

## 📞 Si Todo Falla

1. **Paso 1:** Ve a Render Dashboard → mcd-agencia-api → Logs
2. **Paso 2:** Busca la PRIMERA línea roja (error)
3. **Paso 3:** Copia TODO desde esa línea hasta 10 líneas después
4. **Paso 4:** Pega en un archivo `error_log.txt`
5. **Paso 5:** Contacta soporte o abre issue

**Ejemplo error esperado:**
```
ERROR: could not connect to database
DatabaseError: could not connect to server: No such file or directory
```

---

**Última actualización:** 2026-05-14
**Status:** Render free tier 503 issues common - verify configuration
