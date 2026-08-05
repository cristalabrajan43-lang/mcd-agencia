"""
Users Application for MCD-Agencia.

This app handles user management, authentication, and authorization including:
    - Custom user model with email-based authentication
    - Role-based access control (RBAC)
    - User registration and verification
    - OAuth integration (Google)
    - Consent management
    - Fiscal data management
"""

default_app_config = 'apps.users.apps.UsersConfig'
