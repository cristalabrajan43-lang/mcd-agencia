"""
Core Application for MCD-Agencia.

This app provides base models, utilities, and shared functionality used
across all other applications in the platform.

Features:
    - Base abstract models with common fields (timestamps, soft delete)
    - Custom pagination classes
    - Exception handlers
    - Utility functions
    - Health check endpoints
"""

default_app_config = 'apps.core.apps.CoreConfig'
