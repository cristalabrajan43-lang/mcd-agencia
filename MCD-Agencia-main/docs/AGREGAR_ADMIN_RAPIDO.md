# 🔐 Administrador Seguro - Guía Rápida

## El Problema

Agregar administradores sin validaciones es una **vulnerabilidad crítica**:
- Sin auditoría ➜ No sabes quién lo hizo ni cuándo
- Sin validaciones ➜ Usuarios fantasma pueden volverse admins
- Sin confirmación ➜ Cambios accidentales

## La Solución: Management Command

### Instalación

El comando ya está listo en:
```
backend/apps/users/management/commands/promote_to_admin.py
```

### Uso

**1️⃣ Forma Interactiva (Recomendada)**
```bash
python manage.py promote_to_admin nuevo.admin@empresa.com
```

Output esperado:
```
======================================================================
🔐 ADMIN PROMOTION REQUEST
======================================================================
Email:        nuevo.admin@empresa.com
Name:         Juan Pérez
Current Role: None
New Role:     Administrator
Active:       ✅ Yes
Email Verified: ✅ Yes
======================================================================

Are you SURE you want to promote this user to administrator? (yes/no): yes
✅ SUCCESS: User "nuevo.admin@empresa.com" promoted to Administrator
   Action logged to audit trail
```

**2️⃣ Forma No-Interactiva (Automatización)**
```bash
python manage.py promote_to_admin nuevo.admin@empresa.com --no-input
```

**3️⃣ Asignar Rol de Ventas (Acceso Limitado)**
```bash
python manage.py promote_to_admin vendedor@empresa.com --role sales
```

---

## 🛡️ Capas de Seguridad

```
┌─────────────────────────────────────┐
│   1. CLI Only (No API)              │  ← Solo terminal, no se puede remotamente
├─────────────────────────────────────┤
│   2. Email Validation               │  ← Verifica que existe el usuario
├─────────────────────────────────────┤
│   3. Manual Confirmation            │  ← Pide "Are you SURE"
├─────────────────────────────────────┤
│   4. Pre-change Validation          │  ← No permite duplicados
├─────────────────────────────────────┤
│   5. Atomic Transaction             │  ← Todo o nada (no cambios parciales)
├─────────────────────────────────────┤
│   6. Complete Audit Trail           │  ← Registra TODO en AuditLog
├─────────────────────────────────────┤
│   7. Role-based Permission System   │  ← Usa Django permissions
└─────────────────────────────────────┘
```

---

## 📊 Ver Admins Actuales

```bash
python manage.py shell

from apps.users.models import User

# Listar todos los admins
admins = User.objects.filter(is_staff=True).select_related('role')
for admin in admins:
    print(f"✅ {admin.email} ({admin.role.display_name}) - {admin.created_at}")

# Contar admins
print(f"\nTotal admins: {admins.count()}")
```

---

## 🔍 Auditar Cambios

### En Django Admin
1. Ve a **Audit > Audit Logs**
2. Filtra por **admin_promotion**
3. Revisa usuario, timestamp y cambios

### Por Terminal
```bash
python manage.py shell

from apps.audit.models import AuditLog

logs = AuditLog.objects.filter(
    metadata__action_type='admin_promotion'
).order_by('-created_at')

for log in logs[:10]:
    print(f"{log.created_at} - {log.entity_id} - {log.action}")
```

---

## ⚠️ Emergencias

### Si Sospechas Acceso No Autorizado

**PASO 1: Desactiva el usuario inmediatamente**
```bash
python manage.py shell

from apps.users.models import User
user = User.objects.get(email='suspicious@email.com')
user.is_active = False
user.save()
print("✅ Usuario desactivado")
```

**PASO 2: Revisa auditoría**
```bash
from apps.audit.models import AuditLog

logs = AuditLog.objects.filter(
    actor_id='<user_id>'
).order_by('-created_at')[:20]

for log in logs:
    print(log.metadata)
```

**PASO 3: Restaura permisos si fue error**
```bash
from apps.users.models import Role

user.role = Role.objects.get(name='customer')
user.is_staff = False
user.save()
```

---

## 🧪 Pruebas

Ejecuta tests del comando:
```bash
python manage.py test apps.users.management.commands.tests
```

---

## 📋 Checklist de Seguridad

- [ ] Email del usuario verificado
- [ ] Usuario existe y está activo
- [ ] No es ya administrador
- [ ] Razón legítima documentada
- [ ] Confirmación manual realizada (`yes/no`)
- [ ] Cambio registrado en auditoría
- [ ] Notificación enviada al usuario

---

## 💡 Mejores Prácticas

| Acción | ✅ Seguro | ❌ Inseguro |
|--------|----------|-----------|
| Agregar admin | `promote_to_admin` | SQL directo |
| Quitar admin | `promote_to_admin --role customer` | API endpoint |
| Auditar cambios | Django Admin audit | Revisar DB |
| Emergencias | CLI + desactivar | Eliminar cuenta |

---

## 🆘 Troubleshooting

### "User does not exist"
```bash
# Verifica que el email exista y sea exacto
python manage.py shell
from apps.users.models import User
User.objects.filter(email__icontains='email').values_list('email')
```

### "User is already an administrator"
```bash
# Si es un error, degradar a customer
python manage.py shell
from apps.users.models import User, Role
user = User.objects.get(email='admin@email.com')
user.role = Role.objects.get(name='customer')
user.is_staff = False
user.save()
```

### "Role does not exist"
```bash
# Ver roles disponibles
python manage.py shell
from apps.users.models import Role
Role.objects.all().values_list('name', 'display_name')
```

---

## 🔗 Referencias

- [Guía Completa](ADMIN_SECURITY_GUIDE.md)
- [Code: promote_to_admin.py](../backend/apps/users/management/commands/promote_to_admin.py)
- [AuditLog Model](../backend/apps/audit/models.py)
- [Django Auth Docs](https://docs.djangoproject.com/en/stable/topics/auth/)

---

**Recuerda:** La seguridad es trabajo de todos. Si ves algo sospechoso, reporta inmediatamente. 🚨
