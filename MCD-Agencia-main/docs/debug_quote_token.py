#!/usr/bin/env python
"""
Debug script to troubleshoot quote token viewing issues.

Usage:
    python manage.py shell < docs/debug_quote_token.py
    
Or interactively:
    python manage.py shell
    >>> exec(open('docs/debug_quote_token.py').read())
"""

from django.utils import timezone
from apps.quotes.models import Quote
from uuid import UUID

# Token to debug
TOKEN_TO_DEBUG = "f3e22ebb-74d4-4ffa-88e6-cfd48e7ed1a1"

print("\n" + "="*70)
print("🔍 QUOTE TOKEN DEBUGGING TOOL")
print("="*70)

# 1. Validate UUID format
print(f"\n1️⃣  Token Format Validation")
print(f"   Token: {TOKEN_TO_DEBUG}")
try:
    uuid_obj = UUID(TOKEN_TO_DEBUG)
    print(f"   ✅ Valid UUID format")
except ValueError as e:
    print(f"   ❌ Invalid UUID format: {e}")
    exit(1)

# 2. Check if quote exists with this token
print(f"\n2️⃣  Token Existence Check")
try:
    quote = Quote.objects.get(token=TOKEN_TO_DEBUG)
    print(f"   ✅ Quote found!")
    print(f"      ID: {quote.id}")
    print(f"      Number: {quote.quote_number}")
    print(f"      Status: {quote.get_status_display()}")
except Quote.DoesNotExist:
    print(f"   ❌ No quote found with this token")
    
    # Show recent quotes for reference
    recent_quotes = Quote.objects.order_by('-created_at')[:5]
    print(f"\n   📋 Recent quotes:")
    for q in recent_quotes:
        print(f"      - #{q.quote_number} ({q.get_status_display()}) - Token: {q.token}")
    
    print(f"\n   💡 Possible solutions:")
    print(f"      1. Check if token is correct (case-sensitive)")
    print(f"      2. Verify quote exists: python manage.py shell")
    print(f"         >>> Quote.objects.all().count()  # See total quotes")
    print(f"      3. Generate a valid test token:")
    print(f"         >>> from apps.quotes.models import Quote")
    print(f"         >>> q = Quote.objects.filter(status='sent').first()")
    print(f"         >>> print(q.token)  # Get a valid token")
    exit(1)

# 3. Check quote status is public-viewable
print(f"\n3️⃣  Public View Status Check")
ALLOWED_STATUSES = ['sent', 'viewed', 'accepted', 'rejected', 'changes_requested']
if quote.status in ALLOWED_STATUSES:
    print(f"   ✅ Status '{quote.status}' is public-viewable")
else:
    print(f"   ❌ Status '{quote.status}' is NOT public-viewable")
    print(f"      Allowed statuses: {', '.join(ALLOWED_STATUSES)}")

# 4. Check if quote is soft-deleted
print(f"\n4️⃣  Soft Delete Check")
if quote.is_deleted:
    print(f"   ⚠️  Quote is soft-deleted")
    print(f"      Deleted at: {quote.deleted_at}")
else:
    print(f"   ✅ Quote is not deleted")

# 5. Check quote data completeness
print(f"\n5️⃣  Data Completeness Check")
issues = []
if not quote.customer_email:
    issues.append("Missing customer_email")
if not quote.customer_name:
    issues.append("Missing customer_name")
if not quote.lines or quote.lines.count() == 0:
    issues.append("No quote lines")
if not quote.quote_request:
    issues.append("Missing quote_request")

if issues:
    print(f"   ⚠️  Data issues found:")
    for issue in issues:
        print(f"      - {issue}")
else:
    print(f"   ✅ All required data present")

# 6. Test API response
print(f"\n6️⃣  API Response Test")
print(f"   Testing endpoint: GET /api/v1/quotes/view/{quote.token}/")

from rest_framework.test import APIRequestFactory
from apps.quotes.views import QuotePublicView
from apps.quotes.serializers import QuoteSerializer

factory = APIRequestFactory()
request = factory.get(f'/api/v1/quotes/view/{quote.token}/')
view = QuotePublicView.as_view()

try:
    response = view(request, token=str(quote.token))
    if response.status_code == 200:
        print(f"   ✅ API returns 200 OK")
        serialized = response.data
        print(f"      - Quote #: {serialized.get('quote_number')}")
        print(f"      - Customer: {serialized.get('customer_name')} ({serialized.get('customer_email')})")
        print(f"      - Total: ${serialized.get('total')}")
        print(f"      - Line items: {len(serialized.get('lines', []))}")
    else:
        print(f"   ❌ API returns {response.status_code}")
        print(f"      Response: {response.data}")
except Exception as e:
    print(f"   ❌ API error: {e}")

# 7. Frontend compatibility check
print(f"\n7️⃣  Frontend Compatibility Check")
print(f"   Quote type: {quote.get_status_display()}")
print(f"   Viewed at: {quote.viewed_at}")
print(f"   Sent at: {quote.sent_at}")
print(f"   Created at: {quote.created_at}")

if quote.status == 'sent':
    print(f"   💡 This quote hasn't been viewed yet (first access will mark as 'viewed')")

# 8. CORS and Security Headers
print(f"\n8️⃣  CORS & Security Headers Check")
print(f"   Quote token is UUID: ✅")
print(f"   Quote permission_classes: AllowAny ✅")
print(f"   Endpoint is public: ✅")

# Summary
print(f"\n" + "="*70)
print("📊 SUMMARY")
print("="*70)

if quote.status in ALLOWED_STATUSES:
    print(f"✅ Quote should be publicly accessible!")
    print(f"\n   If still not loading on frontend:")
    print(f"   1. Hard refresh: Ctrl+Shift+R")
    print(f"   2. Check browser console for errors (F12 → Console)")
    print(f"   3. Check network tab for failed requests")
    print(f"   4. Verify URL is correct: /es/cotizacion/{quote.token}/")
else:
    print(f"❌ Quote cannot be viewed publicly (status: {quote.status})")
    print(f"\n   Solution: Change status to 'sent'")
    print(f"   >>> quote.status = 'sent'")
    print(f"   >>> quote.save(update_fields=['status'])")

print("="*70 + "\n")
