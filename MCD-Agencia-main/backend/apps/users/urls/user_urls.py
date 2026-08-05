"""
User URLs for MCD-Agencia.

This module provides URL routing for user endpoints:
    - Profile management
    - Fiscal data
    - Consents
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from ..views import (
    UserProfileView,
    ChangePasswordView,
    RoleViewSet,
    UserConsentViewSet,
    FiscalDataViewSet,
    UserAddressViewSet,
    UserAdminViewSet,
    SalesRepsView,
    AdminCreateUserView,
    AdminAssignGroupView,
    VerifyTemporaryPasswordView,
    CompleteUserSetupView,
)

app_name = 'users'

router = DefaultRouter()
router.register('roles', RoleViewSet, basename='roles')
router.register('consents', UserConsentViewSet, basename='consents')
router.register('fiscal-data', FiscalDataViewSet, basename='fiscal-data')
router.register('addresses', UserAddressViewSet, basename='addresses')

urlpatterns = [
    # Profile
    path('me/', UserProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),

    # Sales Reps (for quote assignment)
    path('sales-reps/', SalesRepsView.as_view(), name='sales_reps'),
    
    # User setup and verification
    path('verify-temp-password/', VerifyTemporaryPasswordView.as_view(), name='verify-temp-password'),
    path('complete-setup/', CompleteUserSetupView.as_view(), name='complete-setup'),

    # ViewSets
    path('', include(router.urls)),
]


# Admin URLs (to be included separately)
admin_router = DefaultRouter()
admin_router.register('', UserAdminViewSet, basename='admin-users')

admin_urlpatterns = [
    path('', include(admin_router.urls)),
    path('create_with_password/', AdminCreateUserView.as_view(), name='admin-create-user'),
    path('<str:user_id>/assign_group/', AdminAssignGroupView.as_view(), name='admin-assign-group'),
]
