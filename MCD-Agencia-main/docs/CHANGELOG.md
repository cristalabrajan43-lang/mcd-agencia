# Changelog — MCD-Agencia

Registro completo de todos los cambios realizados en el proyecto desde su creación.

> **107 commits** | 22 de enero — 9 de febrero 2026  
> **Stack**: Django 5 + Next.js 14 + TypeScript + Tailwind CSS  
> **Deploy**: Render (backend) + Vercel (frontend)

---

## Fase 0 — Inicio del Proyecto (22 – 28 Ene 2026)

| Commit | Fecha | Descripción |
|--------|-------|-------------|
| `2935256` | 22 Ene | **Initial commit** — Plataforma e-commerce completa: Django REST backend con 11 apps (users, catalog, orders, quotes, inventory, audit, content, payments, notifications, chatbot, core), Next.js 14 frontend con App Router, i18n (ES/EN), Tailwind CSS, Zustand + React Query, autenticación JWT + Google OAuth |
| `9ef1077` | 25 Ene | Fix: Corregir URLs de API y agregar endpoint admin quote-requests |
| `fd3c64b` | 26 Ene | Reemplazo de ícono de pulpo por ícono de chat normal en el chatbot |
| `18306a4` | 28 Ene | Merge cambios de colores-logo para pasar a rama principal |

---

## Fase 1 — Despliegue a Producción (7 Feb 2026, mañana)

Configuración completa para hosting gratuito: Render (backend + PostgreSQL) + Vercel (frontend).

| Commit | Descripción |
|--------|-------------|
| `3cab78a` | **Configuración de producción y cloud**: `cloud.py` settings, `render.yaml` blueprint, `docker-compose.prod.yml`, `build.sh` |
| `117080d` | Consolidar a 2 plataformas (Render + Vercel), eliminar configuraciones innecesarias |
| `4fe20e7` | Manejar `ALLOWED_HOSTS` vacío + dependencias de sistema de WeasyPrint para Render |
| `9d13929` | Renombrar `Dockerfile` a `Dockerfile.prod` para evitar auto-detección Docker en Render |
| `2741105` | Hacer `build.sh` ejecutable (`chmod +x`) |
| `4fa8e6b` | Importar explícitamente `_INSECURE_SECRET_KEY` (import * omite nombres con `_`) |
| `905162a` | Agregar paquete `cryptography` (requerido por allauth Google OAuth) |
| `ae20cb1` | Agregar archivos `frontend/src/lib/` que estaban en .gitignore por regla `lib/` |
| `3e3b9cb` | Coerción de `cannotCreateForRequest` a boolean para tipo de prop `disabled` |
| `3312fbf` | Cast de `amount` a `Number()` para `Intl.NumberFormat.format()` |
| `8b43942` | Resolver todos los errores de TypeScript para build de Vercel |
| `dd83e65` | CSP `connect-src` usa origin, fix de doble `/api/v1` en ChatWidget |
| `ad929c6` | `build.sh` crea roles por defecto y asigna rol admin al superusuario |

---

## Fase 2 — Branding y UI Base (7 Feb 2026, tarde)

| Commit | Descripción |
|--------|-------------|
| `5477c32` | **Unificar rutas** `/admin/` y `/ventas/` en una sola ruta `/dashboard/` |
| `dd3bb9b` | Reemplazar todos los logos con nueva marca **MCD Diseño** + favicon, apple-touch-icon, íconos PWA y webmanifest |
| `c31b5e5` | Duplicar tamaño del logo en todos los componentes |
| `e1c6004` | Recortar espacio blanco del logo y establecer tamaños armoniosos |
| `42da03d` | Fix sistema de auditoría — URL de API, interfaz TypeScript, nombres de campos |
| `61a85cc` | Reemplazar grid de portafolio con video de YouTube lazy-loaded (patrón facade) |
| `222a6c3` | Sección de portafolio con 2 YouTube Shorts verticales lado a lado |
| `9829ab6` | Ocultar labels de video, regenerar favicon (35KB multi-size), rediseñar glows de fondo como filas alternadas |
| `61b5a64` | Metadata de favicon con array de sizes, z-index para glow vs contenido |

---

## Fase 3 — CMS y Gestión de Contenido (7 Feb 2026, tarde-noche)

| Commit | Descripción |
|--------|-------------|
| `d695754` | **Sistema CMS completo** para gestión de contenido del landing: servicios, portafolio, testimonios, videos, carruseles |
| `814f1e2` | Refactorizar CMS admin + mejoras UX del landing |
| `59f7f57` | Fix display de posición, omitir paginación para endpoints públicos, filtrar imágenes nulas |
| `e062718` | Servir media en producción, fix creación de video 400, mostrar errores de servidor |

---

## Fase 4 — Almacenamiento en la Nube (7 Feb 2026, noche)

Configuración de Cloudflare R2 para almacenamiento persistente de archivos.

| Commit | Descripción |
|--------|-------------|
| `54ba6ac` | Configurar **Cloudflare R2** para almacenamiento persistente de media |
| `8c09bc6` | Mejorar config R2 — `MEDIA_URL` para acceso público, env vars en `render.yaml`, warning de storage efímero |
| `5e75c98` | Usar dominio personalizado para R2 en vez de `r2.dev` (evita error Cloudflare 1010) |
| `6c159cd` | Usar URLs presignadas para R2 para bypass de Cloudflare Bot Fight Mode |
| `d7353b8` | Aumentar expiración de URLs presignadas a 7 días para mejor caching CDN |
| `25db04e` – `28ead7b` | Endpoints temporales de debug para diagnosticar URLs presignadas R2 |
| `fda2e4e` | Usar dict `STORAGES` de Django 5.0+ en vez del deprecado `DEFAULT_FILE_STORAGE` |
| `911c456` | Limpiar endpoints temporales de debug de storage |

---

## Fase 5 — Imágenes de Servicios y Lightbox (7-8 Feb 2026)

| Commit | Descripción |
|--------|-------------|
| `b9e9307` | Lightbox: limpiar header, click-fuera-para-cerrar en imágenes fullscreen |
| `9005faa` | Lightbox: aumentar clearance de header de `pt-16` a `pt-24` |
| `ca913c7` | Lightbox: click-fuera-para-cerrar + botón X visible |
| `d06f0f1` | Lightbox: usar `<img>` nativo para click-fuera-para-cerrar preciso |
| `dbb2097` | **Auto-sync 9 servicios** + gestión de imágenes por subtipo |
| `df47381` | Mostrar los 9 servicios en landing en vez de 5 |
| `e33bf90` | Fix imágenes CMS no mostrándose en landing — `prefetch_related` con `Prefetch`, evitar N+1 queries |
| `07f93b0` | Agregar traducciones faltantes de subcategorías (anuncios2d, bastidores, toldos) |
| `121b9e7` | Reemplazar `next/image fill` con `<img>` nativo para carrusel de servicios (fix de compatibilidad de browsers) |
| `ca929db` | Endpoint temporal de diagnóstico DB para registros ServiceImage |
| `1903a9c` | Fix bug `is_active=False` en imágenes — default=True en serializer, enviar `is_active` en FormData, endpoint de activación |
| `76a9e42` | Limpiar endpoint temporal de debug |
| `a43654c` | Sincronizar todos los carruseles de servicios e intervalo a 6 segundos |

---

## Fase 6 — Diseño de Autenticación (8 Feb 2026, madrugada)

| Commit | Descripción |
|--------|-------------|
| `979e45d` | **Rediseño de layout de auth** — logo a la izquierda, formulario a la derecha, más ancho, sin scroll |
| `a1d8b3a` | Logo más grande, mensaje motivacional, sin fondo, registro más ancho, contraseña y confirmar en fila |
| `3e7750a` | Ajuste de márgenes, frase motivacional para login/signup |
| `47f1e70` | Teléfono y fecha de nacimiento en una fila, mejor ajuste vertical |
| `c7cb435` | Layout de registro sin scroll, separación arriba y abajo, centrado |
| `ef2c636` | Helper text de registro, texto de contraseña más pequeño |
| `5f77720` | Fix página de login: centrado vertical y error de sintaxis |
| `851b613` – `f83e413` | Serie de ajustes de ancho del login (900px → 820px → 768px → 680px) |

---

## Fase 7 — Ajustes de Landing y Catálogo (8 Feb 2026, mañana)

| Commit | Descripción |
|--------|-------------|
| `4ec3349` | Corregir coordenadas de Diamante y Costa Azul, mejorar embed de mapa |
| `dceab2e` | Unificar botones amarillos a `yellow-400` consistentemente |
| `0154c11` | Sincronizar subtipos del formulario de cotización con sección de servicios |
| `160b443` | Cambiar tipos de servicio: Offset/Serigrafía/Sublimación → Tarjetas de Presentación, Volantes y Otro |
| `d24a336` | Revertir nombre a Impresión Offset/Serigrafía, agregar subtipo "Otro" a todos los servicios |

---

## Fase 8 — Mobile/Responsive y UX (8 Feb 2026, mediodía)

| Commit | Descripción |
|--------|-------------|
| `dbcda4f` | Fix "Failed to Fetch" en subida de imágenes |
| `c39bd5a` | Footer ya no se oculta detrás del sidebar del dashboard en desktop |
| `94bbdec` | **Auditoría completa mobile/responsive**: scroll lock con `dvh`, grids responsive (`grid-cols-1 sm:grid-cols-2/3`), `overscroll-contain` en modales, padding progresivo en QuoteForm |
| `a4573b5` | UX de modal de servicios en mobile, z-index de menú header, alineación de hamburguesa en dashboard |
| `ff432b0` | Mover sidebar del dashboard de izquierda a derecha |

---

## Fase 9 — Analytics y OAuth (8 Feb 2026, mediodía)

| Commit | Descripción |
|--------|-------------|
| `0dd6ab4` | **Sistema completo de analytics/tracking** reemplazando módulo de leads |
| `4f88b8b` | Fix Google OAuth: redirect de página de registro a JWT callback en vez de locale |

---

## Fase 10 — Email y PDF en Producción (8 Feb 2026, tarde)

| Commit | Descripción |
|--------|-------------|
| `15f9dc9` | Velocidad de envío de email de cotización + reemplazar toasts con `SuccessModal` |
| `b096502` | Comando temporal `resend_quotes` management |
| `7781b4f` | Endpoint temporal de reenvío (eliminar después de uso) |
| `7e8b9df` | Agregar **Resend** como backend de email HTTP para Render free tier |
| `33f43f1` | Agregar **Brevo** como backend de email primario (no requiere dominio) |
| `018829a` | Limpiar endpoint temporal de reenvío y management command |
| `6b9799d` | Fix inyección de script de Clarity via `useEffect` en vez de `next/script` |
| `f659a73` | Descarga de PDF compatible con almacenamiento en la nube (R2/S3) |
| `0282809` | Fix descarga de PDF — `bind=True` direct call + token refresh |
| `6374333` | Fix violación de orden de hooks en páginas de editar/crear cotización |
| `b2eab2a` | Sidebar izquierdo en desktop, diagnóstico PDF + manejo robusto de errores |
| `141d283` | **Generación de PDF** — bypass de Celery broker (Redis no disponible) |
| `59e2922` | Usar **ReportLab** directamente para PDF (omitir template de WeasyPrint) |
| `20cbb69` | Logo oscuro en PDFs de cotización para visibilidad en papel blanco |

---

## Fase 11 — Cotizaciones y Duplicados (8 Feb 2026, tarde)

| Commit | Descripción |
|--------|-------------|
| `d761d7c` | Duplicar cotización copia **TODOS** los campos + agregar hora a todas las fechas mostradas |
| `b3a553c` | Snippet oficial de Clarity (init queue antes de script load) |
| `78eb970` | Agregar dominios de Clarity y Facebook Pixel a CSP policy |
| `878e6c0` | Usar wildcard `*.clarity.ms` en CSP `script-src` para todos los subdominios |

---

## Fase 12 — Mejoras Masivas del Sistema (8 Feb 2026, tarde-noche)

### 10 Mejoras de Workflow de Cotizaciones (`573ac48`)

1. Token público y URL compartible para cotizaciones
2. Vista pública de cotización (sin login)
3. Aceptar/rechazar cotización desde vista pública
4. Campo de notas del cliente al aceptar
5. Página de preview antes de enviar cotización
6. Envío de email con PDF adjunto automático
7. Indicador visual de estado (borrador/enviado/aceptado/rechazado/expirado)
8. Historial de versiones de cotización
9. Duplicar cotización existente
10. Filtros y búsqueda mejorados en listado

### 12 Mejoras del Sistema A-L (`17303f1`)

1. **(A)** Dashboard admin con estadísticas en tiempo real y gráficas
2. **(B)** Perfil de usuario editable con cambio de contraseña
3. **(C)** Tema oscuro/claro con toggle
4. **(D)** Breadcrumbs de navegación en dashboard
5. **(E)** Exportar tablas a CSV/Excel
6. **(F)** Búsqueda global en dashboard
7. **(G)** Indicadores de estado con colores en tablas
8. **(H)** Paginación mejorada con selector de filas por página
9. **(I)** Confirmación antes de acciones destructivas
10. **(J)** Loading skeletons en todas las tablas
11. **(K)** Mensajes de error informativos (no genéricos)
12. **(L)** Responsive mejorado en todas las tablas del dashboard

---

## Fase 13 — UX Polish (8 Feb 2026, noche)

| Commit | Descripción |
|--------|-------------|
| `32d3a34` | Eliminar flash de imagen fallback en carga del landing |
| `9e6f422` | **4 mejoras UX**: campos de solicitud de cambios, acciones mobile, limpieza dashboard, carrusel de video |
| `01245c3` | Fix tags duplicados cerrándose causando error de sintaxis de build |

---

## Fase 14 — Sistema de Notificaciones (8 Feb 2026, noche)

| Commit | Descripción |
|--------|-------------|
| `bc356bb` | Leads→Analítica en header, Acciones como 1ra columna, NotificationBell en UnifiedHeader |
| `64332ff` | **NotificationBell** visible en mobile junto al menú hamburguesa |
| `d31de29` | Mover NotificationBell junto al ícono de usuario en desktop, unificar estilo del dropdown |
| `a5ff712` | **Sistema completo de notificaciones** en backend: modelo `Notification`, endpoints CRUD, notificaciones automáticas para nuevas cotizaciones, pedidos, solicitudes de cambio, usuarios |

---

## Fase 15 — Solicitudes de Cambio (8 Feb 2026, noche)

| Commit | Descripción |
|--------|-------------|
| `e1f5860` | **Flujo de solicitud de cambios mejorado**: mini-cotizador inline, teléfono en solicitudes, imágenes adjuntas |
| `a5f9915` | Fix 3 bugs en editor de cambios: cantidad, edición y envío |
| `208cbcc` | Fix error al aprobar solicitud de cambios (`get_full_name` → `full_name`) |

---

## Fase 16 — Editor de Cotizaciones (9 Feb 2026, madrugada)

| Commit | Descripción |
|--------|-------------|
| `90c082c` | Fix precios de líneas se perdían al editar cotización + **modal de confirmación** al enviar cotización |

---

## Fase 17 — Registro y Verificación de Email (9 Feb 2026)

Serie de fixes críticos para el flujo completo de registro → verificación → login.

| Commit | Descripción |
|--------|-------------|
| `5269fce` | **3 bugs de registro**: (1) `send_verification_email` llamaba método inexistente `generate_verification_token()` y campo incorrecto `email_verified` → `is_email_verified`, (2) teléfono ahora obligatorio, (3) fecha de nacimiento cortada en mobile (`grid-cols-1 sm:grid-cols-2`) |
| `983764d` | Registro atómico con `transaction.atomic()` + **banner de email duplicado** con links a login/recuperación |
| `5e198e6` | **Fix cadena de errores**: (1) exception handler usa primer error de campo como mensaje, (2) apiClient desenvuelve envelope de error personalizado, (3) serializer sobreescribe `UniqueValidator.message` |
| `6ef6006` | **Fix login sin verificar**: banner amarillo en español "Debes verificar tu correo" con botón "Reenviar correo de verificación" |
| `b0465b4` | Fix crash al reenviar verificación + **crear página `/verificar-email`** + URLs locale-aware (`/{lang}/verificar-email?token=...`) |
| `34f5acb` | Endpoint temporal de diagnóstico de email + mejor logging de errores |
| `baf0ddc` | Eliminar endpoint temporal, mantener logging mejorado de errores en tasks de email |

### Detalles técnicos de verificación de email

- **Token**: Django signing framework con expiración de 24 horas, salt `email-verification`
- **Métodos agregados a User**: `generate_verification_token()`, `verify_email_token()` (classmethod)
- **Task Celery**: `send_verification_email` envía HTML email con template `emails/verify_email.html`
- **Frontend**: Página `verificar-email` con 3 estados (loading/success/error)
- **Error handling**: `try/except` alrededor de todos los `delay()` para evitar crashes silenciosos
- **Email backend en producción**: Brevo HTTP API vía `django-anymail` (300 emails gratis/día)

---

## Resumen Técnico

### Arquitectura de Producción

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│   Vercel         │────▶│  Render           │────▶│ PostgreSQL    │
│   (Frontend)     │     │  (Backend API)    │     │ (Render free) │
│   Next.js 14     │     │  Django 5 +       │     └───────────────┘
│   TypeScript     │     │  Gunicorn         │
│   Tailwind CSS   │     │  Celery (eager)   │     ┌───────────────┐
└─────────────────┘     │                    │────▶│ Cloudflare R2 │
                         └──────────────────┘     │ (Media files) │
                                │                  └───────────────┘
                                │
                         ┌──────▼──────────┐
                         │  Brevo API       │
                         │  (Email HTTP)    │
                         │  300/day free    │
                         └─────────────────┘
```

### Apps Django

| App | Descripción |
|-----|-------------|
| `core` | Modelos base, paginación, excepciones, recaptcha |
| `users` | Usuarios, roles RBAC, OAuth Google, verificación email, datos fiscales |
| `catalog` | Categorías (MPTT), productos, variantes, atributos, imágenes |
| `orders` | Pedidos con FSM de estados, líneas, direcciones |
| `quotes` | Cotizaciones con PDF, tokens públicos, solicitudes de cambio |
| `inventory` | Movimientos de stock, alertas de bajo inventario |
| `payments` | Mercado Pago, PayPal, confirmación de pago |
| `audit` | Bitácora de auditoría completa con middleware |
| `content` | CMS: servicios, portafolio, videos, testimonios |
| `notifications` | Notificaciones in-app para admin/ventas/clientes |
| `chatbot` | Chatbot de atención y captura de leads |

### Variables de Entorno en Producción (Render)

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DJANGO_ENV` | `cloud` | ✅ |
| `DJANGO_SECRET_KEY` | Auto-generada por Render | ✅ |
| `DATABASE_URL` | Auto-vinculada por Render | ✅ |
| `ALLOWED_HOSTS` | `mcd-agencia-api.onrender.com` | ✅ |
| `CORS_ALLOWED_ORIGINS` | URL de Vercel | ✅ |
| `CSRF_TRUSTED_ORIGINS` | URL de Vercel | ✅ |
| `FRONTEND_URL` | `https://agenciamcd.mx` | ✅ |
| `BREVO_API_KEY` | API key de Brevo (email HTTP) | ✅ |
| `DEFAULT_FROM_EMAIL` | `MCD Agencia <email>` | ✅ |
| `AWS_ACCESS_KEY_ID` | Cloudflare R2 access key | ✅ |
| `AWS_SECRET_ACCESS_KEY` | Cloudflare R2 secret | ✅ |
| `AWS_STORAGE_BUCKET_NAME` | Nombre del bucket R2 | ✅ |
| `AWS_S3_ENDPOINT_URL` | Endpoint R2 | ✅ |
| `GOOGLE_CLIENT_ID` | OAuth Google | Opcional |
| `GOOGLE_CLIENT_SECRET` | OAuth Google | Opcional |
| `MERCADOPAGO_ACCESS_TOKEN` | Mercado Pago | Prod |
| `PAYPAL_CLIENT_ID` | PayPal | Prod |
| `SENTRY_DSN` | Sentry para monitoreo | Opcional |

### Dependencias Principales

**Backend (Python)**:
- Django 5.0, DRF, SimpleJWT, django-allauth, django-anymail
- Celery (modo eager en cloud, sin Redis), ReportLab (PDF)
- boto3 + django-storages (Cloudflare R2), psycopg2 (PostgreSQL)
- Gunicorn + WhiteNoise (producción)

**Frontend (Node.js)**:
- Next.js 14.1.0, React 18.2, TypeScript 5.3
- Tailwind CSS 3.4, Framer Motion, Embla Carousel
- React Query 5, Zustand 4, React Hook Form + Zod
- next-intl 3.4 (i18n ES/EN), Lucide React (iconos)
