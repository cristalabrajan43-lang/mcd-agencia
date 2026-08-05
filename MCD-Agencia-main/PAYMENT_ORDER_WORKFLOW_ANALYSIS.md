# MCD-Agencia: Payment, Order & Logistics Workflow Analysis

**Date:** May 2, 2026  
**Project:** MCD-Agencia  
**Focus:** Complete payment flow, order creation, production/logistics orchestration

---

## Executive Summary

The MCD-Agencia system has a sophisticated order-to-fulfillment pipeline supporting:
- **Direct purchases** from product catalog through shopping cart checkout
- **Quote-based purchases** requiring approval before order creation
- **Multiple payment methods** (Mercado Pago, PayPal, Bank Transfer, Cash)
- **Operational orchestration** with Production, Logistics, and Field Operations jobs
- **Finite State Machine (FSM)** order status management with strict state transitions

---

## 1. CHECKOUT & PAYMENT METHODS

### 1.1 Configured Payment Methods

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L409)

```python
PAYMENT_METHOD_CHOICES = [
    ('mercadopago', _('Mercado Pago')),      # Online - immediate confirmation
    ('paypal', _('PayPal')),                 # Online - immediate confirmation
    ('bank_transfer', _('Bank Transfer')),   # Manual - requires approval
    ('cash', _('Cash')),                     # Manual - requires approval
]

# Online vs Manual Methods
ONLINE_PAYMENT_METHODS = {'mercadopago', 'paypal'}
MANUAL_PAYMENT_METHODS = {'bank_transfer', 'cash'}
```

**Location in Frontend:** [frontend/src/app/[locale]/checkout/page.tsx](frontend/src/app/[locale]/checkout/page.tsx#L80)

### 1.2 Checkout Flow (Direct Cart Purchase)

**File:** [frontend/src/app/[locale]/checkout/page.tsx](frontend/src/app/[locale]/checkout/page.tsx#L1)

```typescript
// Checkout Steps:
1. Customer adds items to cart → Address selection → Delivery method → Payment method
2. Supported Delivery Methods:
   - 'shipping' → Variable shipping fee based on city proximity
   - 'pickup' → Free, requires selecting pickup branch
   - 'installation' → (For quotes/services)

// Shipping Fee Logic:
const isLocalShipping = branch.city === deliveryAddress.city;
const shippingFee = isLocalShipping ? LOCAL_SHIPPING_FEE : OUTSIDE_SHIPPING_FEE;

// Order Creation Call:
const order = await createOrder({
  shipping_address_id: string,
  billing_address_id?: string,
  use_shipping_as_billing?: boolean,
  payment_method: 'mercadopago' | 'paypal' | 'bank_transfer' | 'cash',
  delivery_method?: 'pickup' | 'shipping',
  pickup_branch_id?: string,
  shipping_fee?: string,
  notes?: string,
  terms_accepted: boolean,
});
```

**API Endpoint:** `POST /api/v1/orders/create_order/`

---

## 2. CART TO ORDER CREATION

### 2.1 Order Creation Process (Backend)

**File:** [backend/apps/orders/views.py](backend/apps/orders/views.py#L540-L660)

```python
@action(detail=False, methods=['post'])
def create_order(self, request):
    """Create order from cart (POST /api/v1/orders/create_order/)"""
    
    # Step 1: Validate request & get user's cart
    serializer = CreateOrderSerializer(data=request.data, context={'request': request})
    cart = Cart.objects.prefetch_related('items__variant__catalog_item').get(user=request.user)
    
    # Step 2: Retrieve & validate addresses
    shipping_address = Address.objects.get(id=serializer.validated_data['shipping_address_id'])
    billing_address = Address.objects.get(id=serializer.validated_data['billing_address_id'])
    
    # Step 3: Calculate totals
    subtotal = sum(item.line_total for item in cart.items.all())
    tax_rate = Decimal(str(settings.TAX_RATE))  # 0.1600 (16% IVA)
    tax_amount = subtotal * tax_rate
    shipping_fee = validate_shipping_fee(serializer)
    total = subtotal + tax_amount + shipping_fee
    
    # Step 4: Create Order
    order = Order.objects.create(
        user=request.user,
        status=Order.STATUS_PENDING_PAYMENT,
        origin=Order.ORIGIN_DIRECT_PURCHASE,
        shipping_address=shipping_address.full_address,
        billing_address=billing_address.full_address,
        subtotal=subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total=total,
        payment_method=serializer.validated_data['payment_method'],
        delivery_method=delivery_method,
        pickup_branch=pickup_branch,
    )
    
    # Step 5: Create OrderLines from CartItems
    for cart_item in cart.items.all():
        variant = cart_item.variant
        OrderLine.objects.create(
            order=order,
            sku=variant.sku,
            name=variant.catalog_item.name,
            variant_name=variant.name,
            quantity=cart_item.quantity,
            unit_price=cart_item.unit_price,
            line_total=cart_item.line_total,
            metadata={
                'variant_id': str(variant.id),
                'catalog_item_id': str(variant.catalog_item.id)
            }
        )
    
    # Step 6: Simulate payment for online methods
    if order.payment_method in ONLINE_PAYMENT_METHODS:
        order.amount_paid = order.total
        order.save(update_fields=['amount_paid'])
        order.transition_to(Order.STATUS_PAID, ...)
        order.transition_to(Order.STATUS_IN_PRODUCTION, ...)
    
    # Step 7: Build operational plan for production/logistics
    build_operational_plan(order)
    
    # Step 8: Clear cart
    cart.items.all().delete()
    
    return Response(OrderSerializer(order).data, status=HTTP_201_CREATED)
```

### 2.2 Order Created - Initial State

| Status | Amount Paid | Next State | Trigger |
|--------|------------|-----------|---------|
| `pending_payment` | $0 | `paid` | Payment confirmation (manual or online) |
| **For Online Methods** | Simulated to `amount_paid = total` | `in_production` | Automatic transition |
| **For Manual Methods** | Remains $0 | Manual admin confirmation | Admin marks as paid |

---

## 3. QUOTE TO ORDER CONVERSION

### 3.1 Quote Acceptance & Auto-Conversion

**File:** [backend/apps/quotes/views.py](backend/apps/quotes/views.py#L1219-L1310)

```python
@action(detail=True, methods=['post'])
def accept(self, request, pk=None):
    """Accept a quote (POST /quotes/{id}/accept/)
    
    Security: User email must match quote.customer_email
    
    Returns: {
        'quote': QuoteSerializer,
        'order_id': str,           # If auto-converted to order
        'order_number': str,
    }
    """
    
    quote = self.get_object()
    
    # Validate quote not expired
    if quote.is_expired:
        raise Error("This quote has expired.")
    
    # Mark quote as accepted
    quote.status = Quote.STATUS_ACCEPTED
    quote.save(update_fields=['status', 'accepted_at'])
    
    # AUTO-CONVERT TO ORDER if quote.customer user is linked
    if quote.customer:
        order, created = self._convert_quote_to_order(
            quote=quote,
            actor=request.user,
            payment_method=None,  # Uses quote's default payment method
        )
        
        return Response({
            'quote': QuoteSerializer(quote).data,
            'order_id': str(order.id),
            'order_number': order.order_number,
        })
```

### 3.2 Quote to Order Conversion Logic

**File:** [backend/apps/quotes/views.py](backend/apps/quotes/views.py#L1072-L1193)

```python
def _convert_quote_to_order(self, quote: Quote, actor, payment_method: str | None = None):
    """Convert accepted quote to order
    
    Returns: tuple(order, created_now)
    """
    
    # Prevent duplicate conversions
    existing_order = Order.objects.filter(quote=quote).first()
    if existing_order:
        return existing_order, False
    
    # Require customer linked to quote
    if not quote.customer:
        raise ValueError("Quote must have a registered customer")
    
    # Resolve payment method
    order_payment_method = quote.payment_method or payment_method or 'bank_transfer'
    online_methods = {'mercadopago', 'paypal'}
    
    # Create Order
    order = Order.objects.create(
        user=quote.customer,
        status=Order.STATUS_PENDING_PAYMENT,
        origin=Order.ORIGIN_QUOTE,  # <- Track origin for analytics
        subtotal=quote.subtotal,
        tax_rate=quote.tax_rate,
        tax_amount=quote.tax_amount,
        total=quote.total,
        currency=quote.currency,
        payment_method=order_payment_method,
        internal_notes=f'Converted from quote {quote.quote_number}',
        quote=quote,  # <- Link back to source quote
        delivery_method=quote.delivery_method,
        pickup_branch=quote.pickup_branch,
        delivery_address=quote.delivery_address,
    )
    
    # Create OrderLines from QuoteLines
    for quote_line in quote.lines.all():
        line_metadata = {
            'quote_line_id': str(quote_line.id),
            'quote_line_description': quote_line.description,
            'service_details': quote_line.service_details,
            # ... includes full quote request context for traceability
        }
        
        OrderLine.objects.create(
            order=order,
            sku=f'Q-{quote.quote_number}-{quote_line.position}',
            name=quote_line.concept,
            variant_name=quote_line.description[:255],
            quantity=int(quote_line.quantity),
            unit_price=quote_line.unit_price,
            line_total=quote_line.line_total,
            metadata=line_metadata,
        )
    
    # Auto-transition if online payment
    if order_payment_method in online_methods:
        order.amount_paid = order.total
        order.save(update_fields=['amount_paid'])
        order.transition_to(Order.STATUS_PAID, ...)
        order.transition_to(Order.STATUS_IN_PRODUCTION, ...)
    
    # Build operational plan
    build_operational_plan(order)
    
    # Update quote status
    quote.status = Quote.STATUS_CONVERTED
    quote.save(update_fields=['status'])
    
    # Send confirmation email
    send_order_confirmation_email(quote.id, order.order_number)
    
    return order, True
```

### 3.3 Quote States

**File:** [backend/apps/quotes/models.py](backend/apps/quotes/models.py#L600-L640)

```python
STATUS_DRAFT = 'draft'
STATUS_SENT = 'sent'                    # Sent to customer
STATUS_VIEWED = 'viewed'                # Customer opened email/link
STATUS_CHANGES_REQUESTED = 'changes_requested'  # Customer asked for changes
STATUS_ACCEPTED = 'accepted'            # Customer accepted
STATUS_REJECTED = 'rejected'
STATUS_EXPIRED = 'expired'
STATUS_CONVERTED = 'converted'          # Converted to order ← Auto on accept if customer linked
```

---

## 4. ORDER STATUS WORKFLOW (Finite State Machine)

### 4.1 Order States & Valid Transitions

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L263-L360)

```python
# Order FSM States
STATUS_DRAFT = 'draft'                  # Not used for direct purchases (starts at pending_payment)
STATUS_PENDING_PAYMENT = 'pending_payment'
STATUS_PAID = 'paid'
STATUS_PARTIALLY_PAID = 'partially_paid'
STATUS_IN_PRODUCTION = 'in_production'
STATUS_READY = 'ready'
STATUS_IN_DELIVERY = 'in_delivery'
STATUS_COMPLETED = 'completed'
STATUS_CANCELLED = 'cancelled'
STATUS_REFUNDED = 'refunded'

# Allowed Transitions
STATUS_TRANSITIONS = {
    'draft': ['pending_payment', 'cancelled'],
    'pending_payment': ['paid', 'partially_paid', 'cancelled'],
    'paid': ['in_production', 'refunded'],
    'partially_paid': ['paid', 'in_production', 'cancelled'],
    'in_production': ['ready', 'cancelled'],
    'ready': ['in_delivery', 'completed'],
    'in_delivery': ['completed'],
    'completed': ['refunded'],
    'cancelled': [],
    'refunded': [],
}

# Transition Flow Chart:
draft
  ├─> pending_payment (direct purchases start here)
  │    ├─> paid (full payment confirmed)
  │    │    ├─> in_production
  │    │    │    ├─> ready (production complete)
  │    │    │    │    ├─> in_delivery (shipping started)
  │    │    │    │    │    └─> completed (delivered)
  │    │    │    │    └─> completed (pickup/installation done)
  │    │    │    └─> cancelled (production blocked)
  │    │    └─> refunded (refund issued)
  │    ├─> partially_paid (deposit received)
  │    │    ├─> paid (remaining balance received)
  │    │    ├─> in_production (proceed with deposit) 
  │    │    └─> cancelled
  │    └─> cancelled (customer cancels before payment)
  └─> cancelled (draft cancellation)
```

### 4.2 Order Payment Flow - Direct Purchase

```
1. Customer Creates Order (POST /orders/create_order/)
   └─> Order Status: pending_payment
   └─> amount_paid: $0

2a. ONLINE PAYMENT (Mercado Pago / PayPal)
    └─> Simulated immediate confirmation:
        └─> amount_paid = order.total
        └─> Status: paid
        └─> Status: in_production (auto-transition)
        └─> Production Plan Generated

2b. MANUAL PAYMENT (Bank Transfer / Cash)
    └─> Order Status: pending_payment (no auto-transition)
    └─> Admin must manually confirm payment:
        └─> API: PATCH /admin/orders/{id}/set_payment_method/
        └─> or POST /payments/initiate/ webhook confirmation
        └─> Once amount_paid >= total:
            └─> Admin transitions to: paid
            └─> Admin transitions to: in_production
            └─> Production Plan Generated
```

### 4.3 Manual Payment Initiation

**File:** [backend/apps/payments/views.py](backend/apps/payments/views.py#L75-L170)

```python
@action(detail=False, methods=['post'])
def initiate(self, request):
    """Initiate a payment (POST /payments/initiate/)
    
    For manual payments (bank_transfer, cash):
    - Creates a Payment record with status = 'pending'
    - Customer sees payment details (account number, etc.) in order dashboard
    
    For online payments:
    - Redirects to payment provider (Mercado Pago/PayPal)
    - Webhook handler confirms payment
    """
    
    order = validate_and_get_order(request.data)
    
    payment = Payment.objects.create(
        order=order,
        user=request.user,
        provider=request.data['provider'],  # 'mercadopago', 'paypal', etc.
        amount=order.balance_due,
        status=Payment.STATUS_PENDING,
    )
    
    if provider == 'mercadopago':
        result = gateway.create_preference(payment_data)
        return Response({
            'payment_id': str(payment.id),
            'provider_order_id': result['preference_id'],
            'init_point': result['init_url'],  # URL to payment provider
        })
    
    elif provider == 'paypal':
        result = gateway.create_paypal_order(payment_data)
        return Response({
            'payment_id': str(payment.id),
            'provider_order_id': result['order_id'],
            'approval_url': result['approval_url'],  # URL to approve payment
        })
```

**Payment Providers:**
- **File:** [backend/apps/payments/services/mercadopago.py](backend/apps/payments/services/mercadopago.py)
- **File:** [backend/apps/payments/services/paypal.py](backend/apps/payments/services/paypal.py)

---

## 5. PRODUCTION WORKFLOW

### 5.1 Production Job States

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L871-L920)

```python
class ProductionJob(TimeStampedModel):
    """Production track item for a specific order line or service group."""
    
    STATUS_QUEUED = 'queued'              # Initial state
    STATUS_PREPARING = 'preparing'        # Setup/prep work
    STATUS_IN_PRODUCTION = 'in_production'
    STATUS_QUALITY_CHECK = 'quality_check'
    STATUS_RELEASED = 'released'          # Ready for logistics/delivery
    STATUS_BLOCKED = 'blocked'            # Issue found, waiting fix
    STATUS_CANCELLED = 'cancelled'
    
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('preparing', 'Preparing'),
        ('in_production', 'In Production'),
        ('quality_check', 'Quality Check'),
        ('released', 'Released'),
        ('blocked', 'Blocked'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Related Data
    order = ForeignKey(Order, related_name='production_jobs')
    order_line = ForeignKey(OrderLine, related_name='production_jobs', null=True)
    status = CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    requires_quality_check = BooleanField(default=True)
    
    # Timeline
    planned_start = DateTimeField(null=True, blank=True)
    planned_end = DateTimeField(null=True, blank=True)
    actual_start = DateTimeField(null=True, blank=True)
    actual_end = DateTimeField(null=True, blank=True)
    
    metadata = JSONField(default=dict)
```

### 5.2 Production Job Lifecycle

```
Order Status: in_production
    └─> Create ProductionJobs for each OrderLine
        └─> Status: queued → preparing → in_production → quality_check → released
        
When ALL ProductionJobs Status = released or cancelled:
    └─> Order transitions to: ready
    └─> LogisticsJobs automatically created based on delivery_method
```

### 5.3 Production Dashboard

**File:** [frontend/src/app/[locale]/dashboard/produccion/page.tsx](frontend/src/app/[locale]/dashboard/produccion/page.tsx)

```typescript
// Supervisor can:
// 1. View all production jobs (filtered by status)
// 2. Update job status: queued → preparing → in_production → quality_check → released
// 3. Mark jobs as blocked (if issue found)
// 4. Add notes to jobs

API Endpoints:
- GET /admin/orders/production-jobs/ → List all production jobs
- POST /admin/orders/{orderId}/production-jobs/{jobId}/update-status/ → Change status
```

---

## 6. LOGISTICS WORKFLOW

### 6.1 Logistics Job States

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L925-L990)

```python
class LogisticsJob(TimeStampedModel):
    """Logistics track item for shipping, pickup or digital handoff."""
    
    # Type of Logistics
    TYPE_SHIPPING = 'shipping'
    TYPE_PICKUP = 'pickup'
    TYPE_DIGITAL = 'digital_delivery'
    
    # Status Workflow (State Machine)
    STATUS_PENDING_DISPATCH = 'pending_dispatch'    # Initial state (production released)
    STATUS_SCHEDULED = 'scheduled'                  # Delivery window confirmed
    STATUS_IN_TRANSIT = 'in_transit'                # On the way
    STATUS_READY_FOR_PICKUP = 'ready_for_pickup'    # Ready (for pickup type)
    STATUS_DELIVERED = 'delivered'                  # Completed
    STATUS_DELIVERY_FAILED = 'delivery_failed'      # Failed attempt
    STATUS_CANCELLED = 'cancelled'
    
    # Valid Transitions
    # pending_dispatch → scheduled → in_transit → delivered
    #                  → ready_for_pickup → delivered
    #                  → delivery_failed → scheduled
    
    # Related Data
    order = ForeignKey(Order, related_name='logistics_jobs')
    status = CharField(max_length=25, default=STATUS_PENDING_DISPATCH)
    logistics_type = CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_SHIPPING)
    
    # Delivery Window
    window_start = DateTimeField(null=True, blank=True)
    window_end = DateTimeField(null=True, blank=True)
    delivered_at = DateTimeField(null=True, blank=True)
    
    # Address & Metadata
    address_snapshot = JSONField(default=dict)  # Frozen delivery address
    metadata = JSONField(default=dict)
```

### 6.2 Logistics Job Lifecycle

```
Order Status: ready
    └─> Create LogisticsJob based on delivery_method:
        
        Case 1: delivery_method = 'shipping'
            └─> LogisticsJob Status: pending_dispatch
            └─> operations team schedules delivery
            └─> Status: scheduled → in_transit → delivered
        
        Case 2: delivery_method = 'pickup'
            └─> LogisticsJob Status: ready_for_pickup
            └─> Customer picks up at branch
            └─> Status: delivered
        
        Case 3: delivery_method = 'installation'
            └─> Creates FieldOperationJob (see section 7)
```

### 6.3 Logistics Dashboard

**File:** [frontend/src/app/[locale]/dashboard/logistica/page.tsx](frontend/src/app/[locale]/dashboard/logistica/page.tsx)

```typescript
// Logistics Team can:
// 1. View shipping jobs (pending_dispatch → scheduled → in_transit → delivered)
// 2. View pickup jobs (ready_for_pickup)
// 3. Update status transitions
// 4. Add tracking information

Valid Logistics Status Transitions:
pending_dispatch → [scheduled, cancelled]
scheduled → [in_transit, ready_for_pickup, cancelled]
in_transit → [delivered, delivery_failed, cancelled]
ready_for_pickup → [delivered, cancelled]
delivered → []
delivery_failed → [scheduled, cancelled]  # Can retry
cancelled → []

API Endpoints:
- GET /admin/orders/operations-jobs/?job_type=logistics → Logistics jobs
- POST /admin/orders/{orderId}/logistics-jobs/{jobId}/update-status/ → Change status
```

---

## 7. FIELD OPERATIONS WORKFLOW (Installations)

### 7.1 Field Operation Job States

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L995-L1050)

```python
class FieldOperationJob(TimeStampedModel):
    """Field operation track for installations and date-ranged campaigns."""
    
    TYPE_INSTALLATION = 'installation'
    TYPE_MOBILE_CAMPAIGN = 'mobile_campaign'
    TYPE_SERVICE_WINDOW = 'service_window'
    
    STATUS_SCHEDULED = 'scheduled'           # Initial state
    STATUS_CREW_ASSIGNED = 'crew_assigned'   # Team assigned
    STATUS_IN_PROGRESS = 'in_progress'       # Work started
    STATUS_PAUSED = 'paused'                 # Temporarily stopped
    STATUS_COMPLETED = 'completed'           # Work finished
    STATUS_REQUIRES_REVISIT = 'requires_revisit'  # Quality issue
    STATUS_CANCELLED = 'cancelled'
    
    # Related Data
    order = ForeignKey(Order, related_name='field_ops_jobs')
    status = CharField(max_length=25, default=STATUS_SCHEDULED)
    operation_type = CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_INSTALLATION)
    
    # Assignment
    assigned_to = ForeignKey(User, null=True, blank=True)
    
    # Timeline
    scheduled_start = DateTimeField(null=True, blank=True)
    scheduled_end = DateTimeField(null=True, blank=True)
    actual_start = DateTimeField(null=True, blank=True)
    actual_end = DateTimeField(null=True, blank=True)
    
    # Location & Metadata
    location_snapshot = JSONField(default=dict)
    metadata = JSONField(default=dict)
    notes = TextField(blank=True)
```

### 7.2 Field Operations Dashboard

**File:** [frontend/src/app/[locale]/dashboard/operaciones-campo/page.tsx](frontend/src/app/[locale]/dashboard/operaciones-campo/page.tsx)

```typescript
// Field Operations Team can:
// 1. View all installations (pending → assigned → in_progress → completed)
// 2. Assign crew to jobs
// 3. Update job status with actual times
// 4. Mark jobs requiring revisit if quality issues found

Valid Field Operations Status Transitions:
scheduled → [crew_assigned, cancelled]
crew_assigned → [in_progress, cancelled]
in_progress → [completed, paused, requires_revisit, cancelled]
paused → [in_progress, requires_revisit, cancelled]
completed → []
requires_revisit → [in_progress, cancelled]
cancelled → []

API Endpoints:
- GET /admin/orders/operations-jobs/?job_type=field_ops → Field ops jobs
- POST /admin/orders/{orderId}/field-ops-jobs/{jobId}/update-status/ → Change status
```

---

## 8. OPERATIONAL ORCHESTRATION (Auto-Generated Plans)

### 8.1 Operation Plan Generation

**File:** [backend/apps/orders/services/operations.py](backend/apps/orders/services/operations.py#L1-L100)

```python
def build_operational_plan(order: Order) -> None:
    """Build and attach operational plan to order.
    
    This function is called when:
    1. Order created from direct purchase
    2. Order created from quote conversion
    3. Order transitioned to in_production
    
    Generates:
    - ProductionJobs for each OrderLine
    - LogisticsJobs based on delivery_method
    - FieldOperationJobs if installation required
    - Dependency map between jobs
    """
    
    # For each OrderLine → Create ProductionJob
    for line in order.lines.all():
        ProductionJob.objects.create(
            order=order,
            order_line=line,
            status=ProductionJob.STATUS_QUEUED,
            requires_quality_check=(line.metadata.get('requires_qc', True))
        )
    
    # Based on delivery_method → Create Logistics/Field Ops
    if order.delivery_method == Order.DELIVERY_SHIPPING:
        LogisticsJob.objects.create(
            order=order,
            logistics_type=LogisticsJob.TYPE_SHIPPING,
            status=LogisticsJob.STATUS_PENDING_DISPATCH,
            address_snapshot=order.shipping_address,
        )
    
    elif order.delivery_method == Order.DELIVERY_PICKUP:
        LogisticsJob.objects.create(
            order=order,
            logistics_type=LogisticsJob.TYPE_PICKUP,
            status=LogisticsJob.STATUS_READY_FOR_PICKUP,
        )
    
    elif order.delivery_method == Order.DELIVERY_INSTALLATION:
        FieldOperationJob.objects.create(
            order=order,
            operation_type=FieldOperationJob.TYPE_INSTALLATION,
            status=FieldOperationJob.STATUS_SCHEDULED,
            location_snapshot=order.delivery_address,
        )
    
    # Store the operation plan JSON in order.operation_plan
    order.operation_plan = generate_dependency_map(order)
    order.save(update_fields=['operation_plan'])
```

### 8.2 Operational Rollup (Aggregated Status)

**File:** [backend/apps/orders/services/operations.py](backend/apps/orders/services/operations.py#L200-L250)

```python
def sync_operational_rollup(order: Order) -> None:
    """Refresh aggregated operational status from jobs.
    
    Updates order.operational_rollup based on all job statuses.
    """
    
    # Collect all job statuses
    production_statuses = list(order.production_jobs.values_list('status', flat=True))
    logistics_statuses = list(order.logistics_jobs.values_list('status', flat=True))
    field_statuses = list(order.field_ops_jobs.values_list('status', flat=True))
    
    all_statuses = production_statuses + logistics_statuses + field_statuses
    
    # Determine rollup status
    if not all_statuses:
        rollup = Order.OP_ROLLUP_PLANNED
    
    elif any(status in {
        ProductionJob.STATUS_BLOCKED,
        FieldOperationJob.STATUS_PAUSED,
        FieldOperationJob.STATUS_REQUIRES_REVISIT,
        LogisticsJob.STATUS_DELIVERY_FAILED
    } for status in all_statuses):
        rollup = Order.OP_ROLLUP_ON_HOLD  # ← Requires attention
    
    elif all(status in {
        ProductionJob.STATUS_RELEASED,
        ProductionJob.STATUS_CANCELLED,
        LogisticsJob.STATUS_DELIVERED,
        LogisticsJob.STATUS_CANCELLED,
        FieldOperationJob.STATUS_COMPLETED,
        FieldOperationJob.STATUS_CANCELLED,
    } for status in all_statuses):
        rollup = Order.OP_ROLLUP_COMPLETED
    
    elif any(status in {
        ProductionJob.STATUS_IN_PRODUCTION,
        ProductionJob.STATUS_QUALITY_CHECK,
        LogisticsJob.STATUS_IN_TRANSIT,
        FieldOperationJob.STATUS_IN_PROGRESS,
    } for status in all_statuses):
        rollup = Order.OP_ROLLUP_IN_EXECUTION
    
    else:
        rollup = Order.OP_ROLLUP_PLANNED or OP_ROLLUP_AWAITING_FINALIZATION
    
    order.operational_rollup = rollup
    order.save(update_fields=['operational_rollup', 'updated_at'])
```

**Operational Rollup States:**
```
OP_ROLLUP_PLANNED = 'planned'                             # Awaiting start
OP_ROLLUP_IN_EXECUTION = 'in_execution'                  # Production/Logistics working
OP_ROLLUP_AWAITING_FINALIZATION = 'awaiting_finalization'  # Waiting final step
OP_ROLLUP_COMPLETED = 'completed'                        # All jobs done
OP_ROLLUP_ON_HOLD = 'on_hold'                            # Blocked/paused
```

---

## 9. PAYMENT MODELS

### 9.1 Payment States

**File:** [backend/apps/payments/models.py](backend/apps/payments/models.py#L40-L80)

```python
class Payment(TimeStampedModel):
    """Individual payment transaction tracking."""
    
    PROVIDER_MERCADOPAGO = 'mercadopago'
    PROVIDER_PAYPAL = 'paypal'
    
    STATUS_PENDING = 'pending'              # Awaiting payment
    STATUS_APPROVED = 'approved'            # Payment successful
    STATUS_REJECTED = 'rejected'            # Payment failed/declined
    STATUS_CANCELLED = 'cancelled'
    STATUS_REFUNDED = 'refunded'
    STATUS_IN_PROCESS = 'in_process'        # Processing (Mercado Pago)
    
    # Related Entities
    order = ForeignKey(Order, related_name='payments', null=True)
    quote = ForeignKey(Quote, related_name='payments', null=True)
    user = ForeignKey(User, related_name='payments')
    
    # Financial Data
    provider = CharField(max_length=20, choices=PROVIDER_CHOICES)
    status = CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    amount = DecimalField(max_digits=12, decimal_places=2)
    currency = CharField(max_length=3, default='MXN')
    fee_amount = DecimalField(null=True)    # Provider fee
    net_amount = DecimalField(null=True)    # Net after fees
    
    # Provider References
    provider_payment_id = CharField(max_length=100, blank=True)  # External payment ID
    provider_order_id = CharField(max_length=100, blank=True)    # External order/preference ID
    payment_method_type = CharField(max_length=50, blank=True)   # credit_card, debit_card, etc.
    payment_method_id = CharField(max_length=50, blank=True)     # visa, mastercard, etc.
    
    # Logging
    approved_at = DateTimeField(null=True)
    error_message = TextField(blank=True)
    ip_address = GenericIPAddressField(null=True)
    metadata = JSONField(default=dict)
```

### 9.2 Payment Webhook Logging

**File:** [backend/apps/payments/models.py](backend/apps/payments/models.py#L250-L310)

```python
class PaymentWebhookLog(TimeStampedModel):
    """Log all webhook events from payment providers for debugging."""
    
    id = UUIDField(primary_key=True)
    provider = CharField(max_length=20)  # 'mercadopago', 'paypal'
    event_type = CharField(max_length=100)  # 'payment.created', 'payment.updated', etc.
    event_id = CharField(max_length=100, unique=True)  # Deduplication
    payment = ForeignKey(Payment, null=True)
    payload = JSONField()  # Raw webhook data
    headers = JSONField(default=dict)
    processed = BooleanField(default=False)
    processing_error = TextField(blank=True)
    ip_address = GenericIPAddressField(null=True)
```

---

## 10. KEY DATA FLOWS & SUMMARIZATION

### 10.1 Complete Direct Purchase Flow

```
START: User clicks "Proceder al pago" in cart page
  ↓
STEP 1: Checkout Page Load
├─ Load user's saved addresses
├─ Sync with user profile addresses
├─ Calculate shipping fee based on address
└─ Display payment method options

STEP 2: User Selects Payment Method & Delivery
└─> Mercado Pago / PayPal / Bank Transfer / Cash
└─> Shipping / Pickup / Installation

STEP 3: Create Order (POST /orders/create_order/)
  ├─ Validate addresses, cart, totals
  ├─ Create Order: status=pending_payment, amount_paid=$0
  ├─ Create OrderLines from CartItems
  ├─ Create OrderStatusHistory entry
  │
  └─ IF payment_method IN ['mercadopago', 'paypal']:
      ├─ Set amount_paid = order.total (simulated confirmation)
      ├─ Transition: pending_payment → paid
      ├─ Transition: paid → in_production
      └─ build_operational_plan(order)
           ├─ Create ProductionJobs (queued)
           ├─ Create LogisticsJob or FieldOperationJob
           └─ Store operation_plan dependency map
  
  └─ IF payment_method IN ['bank_transfer', 'cash']:
      ├─ Order stays: status=pending_payment
      ├─ Clear cart (user can only checkout once)
      └─ Customer sees payment details in dashboard

STEP 4: Cart Cleared
└─ CartItems deleted
└─ User redirected to order detail page

Production Team:
  ├─ View ProductionJobs in production dashboard
  ├─ Update status: queued → preparing → in_production → quality_check → released
  └─ System auto-transitions order: in_production → ready (when all jobs released)

Logistics/Field Ops Team:
  ├─ View LogisticsJobs or FieldOpsJobs
  ├─ Update status through completion
  └─ System auto-transitions order: ready → in_delivery → completed

Customer:
  └─ Receives notifications at key milestones
  └─ Can track order status in dashboard
```

### 10.2 Complete Quote-to-Order Flow

```
START: Customer views quote link (via email or public link)
  ↓
STEP 1: Guest/Customer Views Quote
├─ Open quote via public token: /cotizacion/{token}/
├─ View quote details, pricing, delivery method
└─ Can request changes or accept

STEP 2: Customer Accepts Quote
├─ API: POST /quotes/{id}/accept/
├─ System verifies user email matches quote.customer_email
├─
├─ IF quote.customer (user linked):
│   ├─ Status: accepted
│   ├─ Auto-convert: _convert_quote_to_order(quote)
│   │  ├─ Create Order: status=pending_payment, origin=quote_conversion
│   │  ├─ Create OrderLines from QuoteLines (with full metadata)
│   │  ├─ Create OrderStatusHistory: "From quote #{quote_number}"
│   │  │
│   │  ├─ IF quote.payment_method IN ['mercadopago', 'paypal']:
│   │  │   ├─ amount_paid = order.total (simulated)
│   │  │   ├─ Transition: pending_payment → paid → in_production
│   │  │   └─ build_operational_plan(order)
│   │  │
│   │  └─ IF quote.payment_method IN ['bank_transfer', 'cash']:
│   │      ├─ Order stays pending_payment
│   │      └─ Admin confirms payment later
│   │
│   ├─ Update Quote: status=converted
│   ├─ Update QuoteRequest: status=accepted
│   ├─ Log Audit: Quote → Order conversion
│   └─ Send Email: order_created_from_quote.html
│
└─ IF quote.customer NOT linked:
    ├─ Status: accepted (but NOT auto-converted)
    ├─ Admin must manually convert via dashboard:
    │   └─ POST /quotes/{id}/convert_to_order/
    └─ Returns newly created order

STEP 3: Customer Redirected to Order
└─ Frontend redirects to: /mi-cuenta/pedidos/{order_id}/
```

### 10.3 Order Origin Tracking

Orders created via different paths are tracked with `origin` field:

```python
# In order.origin:
Order.ORIGIN_QUOTE = 'quote_conversion'          # Created from accepted quote
Order.ORIGIN_DIRECT_PURCHASE = 'direct_purchase' # Created from cart checkout
Order.ORIGIN_MANUAL = 'manual'                   # Created manually by admin
```

**Analytics Impact:**
- Separate revenue reporting for quote vs. direct sales
- Conversion funnel tracking (quote requests → converted orders)
- Different operational workflows possible based on origin

---

## 11. RELATED MODELS & SUPPORTING STRUCTURES

### 11.1 Cart & CartItem

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L30-L145)

```python
class Cart(TimeStampedModel):
    """Shopping cart for authenticated users."""
    user = OneToOneField(User, ...)
    session_key = CharField(blank=True)  # For future guest carts
    
    @property
    def subtotal: Decimal
    @property
    def tax_amount: Decimal
    @property
    def total: Decimal
    @property
    def item_count: int
    
    def clear(self): pass

class CartItem(TimeStampedModel):
    """Individual item in cart."""
    cart = ForeignKey(Cart, related_name='items')
    variant = ForeignKey(ProductVariant)
    quantity = PositiveIntegerField
    
    @property
    def unit_price: Decimal
    @property
    def line_total: Decimal
```

### 11.2 Address Model

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L145-L240)

```python
class Address(TimeStampedModel):
    """Reusable address for shipping/billing."""
    user = ForeignKey(User)
    type = CharField(choices=[('shipping', 'Shipping'), ('billing', 'Billing')])
    is_default = BooleanField(default=False)
    
    name = CharField()
    phone = CharField()
    street = CharField()
    exterior_number = CharField()
    interior_number = CharField(blank=True)
    neighborhood = CharField()  # colonia
    city = CharField()
    state = CharField()
    postal_code = CharField()
    country = CharField(default='MEX')
    reference = TextField(blank=True)  # Landmarks, instructions
    
    @property
    def full_address: str
```

### 11.3 OrderLine Model

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L800-L870)

```python
class OrderLine(TimeStampedModel):
    """Line item snapshot at order time."""
    order = ForeignKey(Order)
    variant = ForeignKey(ProductVariant, null=True)
    
    # Snapshot data (preserved if product changes later)
    sku = CharField()
    name = CharField()
    variant_name = CharField(blank=True)
    quantity = PositiveIntegerField()
    unit_price = DecimalField()
    line_total = DecimalField()
    
    metadata = JSONField(default=dict)  # For quote-based orders, includes full quote line context
```

### 11.4 OrderStatusHistory

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L828-L870)

```python
class OrderStatusHistory(TimeStampedModel):
    """Audit trail of all status changes."""
    order = ForeignKey(Order)
    from_status = CharField()
    to_status = CharField()
    changed_by = ForeignKey(User, null=True)
    notes = TextField(blank=True)
```

---

## 12. CONFIGURATION SETTINGS

### 12.1 Tax & Shipping Configuration

**File:** [backend/config/settings/base.py](backend/config/settings/base.py)

```python
# Tax Rate (16% IVA - Mexican tax)
TAX_RATE = Decimal('0.1600')

# Shipping Configuration
LOCAL_SHIPPING_FEE = Decimal('50.00')    # For deliveries in same city
OUTSIDE_SHIPPING_FEE = Decimal('150.00') # For deliveries outside city

# Quote Configuration
QUOTE_DEFAULT_VALIDITY_DAYS = 15  # Quotes expire after 15 days

# Payment Providers
MERCADO_PAGO_ACCESS_TOKEN = '...'
PAYPAL_CLIENT_ID = '...'
```

---

## 13. API ENDPOINTS SUMMARY

### Orders Management
```
GET    /api/v1/orders/                      → List user's orders
GET    /api/v1/orders/{id}/                 → Order details
POST   /api/v1/orders/create_order/         → Create from cart
POST   /api/v1/orders/{id}/cancel/          → Cancel order (customer)
GET    /api/v1/admin/orders/                → List all orders (staff)
PATCH  /api/v1/admin/orders/{id}/           → Update order (staff)
POST   /api/v1/admin/orders/{id}/update-status/  → Change status (staff)
```

### Production Management
```
GET    /api/v1/admin/orders/production-jobs/ → List production jobs
POST   /api/v1/admin/orders/{orderId}/production-jobs/{jobId}/update-status/
```

### Logistics Management
```
GET    /api/v1/admin/orders/operations-jobs/?job_type=logistics  → Logistics jobs
POST   /api/v1/admin/orders/{orderId}/logistics-jobs/{jobId}/update-status/
```

### Field Operations Management
```
GET    /api/v1/admin/orders/operations-jobs/?job_type=field_ops  → Field ops jobs
POST   /api/v1/admin/orders/{orderId}/field-ops-jobs/{jobId}/update-status/
```

### Cart Management
```
GET    /api/v1/orders/cart/                 → Get user's cart
POST   /api/v1/orders/cart/add/             → Add item
PUT    /api/v1/orders/cart/update/{itemId}/ → Update quantity
DELETE /api/v1/orders/cart/remove/{itemId}/ → Remove item
DELETE /api/v1/orders/cart/clear/           → Clear cart
```

### Address Management
```
GET    /api/v1/orders/addresses/            → List user's addresses
POST   /api/v1/orders/addresses/            → Create address
PATCH  /api/v1/orders/addresses/{id}/       → Update address
DELETE /api/v1/orders/addresses/{id}/       → Delete address
POST   /api/v1/orders/addresses/{id}/set_default/ → Set as default
```

### Payments
```
GET    /api/v1/payments/                    → List user's payments
POST   /api/v1/payments/initiate/           → Initiate payment
GET    /api/v1/admin/payments/              → List all payments (staff)
```

### Quotes
```
GET    /api/v1/quotes/                      → List user's quotes
GET    /api/v1/quotes/{id}/                 → Quote details
POST   /api/v1/quotes/{id}/accept/          → Accept quote (customer)
POST   /api/v1/quotes/{id}/reject/          → Reject quote (customer)
POST   /api/v1/quotes/{id}/convert_to_order/  → Convert to order (staff)
GET    /api/v1/quotes/view/{token}/         → Public quote view (no auth)
```

---

## 14. CURRENT IMPLEMENTATION NOTES

### What's Implemented
✅ Full FSM order state machine  
✅ Direct cart checkout (→ simulated immediate payment for online methods)  
✅ Quote creation, acceptance, and auto-conversion to orders  
✅ Production job generation and tracking  
✅ Logistics job generation and tracking  
✅ Field operations job tracking  
✅ Multiple payment providers (Mercado Pago, PayPal)  
✅ Manual payment methods (Bank Transfer, Cash)  
✅ Webhook payment confirmation  
✅ Order origin tracking (quote vs. direct purchase)  
✅ Operational orchestration and rollup status  

### Simulated Features (MOCK)
⚠️ **Payment confirmation for online methods is simulated** - When user places order with Mercado Pago or PayPal at checkout:
- Payment immediately marked as confirmed (amount_paid = total)
- Order automatically transitions: pending_payment → paid → in_production
- No actual payment redirect or webhook handling in checkout flow
- "Mock" payment in the sense of automatic confirmation without gateway interaction

### TODO / Future Enhancements
❌ Actual Mercado Pago/PayPal checkout integration (currently simulated)  
❌ Refund processing workflow  
❌ Partial payment handling (currently only binary paid/unpaid)  
❌ Multi-currency support (fixed to MXN)  
❌ Inventory management integration  
❌ Notification triggers (email/SMS at key milestones)  

---

## 15. DATABASE RELATIONSHIPS DIAGRAM

```
User (from Django)
├─ Cart (one-to-one) → CartItems → ProductVariants
├─ Orders (one-to-many, protected delete)
│  ├─ OrderLines (one-to-many, cascade)
│  │  ├─ ProductVariant (reference only)
│  │  └─ ProductionJobs (one-to-many)
│  ├─ ProductionJobs (one-to-many)
│  ├─ LogisticsJobs (one-to-many)
│  ├─ FieldOperationJobs (one-to-many)
│  ├─ OrderStatusHistory (one-to-many)
│  ├─ Payments (one-to-many)
│  ├─ Address (shipping/billing addresses - JSON snapshots at order time)
│  └─ Quote (internal reference for quote-converted orders)
│
├─ Addresses (many-to-one)
│  └─ (Sync with UserAddress profile)
│
├─ Payments (one-to-many)
│  └─ PaymentWebhookLog (one-to-many)
│
├─ QuoteRequests (one-to-many, if authenticated)
├─ Quotes (one-to-many, if customer linked)
└─ PreferenceMetadata (for sales tracking)

Quote
├─ QuoteRequest (one-to-one)
├─ QuoteLines (one-to-many)
├─ Orders (one-to-many, from quote conversion)
└─ Payments (one-to-many)

ProductVariant
└─ CartItems (back-reference)
└─ OrderLines (back-reference)
```

---

## 16. TRANSACTION & ATOMICITY PATTERNS

### Order Creation (must be atomic)
```python
with transaction.atomic():
    # Create Order
    # Create OrderLines
    # Create OrderStatusHistory
    # Optionally transition status (for online payments)
    # Build operational plan
    # Clear cart
    # → All succeed or all rollback
```

### Quote to Order Conversion (must be atomic)
```python
with transaction.atomic():
    # Create Order
    # Create OrderLines
    # Create OrderStatusHistory
    # Optionally transition status
    # Build operational plan
    # Update Quote.status
    # Update QuoteRequest.status
    # → All succeed or all rollback
```

### Payment Webhook Processing (idempotent)
```python
# Webhook event_id stored in PaymentWebhookLog
# If event_id already exists:
#   → Log processed=True, skip re-processing
# Prevents duplicate charge due to retry
```

---

## 17. AUDIT & LOGGING

All state changes logged via AuditLog:

```python
# Order Creation
AuditLog.log(
    entity=order,
    action=AuditLog.ACTION_CREATED,
    actor=request.user,
    after_state=OrderSerializer(order).data,
    metadata={'payment_method': 'mercadopago', ...}
)

# Status Transitions
OrderStatusHistory records all changes with:
- from_status
- to_status
- changed_by (user who initiated)
- notes (reason for change)

# Payment Processing
PaymentWebhookLog records all received events:
- event_id (provider's ID)
- payload (raw webhook data)
- processed (bool)
- processing_error (if failed)
```

---

## CONCLUSION

The MCD-Agencia system implements a **production-grade order management pipeline** with:

1. **Flexible Order Creation:** Cart checkout OR quote acceptance
2. **Multiple Payment Workflows:** Online (simulated immediate) or manual (admin-confirmed)
3. **Operational Orchestration:** Automatic generation of production/logistics/field ops jobs
4. **State Machine Enforcement:** Strict FSM prevents invalid transitions
5. **Full Audit Trail:** All changes tracked for compliance and debugging
6. **Origin Tracking:** Orders tagged with source (quote vs. direct) for analytics

**Key Design Principles:**
- Orders only created in `pending_payment` state after cart checkout
- Online payment methods simulated to immediate confirmation for MVP
- Manual payments require admin confirmation before production starts
- Quote-converted orders have full context preserved for traceability
- Operational jobs automatically generated and tracked independently
- All state changes atomic and audit-logged

