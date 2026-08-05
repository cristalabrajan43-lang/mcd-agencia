# MCD-Agencia

Plataforma de e-commerce y cotizaciones para Agencia MCD — Medios Impresos y Publicidad Exterior.

> **107 commits** | Ene – Feb 2026 | [Changelog completo](docs/CHANGELOG.md) | [Arquitectura](docs/ARCHITECTURE.md)

## Producción

| Servicio | URL | Plataforma |
|----------|-----|------------|
| Frontend | [agenciamcd.mx](https://agenciamcd.mx) | Vercel |
| Backend API | [mcd-agencia-api.onrender.com](https://mcd-agencia-api.onrender.com) | Render |
| Base de datos | PostgreSQL | Render (incluido) |
| Media/Storage | Cloudflare R2 | Cloudflare |
| Email | Brevo HTTP API (300/día) | Brevo |

## Descripción

Sistema integral que combina:
- **E-commerce**: Venta directa de productos con precio definido
- **Cotizaciones (RFQ)**: Solicitud, gestión, PDF bilingüe, tokens públicos, solicitudes de cambio
- **Panel Admin**: Dashboard con estadísticas, gestión completa con RBAC (5 roles)
- **CMS**: Gestión de servicios, portafolio, videos y contenido del landing
- **Inventario**: Control de stock con alertas automáticas
- **Notificaciones**: Sistema in-app para admin/ventas/clientes
- **Auditoría**: Bitácora completa de operaciones con middleware
- **Analytics**: Sistema de tracking de eventos y conversiones
- **i18n**: Español e Inglés completo (ES/EN)

## Stack Tecnológico

### Backend
- **Framework**: Django 5.0 + Django REST Framework 3.14
- **Base de datos**: PostgreSQL (Render) / SQLite (dev)
- **Task Queue**: Celery (modo eager en cloud, sin Redis)
- **PDF**: ReportLab (generación directa, bilingüe)
- **Email**: Brevo HTTP API vía django-anymail
- **Storage**: Cloudflare R2 vía django-storages + boto3
- **Autenticación**: JWT (SimpleJWT) + Google OAuth (django-allauth)

### Frontend
- **Framework**: Next.js 14.1.0 (App Router)
- **Lenguaje**: TypeScript 5.3
- **Estilos**: Tailwind CSS 3.4
- **Estado**: React Query 5 + Zustand 4
- **Formularios**: React Hook Form + Zod
- **i18n**: next-intl 3.4 (ES/EN)
- **UI**: Lucide React, Framer Motion, Embla Carousel

### Infraestructura
- **Backend**: Render (free tier, auto-deploy desde GitHub)
- **Frontend**: Vercel (auto-deploy desde GitHub)
- **Storage**: Cloudflare R2 (S3-compatible, URLs presignadas)
- **Email**: Brevo (HTTP API, 300 emails/día gratis)
- **Pagos**: Mercado Pago + PayPal (sandbox/live)

## Estructura del Proyecto

```
MCD-Agencia/
├── backend/                 # Django Backend
│   ├── apps/               # Django applications
│   │   ├── core/          # Base models, exceptions, pagination
│   │   ├── users/         # Users, roles, OAuth, email verification
│   │   ├── catalog/       # Categories (MPTT), products, variants
│   │   ├── orders/        # Orders with FSM states
│   │   ├── quotes/        # RFQ system, PDF, public tokens, change requests
│   │   ├── inventory/     # Stock movements, alerts
│   │   ├── audit/         # Audit logging with middleware
│   │   ├── content/       # CMS: services, portfolio, videos
│   │   ├── payments/      # Mercado Pago, PayPal
│   │   ├── notifications/ # In-app notification system
│   │   └── chatbot/       # Chatbot & leads
│   ├── config/            # Django settings (base, dev, cloud, production)
│   ├── templates/         # Email & PDF templates
│   └── requirements.txt
├── frontend/               # Next.js Frontend
│   ├── src/
│   │   ├── app/[locale]/ # i18n routes (es/en)
│   │   ├── components/   # React components
│   │   ├── lib/api/      # API client & services
│   │   ├── hooks/        # Custom hooks
│   │   ├── store/        # Zustand stores
│   │   └── types/        # TypeScript types
│   └── messages/         # i18n translations (es.json, en.json)
├── docs/                   # Documentation
│   ├── CHANGELOG.md       # Complete change history
│   └── ARCHITECTURE.md    # Architecture & deployment guide
├── render.yaml             # Render Blueprint (auto-deploy)
└── docker-compose.yml      # Docker services (local)
```

## Inicio Rápido

### Prerrequisitos
- Docker y Docker Compose
- Node.js 18+ (para desarrollo local del frontend)
- Python 3.11+ (para desarrollo local del backend)

### Con Docker (Recomendado)

```bash
# Clonar el repositorio
git clone https://github.com/agenciamcd/mcd-agencia.git
cd mcd-agencia

# Copiar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores

# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f
```

La aplicación estará disponible en:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/v1/
- API Docs: http://localhost:8000/api/docs/swagger/

### Desarrollo Local

#### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con USE_SQLITE=true para desarrollo simple

# Ejecutar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Iniciar servidor
python manage.py runserver
```

#### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## Variables de Entorno

### Backend (`.env`) — Desarrollo Local

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DJANGO_ENV` | Entorno (`development` / `cloud`) | `development` |
| `USE_SQLITE` | Usar SQLite en vez de PostgreSQL | `true` |
| `CELERY_ALWAYS_EAGER` | Tasks síncronos | `true` |
| `EMAIL_HOST_USER` | Gmail para envío de emails | — |
| `EMAIL_HOST_PASSWORD` | App password de Gmail | — |
| `FRONTEND_URL` | URL del frontend | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | OAuth Google (opcional) | — |

### Producción (Render)

| Variable | Descripción |
|----------|-------------|
| `DJANGO_ENV` | `cloud` |
| `DJANGO_SECRET_KEY` | Auto-generada |
| `DATABASE_URL` | Auto-vinculada por Render |
| `BREVO_API_KEY` | Email HTTP API |
| `DEFAULT_FROM_EMAIL` | `MCD Agencia <email>` |
| `AWS_ACCESS_KEY_ID` | Cloudflare R2 |
| `AWS_SECRET_ACCESS_KEY` | Cloudflare R2 |
| `AWS_STORAGE_BUCKET_NAME` | Nombre del bucket |
| `AWS_S3_ENDPOINT_URL` | Endpoint R2 |
| `ALLOWED_HOSTS` | Hostname de Render |
| `CORS_ALLOWED_ORIGINS` | URL de Vercel |
| `FRONTEND_URL` | URL pública del frontend |

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para la lista completa.

## Modelos de Datos Principales

### Usuarios y Roles
- **User**: Usuario con autenticación por email
- **Role**: Roles para RBAC (SuperAdmin, Admin, Ventas, Operaciones, Cliente)
- **UserConsent**: Consentimientos legales (GDPR)
- **FiscalData**: Datos fiscales para CFDI

### Catálogo
- **Category**: Categorías jerárquicas (MPTT)
- **Tag**: Etiquetas flexibles
- **Attribute/AttributeValue**: Atributos configurables
- **CatalogItem**: Producto o servicio unificado
- **ProductVariant**: SKU con atributos específicos

### E-commerce
- **Cart/CartItem**: Carrito de compras
- **Order/OrderLine**: Pedidos con FSM de estados
- **Address**: Direcciones de envío/facturación
- **Payment**: Transacciones de pago

### Cotizaciones
- **QuoteRequest**: Solicitud de cotización
- **Quote/QuoteLine**: Cotización con líneas
- **QuoteAttachment**: Archivos adjuntos

### Inventario
- **InventoryMovement**: Movimientos de stock
- **StockAlert**: Alertas de stock bajo

## API Endpoints

### Autenticación
- `POST /api/v1/auth/register/` — Registrar usuario
- `POST /api/v1/auth/token/` — Obtener JWT (login)
- `POST /api/v1/auth/token/refresh/` — Refrescar token
- `POST /api/v1/auth/verify-email/` — Verificar email con token
- `POST /api/v1/auth/resend-verification/` — Reenviar verificación
- `GET /api/v1/auth/google/callback/` — OAuth Google

### Catálogo
- `GET /api/v1/catalog/items/` - Listar productos
- `GET /api/v1/catalog/items/{slug}/` - Detalle de producto
- `GET /api/v1/catalog/categories/` - Categorías

### Pedidos
- `GET /api/v1/orders/` - Mis pedidos
- `POST /api/v1/orders/` - Crear pedido
- `GET /api/v1/orders/{id}/` - Detalle de pedido

### Cotizaciones
- `POST /api/v1/quotes/request/` — Solicitar cotización
- `GET /api/v1/quotes/` — Listar cotizaciones (admin/ventas)
- `POST /api/v1/quotes/` — Crear cotización
- `GET /api/v1/quotes/{id}/` — Detalle de cotización
- `POST /api/v1/quotes/{id}/send/` — Enviar al cliente (email + PDF)
- `GET /api/v1/quotes/public/{token}/` — Vista pública (sin login)
- `POST /api/v1/quotes/public/{token}/accept/` — Aceptar cotización
- `POST /api/v1/quotes/{id}/change-requests/` — Solicitar cambios
- `POST /api/v1/quotes/{id}/duplicate/` — Duplicar cotización
- `GET /api/v1/quotes/{id}/download-pdf/` — Descargar PDF

### Carrito
- `GET /api/v1/cart/` - Ver carrito
- `POST /api/v1/cart/add/` - Agregar item
- `DELETE /api/v1/cart/remove/{id}/` - Eliminar item

## Roles y Permisos

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| SuperAdmin | Acceso total | Todo |
| Admin | Gestión operativa | Todo excepto configuración crítica |
| Ventas | Comercial | Cotizaciones, pedidos, clientes |
| Operaciones | Producción | Inventario, estados de producción |
| Cliente | Usuario final | Compras, sus pedidos/cotizaciones |

## Flujos Principales

### Compra Directa
1. Cliente navega catálogo
2. Agrega productos al carrito
3. Inicia checkout (requiere login)
4. Completa datos y paga
5. Recibe confirmación

### Cotización (RFQ)
1. Cliente envía solicitud
2. Ventas recibe y crea cotización
3. Sistema genera PDF y envía email
4. Cliente revisa y acepta
5. Se convierte en pedido

## Seguridad

- Autenticación JWT con refresh tokens
- Contraseñas hasheadas con algoritmos seguros
- CORS configurado por ambiente
- Headers de seguridad (HSTS, XSS, etc.)
- Validación de entrada en servidor
- Rate limiting en endpoints sensibles
- Auditoría completa de acciones

## Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

## Despliegue

### Producción Actual

| Plataforma | Servicio | Auto-deploy |
|------------|----------|-------------|
| **Render** | Backend + PostgreSQL | ✅ push a `main` |
| **Vercel** | Frontend Next.js | ✅ push a `main` |
| **Cloudflare R2** | Media storage | N/A |
| **Brevo** | Email HTTP API | N/A |

El backend se configura automáticamente vía `render.yaml` (Blueprint).  
Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalles completos.

### Docker (Desarrollo Local)

```bash
docker-compose up -d
```

### Variables de Producción
- `DJANGO_ENV=cloud`
- `DEBUG=false` (automático)
- Ver tabla de variables arriba

## Contribución

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## Documentación

- 📋 [Changelog completo](docs/CHANGELOG.md) — Historial detallado de 107 commits organizados por fases
- 🏗️ [Arquitectura y Despliegue](docs/ARCHITECTURE.md) — Stack, flujos, configuración, diagramas

## Licencia

Propiedad de Agencia MCD. Todos los derechos reservados.

## Soporte

Para soporte técnico, contactar a:
- Email: soporte@agenciamcd.mx
- Tel: +52 744 XXX XXXX
