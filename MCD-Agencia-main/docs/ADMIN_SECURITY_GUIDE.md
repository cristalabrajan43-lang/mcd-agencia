# 🔐 Guía de Seguridad - Agregar Administradores

## ¿Por qué esto es importante?

Agregar administradores al sistema es una acción crítica que puede comprometer toda la seguridad si no se hace correctamente. Esta guía te muestra la forma **segura** de hacerlo.

---

## ✅ Método Recomendado (Seguro)

### Opción 1: Management Command (Recomendado)

El método más seguro es usar el management command que incluye múltiples capas de seguridad:

```bash
# Forma interactiva (recomendada - pide confirmación)
python manage.py promote_to_admin nuevo.admin@mcdagencia.com

# Forma no interactiva (solo para automatización autorizada)
python manage.py promote_to_admin nuevo.admin@mcdagencia.com --no-input

# Asignar rol de ventas (acceso limitado)
python manage.py promote_to_admin vendedor@mcdagencia.com --role sales
```

### Características de Seguridad Incluidas:

✅ **Validaciones**
- Verifica que el usuario existe
- Previene promociones duplicadas
- Valida el formato del email

✅ **Confirmación Manual**
- Requiere confirmación interactiva del operador
- Muestra información del usuario antes de confirmar
- Advierte si el email no está verificado

✅ **Auditoría Completa**
- Registra TODAS las acciones en `AuditLog`
- Guarda estado anterior y nuevo
- Incluye timestamp y metadata

✅ **Control de Permisos**
- Solo acceso por CLI (no API)
- Asigna role + is_staff = True
- Soporta roles: `admin` (acceso total) o `sales` (comercial)

---

## 🚫 Métodos Inseguros (NO USAR)

### ❌ NO: Usar Django Admin directamente

```python
# ❌ PROHIBIDO - No deja rastro de auditoría
user.is_staff = True
user.is_superuser = True
user.save()
```

**Riesgo:** Sin auditoría, sin validaciones, sin confirmación.

---

### ❌ NO: Endpoint API directo

```bash
# ❌ PROHIBIDO - Cualquiera podría hacerlo si el token es robado
PUT /api/v1/admin/users/{user_id}/
{
  "is_staff": true,
  "role_id": "admin"
}
```

**Riesgo:** 
- Sin confirmación manual
- Acceso potencial desde token robado
- Sin control de acceso fuerte

---

### ❌ NO: Script Python directo

```python
# ❌ PROHIBIDO - Sin validaciones ni auditoría
user = User.objects.get(email='someone@example.com')
user.is_staff = True
user.save()
```

**Riesgo:** Sin capas de seguridad.

---

## 🔍 Roles Disponibles

| Rol | Acceso | Uso |
|-----|--------|-----|
| **admin** | Acceso total al sistema | Administradores de sistema |
| **sales** | Gestión de ventas, cotizaciones, clientes | Personal de ventas |
| **customer** | Acceso cliente (órdenes propias) | Usuarios regulares |

---

## 📋 Checklist de Seguridad

Antes de promover a un usuario, verifica:

- [ ] Email verificado (si es posible)
- [ ] Usuario existe y está activo
- [ ] No es ya administrador
- [ ] Motivo legítimo para la promoción
- [ ] Confirmación manual realizada
- [ ] Registrado en auditoría

---

## 🛠️ API Segura (Para Admins)

Si necesitas una forma segura de gestionar admins por API:

```python
# PUT /api/v1/admin/users/{user_id}/
# (Solo para usuarios autenticados con permisos de admin)

{
  "email": "admin@example.com",
  "first_name": "Admin",
  "last_name": "User",
  "is_staff": true,
  "role_id": "admin-role-uuid"
}
```

**Protecciones:**
- Solo admins pueden usar este endpoint
- Se registra automáticamente en AuditLog
- Validación de datos completa
- Confirmación necesaria

---

## 🚨 Respuesta si Sospechas Compromiso

Si encuentras un usuario admin no autorizado:

1. **Inmediatamente:**
   ```bash
   python manage.py promote_to_admin suspicious@email.com --role customer
   # O desactiva la cuenta
   ```

2. **Revisa auditoría:**
   ```bash
   # En Django admin: Audit > Audit Logs
   # Filtra por usuario y fecha
   ```

3. **Contacta seguridad:**
   - Revisa todos los cambios del usuario
   - Verifica qué datos accedieron
   - Restaura copias de seguridad si es necesario

---

## 💡 Mejores Prácticas

### 1. Usar Management Command
```bash
python manage.py promote_to_admin nuevo@empresa.com
```

### 2. Verificar Auditoría Regularmente
```
Django Admin → Audit → Audit Logs
Filtra por "admin_promotion"
```

### 3. Cambiar Contraseña Después
Pídele al usuario que cambie su contraseña después de ser promovido.

### 4. 2FA (Si disponible)
Habilita autenticación de dos factores para admins.

### 5. Principio de Menor Privilegio
- Usa `sales` para vendedores
- Usa `admin` solo para administradores del sistema
- Revoca acceso cuando alguien se va

---

## 📊 Auditar Adminstradores Actuales

```bash
# En Django shell
python manage.py shell

from apps.users.models import User, Role
admins = User.objects.filter(
    role__name__in=['admin', 'superadmin']
).select_related('role')
for admin in admins:
    print(f"{admin.email} - {admin.role.display_name} - {admin.created_at}")
```

---

## ⚡ Resumen Rápido

| Acción | Seguridad | Uso |
|--------|-----------|-----|
| **Management Command** | ⭐⭐⭐⭐⭐ | Agregar admins nuevos |
| **API (admin solo)** | ⭐⭐⭐⭐ | Gestión en emergencias |
| **Django Admin** | ⭐⭐⭐ | Solo superusuario local |
| **Directo en código** | ❌ | NUNCA |
| **Script sin auditoría** | ❌ | NUNCA |

---

**Recuerda:** ¡Cualquier cambio de permisos debe ser auditable y reversible! 🔐
