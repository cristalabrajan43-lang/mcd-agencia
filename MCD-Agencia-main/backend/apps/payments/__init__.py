"""
Payments Application for MCD-Agencia.

This app handles payment processing including:
    - Payment gateway integrations (Mercado Pago, PayPal)
    - Webhook handling for payment confirmations
    - Payment tracking and history
    - Refund processing
"""

default_app_config = 'apps.payments.apps.PaymentsConfig'
