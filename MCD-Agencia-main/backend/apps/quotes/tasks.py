"""
Celery Tasks for Quotes App.

This module contains asynchronous tasks for quote management:
    - PDF quote generation
    - Quote notification emails
    - Quote expiration handling
    - Reminder emails for pending quotes
"""

import logging
from datetime import timedelta
from io import BytesIO

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMessage, send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


@shared_task(
    max_retries=2,
    default_retry_delay=5,
)
def generate_quote_pdf(quote_id: str, language: str = 'es') -> str:
    """
    Generate PDF document for a quote.

    Uses ReportLab to generate professional PDF quotes.
    Supports language='es' (Spanish, default) or 'en' (English).

    Args:
        quote_id: UUID of the quote.

    Returns:
        str: Path to the generated PDF file.
    """
    from apps.quotes.models import Quote

    # I18n labels
    is_en = language == 'en'
    LBL = {
        'title': 'QUOTATION' if is_en else 'COTIZACIÓN',
        'client': 'Client' if is_en else 'Cliente',
        'email': 'Email',
        'company': 'Company' if is_en else 'Empresa',
        'date': 'Date' if is_en else 'Fecha',
        'valid_until': 'Valid until' if is_en else 'Válido hasta',
        'status': 'Status' if is_en else 'Estado',
        'detail_title': 'QUOTATION DETAILS' if is_en else 'DETALLE DE LA COTIZACIÓN',
        'concept': 'Concept' if is_en else 'Concepto',
        'description': 'Description' if is_en else 'Descripción',
        'qty': 'Qty.' if is_en else 'Cant.',
        'unit_price': 'Unit Price' if is_en else 'P. Unitario',
        'total_col': 'Total',
        'subtotal': 'Subtotal',
        'notes': 'NOTES' if is_en else 'NOTAS',
        'footer_company': 'MCD Agencia | Acapulco, Guerrero, México',
        'footer_prices': 'Prices in MXN. This document is not a tax receipt.' if is_en else 'Precios en MXN. Este documento no es un comprobante fiscal.',
        'footer_contact': f'For any questions, contact us: {settings.DEFAULT_FROM_EMAIL}' if is_en else f'Para cualquier duda, contáctenos: {settings.DEFAULT_FROM_EMAIL}',
        'page': 'Page' if is_en else 'Página',
    }

    try:
        # Use ReportLab for PDF generation (reliable, no system deps, no template issues)
        # WeasyPrint HTML template needs rewrite to match current models — TODO for later
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.lib.colors import HexColor
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, KeepTogether
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        from reportlab.pdfgen import canvas
        import os

        quote = Quote.objects.select_related(
            'quote_request', 'created_by'
        ).prefetch_related(
            'lines', 'lines__pickup_branch',
            'quote_request__services',
        ).get(id=quote_id)

        # Professional ReportLab PDF with brand colors
        buffer = BytesIO()

        # Brand colors
        CYAN = HexColor('#0DA3EF')
        MAGENTA = HexColor('#EC2D8D')
        BLACK = HexColor('#141414')
        GRAY = HexColor('#666666')
        LIGHT_GRAY = HexColor('#F5F5F5')
        WHITE = colors.white

        # Page dimensions
        page_width, page_height = letter
        margin_left = 0.75 * inch
        margin_right = 0.75 * inch
        margin_top = 0.5 * inch
        margin_bottom = 1.2 * inch  # Extra space for fixed footer

        # Create document with extra bottom margin for footer
        pdf_title = f"{'Quotation' if is_en else 'Cotización'} {quote.quote_number}"
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=margin_right,
            leftMargin=margin_left,
            topMargin=margin_top,
            bottomMargin=margin_bottom,
            title=pdf_title,
            author='MCD Agencia',
            subject=f"{'Quotation' if is_en else 'Cotización'} {quote.quote_number} - {quote.customer_name}",
            creator='MCD Agencia - agenciamcd.mx',
            displayDocTitle=True,
        )

        # Styles
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name='CompanyName',
            fontSize=24,
            fontName='Helvetica-Bold',
            textColor=BLACK,
            spaceAfter=6
        ))
        styles.add(ParagraphStyle(
            name='QuoteTitle',
            fontSize=14,
            fontName='Helvetica-Bold',
            textColor=CYAN,
            spaceAfter=20
        ))
        styles.add(ParagraphStyle(
            name='SectionTitle',
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=BLACK,
            spaceBefore=15,
            spaceAfter=8
        ))
        styles.add(ParagraphStyle(
            name='CustomerInfo',
            fontSize=10,
            fontName='Helvetica',
            textColor=GRAY,
            leading=14
        ))
        styles.add(ParagraphStyle(
            name='Footer',
            fontSize=8,
            fontName='Helvetica',
            textColor=GRAY,
            alignment=TA_CENTER
        ))

        elements = []
        width, height = letter
        content_width = width - 1.5 * inch

        # =====================================================================
        # HEADER SECTION - Company Info and Quote Number
        # =====================================================================

        # Try to load dark logo (for white paper) from various locations
        possible_logo_paths = [
            os.path.join(settings.STATIC_ROOT or '', 'images', 'logo_dark.png'),
            os.path.join(settings.BASE_DIR, 'static', 'images', 'logo_dark.png'),
            os.path.join(settings.STATIC_ROOT or '', 'images', 'logo.png'),
            os.path.join(settings.BASE_DIR, 'static', 'images', 'logo.png'),
        ]
        logo_path = None
        for path in possible_logo_paths:
            if os.path.exists(path):
                logo_path = path
                break
        has_logo = logo_path is not None

        if has_logo:
            try:
                logo = Image(logo_path, width=120, height=60)
                header_data = [
                    [logo, '', Paragraph(LBL['title'], styles['QuoteTitle'])],
                    ['', '', Paragraph(f'<b>#{quote.quote_number}</b>', ParagraphStyle(
                        'QuoteNum', fontSize=12, fontName='Helvetica-Bold', textColor=BLACK, alignment=TA_RIGHT
                    ))],
                ]
            except Exception:
                has_logo = False

        if not has_logo:
            header_data = [
                [Paragraph('<b>MCD AGENCIA</b>', styles['CompanyName']), '', Paragraph(LBL['title'], styles['QuoteTitle'])],
                [Paragraph('Acapulco, Guerrero', styles['CustomerInfo']), '', Paragraph(f'<b>#{quote.quote_number}</b>', ParagraphStyle(
                    'QuoteNum', fontSize=12, fontName='Helvetica-Bold', textColor=BLACK, alignment=TA_RIGHT
                ))],
            ]

        header_table = Table(header_data, colWidths=[2 * inch, content_width - 4 * inch, 2 * inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ]))
        elements.append(header_table)

        # Cyan divider line
        elements.append(Spacer(1, 10))
        divider_data = [['']]
        divider = Table(divider_data, colWidths=[content_width])
        divider.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 3, CYAN),
        ]))
        elements.append(divider)
        elements.append(Spacer(1, 15))

        # =====================================================================
        # CUSTOMER INFO AND QUOTE DATE SECTION
        # =====================================================================

        date_str = quote.created_at.strftime('%d/%m/%Y') if quote.created_at else timezone.now().strftime('%d/%m/%Y')
        valid_str = quote.valid_until.strftime('%d/%m/%Y') if quote.valid_until else 'N/A'

        customer_info = f"""<b>{LBL['client']}:</b> {quote.customer_name or 'N/A'}<br/>
        <b>{LBL['email']}:</b> {quote.customer_email or 'N/A'}<br/>
        <b>{LBL['company']}:</b> {quote.customer_company or 'N/A'}"""

        quote_info = f"""<b>{LBL['date']}:</b> {date_str}<br/>
        <b>{LBL['valid_until']}:</b> {valid_str}<br/>
        <b>{LBL['status']}:</b> {quote.get_status_display()}"""

        info_data = [
            [Paragraph(customer_info, styles['CustomerInfo']), Paragraph(quote_info, ParagraphStyle(
                'QuoteInfo', fontSize=10, fontName='Helvetica', textColor=GRAY, leading=14, alignment=TA_RIGHT
            ))],
        ]
        info_table = Table(info_data, colWidths=[content_width / 2, content_width / 2])
        info_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('BOX', (0, 0), (-1, -1), 1, colors.Color(0.9, 0.9, 0.9)),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 20))

        # =====================================================================
        # LINE ITEMS TABLE — grouped by service with delivery info
        # =====================================================================

        elements.append(Paragraph(LBL['detail_title'], styles['SectionTitle']))

        # Style for table cells (allows text wrapping)
        cell_style = ParagraphStyle(
            'TableCell',
            fontSize=9,
            fontName='Helvetica',
            leading=11,
            textColor=BLACK
        )
        cell_style_right = ParagraphStyle(
            'TableCellRight',
            fontSize=9,
            fontName='Helvetica',
            leading=11,
            textColor=BLACK,
            alignment=TA_RIGHT
        )
        cell_style_center = ParagraphStyle(
            'TableCellCenter',
            fontSize=9,
            fontName='Helvetica',
            leading=11,
            textColor=BLACK,
            alignment=TA_CENTER
        )

        # Delivery method labels
        DELIVERY_LABELS = {
            'installation': 'Instalación en sitio' if not is_en else 'On-site installation',
            'pickup': 'Recolección en sucursal' if not is_en else 'Branch pickup',
            'shipping': 'Envío' if not is_en else 'Shipping',
            'digital': 'Entrega digital' if not is_en else 'Digital delivery',
            'not_applicable': 'No aplica' if not is_en else 'N/A',
        }
        LBL_SHIPPING = 'Shipping' if is_en else 'Envío'
        LBL_DELIVERY = 'Delivery' if is_en else 'Entrega'
        LBL_EST_DATE = 'Estimated date' if is_en else 'Fecha estimada'
        LBL_EST_END = 'Estimated end date' if is_en else 'Fecha de fin estimada'
        LBL_SHIPPING_PRICE = 'Shipping Price' if is_en else 'Precio de envío'

        # Helper: build description text from service_details JSON
        def build_description_from_details(details, request_service=None):
            """Build human-readable description from service_details dict.

            Includes all service parameters and optionally the required_date
            and customer comments from the matching QuoteRequestService.
            """
            if not details or not isinstance(details, dict):
                return ''
            DETAIL_LABELS = {
                'tipo': 'Tipo' if not is_en else 'Type',
                'subtipo': 'Subtype' if is_en else 'Subtipo',
                'tipo_anuncio': 'Type' if is_en else 'Tipo de anuncio',
                'tipo_vehiculo': 'Vehicle' if is_en else 'Tipo de vehículo',
                'tipo_rotulacion': 'Wrap type' if is_en else 'Tipo de rotulación',
                'tipo_diseno': 'Design type' if is_en else 'Tipo de diseño',
                'tipo_impresion': 'Print type' if is_en else 'Tipo de impresión',
                'tipo_servicio': 'Service type' if is_en else 'Tipo de servicio',
                'material': 'Material',
                'medidas': 'Dimensions' if is_en else 'Medidas',
                'cantidad': 'Quantity' if is_en else 'Cantidad',
                'uso': 'Usage' if is_en else 'Uso',
                'producto': 'Product' if is_en else 'Producto',
                'numero_piezas': 'Pieces' if is_en else 'Número de piezas',
                'duracion': 'Duration' if is_en else 'Duración',
                'tiempo_exhibicion': 'Exhibition time' if is_en else 'Tiempo en exhibición',
                'tiempo_campana': 'Campaign time' if is_en else 'Tiempo de campaña',
                'duracion_campana': 'Campaign duration' if is_en else 'Duración de campaña',
                'meses_campana': 'Campaign months' if is_en else 'Meses de campaña',
                'zona': 'Zone' if is_en else 'Zona',
                'zona_cobertura': 'Coverage zone' if is_en else 'Zona de cobertura',
                'ciudad_zona': 'City / Zone' if is_en else 'Ciudad / Zona',
                'ubicacion': 'Location' if is_en else 'Ubicación',
                'descripcion': 'Description' if is_en else 'Descripción',
                'servicio': 'Service' if is_en else 'Servicio',
                # Boolean flags
                'impresion_incluida': 'Print included' if is_en else 'Impresión incluida',
                'instalacion_incluida': 'Installation included' if is_en else 'Instalación incluida',
                'diseno_incluido': 'Design included' if is_en else 'Diseño incluido',
                'archivo_listo': 'File ready' if is_en else 'Archivo listo',
                'iluminacion': 'Lighting' if is_en else 'Iluminación',
                'requiere_grabacion': 'Recording needed' if is_en else 'Requiere grabación',
                'cambios_incluidos': 'Changes included' if is_en else 'Cambios incluidos',
                'archivo_grabacion': 'Recording file provided' if is_en else 'Archivo de grabación proporcionado',
                'delimitacion_zona': 'Zone delimitation' if is_en else 'Delimitación de zona',
            }
            SKIP_KEYS = {'service_type', 'tipo_personalizado', 'material_personalizado',
                         'producto_personalizado', 'subtipo_personalizado',
                         'tipo_rotulacion_personalizado', 'tipo_impresion_personalizado',
                         'rutas', 'coordenadas', 'ruta', 'ruta_preestablecida',
                         'punto_a', 'punto_b', 'distancia_metros', 'duracion_segundos',
                         'rutas_vallas', 'rutas_publibuses', 'rutas_perifoneo'}
            parts = []
            for key, val in details.items():
                if key in SKIP_KEYS or val is None or val == '':
                    continue
                # Skip complex objects (dicts, lists) — they're handled separately
                if isinstance(val, (dict, list)):
                    continue
                label = DETAIL_LABELS.get(key, key.replace('_', ' ').capitalize())
                if isinstance(val, bool):
                    parts.append(f"{label}: {'Sí' if not is_en else 'Yes'}" if val else f"{label}: No")
                elif isinstance(val, str) and val.lower() in ('si', 'sí'):
                    parts.append(f"{label}: Sí")
                elif isinstance(val, str) and val.lower() == 'no':
                    parts.append(f"{label}: No")
                else:
                    parts.append(f"{label}: {val}")
            # Append required_date and customer comments from request service
            if request_service:
                if request_service.required_date:
                    lbl_req = 'Required date' if is_en else 'Fecha requerida'
                    parts.append(f"{lbl_req}: {request_service.required_date.strftime('%d/%m/%Y')}")
                if request_service.description:
                    lbl_comments = 'Customer comments' if is_en else 'Comentarios del cliente'
                    parts.append(f"{lbl_comments}: {request_service.description}")
            return '<br/>'.join(parts)

        def build_route_description(route, route_index):
            """Build description for a single publicidad-movil route."""
            parts = []
            # Pre-established route (publibuses)
            ruta_pre = route.get('ruta_preestablecida')
            if ruta_pre:
                lbl = 'Preset route' if is_en else 'Ruta preestablecida'
                parts.append(f"{lbl}: {ruta_pre}")
            # Route geo info — old format (coordenadas dict)
            coordenadas = route.get('coordenadas') or {}
            if coordenadas:
                inicio = coordenadas.get('inicio') or {}
                fin = coordenadas.get('fin') or {}
                if inicio.get('nombre'):
                    lbl = 'Route start' if is_en else 'Inicio'
                    parts.append(f"{lbl}: {inicio['nombre']}")
                if fin.get('nombre'):
                    lbl = 'Route end' if is_en else 'Fin'
                    parts.append(f"{lbl}: {fin['nombre']}")
                dist = coordenadas.get('distancia')
                if dist:
                    km = dist / 1000 if dist > 100 else dist
                    lbl = 'Distance' if is_en else 'Distancia'
                    parts.append(f"{lbl}: {km:.1f} km")
            # Route geo info — new format (ruta object with punto_a/punto_b)
            ruta_obj = route.get('ruta')
            if isinstance(ruta_obj, dict):
                pa = ruta_obj.get('punto_a') or {}
                pb = ruta_obj.get('punto_b') or {}
                if isinstance(pa, dict) and pa.get('name'):
                    lbl = 'Route start' if is_en else 'Inicio'
                    parts.append(f"{lbl}: {pa['name']}")
                if isinstance(pb, dict) and pb.get('name'):
                    lbl = 'Route end' if is_en else 'Fin'
                    parts.append(f"{lbl}: {pb['name']}")
                dist_m = ruta_obj.get('distancia_metros')
                if dist_m:
                    km = dist_m / 1000 if dist_m >= 1000 else dist_m / 1000
                    lbl = 'Distance' if is_en else 'Distancia'
                    parts.append(f"{lbl}: {km:.1f} km")
            elif isinstance(ruta_obj, str) and ruta_obj:
                lbl = 'Route' if is_en else 'Ruta'
                parts.append(f"{lbl}: {ruta_obj}")
            # Schedule
            if route.get('horario_inicio'):
                lbl = 'Start time' if is_en else 'Horario inicio'
                parts.append(f"{lbl}: {route['horario_inicio']}")
            if route.get('horario_fin'):
                lbl = 'End time' if is_en else 'Horario fin'
                parts.append(f"{lbl}: {route['horario_fin']}")
            # Dates
            if route.get('fecha_inicio'):
                lbl = 'Start date' if is_en else 'Fecha inicio'
                parts.append(f"{lbl}: {route['fecha_inicio']}")
            if route.get('fecha_fin'):
                lbl = 'End date' if is_en else 'Fecha fin'
                parts.append(f"{lbl}: {route['fecha_fin']}")
            return '<br/>'.join(parts)

        def find_matching_request_service(line):
            """Find the QuoteRequestService that matches a quote line's service_details."""
            if not quote.quote_request:
                return None
            sd = line.service_details or {}
            line_svc_type = sd.get('service_type', '')
            if not line_svc_type:
                return None
            try:
                services = list(quote.quote_request.services.all())
            except Exception:
                return None
            for svc in services:
                if svc.service_type == line_svc_type:
                    return svc
            return None

        def calc_estimated_end_date(line, route):
            """Calculate estimated end date for a route.

            Logic: offset = estimated_delivery_date - client_fecha_inicio
            estimated_end = client_fecha_fin + offset
            """
            from datetime import datetime as _dt
            est_delivery = line.estimated_delivery_date
            if not est_delivery:
                # Check route-level estimated delivery date
                est_str = route.get('fecha_entrega_estimada') or route.get('estimated_delivery_date')
                if est_str:
                    try:
                        est_delivery = _dt.strptime(str(est_str), '%Y-%m-%d').date()
                    except (ValueError, TypeError):
                        return None
            if not est_delivery:
                return None
            fecha_inicio_str = route.get('fecha_inicio')
            fecha_fin_str = route.get('fecha_fin')
            if not fecha_inicio_str or not fecha_fin_str:
                return None
            try:
                fecha_inicio = _dt.strptime(str(fecha_inicio_str), '%Y-%m-%d').date()
                fecha_fin = _dt.strptime(str(fecha_fin_str), '%Y-%m-%d').date()
            except (ValueError, TypeError):
                return None
            offset = (est_delivery - fecha_inicio).days
            if offset < 0:
                offset = 0
            from datetime import timedelta as _td
            return fecha_fin + _td(days=offset)

        # Column widths (6 columns: concept, description, qty, unit price, shipping, total)
        col_widths = [1.3 * inch, 2.1 * inch, 0.45 * inch, 0.95 * inch, 0.95 * inch, 1.05 * inch]

        # Group lines by delivery method + address/branch (or treat all as one group)
        all_lines = list(quote.lines.all())
        shipping_total = sum(line.shipping_cost for line in all_lines)

        # Pre-load request services for matching client comments
        request_services = []
        if quote.quote_request:
            try:
                request_services = list(quote.quote_request.services.all())
            except Exception:
                pass
        # Fallback: build a pseudo-service from the QuoteRequest itself
        if not request_services and quote.quote_request:
            request_services = [quote.quote_request]  # has .service_type, .required_date, .description

        logger.info(
            f"[PDF {quote.quote_number}] Loaded {len(request_services)} request services: "
            + ", ".join(f"{getattr(s, 'service_type', '?')} (desc={'yes' if getattr(s, 'description', '') else 'no'})" for s in request_services)
        )

        # Build lookup: service_type → list of request services (handles duplicates)
        _svc_by_type = {}
        for svc in request_services:
            st = getattr(svc, 'service_type', '')
            if st:
                _svc_by_type.setdefault(st, []).append(svc)
        _svc_type_used = {}  # track how many times each type has been consumed

        def _find_request_svc(service_type):
            """Find the matching request service for a given service_type.

            When multiple services share the same type, returns them in order
            (first call → first service, second call → second service, etc.).
            """
            if not service_type:
                return None
            svcs = _svc_by_type.get(service_type)
            if not svcs:
                return None
            idx = _svc_type_used.get(service_type, 0)
            if idx < len(svcs):
                _svc_type_used[service_type] = idx + 1
                return svcs[idx]
            # All consumed, return last one as fallback
            return svcs[-1]

        # Detect which lines are publicidad-movil route-expanded lines.
        # These have concept like "Publicidad Móvil — Ruta 1" and
        # service_details containing route-level info.
        def is_route_line(line):
            sd = line.service_details or {}
            svc_type = sd.get('service_type', '')
            return svc_type == 'publicidad-movil' or '— Ruta' in (line.concept or '')

        # Separate route lines vs regular lines
        route_lines = [l for l in all_lines if is_route_line(l)]
        regular_lines = [l for l in all_lines if not is_route_line(l)]

        # For regular lines: group by delivery method + address/branch
        def line_group_key(line):
            dm = line.delivery_method or quote.delivery_method or ''
            if dm == 'pickup' and line.pickup_branch_id:
                return (dm, f'branch:{line.pickup_branch_id}')
            elif dm in ('shipping', 'installation') and line.delivery_address:
                addr = line.delivery_address or {}
                return (dm, addr.get('calle', '') + addr.get('ciudad', ''))
            return (dm, '')

        from collections import OrderedDict
        groups = OrderedDict()
        for line in regular_lines:
            key = line_group_key(line)
            groups.setdefault(key, []).append(line)

        # ── Delivery header builder (reusable) ──
        delivery_header_style = ParagraphStyle(
            'DeliveryHeader', fontSize=8, fontName='Helvetica', textColor=GRAY,
            leading=12, spaceBefore=8, spaceAfter=4
        )

        def _build_delivery_header(dm, group_lines_for_header, est_date_override=None, est_end_override=None):
            """Build a delivery info Paragraph for a group of lines."""
            delivery_label = DELIVERY_LABELS.get(dm, dm)
            header_parts = [f"<b>{LBL_DELIVERY}:</b> {delivery_label}"]
            # Estimated delivery date
            est_date = est_date_override
            if not est_date and group_lines_for_header:
                est_date = next(
                    (l.estimated_delivery_date for l in group_lines_for_header if l.estimated_delivery_date),
                    None
                )
            if est_date:
                fmt = est_date.strftime('%d/%m/%Y') if hasattr(est_date, 'strftime') else str(est_date)
                header_parts.append(f"<b>{LBL_EST_DATE}:</b> {fmt}")
            # Estimated end date
            if est_end_override:
                fmt = est_end_override.strftime('%d/%m/%Y') if hasattr(est_end_override, 'strftime') else str(est_end_override)
                header_parts.append(f"<b>{LBL_EST_END}:</b> {fmt}")
            # Pickup branch
            if dm == 'pickup' and group_lines_for_header:
                branch = next((l.pickup_branch for l in group_lines_for_header if l.pickup_branch_id), None)
                if branch:
                    header_parts.append(f"<b>{'Branch' if is_en else 'Sucursal'}:</b> {branch.name}")
            # Address
            if dm in ('shipping', 'installation') and group_lines_for_header:
                addr = next((l.delivery_address for l in group_lines_for_header if l.delivery_address), None) or {}
                city_parts = [addr.get('calle', ''), addr.get('ciudad', ''), addr.get('estado', '')]
                city_str = ', '.join(p for p in city_parts if p)
                if city_str:
                    header_parts.append(f"<b>{'Address' if is_en else 'Dirección'}:</b> {city_str}")
            return Paragraph(' &nbsp;|&nbsp; '.join(header_parts), delivery_header_style)

        # ── Table builder (reusable) ──
        def _build_items_table(rows):
            """Build a styled ReportLab Table from header + data rows."""
            tbl = Table(rows, colWidths=col_widths)
            tbl.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), CYAN),
                ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                # Body styling
                ('VALIGN', (0, 1), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                ('LEFTPADDING', (0, 1), (-1, -1), 4),
                ('RIGHTPADDING', (0, 1), (-1, -1), 4),
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.Color(0.8, 0.8, 0.8)),
                ('BOX', (0, 0), (-1, -1), 1, CYAN),
            ]))
            return tbl

        table_header_row = [
            LBL['concept'], LBL['description'], LBL['qty'],
            LBL['unit_price'], LBL_SHIPPING_PRICE, LBL['total_col']
        ]

        # ── Render REGULAR (non-route) line groups ──
        for (dm, _addr_key), group_lines in groups.items():
            if dm:
                elements.append(_build_delivery_header(dm, group_lines))

            table_data = [list(table_header_row)]
            for line in group_lines:
                concept_text = (line.concept_en or line.concept) if is_en else line.concept
                # For service-based lines, show auto-generated details + client comments.
                # For manual lines (no service_details), keep line.description as-is.
                if line.service_details:
                    svc_type = (line.service_details or {}).get('service_type', '')
                    req_svc = _find_request_svc(svc_type)
                    desc_text = build_description_from_details(line.service_details, req_svc) or ''
                    logger.info(
                        f"[PDF {quote.quote_number}] Line '{line.concept}': svc_type='{svc_type}', "
                        f"req_svc={'found (desc=' + repr(getattr(req_svc, 'description', '')[:50]) + ')' if req_svc else 'NOT FOUND'}, "
                        f"desc_len={len(desc_text)}"
                    )
                else:
                    desc_text = (line.description_en or line.description) if is_en else line.description
                concept = Paragraph(concept_text or '', cell_style)
                description = Paragraph(desc_text or '', cell_style)
                qty = Paragraph(str(line.quantity), cell_style_center)
                unit_price = Paragraph(f"${line.unit_price:,.2f}", cell_style_right)
                ship_cost = Paragraph(f"${line.shipping_cost:,.2f}", cell_style_right)
                total = Paragraph(f"${line.line_total:,.2f}", cell_style_right)
                table_data.append([concept, description, qty, unit_price, ship_cost, total])

            elements.append(_build_items_table(table_data))
            elements.append(Spacer(1, 12))

        # ── Render ROUTE (publicidad-movil) lines ──
        # Each route line gets its own delivery header showing
        # "Método de entrega: No aplica | Fecha estimada: X | Fecha de fin estimada: Y"
        if route_lines:
            # Find the matching request service for customer comments
            first_sd = route_lines[0].service_details or {}
            first_svc_type = first_sd.get('service_type', '')
            req_svc = _find_request_svc(first_svc_type)

            # Build a shared service-level description (params without route details)
            svc_desc_text = build_description_from_details(first_sd, req_svc) if first_sd else ''

            for line in route_lines:
                sd = line.service_details or {}
                rutas = sd.get('rutas', [])

                # Fallback: if this line has no service_details (only the first
                # route line carries the full JSON), use the shared first_sd.
                if not rutas and first_sd:
                    rutas = first_sd.get('rutas', [])

                # Find this line's route data
                # The concept contains "— Ruta N", extract route index
                route_data = None
                route_idx = 0
                concept_str = line.concept or ''
                if '— Ruta ' in concept_str:
                    try:
                        route_num = int(concept_str.split('— Ruta ')[1].strip())
                        route_idx = route_num - 1
                    except (ValueError, IndexError):
                        pass
                if rutas and route_idx < len(rutas):
                    route_data = rutas[route_idx]
                elif rutas and len(rutas) == 1:
                    route_data = rutas[0]

                # Build per-route delivery header
                dm = line.delivery_method or 'not_applicable'
                est_date = line.estimated_delivery_date
                est_end = None
                if route_data:
                    # Try to get route-level estimated delivery date if line doesn't have one
                    if not est_date:
                        from datetime import datetime as _dt2
                        est_str = route_data.get('fecha_entrega_estimada') or route_data.get('estimated_delivery_date')
                        if est_str:
                            try:
                                est_date = _dt2.strptime(str(est_str), '%Y-%m-%d').date()
                            except (ValueError, TypeError):
                                pass
                    est_end = calc_estimated_end_date(line, route_data)

                elements.append(_build_delivery_header(dm, [line], est_date_override=est_date, est_end_override=est_end))

                # Build description with route details
                route_desc_parts = []
                # Add service-level details (only for first route to avoid repetition)
                if route_data:
                    route_desc = build_route_description(route_data, route_idx)
                    if route_desc:
                        route_desc_parts.append(route_desc)
                # Add customer comments from request service (only once)
                if req_svc and req_svc.description and route_idx == 0:
                    lbl_comments = 'Customer comments' if is_en else 'Comentarios del cliente'
                    route_desc_parts.append(f"{lbl_comments}: {req_svc.description}")

                # Only show route details + client comments (skip vendor description)
                route_details_text = '<br/>'.join(route_desc_parts) if route_desc_parts else ''
                desc_text = route_details_text or svc_desc_text or ''

                concept_text = (line.concept_en or line.concept) if is_en else line.concept
                table_data = [list(table_header_row)]
                concept_p = Paragraph(concept_text or '', cell_style)
                description_p = Paragraph(desc_text or '', cell_style)
                qty_p = Paragraph(str(line.quantity), cell_style_center)
                unit_price_p = Paragraph(f"${line.unit_price:,.2f}", cell_style_right)
                ship_cost_p = Paragraph(f"${line.shipping_cost:,.2f}", cell_style_right)
                total_p = Paragraph(f"${line.line_total:,.2f}", cell_style_right)
                table_data.append([concept_p, description_p, qty_p, unit_price_p, ship_cost_p, total_p])

                elements.append(_build_items_table(table_data))
                elements.append(Spacer(1, 8))

        elements.append(Spacer(1, 8))

        # =====================================================================
        # TOTALS SECTION - Keep together to avoid page breaks
        # =====================================================================

        tax_percent = float(quote.tax_rate) * 100

        totals_data = [
            ['', 'Subtotal:', f"${quote.subtotal:,.2f}"],
            ['', f'IVA ({tax_percent:.0f}%):', f"${quote.tax_amount:,.2f}"],
        ]
        if shipping_total > 0:
            totals_data.append(['', f'{LBL_SHIPPING}:', f"${shipping_total:,.2f}"])
        totals_data.append(['', 'TOTAL:', f"${quote.total:,.2f}"])

        totals_table = Table(totals_data, colWidths=[content_width - 3 * inch, 1.5 * inch, 1.5 * inch])
        total_row_idx = len(totals_data) - 1
        totals_table.setStyle(TableStyle([
            ('FONTNAME', (1, 0), (1, total_row_idx - 1), 'Helvetica'),
            ('FONTNAME', (1, total_row_idx), (1, total_row_idx), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, total_row_idx - 1), 'Helvetica'),
            ('FONTNAME', (2, total_row_idx), (2, total_row_idx), 'Helvetica-Bold'),
            ('FONTSIZE', (1, 0), (-1, total_row_idx - 1), 10),
            ('FONTSIZE', (1, total_row_idx), (-1, total_row_idx), 12),
            ('TEXTCOLOR', (1, total_row_idx), (-1, total_row_idx), CYAN),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LINEABOVE', (1, total_row_idx), (-1, total_row_idx), 1, CYAN),
        ]))
        # Wrap totals in KeepTogether to prevent page break in the middle
        elements.append(KeepTogether([totals_table, Spacer(1, 20)]))

        # =====================================================================
        # NOTES SECTION (if any)
        # =====================================================================

        if quote.customer_notes:
            # Wrap notes in KeepTogether to prevent awkward page breaks
            notes_elements = [
                Paragraph(LBL['notes'], styles['SectionTitle']),
                Paragraph(quote.customer_notes, styles['CustomerInfo']),
                Spacer(1, 20)
            ]
            elements.append(KeepTogether(notes_elements))

        # =====================================================================
        # FOOTER - Fixed at bottom of each page
        # =====================================================================

        # Define footer drawing function
        def draw_footer(canvas_obj, doc_obj):
            """Draw footer at fixed position on each page."""
            canvas_obj.saveState()

            # Footer position - fixed at bottom
            footer_y = 0.5 * inch
            footer_x = margin_left
            footer_width = page_width - margin_left - margin_right

            # Draw divider line
            canvas_obj.setStrokeColor(colors.Color(0.8, 0.8, 0.8))
            canvas_obj.setLineWidth(1)
            canvas_obj.line(footer_x, footer_y + 35, footer_x + footer_width, footer_y + 35)

            # Footer text
            canvas_obj.setFont('Helvetica-Bold', 8)
            canvas_obj.setFillColor(GRAY)
            canvas_obj.drawCentredString(page_width / 2, footer_y + 22, LBL['footer_company'])

            canvas_obj.setFont('Helvetica', 8)
            canvas_obj.drawCentredString(page_width / 2, footer_y + 12, LBL['footer_prices'])
            canvas_obj.drawCentredString(page_width / 2, footer_y + 2, LBL['footer_contact'])

            # Page number
            canvas_obj.setFont('Helvetica', 7)
            canvas_obj.setFillColor(colors.Color(0.6, 0.6, 0.6))
            page_num = canvas_obj.getPageNumber()
            canvas_obj.drawRightString(page_width - margin_right, footer_y + 2, f'{LBL["page"]} {page_num}')

            canvas_obj.restoreState()

        # Build PDF with footer callback
        doc.build(elements, onFirstPage=draw_footer, onLaterPages=draw_footer)
        buffer.seek(0)
        pdf_content = buffer.getvalue()

        # Save PDF to quote
        filename = f"cotizacion_{quote.quote_number}{'_en' if is_en else ''}.pdf"
        if is_en:
            quote.pdf_file_en.save(filename, ContentFile(pdf_content))
            quote.save(update_fields=['pdf_file_en'])
        else:
            quote.pdf_file.save(filename, ContentFile(pdf_content))
            quote.save(update_fields=['pdf_file'])

        logger.info(f"PDF generated for quote {quote.quote_number}")
        return quote.pdf_file.url

    except Quote.DoesNotExist:
        logger.error(f"Quote {quote_id} not found")
        return None


def generate_snapshot_pdf(quote, snapshot, language='es'):
    """
    Generate a PDF from an original_snapshot dict (used by change requests).

    This reconstructs a PDF that matches what the customer saw at the time
    of the change request, using the snapshot data instead of the current
    quote lines.

    Args:
        quote: Quote model instance (for customer info, dates, etc.)
        snapshot: dict with keys: quote_number, subtotal, tax_amount, total, lines[]
        language: 'es' or 'en'

    Returns:
        bytes: PDF content as bytes
    """
    from decimal import Decimal

    is_en = language == 'en'
    LBL = {
        'title': 'QUOTATION' if is_en else 'COTIZACIÓN',
        'client': 'Client' if is_en else 'Cliente',
        'email': 'Email',
        'company': 'Company' if is_en else 'Empresa',
        'date': 'Date' if is_en else 'Fecha',
        'valid_until': 'Valid until' if is_en else 'Válido hasta',
        'status': 'Status' if is_en else 'Estado',
        'detail_title': 'QUOTATION DETAILS' if is_en else 'DETALLE DE LA COTIZACIÓN',
        'concept': 'Concept' if is_en else 'Concepto',
        'description': 'Description' if is_en else 'Descripción',
        'qty': 'Qty.' if is_en else 'Cant.',
        'unit_price': 'Unit Price' if is_en else 'P. Unitario',
        'total_col': 'Total',
        'subtotal': 'Subtotal',
        'footer_company': 'MCD Agencia | Acapulco, Guerrero, México',
        'footer_prices': 'Prices in MXN. This document is not a tax receipt.' if is_en else 'Precios en MXN. Este documento no es un comprobante fiscal.',
        'footer_contact': f'For any questions, contact us: {settings.DEFAULT_FROM_EMAIL}' if is_en else f'Para cualquier duda, contáctenos: {settings.DEFAULT_FROM_EMAIL}',
        'page': 'Page' if is_en else 'Página',
    }

    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    import os

    buffer = BytesIO()

    CYAN = HexColor('#0DA3EF')
    MAGENTA = HexColor('#EC2D8D')
    BLACK = HexColor('#141414')
    GRAY = HexColor('#666666')
    LIGHT_GRAY = HexColor('#F5F5F5')
    WHITE = colors.white

    page_width, page_height = letter
    margin_left = 0.75 * inch
    margin_right = 0.75 * inch
    margin_top = 0.5 * inch
    margin_bottom = 1.2 * inch

    pdf_title = f"{'Quotation' if is_en else 'Cotización'} {quote.quote_number}"
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=margin_right,
        leftMargin=margin_left,
        topMargin=margin_top,
        bottomMargin=margin_bottom,
        title=pdf_title,
        author='MCD Agencia',
        subject=f"{'Quotation' if is_en else 'Cotización'} {quote.quote_number} - {quote.customer_name}",
        creator='MCD Agencia - agenciamcd.mx',
        displayDocTitle=True,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='CompanyName', fontSize=24, fontName='Helvetica-Bold',
        textColor=BLACK, spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name='QuoteTitle', fontSize=14, fontName='Helvetica-Bold',
        textColor=CYAN, spaceAfter=20
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle', fontSize=11, fontName='Helvetica-Bold',
        textColor=BLACK, spaceBefore=15, spaceAfter=8
    ))
    styles.add(ParagraphStyle(
        name='CustomerInfo', fontSize=10, fontName='Helvetica',
        textColor=GRAY, leading=14
    ))

    elements = []
    width, height = letter
    content_width = width - 1.5 * inch

    quote_number = snapshot.get('quote_number', quote.quote_number)

    # HEADER
    possible_logo_paths = [
        os.path.join(settings.STATIC_ROOT or '', 'images', 'logo_dark.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'logo_dark.png'),
        os.path.join(settings.STATIC_ROOT or '', 'images', 'logo.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'logo.png'),
    ]
    logo_path = None
    for path in possible_logo_paths:
        if os.path.exists(path):
            logo_path = path
            break
    has_logo = logo_path is not None

    if has_logo:
        try:
            logo = Image(logo_path, width=120, height=60)
            header_data = [
                [logo, '', Paragraph(LBL['title'], styles['QuoteTitle'])],
                ['', '', Paragraph(f'<b>#{quote_number}</b>', ParagraphStyle(
                    'QuoteNum', fontSize=12, fontName='Helvetica-Bold',
                    textColor=BLACK, alignment=TA_RIGHT
                ))],
            ]
        except Exception:
            has_logo = False

    if not has_logo:
        header_data = [
            [Paragraph('<b>MCD AGENCIA</b>', styles['CompanyName']), '',
             Paragraph(LBL['title'], styles['QuoteTitle'])],
            [Paragraph('Acapulco, Guerrero', styles['CustomerInfo']), '',
             Paragraph(f'<b>#{quote_number}</b>', ParagraphStyle(
                 'QuoteNum', fontSize=12, fontName='Helvetica-Bold',
                 textColor=BLACK, alignment=TA_RIGHT
             ))],
        ]

    header_table = Table(header_data, colWidths=[2 * inch, content_width - 4 * inch, 2 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
    ]))
    elements.append(header_table)

    elements.append(Spacer(1, 10))
    divider_data = [['']]
    divider = Table(divider_data, colWidths=[content_width])
    divider.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, 0), 3, CYAN)]))
    elements.append(divider)
    elements.append(Spacer(1, 15))

    # CUSTOMER INFO
    date_str = quote.created_at.strftime('%d/%m/%Y') if quote.created_at else ''
    valid_str = quote.valid_until.strftime('%d/%m/%Y') if quote.valid_until else 'N/A'

    customer_info = f"""<b>{LBL['client']}:</b> {quote.customer_name or 'N/A'}<br/>
    <b>{LBL['email']}:</b> {quote.customer_email or 'N/A'}<br/>
    <b>{LBL['company']}:</b> {quote.customer_company or 'N/A'}"""

    quote_info = f"""<b>{LBL['date']}:</b> {date_str}<br/>
    <b>{LBL['valid_until']}:</b> {valid_str}"""

    info_data = [
        [Paragraph(customer_info, styles['CustomerInfo']),
         Paragraph(quote_info, ParagraphStyle(
             'QuoteInfo', fontSize=10, fontName='Helvetica',
             textColor=GRAY, leading=14, alignment=TA_RIGHT
         ))],
    ]
    info_table = Table(info_data, colWidths=[content_width / 2, content_width / 2])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('BOX', (0, 0), (-1, -1), 1, colors.Color(0.9, 0.9, 0.9)),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # LINE ITEMS TABLE
    elements.append(Paragraph(LBL['detail_title'], styles['SectionTitle']))

    cell_style = ParagraphStyle('TableCell', fontSize=9, fontName='Helvetica', leading=11, textColor=BLACK)
    cell_style_right = ParagraphStyle('TableCellRight', fontSize=9, fontName='Helvetica', leading=11, textColor=BLACK, alignment=TA_RIGHT)
    cell_style_center = ParagraphStyle('TableCellCenter', fontSize=9, fontName='Helvetica', leading=11, textColor=BLACK, alignment=TA_CENTER)

    LBL_SHIPPING_PRICE = 'Shipping Price' if is_en else 'Precio de envío'

    table_data = [
        [LBL['concept'], LBL['description'], LBL['qty'], LBL['unit_price'], LBL_SHIPPING_PRICE, LBL['total_col']]
    ]

    for line in snapshot.get('lines', []):
        concept = Paragraph(str(line.get('concept', '')), cell_style)
        description = Paragraph(str(line.get('description', '')), cell_style)
        qty = Paragraph(str(line.get('quantity', '')), cell_style_center)
        up = Decimal(str(line.get('unit_price', 0)))
        lt = Decimal(str(line.get('line_total', 0)))
        sc = Decimal(str(line.get('shipping_cost', 0)))
        unit_price = Paragraph(f"${up:,.2f}", cell_style_right)
        ship_cost = Paragraph(f"${sc:,.2f}", cell_style_right)
        total = Paragraph(f"${lt:,.2f}", cell_style_right)
        table_data.append([concept, description, qty, unit_price, ship_cost, total])

    col_widths = [1.3 * inch, 2.1 * inch, 0.45 * inch, 0.95 * inch, 0.95 * inch, 1.05 * inch]
    items_table = Table(table_data, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CYAN),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('VALIGN', (0, 1), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('LEFTPADDING', (0, 1), (-1, -1), 4),
        ('RIGHTPADDING', (0, 1), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.Color(0.8, 0.8, 0.8)),
        ('BOX', (0, 0), (-1, -1), 1, CYAN),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 20))

    # TOTALS
    subtotal = Decimal(str(snapshot.get('subtotal', 0)))
    tax_amount = Decimal(str(snapshot.get('tax_amount', 0)))
    total_amount = Decimal(str(snapshot.get('total', 0)))
    tax_percent = float(quote.tax_rate) * 100 if quote.tax_rate else 16.0

    totals_data = [
        ['', 'Subtotal:', f"${subtotal:,.2f}"],
        ['', f'IVA ({tax_percent:.0f}%):', f"${tax_amount:,.2f}"],
        ['', 'TOTAL:', f"${total_amount:,.2f}"],
    ]

    totals_table = Table(totals_data, colWidths=[content_width - 3 * inch, 1.5 * inch, 1.5 * inch])
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (1, 0), (1, 1), 'Helvetica'),
        ('FONTNAME', (1, 2), (1, 2), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, 1), 'Helvetica'),
        ('FONTNAME', (2, 2), (2, 2), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 0), (-1, 1), 10),
        ('FONTSIZE', (1, 2), (-1, 2), 12),
        ('TEXTCOLOR', (1, 2), (-1, 2), CYAN),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEABOVE', (1, 2), (-1, 2), 1, CYAN),
    ]))
    elements.append(KeepTogether([totals_table, Spacer(1, 20)]))

    # FOOTER
    def draw_footer(canvas_obj, doc_obj):
        canvas_obj.saveState()
        footer_y = 0.5 * inch
        footer_x = margin_left
        footer_width = page_width - margin_left - margin_right
        canvas_obj.setStrokeColor(colors.Color(0.8, 0.8, 0.8))
        canvas_obj.setLineWidth(1)
        canvas_obj.line(footer_x, footer_y + 35, footer_x + footer_width, footer_y + 35)
        canvas_obj.setFont('Helvetica-Bold', 8)
        canvas_obj.setFillColor(GRAY)
        canvas_obj.drawCentredString(page_width / 2, footer_y + 22, LBL['footer_company'])
        canvas_obj.setFont('Helvetica', 8)
        canvas_obj.drawCentredString(page_width / 2, footer_y + 12, LBL['footer_prices'])
        canvas_obj.drawCentredString(page_width / 2, footer_y + 2, LBL['footer_contact'])
        canvas_obj.setFont('Helvetica', 7)
        canvas_obj.setFillColor(colors.Color(0.6, 0.6, 0.6))
        page_num = canvas_obj.getPageNumber()
        canvas_obj.drawRightString(page_width - margin_right, footer_y + 2, f'{LBL["page"]} {page_num}')
        canvas_obj.restoreState()

    doc.build(elements, onFirstPage=draw_footer, onLaterPages=draw_footer)
    buffer.seek(0)
    return buffer.getvalue()


def send_quote_email_sync(quote_id: str, frontend_url: str | None = None) -> bool:
    """
    Synchronous function to send quote email.
    Can be called directly without Celery.

    Args:
        quote_id: UUID of the quote.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.quotes.models import Quote

    try:
        quote = Quote.objects.select_related(
            'quote_request', 'created_by'
        ).prefetch_related('lines').get(id=quote_id)

        # Get recipient info directly from quote
        recipient_email = quote.customer_email
        recipient_name = quote.customer_name

        # Build the quote view URL with token
        lang = quote.language or 'es'
        resolved_frontend_url = (frontend_url or getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')).rstrip('/')
        quote_url = f"{resolved_frontend_url}/{lang}/cotizacion/{quote.token}" if quote.token else f"{resolved_frontend_url}/{lang}/ventas/cotizaciones/{quote.id}"

        context = {
            'quote': quote,
            'recipient_name': recipient_name,
            'quote_url': quote_url,
            'company_name': 'MCD Agencia',
            'lines': quote.lines.all(),
            'is_revised': quote.version > 1,
        }

        html_message = render_to_string('emails/quote_ready.html', context)
        plain_message = strip_tags(html_message)

        # Use different subject for revised quotes (version > 1)
        if lang == 'en':
            if quote.version > 1:
                subject = f'Your quotation #{quote.quote_number} has been updated (v{quote.version}) - MCD Agencia'
            else:
                subject = f'Your quotation #{quote.quote_number} is ready - MCD Agencia'
        else:
            if quote.version > 1:
                subject = f'Tu cotización #{quote.quote_number} ha sido actualizada (v{quote.version}) - MCD Agencia'
            else:
                subject = f'Tu cotización #{quote.quote_number} está lista - MCD Agencia'

        # Create email with attachment
        email = EmailMessage(
            subject=subject,
            body=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
        )
        email.content_subtype = 'html'

        # Attach PDF if available — use English version when language=en
        pdf_field = quote.pdf_file_en if lang == 'en' and quote.pdf_file_en else quote.pdf_file
        if pdf_field:
            try:
                # Use .read() instead of .path to support cloud storage (R2/S3)
                pdf_data = pdf_field.read()
                pdf_filename = f'quotation_{quote.quote_number}.pdf' if lang == 'en' else f'cotizacion_{quote.quote_number}.pdf'
                email.attach(
                    pdf_filename,
                    pdf_data,
                    'application/pdf'
                )
            except Exception as pdf_error:
                logger.warning(f"Could not attach PDF: {pdf_error}")

        email.send(fail_silently=False)

        logger.info(f"Quote email sent for {quote.quote_number} to {recipient_email}")
        return True

    except Quote.DoesNotExist:
        logger.error(f"Quote {quote_id} not found")
        return False
    except Exception as e:
        logger.error(f"Error sending quote email for {quote_id}: {e}")
        raise


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_quote_email(self, quote_id: str):
    """
    Send quote to customer via email with PDF attachment.
    Celery task wrapper for send_quote_email_sync.

    Args:
        quote_id: UUID of the quote.

    Returns:
        bool: True if email was sent successfully.
    """
    return send_quote_email_sync(quote_id)


@shared_task
def expire_old_quotes():
    """
    Mark quotes as expired if past their valid_until date.

    This task runs hourly (configured in celery.py).

    Returns:
        int: Number of quotes expired.
    """
    from apps.quotes.models import Quote

    now = timezone.now()

    # Find quotes that should be expired
    expired_quotes = Quote.objects.filter(
        valid_until__lt=now,
        status__in=['draft', 'sent'],
    )

    count = 0
    for quote in expired_quotes:
        quote.status = 'expired'
        quote.save(update_fields=['status'])

        # Also expire the related QuoteRequest
        if quote.quote_request and quote.quote_request.status not in ['accepted', 'rejected']:
            quote.quote_request.status = 'expired'
            quote.quote_request.save(update_fields=['status', 'updated_at'])

        # Notify customer about expiration
        send_quote_expiration_notification.delay(str(quote.id))
        count += 1

    logger.info(f"Expired {count} quotes")
    return count


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_quote_expiration_notification(self, quote_id: str):
    """
    Send notification when a quote has expired.

    Args:
        quote_id: UUID of the quote.

    Returns:
        bool: True if notification was sent successfully.
    """
    from apps.quotes.models import Quote

    try:
        quote = Quote.objects.get(id=quote_id)

        # Use customer info directly from quote
        recipient_email = quote.customer_email
        recipient_name = quote.customer_name

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        context = {
            'quote': quote,
            'recipient_name': recipient_name,
            'contact_url': f"{frontend_url}/es/contacto",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/quote_expired.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Tu cotización #{quote.quote_number} ha expirado - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Quote expiration notification sent for {quote.quote_number}")
        return True

    except Quote.DoesNotExist:
        logger.error(f"Quote {quote_id} not found")
        return False


@shared_task
def send_quote_reminders():
    """
    Send reminder emails for quotes expiring soon.

    This task runs daily at 10:00 AM (configured in celery.py).
    Sends reminders for quotes expiring within 3 days.

    Returns:
        int: Number of reminders sent.
    """
    from apps.quotes.models import Quote

    now = timezone.now()
    reminder_threshold = now + timedelta(days=3)

    # Find quotes expiring soon that haven't been reminded
    expiring_quotes = Quote.objects.filter(
        valid_until__gt=now,
        valid_until__lte=reminder_threshold,
        status='sent',
    )

    reminders_sent = 0

    for quote in expiring_quotes:
        # Use customer info directly from quote
        recipient_email = quote.customer_email
        recipient_name = quote.customer_name

        days_remaining = (quote.valid_until - now).days

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        context = {
            'quote': quote,
            'recipient_name': recipient_name,
            'days_remaining': days_remaining,
            'quote_url': f"{frontend_url}/es/cotizacion/{quote.token}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/quote_reminder.html', context)
        plain_message = strip_tags(html_message)

        try:
            send_mail(
                subject=f'Tu cotización #{quote.quote_number} expira pronto - MCD Agencia',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                html_message=html_message,
                fail_silently=False,
            )
            reminders_sent += 1
            logger.info(f"Quote reminder sent for {quote.quote_number}")
        except Exception as e:
            logger.error(f"Failed to send quote reminder for {quote.quote_number}: {e}")

    logger.info(f"Sent {reminders_sent} quote reminders")
    return reminders_sent


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_info_request_email(self, request_id: str):
    """
    Send email to customer requesting additional information for their quote request.

    Args:
        request_id: UUID of the quote request.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.quotes.models import QuoteRequest

    try:
        quote_request = QuoteRequest.objects.get(id=request_id)

        # Use customer's preferred language, fallback to 'es'
        lang = getattr(quote_request, 'preferred_language', 'es') or 'es'
        update_url = f"{settings.FRONTEND_URL}/{lang}/completar-solicitud/{quote_request.info_request_token}"

        # Build human-readable labels for flagged fields
        FIELD_LABELS = {
            'subtipo': 'Subtipo', 'tipo': 'Tipo', 'tipo_anuncio': 'Tipo de anuncio',
            'tipo_vehiculo': 'Tipo de vehículo', 'tipo_rotulacion': 'Tipo de rotulación',
            'tipo_diseno': 'Tipo de diseño', 'tipo_impresion': 'Tipo de impresión',
            'tipo_servicio': 'Tipo de servicio', 'descripcion': 'Descripción',
            'medidas': 'Medidas', 'cantidad': 'Cantidad', 'numero_piezas': 'Número de piezas',
            'ubicacion': 'Ubicación', 'zona': 'Zona de circulación',
            'ciudad_zona': 'Ciudad / Zona', 'zona_cobertura': 'Zona de cobertura',
            'tiempo_exhibicion': 'Tiempo de exhibición', 'tiempo_campana': 'Tiempo de campaña',
            'duracion': 'Duración', 'material': 'Material', 'producto': 'Producto',
            'uso': 'Uso', 'uso_diseno': 'Uso del diseño',
            'impresion_incluida': 'Impresión incluida', 'instalacion_incluida': 'Instalación incluida',
            'iluminacion': 'Iluminación', 'diseno_incluido': 'Diseño incluido',
            'archivo_listo': 'Archivo listo para imprimir',
            'archivo_grabacion_proporcionado': 'Archivo de grabación proporcionado',
            'requiere_grabacion': 'Requiere grabación', 'cambios_incluidos': 'Cambios incluidos',
            'rutas': 'Rutas de circulación', 'ruta': 'Ruta',
            'delimitacion_zona': 'Delimitación de zona', 'servicio': 'Servicio',
        }
        flagged_fields = quote_request.info_request_fields or []
        flagged_labels = [FIELD_LABELS.get(f, f) for f in flagged_fields]

        context = {
            'request': quote_request,
            'update_url': update_url,
            'company_name': 'MCD Agencia',
            'message': quote_request.info_request_message,
            'flagged_fields': flagged_labels,
        }

        html_message = render_to_string('emails/info_request.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Información adicional requerida — Solicitud #{quote_request.request_number}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[quote_request.customer_email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Info request email sent for {quote_request.request_number} to {quote_request.customer_email}")
        return True

    except QuoteRequest.DoesNotExist:
        logger.error(f"Quote request {request_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def notify_admin_new_quote_request(self, request_id: str):
    """
    Notify sales team about new quote requests.

    Args:
        request_id: UUID of the quote request.

    Returns:
        bool: True if notification was sent successfully.
    """
    from apps.quotes.models import QuoteRequest
    from apps.users.models import User

    try:
        quote_request = QuoteRequest.objects.select_related('user').get(id=request_id)

        # Get sales team emails
        sales_emails = list(
            User.objects.filter(
                role__name__in=['admin', 'sales'],
                is_active=True,
            ).values_list('email', flat=True)
        )

        if not sales_emails:
            logger.warning("No sales team members found to notify")
            return False

        context = {
            'request': quote_request,
            'request_url': f"{settings.FRONTEND_URL}/admin/quotes/requests/{quote_request.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/admin_new_quote_request.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Nueva solicitud de cotización #{quote_request.request_number}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=sales_emails,
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"New quote request notification sent for {quote_request.request_number}")
        return True

    except QuoteRequest.DoesNotExist:
        logger.error(f"Quote request {request_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_quote_accepted_notification(self, quote_id: str):
    """
    Notify sales team when a quote is accepted by customer.

    Args:
        quote_id: UUID of the quote.

    Returns:
        bool: True if notification was sent successfully.
    """
    from apps.quotes.models import Quote
    from apps.users.models import User

    try:
        quote = Quote.objects.select_related(
            'quote_request', 'created_by'
        ).prefetch_related('lines').get(id=quote_id)

        # Notify the quote creator and sales team
        recipient_emails = set()

        if quote.created_by and quote.created_by.email:
            recipient_emails.add(quote.created_by.email)

        # Add sales managers
        sales_emails = User.objects.filter(
            role__name__in=['admin'],
            is_active=True,
        ).values_list('email', flat=True)

        recipient_emails.update(sales_emails)

        if not recipient_emails:
            logger.warning("No recipients found for quote acceptance notification")
            return False

        # Use customer info directly from quote
        customer_name = quote.customer_name
        customer_email = quote.customer_email

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        context = {
            'quote': quote,
            'customer_name': customer_name,
            'customer_email': customer_email,
            'quote_url': f"{frontend_url}/es/dashboard/cotizaciones/{quote.id}",
            'company_name': 'MCD Agencia',
        }

        html_message = render_to_string('emails/admin_quote_accepted.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'¡Cotización #{quote.quote_number} aceptada! - ${quote.total}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=list(recipient_emails),
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Quote acceptance notification sent for {quote.quote_number}")
        return True

    except Quote.DoesNotExist:
        logger.error(f"Quote {quote_id} not found")
        return False


def send_order_confirmation_email(quote_id: str, order_number: str) -> bool:
    """
    Send email to customer when their accepted quote is converted to an order.

    Args:
        quote_id: UUID of the source quote.
        order_number: Generated order number.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.quotes.models import Quote

    try:
        quote = Quote.objects.get(id=quote_id)

        recipient_email = quote.customer_email
        recipient_name = quote.customer_name
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        context = {
            'quote': quote,
            'order_number': order_number,
            'recipient_name': recipient_name,
            'company_name': 'MCD Agencia',
            'dashboard_url': f"{frontend_url}/es/dashboard",
        }

        html_message = render_to_string('emails/order_created_from_quote.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'Tu pedido #{order_number} ha sido creado - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Order confirmation email sent for {order_number} to {recipient_email}")
        return True

    except Quote.DoesNotExist:
        logger.error(f"Quote {quote_id} not found for order confirmation")
        return False
    except Exception as e:
        logger.error(f"Error sending order confirmation for {order_number}: {e}")
        return False


# ---------------------------------------------------------------------------
# In-app notification reminders (called by cron or Celery beat)
# ---------------------------------------------------------------------------

def check_expiring_quotes():
    """
    Send in-app notifications for quotes expiring within 3 days.

    Only notifies once per quote (checks if a QUOTE_EXPIRING notification
    already exists for the same entity_id).

    Returns:
        int: Number of notifications created.
    """
    from apps.quotes.models import Quote
    from apps.notifications.models import Notification

    now = timezone.now()
    threshold = now + timedelta(days=3)

    expiring = Quote.objects.filter(
        valid_until__gt=now,
        valid_until__lte=threshold,
        status__in=['sent', 'viewed'],
    ).select_related('created_by')

    count = 0
    for quote in expiring:
        # Skip if already notified
        already = Notification.objects.filter(
            notification_type=Notification.TYPE_QUOTE_EXPIRING,
            entity_type='Quote',
            entity_id=str(quote.id),
        ).exists()
        if already:
            continue

        days_left = (quote.valid_until - now).days
        try:
            Notification.notify_owner_and_admins(
                owner=quote.created_by,
                notification_type=Notification.TYPE_QUOTE_EXPIRING,
                title=f'Cotización #{quote.quote_number} vence en {days_left}d',
                message=f'{quote.customer_name} — sin respuesta aún.',
                entity_type='Quote',
                entity_id=quote.id,
                action_url=f'/dashboard/cotizaciones/{quote.id}',
            )
            count += 1
        except Exception:
            pass

    logger.info(f"Expiring-quote notifications: {count}")
    return count


def check_unattended_requests():
    """
    Send in-app notifications for quote requests that have been pending
    for more than 24 hours without a quote being created.

    Only notifies once per request.

    Returns:
        int: Number of notifications created.
    """
    from apps.quotes.models import QuoteRequest
    from apps.notifications.models import Notification

    cutoff = timezone.now() - timedelta(hours=24)

    unattended = QuoteRequest.objects.filter(
        status__in=['pending', 'assigned'],
        created_at__lte=cutoff,
    )

    count = 0
    for req in unattended:
        already = Notification.objects.filter(
            notification_type=Notification.TYPE_REQUEST_UNATTENDED,
            entity_type='QuoteRequest',
            entity_id=str(req.id),
        ).exists()
        if already:
            continue

        hours = int((timezone.now() - req.created_at).total_seconds() / 3600)
        try:
            Notification.notify_staff(
                notification_type=Notification.TYPE_REQUEST_UNATTENDED,
                title=f'Solicitud #{req.request_number} sin atender ({hours}h)',
                message=f'{req.customer_name} — {req.description[:80]}',
                entity_type='QuoteRequest',
                entity_id=req.id,
                action_url=f'/dashboard/solicitudes/{req.id}',
            )
            count += 1
        except Exception:
            pass

    logger.info(f"Unattended-request notifications: {count}")
    return count
