# MCD-Agencia Workflow: Quick Reference

## Payment Methods Enabled for Direct Checkout

### Configured Methods
- **Mercado Pago** → Online payment (simulated immediate)
- **PayPal** → Online payment (simulated immediate)  
- **Bank Transfer** → Manual payment (admin-approved)
- **Cash** → Manual payment (admin-approved)

**File Reference:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L409)

---

## Order Creation Flows

### Flow 1: Direct Cart Checkout

```
User → Cart (items) → Checkout Page → Select Address + Delivery + Payment
                                    ↓
                              Create Order (pending_payment)
                                    ↓
                    Online Payment?      Manual Payment?
                          ↓                     ↓
            amount_paid = total         amount_paid = $0
            pending_payment             pending_payment
                ↓                            ↓
                paid              [Awaiting admin confirmation]
                ↓
            in_production
                ↓
            [ProductionJobs created]
```

**Endpoint:** `POST /api/v1/orders/create_order/`
**File:** [backend/apps/orders/views.py](backend/apps/orders/views.py#L540)

### Flow 2: Quote Acceptance → Auto-Conversion

```
Customer accepts quote (POST /quotes/{id}/accept/)
                    ↓
         Quote.status = accepted
                    ↓
    [Check if quote.customer exists]
                    ↓
         YES: Auto-convert to Order
         ├─ Create Order (pending_payment)
         ├─ Copy QuoteLines → OrderLines
         ├─ Mark Quote.status = converted
         └─ [Same payment flow as #1]
         
         NO: Quote.status = accepted (no auto-order)
             [Admin must convert manually later]
```

**Endpoints:** 
- `POST /quotes/{id}/accept/` (customer)
- `POST /quotes/{id}/convert_to_order/` (admin)

**Files:**
- [backend/apps/quotes/views.py](backend/apps/quotes/views.py#L1219) - Accept
- [backend/apps/quotes/views.py](backend/apps/quotes/views.py#L1072) - Conversion logic

---

## Order Status Workflow (State Machine)

### Main Path (Standard Purchase)
```
pending_payment
    ├─ amount_paid < total?
    │   ├─ Manual methods stay here [require admin confirmation]
    │   └─ Online methods auto-transition ↓
    ├─ Admin confirms payment → paid
    └─ paid → in_production
              ├─ [Production team processes]
              └─ All jobs released → ready
                    ├─ ready → in_delivery [if shipping]
                    │          → delivered [arrives]
                    ├─ ready → completed [if pickup]
                    └─ [Customer picks up at branch]
```

### States
- `draft` - Not used for direct purchases
- `pending_payment` - Default for new orders
- `paid` - Full payment confirmed
- `partially_paid` - Deposit only (reserved for future)
- `in_production` - Production team working
- `ready` - Ready for delivery/pickup
- `in_delivery` - In transit (shipping only)
- `completed` - Delivered/finished
- `cancelled` - Order cancelled
- `refunded` - Refund issued

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L263)

---

## Production Workflow

### Production Job States

| Status | Next | Trigger |
|--------|------|---------|
| `queued` | preparing | Production team starts |
| `preparing` | in_production | Setup complete |
| `in_production` | quality_check | Work complete |
| `quality_check` | released | QA passed |
| | blocked | QA failed (needs fix) |
| `blocked` | preparing | Issue resolved |
| `released` | — | Ready for logistics |

When **all ProductionJobs = released**:
- Order auto-transitions: `in_production` → `ready`

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L871)
**Dashboard:** [frontend/src/app/[locale]/dashboard/produccion/page.tsx](frontend/src/app/[locale]/dashboard/produccion/page.tsx)

---

## Logistics Workflow

### Logistics Job States (for `delivery_method = 'shipping'`)

| Status | Next | Trigger | Notes |
|--------|------|---------|-------|
| `pending_dispatch` | scheduled | Route assigned | Initial state |
| `scheduled` | in_transit | Dispatch confirmed | Delivery window set |
| `in_transit` | delivered | Delivery attempt | Customer receives |
| | delivery_failed | Delivery failed | Retry needed |
| `delivery_failed` | scheduled | Reschedule | Try again |
| `ready_for_pickup` | delivered | Customer picks up | For pickup method |

When **LogisticsJob = delivered**:
- Order auto-transitions: `in_delivery` → `completed`

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L925)
**Dashboard:** [frontend/src/app/[locale]/dashboard/logistica/page.tsx](frontend/src/app/[locale]/dashboard/logistica/page.tsx)

---

## Field Operations Workflow

### Installation Job States (for `delivery_method = 'installation'`)

| Status | Next | Notes |
|--------|------|-------|
| `scheduled` | crew_assigned | Crew assigned |
| `crew_assigned` | in_progress | Work starts |
| `in_progress` | completed | Work finished |
| | paused | Temporary pause |
| | requires_revisit | Quality issue found |
| `requires_revisit` | in_progress | Re-do work |
| `paused` | in_progress | Resume work |

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L995)
**Dashboard:** [frontend/src/app/[locale]/dashboard/operaciones-campo/page.tsx](frontend/src/app/[locale]/dashboard/operaciones-campo/page.tsx)

---

## Order Origin Tracking

Orders are tagged with origin for analytics:

```python
Order.ORIGIN_QUOTE = 'quote_conversion'          # ← From accepted quote
Order.ORIGIN_DIRECT_PURCHASE = 'direct_purchase' # ← From cart checkout
Order.ORIGIN_MANUAL = 'manual'                   # ← Created by admin
```

### Implications:
- **Quote orders** preserve full quote metadata in OrderLine.metadata
- **Direct purchases** store only product references
- **Separate revenue reporting** possible by origin

---

## Operational Orchestration

### Automatic Job Generation

When order transitions to `in_production`:

```
For each OrderLine:
  └─ Create ProductionJob (status="queued")

Based on delivery_method:
  ├─ 'shipping'
  │  └─ Create LogisticsJob (status="pending_dispatch")
  │     └─ Address snapshot = shipping_address
  │
  ├─ 'pickup'
  │  └─ Create LogisticsJob (status="ready_for_pickup")
  │     └─ pickup_branch stored
  │
  ├─ 'installation'
  │  └─ Create FieldOperationJob (status="scheduled")
  │     └─ location_snapshot = delivery_address
  │
  └─ 'digital'
     └─ No logistics job needed
```

**File:** [backend/apps/orders/services/operations.py](backend/apps/orders/services/operations.py#L1)

### Operational Rollup Status

Aggregated status across all jobs:

```
OP_ROLLUP_PLANNED             # Awaiting start
OP_ROLLUP_IN_EXECUTION        # Production/Logistics/Field actively working
OP_ROLLUP_AWAITING_FINALIZATION  # Waiting final step
OP_ROLLUP_COMPLETED           # All jobs done
OP_ROLLUP_ON_HOLD             # Blocked/paused (requires attention)
```

**File:** [backend/apps/orders/services/operations.py](backend/apps/orders/services/operations.py#L200)

---

## Payment Processing Flow

### Online Payments (Mercado Pago, PayPal)

**Current Implementation: SIMULATED**

```
1. Customer creates order with mercadopago/paypal
2. Backend immediately marks: amount_paid = order.total
3. Order transitions: pending_payment → paid → in_production
4. Production starts immediately
```

**Note:** Actual payment provider integration (checkout redirect, webhooks, confirmation) not fully implemented yet.

**File:** [backend/apps/orders/views.py](backend/apps/orders/views.py#L610)

### Manual Payments (Bank Transfer, Cash)

```
1. Customer creates order with bank_transfer/cash
2. Order stays: pending_payment, amount_paid = $0
3. Customer sees payment details in order dashboard
4. Customer transfers/pays cash at branch
5. Admin receives payment confirmation
6. Admin marks order as paid:
   └─ Sets amount_paid = order.total
   └─ Transitions: pending_payment → paid → in_production
7. Production starts
```

**Admin Action:** `PATCH /admin/orders/{id}/` + Payment received webhook

---

## Quote Management

### Quote States

| Status | Meaning |
|--------|---------|
| `draft` | Sales team creating quote |
| `sent` | Sent to customer (email) |
| `viewed` | Customer opened email/link |
| `changes_requested` | Customer asked for modifications |
| `accepted` | Customer accepted → Auto-converts to order |
| `rejected` | Customer rejected |
| `expired` | Validity date passed |
| `converted` | Order created from quote |

**Critical:** On `accepted` status:
- If `quote.customer` is linked → Order auto-created
- If `quote.customer = NULL` → Quote stays accepted, admin must convert manually

**File:** [backend/apps/quotes/models.py](backend/apps/quotes/models.py#L600)

---

## Key API Endpoints

### Order Management
```
POST   /api/v1/orders/create_order/
GET    /api/v1/orders/
GET    /api/v1/orders/{id}/
POST   /api/v1/orders/{id}/cancel/
```

### Admin Order Management
```
GET    /api/v1/admin/orders/
PATCH  /api/v1/admin/orders/{id}/
POST   /api/v1/admin/orders/{id}/update-status/
```

### Production Management
```
GET    /api/v1/admin/orders/production-jobs/
POST   /api/v1/admin/orders/{orderId}/production-jobs/{jobId}/update-status/
```

### Logistics Management
```
GET    /api/v1/admin/orders/operations-jobs/?job_type=logistics
POST   /api/v1/admin/orders/{orderId}/logistics-jobs/{jobId}/update-status/
```

### Field Operations
```
GET    /api/v1/admin/orders/operations-jobs/?job_type=field_ops
POST   /api/v1/admin/orders/{orderId}/field-ops-jobs/{jobId}/update-status/
```

### Quotes
```
POST   /api/v1/quotes/{id}/accept/
POST   /api/v1/quotes/{id}/convert_to_order/
GET    /api/v1/quotes/view/{token}/  [public, no auth]
```

---

## Data Models

### Core Models
- **Order** - Main order record (FSM states, totals, tracking)
- **OrderLine** - Line items (snapshot of product data at order time)
- **OrderStatusHistory** - Audit trail of status changes
- **ProductionJob** - Production tracking per order line
- **LogisticsJob** - Shipping/pickup tracking
- **FieldOperationJob** - Installation/service tracking
- **Cart** - Ephemeral shopping cart before checkout
- **CartItem** - Items in cart
- **Address** - Shipping/billing address (reusable)
- **Payment** - Payment transaction record
- **PaymentWebhookLog** - Webhook event log (deduplication)

### Quote Models
- **QuoteRequest** - Customer's RFQ
- **Quote** - Sales team's quotation
- **QuoteLine** - Line items in quote

**File Reference:**
- Orders: [backend/apps/orders/models.py](backend/apps/orders/models.py)
- Quotes: [backend/apps/quotes/models.py](backend/apps/quotes/models.py)
- Payments: [backend/apps/payments/models.py](backend/apps/payments/models.py)

---

## Important Behaviors

### Order Creation Clears Cart
Once checkout completes and order is created, **all CartItems are deleted**. User must re-add items if they want to continue shopping.

**File:** [backend/apps/orders/views.py](backend/apps/orders/views.py#L660)

### Addresses Are Snapshots
- Order stores shipping/billing as **JSON snapshots** (immutable)
- If customer address changes later, order still has original delivery address
- Separate `delivery_address` field stores final delivery location

**File:** [backend/apps/orders/models.py](backend/apps/orders/models.py#L360)

### Quote Lines Become Order Lines with Full Context
When quote converts to order:
- Each QuoteLine becomes an OrderLine
- Full metadata preserved in `OrderLine.metadata`
- Quote context (quote_request_service_type, etc.) stored for traceability
- SKU generated as: `Q-{quote_number}-{line_position}`

**File:** [backend/apps/quotes/views.py](backend/apps/quotes/views.py#L1118)

### Payment Methods Are Locked at Order Creation
- Once order created with payment_method = 'mercadopago'
- **Cannot change** to 'bank_transfer' later
- For manual payment methods, admin can initiate payment retry

### Delivery Method Determines Job Type
```
delivery_method = 'shipping'       → LogisticsJob (pending_dispatch)
delivery_method = 'pickup'         → LogisticsJob (ready_for_pickup)
delivery_method = 'installation'   → FieldOperationJob (scheduled)
```

---

## Current Limitations

⚠️ **IMPORTANT IMPLEMENTATION NOTES:**

1. **Online Payment is Simulated**
   - No actual redirect to Mercado Pago/PayPal checkout
   - No real payment processing
   - Immediate confirmation for MVP/testing

2. **No Refund Workflow**
   - Orders can transition to `refunded` but no actual processing
   - Requires payment provider integration

3. **Manual Payments Depend on Admin**
   - No automated payment entry (e.g., from accounting)
   - Admin must manually mark as paid

4. **No Partial Payments**
   - Supports `partially_paid` state but UI/logic minimal
   - Transitions intended for future use

---

## Summary: What Gets Generated Automatically

✅ **Order Creation:**
- Order status set to `pending_payment`
- OrderStatusHistory entry created
- Audit log entry created

✅ **When Paid (Online or Admin-confirmed):**
- Order transitions to `paid`
- Order transitions to `in_production`
- Build operational plan:
  - ProductionJobs created (one per OrderLine)
  - LogisticsJob or FieldOperationJob created based on delivery_method
  - operation_plan JSON with dependency map

❌ **NOT Automatically Generated:**
- Payment records (created only when customer initiates)
- Notification emails (except quote conversion confirmation)
- Inventory decrements (depends on inventory app integration)

---

**Last Updated:** May 2, 2026  
**For Full Details:** See [PAYMENT_ORDER_WORKFLOW_ANALYSIS.md](PAYMENT_ORDER_WORKFLOW_ANALYSIS.md)
