"""
Context Builder for MCD-Agencia Chatbot.

Builds rich business context from the database to give the AI
accurate, up-to-date information about MCD's products, services,
branches, FAQs, etc.
"""

import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

CONTEXT_CACHE_KEY = 'chatbot_business_context_{lang}'
CONTEXT_CACHE_TTL = 3600  # 1 hour


def build_business_context(language: str = 'es') -> str:
    """
    Build a comprehensive business context string for the AI.

    Pulls from: catalog categories, products, branches, FAQs, services.
    Cached for 1 hour to avoid DB hits on every message.
    """
    cache_key = CONTEXT_CACHE_KEY.format(lang=language)
    cached = cache.get(cache_key)
    if cached:
        return cached

    is_es = language == 'es'
    sections = []

    # --- Company Info ---
    sections.append(_build_company_info(is_es))

    # --- Services ---
    sections.append(_build_services_info(is_es))

    # --- Catalog Summary ---
    sections.append(_build_catalog_info(is_es, language))

    # --- Branches ---
    sections.append(_build_branches_info(is_es))

    # --- FAQs ---
    sections.append(_build_faqs_info(is_es, language))

    context = '\n\n'.join(filter(None, sections))

    cache.set(cache_key, context, CONTEXT_CACHE_TTL)
    return context


def _build_company_info(is_es: bool) -> str:
    """Basic company information."""
    if is_es:
        return """=== INFORMACIÓN DE LA EMPRESA ===
Nombre: Agencia de Publicidad MCD
Sitio web: https://agenciamcd.mx
Giro: Agencia de publicidad integral — fabricación de anuncios, espectaculares, señalización, impresión, rotulación, diseño gráfico y más.
Cobertura: Acapulco, Tecoanapa y todo el estado de Guerrero, México.
Idiomas: Español e Inglés.
Métodos de pago: MercadoPago (tarjetas, OXXO, transferencia) y PayPal.
Modos de venta: Algunos productos son de compra directa en el catálogo, otros requieren cotización personalizada, y algunos ofrecen ambas opciones."""
    else:
        return """=== COMPANY INFORMATION ===
Name: Agencia de Publicidad MCD (MCD Advertising Agency)
Website: https://agenciamcd.mx
Industry: Full-service advertising agency — sign manufacturing, billboards, signage, printing, vehicle wrapping, graphic design, and more.
Coverage: Acapulco, Tecoanapa, and the entire state of Guerrero, Mexico.
Languages: Spanish and English.
Payment methods: MercadoPago (cards, OXXO, bank transfer) and PayPal.
Sales modes: Some products are direct purchase from the catalog, others require a custom quote, and some offer both options."""


def _build_services_info(is_es: bool) -> str:
    """List of services from the content module."""
    try:
        from apps.content.models import Service
        services = Service.objects.filter(is_active=True).order_by('position')

        if not services.exists():
            return _get_default_services(is_es)

        header = '=== SERVICIOS ===' if is_es else '=== SERVICES ==='
        lines = [header]
        for s in services:
            name = s.name if is_es else (s.name_en or s.name)
            desc = s.description if is_es else (s.description_en or s.description)
            lines.append(f'• {name}: {desc[:200]}')
        return '\n'.join(lines)
    except Exception as e:
        logger.debug(f'Could not load services from DB: {e}')
        return _get_default_services(is_es)


def _get_default_services(is_es: bool) -> str:
    """Hardcoded service list as fallback."""
    if is_es:
        return """=== SERVICIOS ===
• Fabricación de Anuncios: Cajas de luz, letras 3D, anuncios 2D, bastidores, toldos, neón.
• Espectaculares: Unipolar, azotea, mural — publicidad exterior de alto impacto.
• Publicidad Móvil: Vallas móviles, publibuses, perifoneo con rutas personalizadas.
• Impresión Gran Formato: Lonas, vinil, tela y más en grandes dimensiones.
• Señalización: Interior, exterior y vial — señalética profesional.
• Rotulación Vehicular: Completa, parcial, vinil recortado, impresión digital.
• Corte/Grabado CNC/Láser: Corte y grabado de precisión en diversos materiales.
• Diseño Gráfico: Logotipos, papelería corporativa, diseño para redes sociales.
• Impresión Offset/Serigrafía: Tarjetas, volantes, folletos y más."""
    else:
        return """=== SERVICES ===
• Sign Manufacturing: Light boxes, 3D letters, 2D signs, frames, awnings, neon.
• Billboards: Unipolar, rooftop, mural — high-impact outdoor advertising.
• Mobile Advertising: Mobile billboards, ad buses, loudspeaker trucks with custom routes.
• Large Format Printing: Banners, vinyl, fabric and more in large dimensions.
• Signage: Interior, exterior and road — professional signage.
• Vehicle Wrapping: Full, partial, cut vinyl, digital printing.
• CNC/Laser Cutting & Engraving: Precision cutting and engraving on various materials.
• Graphic Design: Logos, corporate stationery, social media design.
• Offset/Screen Printing: Business cards, flyers, brochures and more."""


def _build_catalog_info(is_es: bool, language: str) -> str:
    """Summary of active catalog products."""
    try:
        from apps.catalog.models import Category
        categories = Category.objects.filter(is_active=True).order_by('position')

        if not categories.exists():
            return ''

        header = '=== CATEGORÍAS DEL CATÁLOGO ===' if is_es else '=== CATALOG CATEGORIES ==='
        lines = [header]
        for cat in categories[:20]:
            name = cat.name if is_es else (cat.name_en or cat.name)
            product_count = cat.items.filter(is_active=True).count() if hasattr(cat, 'items') else 0
            lines.append(f'• {name} ({product_count} productos)' if is_es else f'• {name} ({product_count} products)')

        url = 'https://agenciamcd.mx/es/catalogo' if is_es else 'https://agenciamcd.mx/en/catalogo'
        lines.append(f'\nURL del catálogo: {url}' if is_es else f'\nCatalog URL: {url}')
        return '\n'.join(lines)
    except Exception as e:
        logger.debug(f'Could not load catalog: {e}')
        return ''


def _build_branches_info(is_es: bool) -> str:
    """Branch/location information."""
    try:
        from apps.content.models import Branch
        branches = Branch.objects.filter(is_active=True).order_by('position')

        if not branches.exists():
            return _get_default_branches(is_es)

        header = '=== SUCURSALES ===' if is_es else '=== BRANCHES ==='
        lines = [header]
        for b in branches:
            address = f'{b.street}, {b.neighborhood}, {b.city}, {b.state}'
            hours = b.hours if is_es else (b.hours_en or b.hours)
            lines.append(f'📍 {b.name}')
            lines.append(f'   Dirección: {address}' if is_es else f'   Address: {address}')
            if b.phone:
                lines.append(f'   Teléfono: {b.phone}' if is_es else f'   Phone: {b.phone}')
            if b.email:
                lines.append(f'   Email: {b.email}')
            if hours:
                lines.append(f'   Horario: {hours}' if is_es else f'   Hours: {hours}')
        return '\n'.join(lines)
    except Exception as e:
        logger.debug(f'Could not load branches: {e}')
        return _get_default_branches(is_es)


def _get_default_branches(is_es: bool) -> str:
    """Hardcoded branch info as fallback."""
    if is_es:
        return """=== SUCURSALES ===
📍 Sucursal Acapulco (Principal)
   WhatsApp: https://wa.me/527446887382
   Horario: Lunes a Viernes 9:00-18:00, Sábados 9:00-14:00

📍 Sucursal Tecoanapa
   WhatsApp: https://wa.me/527451147727
   Horario: Lunes a Viernes 9:00-18:00, Sábados 9:00-14:00"""
    else:
        return """=== BRANCHES ===
📍 Acapulco Branch (Main)
   WhatsApp: https://wa.me/527446887382
   Hours: Monday-Friday 9:00-18:00, Saturday 9:00-14:00

📍 Tecoanapa Branch
   WhatsApp: https://wa.me/527451147727
   Hours: Monday-Friday 9:00-18:00, Saturday 9:00-14:00"""


def _build_faqs_info(is_es: bool, language: str) -> str:
    """Active FAQs from the content module."""
    try:
        from apps.content.models import FAQ
        faqs = FAQ.objects.filter(is_active=True).order_by('category', 'position')[:15]

        if not faqs.exists():
            return ''

        header = '=== PREGUNTAS FRECUENTES ===' if is_es else '=== FREQUENTLY ASKED QUESTIONS ==='
        lines = [header]
        for faq in faqs:
            q = faq.question if is_es else (faq.question_en or faq.question)
            a = faq.answer if is_es else (faq.answer_en or faq.answer)
            lines.append(f'P: {q}')
            lines.append(f'R: {a[:300]}')
            lines.append('')
        return '\n'.join(lines)
    except Exception as e:
        logger.debug(f'Could not load FAQs: {e}')
        return ''
