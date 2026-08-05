"""
Quote Serializers for MCD-Agencia.

This module provides serializers for the RFQ system:
    - Quote requests (customer submissions)
    - Quotes (sales team responses)
    - Quote lines
    - Attachments
"""

from decimal import Decimal
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.catalog.serializers import CatalogItemListSerializer
from .models import (
    QuoteRequest, QuoteRequestService, Quote, QuoteLine, QuoteAttachment,
    QuoteResponse, GuestAccessToken, QuoteChangeRequest
)


class QuoteAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for QuoteAttachment model."""

    class Meta:
        model = QuoteAttachment
        fields = [
            'id', 'file', 'filename', 'file_type', 'file_size',
            'description', 'created_at'
        ]
        read_only_fields = ['id', 'filename', 'file_type', 'file_size', 'created_at']

    def validate_file(self, value):
        """Validate file size and type."""
        # Check file size (max 10MB)
        max_size = settings.QUOTE_MAX_ATTACHMENT_SIZE_MB * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError(
                _('File size must be less than %(size)s MB.') % {
                    'size': settings.QUOTE_MAX_ATTACHMENT_SIZE_MB
                }
            )

        # Check file extension
        import os
        ext = os.path.splitext(value.name)[1].lower().replace('.', '')
        if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
            raise serializers.ValidationError(
                _('File type not allowed. Allowed types: %(types)s') % {
                    'types': ', '.join(settings.ALLOWED_UPLOAD_EXTENSIONS)
                }
            )

        return value


class QuoteRequestCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating quote requests (public/guest).

    Handles RFQ submissions from the website.
    Supports multi-service requests via the ``services`` JSON array.
    """

    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        max_length=settings.QUOTE_MAX_ATTACHMENTS,
        write_only=True
    )
    catalog_item_id = serializers.UUIDField(required=False, write_only=True)

    # Multi-service support: optional JSON array of service objects
    services = serializers.JSONField(required=False, write_only=True, allow_null=True)

    class Meta:
        model = QuoteRequest
        fields = [
            'customer_name', 'customer_email', 'customer_phone',
            'customer_company', 'catalog_item_id', 'quantity',
            'dimensions', 'material', 'includes_installation',
            'description', 'preferred_language', 'attachments',
            'service_type', 'service_details', 'required_date',
            'delivery_method', 'delivery_address', 'pickup_branch',
            'services',
        ]

    def validate_services(self, value):
        """Validate the multi-service array if provided."""
        if value is None:
            return value
        if isinstance(value, str):
            import json
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError(_('Invalid JSON for services.'))
        if not isinstance(value, list):
            raise serializers.ValidationError(_('services must be an array.'))
        for idx, svc in enumerate(value):
            if not isinstance(svc, dict):
                raise serializers.ValidationError(
                    _('Each service must be an object (index %(idx)s).') % {'idx': idx}
                )
            if not svc.get('service_type'):
                raise serializers.ValidationError(
                    _('service_type is required for each service (index %(idx)s).') % {'idx': idx}
                )
        return value

    def validate_customer_email(self, value):
        """Normalize email."""
        return value.lower().strip()

    def validate_delivery_address(self, value):
        """Accept both pre-parsed dict and JSON string (from FormData).

        Also normalizes Spanish field names to English so all downstream
        consumers (dashboard display, PDF generation, etc.) use a single
        consistent schema.
        """
        if isinstance(value, str):
            import json
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError(_('Invalid JSON for delivery address.'))

        if isinstance(value, dict):
            # Normalize Spanish → English keys (keep English if already present)
            field_map = {
                'calle': 'street',
                'numero_exterior': 'exterior_number',
                'numero_interior': 'interior_number',
                'colonia': 'neighborhood',
                'ciudad': 'city',
                'estado': 'state',
                'codigo_postal': 'postal_code',
                'referencia': 'reference',
            }
            normalized = {}
            for key, val in value.items():
                eng_key = field_map.get(key, key)
                # Only map if the English key isn't already set
                if eng_key not in normalized:
                    normalized[eng_key] = val
            value = normalized

        return value

    def validate_service_details(self, value):
        """Accept both pre-parsed dict and JSON string (from FormData)."""
        if isinstance(value, str):
            import json
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError(_('Invalid JSON for service details.'))
        return value

    def validate_catalog_item_id(self, value):
        """Validate catalog item exists."""
        if value:
            from apps.catalog.models import CatalogItem
            try:
                CatalogItem.objects.get(id=value, is_active=True)
            except CatalogItem.DoesNotExist:
                raise serializers.ValidationError(_('Product/service not found.'))
        return value

    def create(self, validated_data):
        """Create quote request with attachments, services, and auto-assignment."""
        attachments = validated_data.pop('attachments', [])
        catalog_item_id = validated_data.pop('catalog_item_id', None)
        services_data = validated_data.pop('services', None)

        # Set catalog item if provided
        if catalog_item_id:
            from apps.catalog.models import CatalogItem
            validated_data['catalog_item'] = CatalogItem.objects.get(id=catalog_item_id)

        # Check if user is authenticated
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
            validated_data['is_guest'] = False

            # Auto-save contact data to user profile for future pre-fill
            user = request.user
            update_fields = []
            if validated_data.get('customer_phone') and not user.phone:
                user.phone = validated_data['customer_phone']
                update_fields.append('phone')
            if validated_data.get('customer_company'):
                user.company = validated_data['customer_company']
                update_fields.append('company')

            # For multi-service requests, address may come per-service rather than
            # request-level delivery_address. Pick the first service address that
            # actually requires physical delivery.
            service_level_address = None
            service_level_delivery_method = None
            if isinstance(services_data, list):
                for svc in services_data:
                    if not isinstance(svc, dict):
                        continue
                    svc_method = svc.get('delivery_method')
                    svc_addr = svc.get('delivery_address')
                    if (
                        svc_method in [QuoteRequest.DELIVERY_SHIPPING, QuoteRequest.DELIVERY_INSTALLATION]
                        and isinstance(svc_addr, dict)
                        and any(str(v).strip() for v in svc_addr.values())
                    ):
                        service_level_address = svc_addr
                        service_level_delivery_method = svc_method
                        break

            delivery_method = validated_data.get('delivery_method')
            delivery_addr = validated_data.get('delivery_address') or service_level_address

            def _to_spanish_address(addr: dict) -> dict:
                if not isinstance(addr, dict):
                    return {}
                return {
                    'calle': (addr.get('calle') or addr.get('street') or '').strip(),
                    'numero_exterior': (addr.get('numero_exterior') or addr.get('exterior_number') or '').strip(),
                    'numero_interior': (addr.get('numero_interior') or addr.get('interior_number') or '').strip(),
                    'colonia': (addr.get('colonia') or addr.get('neighborhood') or '').strip(),
                    'ciudad': (addr.get('ciudad') or addr.get('city') or '').strip(),
                    'estado': (addr.get('estado') or addr.get('state') or '').strip(),
                    'codigo_postal': (addr.get('codigo_postal') or addr.get('postal_code') or '').strip(),
                    'referencia': (addr.get('referencia') or addr.get('reference') or '').strip(),
                }

            profile_addr = _to_spanish_address(delivery_addr)
            should_persist_profile_address = (delivery_method or service_level_delivery_method) in [
                QuoteRequest.DELIVERY_SHIPPING,
                QuoteRequest.DELIVERY_INSTALLATION,
            ]

            if (
                should_persist_profile_address
                and profile_addr
                and any(profile_addr.values())
            ):
                user.default_delivery_address = profile_addr
                update_fields.append('default_delivery_address')
                # Also save as a UserAddress record if it doesn't already exist
                from apps.users.models import UserAddress
                addr_fields = {
                    'calle': profile_addr.get('calle', ''),
                    'numero_exterior': profile_addr.get('numero_exterior', ''),
                    'colonia': profile_addr.get('colonia', ''),
                    'ciudad': profile_addr.get('ciudad', ''),
                    'estado': profile_addr.get('estado', ''),
                    'codigo_postal': profile_addr.get('codigo_postal', ''),
                }
                if (
                    addr_fields['calle'] and
                    addr_fields['numero_exterior'] and
                    addr_fields['colonia'] and
                    addr_fields['ciudad'] and
                    addr_fields['estado'] and
                    addr_fields['codigo_postal']
                ):
                    exists = UserAddress.objects.filter(user=user, **addr_fields).exists()
                    if not exists:
                        UserAddress.objects.create(
                            user=user,
                            label='',
                            numero_interior=profile_addr.get('numero_interior', ''),
                            referencia=profile_addr.get('referencia', ''),
                            is_default=not UserAddress.objects.filter(user=user).exists(),
                            **addr_fields,
                        )
            if update_fields:
                user.save(update_fields=update_fields)
        else:
            validated_data['is_guest'] = True

        # Set initial status
        validated_data['status'] = QuoteRequest.STATUS_PENDING

        # Create quote request
        quote_request = QuoteRequest.objects.create(**validated_data)

        # Auto-compute required_date from route dates in service_details
        # (for publicidad-movil subtypes that have per-route fecha_inicio)
        service_details = validated_data.get('service_details')
        if service_details and isinstance(service_details, dict):
            rutas = service_details.get('rutas')
            if isinstance(rutas, list) and rutas:
                from datetime import date as date_cls
                route_dates = []
                for ruta in rutas:
                    if isinstance(ruta, dict):
                        fi = ruta.get('fecha_inicio')
                        if fi and isinstance(fi, str):
                            try:
                                route_dates.append(date_cls.fromisoformat(fi))
                            except (ValueError, TypeError):
                                pass
                if route_dates:
                    earliest = min(route_dates)
                    # Override required_date if not set or if routes have an earlier date
                    if not quote_request.required_date or earliest < quote_request.required_date:
                        quote_request.required_date = earliest
                        quote_request.save(update_fields=['required_date'])

        # Calculate and set urgency
        quote_request.urgency = quote_request.calculate_urgency()
        quote_request.save(update_fields=['urgency'])

        # Create attachments (initially linked to quote_request only)
        attachment_objects = []
        for file in attachments:
            att = QuoteAttachment.objects.create(
                quote_request=quote_request,
                file=file,
                filename=file.name,
                file_type=file.content_type,
                file_size=file.size
            )
            attachment_objects.append(att)

        # Create per-service records (multi-service support)
        created_services = []  # track created service objects for file linking
        if services_data and isinstance(services_data, list):
            from apps.content.models import Branch
            for idx, svc in enumerate(services_data):
                pickup_branch_obj = None
                pickup_id = svc.get('pickup_branch')
                if pickup_id:
                    try:
                        pickup_branch_obj = Branch.objects.get(id=pickup_id, is_active=True)
                    except (Branch.DoesNotExist, ValueError):
                        pass

                # Normalize delivery address
                addr = svc.get('delivery_address') or {}
                if isinstance(addr, dict):
                    field_map = {
                        'calle': 'street', 'numero_exterior': 'exterior_number',
                        'numero_interior': 'interior_number', 'colonia': 'neighborhood',
                        'ciudad': 'city', 'estado': 'state',
                        'codigo_postal': 'postal_code', 'referencia': 'reference',
                    }
                    normalized = {}
                    for key, val in addr.items():
                        eng_key = field_map.get(key, key)
                        if eng_key not in normalized:
                            normalized[eng_key] = val
                    addr = normalized

                svc_obj = QuoteRequestService.objects.create(
                    quote_request=quote_request,
                    position=idx,
                    service_type=svc.get('service_type', ''),
                    service_details=svc.get('service_details', {}),
                    delivery_method=svc.get('delivery_method') or '',
                    delivery_address=addr,
                    pickup_branch=pickup_branch_obj,
                    required_date=svc.get('required_date') or None,
                    description=svc.get('description') or '',
                )
                created_services.append(svc_obj)

            # Set earliest required_date from services onto the request for urgency calc
            from datetime import date as date_cls
            svc_dates = []
            for svc in services_data:
                rd = svc.get('required_date')
                if rd:
                    try:
                        svc_dates.append(date_cls.fromisoformat(rd) if isinstance(rd, str) else rd)
                    except (ValueError, TypeError):
                        pass
                # Also check route dates
                sd = svc.get('service_details', {})
                if isinstance(sd, dict) and isinstance(sd.get('rutas'), list):
                    for ruta in sd['rutas']:
                        fi = ruta.get('fecha_inicio') if isinstance(ruta, dict) else None
                        if fi:
                            try:
                                svc_dates.append(date_cls.fromisoformat(fi))
                            except (ValueError, TypeError):
                                pass
            if svc_dates:
                earliest = min(svc_dates)
                if not quote_request.required_date or earliest < quote_request.required_date:
                    quote_request.required_date = earliest
                    quote_request.save(update_fields=['required_date'])

            # Recalculate urgency now that required_date may have changed
            new_urgency = quote_request.calculate_urgency()
            if new_urgency != quote_request.urgency:
                quote_request.urgency = new_urgency
                quote_request.save(update_fields=['urgency'])

        # Link attachments to per-service records using file_service_map
        if created_services and attachment_objects:
            http_request = self.context.get('request')
            file_service_map_raw = http_request.data.get('file_service_map') if http_request else None
            if file_service_map_raw:
                import json as json_mod
                try:
                    if isinstance(file_service_map_raw, str):
                        file_service_map = json_mod.loads(file_service_map_raw)
                    else:
                        file_service_map = file_service_map_raw
                    if isinstance(file_service_map, list):
                        for file_idx, svc_idx in enumerate(file_service_map):
                            if (file_idx < len(attachment_objects)
                                    and isinstance(svc_idx, int)
                                    and 0 <= svc_idx < len(created_services)):
                                attachment_objects[file_idx].request_service = created_services[svc_idx]
                                attachment_objects[file_idx].save(update_fields=['request_service'])
                except (json_mod.JSONDecodeError, TypeError, ValueError):
                    pass  # If mapping fails, attachments stay linked to quote_request only

        # Attempt automatic assignment
        quote_request.assign_to_sales_rep(auto=True)

        return quote_request


class QuoteRequestServiceSerializer(serializers.ModelSerializer):
    """Serializer for QuoteRequestService model (read)."""

    pickup_branch_detail = serializers.SerializerMethodField()
    delivery_method_display = serializers.CharField(
        source='get_delivery_method_display', read_only=True
    )
    attachments = QuoteAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = QuoteRequestService
        fields = [
            'id', 'position', 'service_type', 'service_details',
            'delivery_method', 'delivery_method_display',
            'delivery_address', 'pickup_branch', 'pickup_branch_detail',
            'required_date', 'description', 'attachments',
        ]

    def get_pickup_branch_detail(self, obj):
        if obj.pickup_branch:
            branch = obj.pickup_branch
            return {
                'id': str(branch.id),
                'name': branch.name,
                'city': branch.city,
                'state': branch.state,
                'full_address': getattr(branch, 'full_address', ''),
            }
        return None


class QuoteRequestSerializer(serializers.ModelSerializer):
    """Serializer for QuoteRequest model (read)."""

    catalog_item = CatalogItemListSerializer(read_only=True)
    attachments = QuoteAttachmentSerializer(many=True, read_only=True)
    services = QuoteRequestServiceSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    urgency_display = serializers.CharField(source='get_urgency_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    days_until_required = serializers.IntegerField(read_only=True)
    is_guest = serializers.SerializerMethodField()
    pickup_branch_detail = serializers.SerializerMethodField()
    delivery_method_display = serializers.CharField(
        source='get_delivery_method_display', read_only=True
    )

    class Meta:
        model = QuoteRequest
        fields = [
            'id', 'request_number', 'status', 'status_display',
            'customer_name', 'customer_email', 'customer_phone',
            'customer_company', 'catalog_item', 'catalog_item_name',
            'quantity', 'dimensions', 'material', 'includes_installation',
            'description', 'preferred_language', 'assigned_to',
            'assigned_to_name', 'attachments', 'services', 'created_at', 'updated_at',
            'service_type', 'service_details', 'is_guest', 'required_date',
            'urgency', 'urgency_display', 'days_until_required',
            'assignment_method', 'assigned_at',
            'delivery_method', 'delivery_method_display',
            'delivery_address', 'pickup_branch', 'pickup_branch_detail'
        ]
        read_only_fields = ['id', 'request_number', 'created_at', 'updated_at', 'urgency', 'assigned_at']

    def get_assigned_to_name(self, obj):
        """Get assigned sales rep name."""
        if obj.assigned_to:
            return obj.assigned_to.full_name
        return None

    def get_is_guest(self, obj):
        """Dynamically determine if the customer is a guest.

        Instead of relying on the static is_guest field (set at submission time),
        check if a registered user exists with the customer's email. This handles
        cases where the customer submitted as a guest but later registered, or
        was registered but not logged in at submission time.
        """
        # If the request already has a linked user, they're not a guest
        if obj.user_id:
            return False
        # Check if a registered user exists with this email
        from django.contrib.auth import get_user_model
        User = get_user_model()
        return not User.objects.filter(email__iexact=obj.customer_email, is_active=True).exists()

    def get_pickup_branch_detail(self, obj):
        """Return branch name and address for display."""
        if obj.pickup_branch:
            branch = obj.pickup_branch
            return {
                'id': str(branch.id),
                'name': branch.name,
                'city': branch.city,
                'state': branch.state,
                'full_address': getattr(branch, 'full_address', ''),
            }
        return None


class QuoteRequestAdminSerializer(QuoteRequestSerializer):
    """Serializer for admin quote request management."""

    assigned_to_id = serializers.UUIDField(write_only=True, required=False)

    class Meta(QuoteRequestSerializer.Meta):
        fields = QuoteRequestSerializer.Meta.fields + [
            'user', 'ip_address', 'user_agent', 'assigned_to_id',
            'info_request_message', 'info_request_token', 'info_request_fields'
        ]


class QuoteLineSerializer(serializers.ModelSerializer):
    """Serializer for QuoteLine model."""

    pickup_branch_detail = serializers.SerializerMethodField()
    delivery_address = serializers.SerializerMethodField()
    service_details = serializers.SerializerMethodField()

    class Meta:
        model = QuoteLine
        fields = [
            'id', 'concept', 'concept_en', 'description', 'description_en',
            'quantity', 'unit', 'unit_price', 'line_total', 'position',
            'service_details', 'shipping_cost',
            'delivery_method', 'delivery_address',
            'pickup_branch', 'pickup_branch_detail',
            'estimated_delivery_date',
        ]
        read_only_fields = ['id', 'line_total']

    def get_pickup_branch_detail(self, obj):
        if obj.pickup_branch:
            branch = obj.pickup_branch
            return {
                'id': str(branch.id),
                'name': branch.name,
                'city': branch.city,
                'state': branch.state,
                'full_address': getattr(branch, 'full_address', ''),
            }
        return None

    def get_delivery_address(self, obj):
        """Convert delivery_address JSONField to formatted string or None."""
        addr = obj.delivery_address
        if not addr or not isinstance(addr, dict) or not addr:
            return None
        # Return the dict only if it has content
        return addr

    def get_service_details(self, obj):
        """Convert service_details JSONField to serializable format or None."""
        details = obj.service_details
        if not details or not isinstance(details, dict) or not details:
            return None
        # Return the dict only if it has content
        return details


class QuoteSerializer(serializers.ModelSerializer):
    """Serializer for Quote model (public view via token)."""

    lines = QuoteLineSerializer(many=True, read_only=True)
    attachments = QuoteAttachmentSerializer(many=True, read_only=True)
    quote_request = QuoteRequestSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    deposit_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    pickup_branch_detail = serializers.SerializerMethodField()
    delivery_method_display = serializers.CharField(
        source='get_delivery_method_display', read_only=True
    )
    delivery_address = serializers.SerializerMethodField()
    payment_methods = serializers.SerializerMethodField()
    included_services = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'status', 'status_display', 'version',
            'customer_name', 'customer_email', 'customer_company', 'customer_phone',
            'valid_until', 'is_expired', 'is_valid',
            'subtotal', 'tax_rate', 'tax_amount', 'total', 'currency',
            'payment_mode', 'deposit_percentage', 'deposit_amount',
            'terms', 'terms_en', 'language',
            'lines', 'attachments', 'quote_request',
            'sent_at', 'viewed_at', 'accepted_at', 'created_at',
            'delivery_time_text', 'estimated_delivery_date',
            'delivery_method', 'delivery_method_display',
            'pickup_branch', 'pickup_branch_detail', 'delivery_address',
            'payment_methods', 'payment_conditions', 'included_services',
            'customer_notes', 'view_count',
            'token', 'pdf_file',
        ]
        read_only_fields = [
            'id', 'quote_number', 'status', 'version', 'subtotal',
            'tax_amount', 'total', 'sent_at', 'viewed_at', 'accepted_at',
            'created_at', 'view_count', 'token', 'pdf_file'
        ]

    def get_pickup_branch_detail(self, obj):
        """Return branch name and address for display."""
        if obj.pickup_branch:
            branch = obj.pickup_branch
            return {
                'id': str(branch.id),
                'name': branch.name,
                'city': branch.city,
                'state': branch.state,
                'full_address': getattr(branch, 'full_address', ''),
            }
        return None

    def get_delivery_address(self, obj):
        """Convert delivery_address JSONField to formatted string or None."""
        addr = obj.delivery_address
        if not addr or not isinstance(addr, dict) or not addr:
            return None
        # Return the dict only if it has content
        return addr

    def get_payment_methods(self, obj):
        """Convert payment_methods list to None if empty."""
        methods = obj.payment_methods
        if not methods or not isinstance(methods, list) or not methods:
            return None
        # Return the list only if it has content
        return methods

    def get_included_services(self, obj):
        """Convert included_services list to None if empty."""
        services = obj.included_services
        if not services or not isinstance(services, list) or not services:
            return None
        # Return the list only if it has content
        return services


class QuoteAdminSerializer(QuoteSerializer):
    """Serializer for admin quote management."""

    quote_request_id = serializers.UUIDField(write_only=True, required=False)
    created_by_name = serializers.SerializerMethodField()

    class Meta(QuoteSerializer.Meta):
        fields = QuoteSerializer.Meta.fields + [
            'quote_request_id', 'customer', 'created_by',
            'created_by_name', 'internal_notes', 'pdf_file_en'
        ]

    def get_created_by_name(self, obj):
        """Get quote creator name."""
        if obj.created_by:
            return obj.created_by.full_name
        return None


class QuoteCreateSerializer(serializers.Serializer):
    """Serializer for creating a quote (admin)."""

    quote_request_id = serializers.UUIDField(required=False, allow_null=True)
    customer_name = serializers.CharField(max_length=255)
    customer_email = serializers.EmailField()
    customer_company = serializers.CharField(max_length=255, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    valid_days = serializers.IntegerField(min_value=1, max_value=90, default=15)
    payment_mode = serializers.ChoiceField(
        choices=[('FULL', 'Full'), ('DEPOSIT_ALLOWED', 'Deposit')],
        default='FULL'
    )
    deposit_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    terms = serializers.CharField(required=False, allow_blank=True)
    terms_en = serializers.CharField(required=False, allow_blank=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=[('es', 'ES'), ('en', 'EN')], default='es')
    # Additional fields
    delivery_time_text = serializers.CharField(max_length=100, required=False, allow_blank=True)
    estimated_delivery_date = serializers.DateField(required=False, allow_null=True)
    delivery_method = serializers.CharField(max_length=20, required=False, allow_blank=True)
    pickup_branch_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_address = serializers.JSONField(required=False, default=dict)
    payment_methods = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    payment_conditions = serializers.CharField(required=False, allow_blank=True)
    included_services = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    lines = QuoteLineSerializer(many=True)

    def validate_lines(self, value):
        """Ensure at least one line item."""
        if not value:
            raise serializers.ValidationError(_('At least one line item is required.'))
        return value

    def validate_delivery_address(self, value):
        """Normalize Spanish field names to English for consistency."""
        if isinstance(value, dict):
            field_map = {
                'calle': 'street',
                'numero_exterior': 'exterior_number',
                'numero_interior': 'interior_number',
                'colonia': 'neighborhood',
                'ciudad': 'city',
                'estado': 'state',
                'codigo_postal': 'postal_code',
                'referencia': 'reference',
            }
            normalized = {}
            for key, val in value.items():
                eng_key = field_map.get(key, key)
                if eng_key not in normalized:
                    normalized[eng_key] = val
            value = normalized
        return value

    def validate(self, attrs):
        """Validate deposit configuration."""
        if attrs.get('payment_mode') == 'DEPOSIT_ALLOWED':
            if not attrs.get('deposit_percentage'):
                raise serializers.ValidationError({
                    'deposit_percentage': _('Deposit percentage is required.')
                })
        return attrs

    def create(self, validated_data):
        """Create a Quote with its line items."""
        from django.utils import timezone
        from datetime import timedelta

        # Extract line items data
        lines_data = validated_data.pop('lines', [])
        quote_request_id = validated_data.pop('quote_request_id', None)
        valid_days = validated_data.pop('valid_days', 15)

        # Get request context
        request = self.context.get('request')
        created_by = request.user if request and request.user.is_authenticated else None

        # Get quote request if provided
        quote_request = None
        if quote_request_id:
            try:
                quote_request = QuoteRequest.objects.get(id=quote_request_id)
            except QuoteRequest.DoesNotExist:
                pass

        # Calculate validity date
        valid_until = timezone.now() + timedelta(days=valid_days)

        # Create the quote
        # Auto-copy phone from quote request if not provided
        customer_phone = validated_data.get('customer_phone', '')
        if not customer_phone and quote_request and quote_request.customer_phone:
            customer_phone = quote_request.customer_phone

        # Auto-copy delivery method and address from quote_request if not provided
        delivery_method = validated_data.get('delivery_method', '')
        if not delivery_method and quote_request and quote_request.delivery_method:
            delivery_method = quote_request.delivery_method

        delivery_address = validated_data.get('delivery_address', {})
        if (not delivery_address or not delivery_address.get('street')) and quote_request and quote_request.delivery_address:
            delivery_address = quote_request.delivery_address

        quote = Quote.objects.create(
            quote_request=quote_request,
            customer_name=validated_data.get('customer_name'),
            customer_email=validated_data.get('customer_email'),
            customer_company=validated_data.get('customer_company', ''),
            customer_phone=customer_phone,
            created_by=created_by,
            valid_until=valid_until,
            payment_mode=validated_data.get('payment_mode', 'FULL'),
            deposit_percentage=validated_data.get('deposit_percentage'),
            terms=validated_data.get('terms', ''),
            terms_en=validated_data.get('terms_en', ''),
            internal_notes=validated_data.get('internal_notes', ''),
            language=validated_data.get('language', 'es'),
            delivery_time_text=validated_data.get('delivery_time_text', ''),
            estimated_delivery_date=validated_data.get('estimated_delivery_date'),
            delivery_method=delivery_method,
            delivery_address=delivery_address,
            payment_methods=validated_data.get('payment_methods', []),
            payment_conditions=validated_data.get('payment_conditions', ''),
            included_services=validated_data.get('included_services', []),
            status=Quote.STATUS_DRAFT,
        )

        # Link pickup branch if provided
        pickup_branch_id = validated_data.get('pickup_branch_id')
        if not pickup_branch_id and quote_request and quote_request.pickup_branch_id:
            pickup_branch_id = quote_request.pickup_branch_id
        
        if pickup_branch_id:
            from apps.content.models import Branch
            try:
                quote.pickup_branch = Branch.objects.get(id=pickup_branch_id, is_active=True)
                quote.save(update_fields=['pickup_branch'])
            except Branch.DoesNotExist:
                pass

        # Create line items
        subtotal = Decimal('0.00')
        shipping_total = Decimal('0.00')
        for position, line_data in enumerate(lines_data):
            quantity = Decimal(str(line_data.get('quantity', 1)))
            unit_price = Decimal(str(line_data.get('unit_price', 0)))
            line_total = quantity * unit_price
            shipping_cost = Decimal(str(line_data.get('shipping_cost', 0) or 0))

            # Per-line delivery fields
            line_delivery_method = line_data.get('delivery_method', '')
            line_delivery_address = line_data.get('delivery_address', {})
            line_estimated_delivery_date = line_data.get('estimated_delivery_date')
            line_pickup_branch_id = line_data.get('pickup_branch') or line_data.get('pickup_branch_id')

            line_pickup_branch = None
            if line_pickup_branch_id:
                from apps.content.models import Branch as BranchModel
                try:
                    line_pickup_branch = BranchModel.objects.get(id=line_pickup_branch_id, is_active=True)
                except (BranchModel.DoesNotExist, ValueError):
                    pass

            QuoteLine.objects.create(
                quote=quote,
                concept=line_data.get('concept', ''),
                concept_en=line_data.get('concept_en', ''),
                description=line_data.get('description', ''),
                description_en=line_data.get('description_en', ''),
                quantity=quantity,
                unit=line_data.get('unit', 'pz'),
                unit_price=unit_price,
                line_total=line_total,
                position=line_data.get('position', position),
                service_details=line_data.get('service_details'),
                shipping_cost=shipping_cost,
                delivery_method=line_delivery_method,
                delivery_address=line_delivery_address or {},
                pickup_branch=line_pickup_branch,
                estimated_delivery_date=line_estimated_delivery_date,
            )
            subtotal += line_total
            shipping_total += shipping_cost

        # Calculate and save totals (shipping has no IVA)
        quote.subtotal = subtotal
        quote.tax_amount = subtotal * quote.tax_rate
        quote.total = subtotal + quote.tax_amount + shipping_total
        quote.save(update_fields=['subtotal', 'tax_amount', 'total'])

        # Update quote request status to 'quoted' when a quote is created
        if quote_request and quote_request.status in (
            QuoteRequest.STATUS_PENDING,
            QuoteRequest.STATUS_ASSIGNED,
            QuoteRequest.STATUS_IN_REVIEW,
        ):
            quote_request.status = QuoteRequest.STATUS_QUOTED
            quote_request.save(update_fields=['status', 'updated_at'])

        # Auto-assign request to the seller who actually created the quote
        if quote_request and created_by and quote_request.assigned_to_id != created_by.id:
            from django.utils import timezone as tz
            quote_request.assigned_to = created_by
            quote_request.assignment_method = QuoteRequest.ASSIGNMENT_MANUAL
            quote_request.assigned_at = tz.now()
            quote_request.save(update_fields=[
                'assigned_to', 'assignment_method', 'assigned_at', 'updated_at'
            ])

        # B: Auto-link customer by email
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            customer_user = User.objects.get(
                email__iexact=quote.customer_email, is_active=True
            )
            quote.customer = customer_user
            quote.save(update_fields=['customer'])
        except User.DoesNotExist:
            pass

        return quote


class QuoteSendSerializer(serializers.Serializer):
    """Serializer for sending a quote to customer."""

    send_email = serializers.BooleanField(default=True)
    custom_message = serializers.CharField(required=False, allow_blank=True)


class QuoteAcceptSerializer(serializers.Serializer):
    """Serializer for accepting a quote (customer)."""

    accepted = serializers.BooleanField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    signature = serializers.CharField(required=False, allow_blank=True)
    signature_name = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate_accepted(self, value):
        """Ensure acceptance is true."""
        if not value:
            raise serializers.ValidationError(_('You must accept the quote.'))
        return value


class QuoteResponseSerializer(serializers.ModelSerializer):
    """Serializer for QuoteResponse model."""

    action_display = serializers.CharField(source='get_action_display', read_only=True)
    responded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QuoteResponse
        fields = [
            'id', 'quote', 'action', 'action_display', 'comment',
            'responded_by', 'responded_by_name', 'guest_name', 'guest_email',
            'ip_address', 'pdf_file', 'created_at'
        ]
        read_only_fields = ['id', 'ip_address', 'pdf_file', 'created_at']

    def get_responded_by_name(self, obj):
        """Get responder name."""
        if obj.responded_by:
            return obj.responded_by.full_name
        return obj.guest_name or None


class QuoteResponseCreateSerializer(serializers.Serializer):
    """Serializer for creating a quote response."""

    action = serializers.ChoiceField(choices=QuoteResponse.ACTION_CHOICES)
    comment = serializers.CharField(required=False, allow_blank=True)
    guest_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    guest_email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        """Validate response based on action."""
        action = attrs.get('action')

        # Rejection and change requests require a comment
        if action in [QuoteResponse.ACTION_REJECTION, QuoteResponse.ACTION_CHANGE_REQUEST]:
            if not attrs.get('comment'):
                raise serializers.ValidationError({
                    'comment': _('A comment is required for this action.')
                })

        return attrs


class SalesRepDashboardSerializer(serializers.Serializer):
    """Serializer for sales rep dashboard data."""

    pending_requests = serializers.IntegerField()
    quotes_without_response = serializers.IntegerField()
    conversion_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    total_quoted = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_approved = serializers.DecimalField(max_digits=12, decimal_places=2)
    urgent_requests = serializers.ListField(child=QuoteRequestSerializer())
    recent_activity = serializers.ListField()


# ==========================================
# Quote Change Request Serializers
# ==========================================

class ProposedLineSerializer(serializers.Serializer):
    """Serializer for a proposed line item change."""

    id = serializers.UUIDField(required=False, allow_null=True)
    action = serializers.ChoiceField(
        choices=['modify', 'add', 'delete'],
        required=True
    )
    concept = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal('0.01')
    )
    unit = serializers.CharField(max_length=20, required=False, default='pz')
    unit_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True
    )
    original_values = serializers.DictField(required=False)
    service_details = serializers.DictField(required=False, allow_null=True)

    def validate(self, attrs):
        """Validate line based on action."""
        action = attrs.get('action')

        if action == 'delete':
            # Delete action only needs the line ID
            if not attrs.get('id'):
                raise serializers.ValidationError({
                    'id': _('Line ID is required for delete action.')
                })
        elif action == 'add':
            # Add action needs concept and quantity
            if not attrs.get('concept'):
                raise serializers.ValidationError({
                    'concept': _('Concept is required for new items.')
                })
            if not attrs.get('quantity'):
                raise serializers.ValidationError({
                    'quantity': _('Quantity is required for new items.')
                })
        elif action == 'modify':
            # Modify action needs the line ID
            if not attrs.get('id'):
                raise serializers.ValidationError({
                    'id': _('Line ID is required for modify action.')
                })

        return attrs


class QuoteChangeRequestCreateSerializer(serializers.Serializer):
    """Serializer for creating a change request from customer."""

    proposed_lines = ProposedLineSerializer(many=True, required=True)
    customer_comments = serializers.CharField(required=False, allow_blank=True)
    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        max_length=5,
        write_only=True
    )

    def validate_proposed_lines(self, value):
        """Validate that there are valid changes."""
        if not value:
            raise serializers.ValidationError(
                _('At least one line change is required.')
            )

        # Check that not all lines are being deleted
        non_delete_actions = [
            line for line in value if line.get('action') != 'delete'
        ]
        delete_actions = [
            line for line in value if line.get('action') == 'delete'
        ]

        # If there are only delete actions, we need to check the quote has other lines
        # This will be validated in the view with access to the quote

        return value

    def create(self, validated_data):
        """Create the change request."""
        quote = self.context.get('quote')
        request = self.context.get('request')
        attachments = validated_data.pop('attachments', [])

        # Create snapshot of original quote
        original_snapshot = {
            'quote_number': quote.quote_number,
            'subtotal': str(quote.subtotal),
            'tax_amount': str(quote.tax_amount),
            'total': str(quote.total),
            'lines': [
                {
                    'id': str(line.id),
                    'concept': line.concept,
                    'description': line.description,
                    'quantity': str(line.quantity),
                    'unit': line.unit,
                    'unit_price': str(line.unit_price),
                    'line_total': str(line.line_total),
                    'service_type': (line.service_details or {}).get('service_type', '') if isinstance(line.service_details, dict) else '',
                    'service_details': line.service_details or {},
                }
                for line in quote.lines.all()
            ]
        }

        # Convert proposed_lines UUIDs and Decimals to strings for JSON serialization
        proposed_lines_serializable = []
        for line in validated_data['proposed_lines']:
            serializable_line = {}
            for key, value in line.items():
                if hasattr(value, 'hex'):  # UUID
                    serializable_line[key] = str(value)
                elif hasattr(value, 'quantize'):  # Decimal
                    serializable_line[key] = str(value)
                else:
                    serializable_line[key] = value
            proposed_lines_serializable.append(serializable_line)

        # Get client IP
        ip_address = None
        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0]
            else:
                ip_address = request.META.get('REMOTE_ADDR')

        # Build customer_comments: use explicit field, or auto-generate from
        # per-line descriptions so summaries/cards can display something.
        customer_comments = validated_data.get('customer_comments', '').strip()
        if not customer_comments:
            line_comments = []
            original_lines = {
                str(ol.id): ol for ol in quote.lines.all()
            }
            for pl in proposed_lines_serializable:
                desc = (pl.get('description') or '').strip()
                if desc and pl.get('action') != 'delete':
                    line_id = pl.get('id')
                    orig = original_lines.get(str(line_id)) if line_id else None
                    # Only treat it as a customer note if it differs from the
                    # original description (otherwise it's just the unchanged
                    # product description being echoed back).
                    if orig and desc == (orig.description or '').strip():
                        continue
                    label = ''
                    if orig:
                        concept = orig.concept or ''
                        parts = concept.split(' \u2014 ')
                        label = parts[-1] if parts else concept
                    elif pl.get('concept'):
                        parts = pl['concept'].split(' \u2014 ')
                        label = parts[-1] if parts else pl['concept']
                    if label:
                        line_comments.append(f'{label}: {desc}')
                    else:
                        line_comments.append(desc)
            if line_comments:
                customer_comments = ' | '.join(line_comments)

        # Create the change request
        change_request = QuoteChangeRequest.objects.create(
            quote=quote,
            customer_name=quote.customer_name,
            customer_email=quote.customer_email,
            customer_comments=customer_comments,
            proposed_lines=proposed_lines_serializable,
            original_snapshot=original_snapshot,
            ip_address=ip_address,
        )

        # Create attachments
        for file in attachments:
            QuoteAttachment.objects.create(
                change_request=change_request,
                file=file,
                filename=file.name,
                file_type=getattr(file, 'content_type', ''),
                file_size=getattr(file, 'size', 0),
            )

        return change_request


class QuoteChangeRequestSerializer(serializers.ModelSerializer):
    """Serializer for QuoteChangeRequest model (read)."""

    quote_number = serializers.CharField(source='quote.quote_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    changes_summary = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    attachments = QuoteAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = QuoteChangeRequest
        fields = [
            'id', 'quote', 'quote_number', 'status', 'status_display',
            'customer_name', 'customer_email', 'customer_comments',
            'proposed_lines', 'original_snapshot', 'changes_summary',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes',
            'created_at', 'updated_at', 'attachments'
        ]
        read_only_fields = [
            'id', 'quote', 'quote_number', 'status', 'status_display',
            'customer_name', 'customer_email', 'original_snapshot',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'created_at', 'updated_at'
        ]

    def get_changes_summary(self, obj):
        """Get summary of proposed changes."""
        return obj.get_changes_summary()

    def get_reviewed_by_name(self, obj):
        """Get reviewer name."""
        if obj.reviewed_by:
            return obj.reviewed_by.full_name or obj.reviewed_by.email
        return None


class QuoteChangeRequestReviewSerializer(serializers.Serializer):
    """Serializer for reviewing a change request (sales/admin)."""

    action = serializers.ChoiceField(choices=['approve', 'reject'], required=True)
    notes = serializers.CharField(required=False, allow_blank=True)
