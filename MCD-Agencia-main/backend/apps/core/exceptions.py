"""
Custom Exception Handlers for MCD-Agencia API.

This module provides custom exception handling for Django REST Framework.
It ensures consistent error response formats across the entire API.

Response format for errors:
    {
        "success": false,
        "error": {
            "code": "validation_error",
            "message": "Invalid input data",
            "details": {...}
        }
    }

Usage:
    # Raise a custom exception in a view
    from apps.core.exceptions import ValidationError

    raise ValidationError("Email already exists", code="email_exists")
"""

import logging

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler for Django REST Framework.

    This handler catches all exceptions and formats them consistently.
    It also logs errors for monitoring and debugging.

    Args:
        exc: The exception that was raised
        context: Additional context (view, request, etc.)

    Returns:
        Response with formatted error message
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # Get the view name for logging
    view = context.get('view', None)
    view_name = view.__class__.__name__ if view else 'Unknown'

    # Handle Django's Http404
    if isinstance(exc, Http404):
        response = Response(
            {
                'success': False,
                'error': {
                    'code': 'not_found',
                    'message': str(exc) or 'Resource not found',
                    'details': None,
                }
            },
            status=status.HTTP_404_NOT_FOUND
        )
        return response

    # Handle Django's PermissionDenied
    if isinstance(exc, PermissionDenied):
        response = Response(
            {
                'success': False,
                'error': {
                    'code': 'permission_denied',
                    'message': str(exc) or 'Permission denied',
                    'details': None,
                }
            },
            status=status.HTTP_403_FORBIDDEN
        )
        return response

    # Handle Django's ValidationError
    if isinstance(exc, DjangoValidationError):
        response = Response(
            {
                'success': False,
                'error': {
                    'code': 'validation_error',
                    'message': 'Validation error',
                    'details': exc.message_dict if hasattr(exc, 'message_dict') else {'error': exc.messages},
                }
            },
            status=status.HTTP_400_BAD_REQUEST
        )
        return response

    # If DRF handled the exception, format the response
    if response is not None:
        # Extract error details
        if isinstance(response.data, dict):
            details = response.data
            # Try to get a meaningful message
            if 'detail' in response.data:
                message = str(response.data['detail'])
                details = None
            elif 'non_field_errors' in response.data:
                message = response.data['non_field_errors'][0]
                details = {k: v for k, v in response.data.items() if k != 'non_field_errors'}
            else:
                # Use the first field-level error as the top-level message
                first_error = None
                for _field, errors in response.data.items():
                    if isinstance(errors, list) and errors:
                        first_error = str(errors[0])
                        break
                    elif isinstance(errors, str):
                        first_error = errors
                        break
                message = first_error or 'Error de validación'
        elif isinstance(response.data, list):
            message = response.data[0] if response.data else 'An error occurred'
            details = None
        else:
            message = str(response.data)
            details = None

        # Determine error code based on status
        error_codes = {
            400: 'bad_request',
            401: 'unauthorized',
            403: 'forbidden',
            404: 'not_found',
            405: 'method_not_allowed',
            406: 'not_acceptable',
            409: 'conflict',
            415: 'unsupported_media_type',
            429: 'throttled',
            500: 'internal_error',
        }
        error_code = error_codes.get(response.status_code, 'error')

        # Override with custom code if available
        if hasattr(exc, 'default_code'):
            error_code = exc.default_code

        response.data = {
            'success': False,
            'error': {
                'code': error_code,
                'message': message,
                'details': details,
            }
        }

        # Log the error
        if response.status_code >= 500:
            logger.error(
                f"Server error in {view_name}: {message}",
                exc_info=exc,
                extra={'request': context.get('request')}
            )
        elif response.status_code >= 400:
            logger.warning(
                f"Client error in {view_name}: {message}",
                extra={'request': context.get('request')}
            )

        return response

    # Unhandled exception - log and return generic error
    logger.exception(
        f"Unhandled exception in {view_name}",
        exc_info=exc,
        extra={'request': context.get('request')}
    )

    return Response(
        {
            'success': False,
            'error': {
                'code': 'internal_error',
                'message': 'An unexpected error occurred',
                'details': None,
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


# =============================================================================
# CUSTOM API EXCEPTIONS
# =============================================================================

class BaseAPIException(APIException):
    """
    Base exception class for custom API exceptions.

    All custom exceptions should inherit from this class to ensure
    consistent error handling and response formatting.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'An error occurred'
    default_code = 'error'

    def __init__(self, detail=None, code=None):
        """
        Initialize the exception.

        Args:
            detail: Human-readable error message
            code: Machine-readable error code
        """
        if detail is not None:
            self.detail = detail
        else:
            self.detail = self.default_detail

        if code is not None:
            self.default_code = code


class ValidationError(BaseAPIException):
    """
    Exception for validation errors.

    Use when user input fails validation.

    Example:
        raise ValidationError("Email is invalid", code="invalid_email")
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Invalid input data'
    default_code = 'validation_error'


class NotFoundError(BaseAPIException):
    """
    Exception for resource not found errors.

    Use when a requested resource doesn't exist.

    Example:
        raise NotFoundError("Product not found", code="product_not_found")
    """

    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Resource not found'
    default_code = 'not_found'


class ConflictError(BaseAPIException):
    """
    Exception for conflict errors.

    Use when an action conflicts with the current state.

    Example:
        raise ConflictError("Email already registered", code="email_exists")
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Resource conflict'
    default_code = 'conflict'


class PermissionDeniedError(BaseAPIException):
    """
    Exception for permission denied errors.

    Use when the user lacks permission for an action.

    Example:
        raise PermissionDeniedError("Only admins can access this resource")
    """

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = 'Permission denied'
    default_code = 'permission_denied'


class PaymentError(BaseAPIException):
    """
    Exception for payment-related errors.

    Use when a payment operation fails.

    Example:
        raise PaymentError("Payment declined", code="payment_declined")
    """

    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_detail = 'Payment error'
    default_code = 'payment_error'


class QuoteExpiredError(BaseAPIException):
    """
    Exception for expired quotations.

    Use when attempting to accept an expired quote.

    Example:
        raise QuoteExpiredError("This quotation has expired")
    """

    status_code = status.HTTP_410_GONE
    default_detail = 'Quotation has expired'
    default_code = 'quote_expired'


class InsufficientStockError(BaseAPIException):
    """
    Exception for insufficient stock errors.

    Use when there's not enough stock to fulfill an order.

    Example:
        raise InsufficientStockError("Only 5 items available")
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Insufficient stock'
    default_code = 'insufficient_stock'


class RateLimitError(BaseAPIException):
    """
    Exception for rate limit exceeded.

    Use when a user has exceeded the rate limit.

    Example:
        raise RateLimitError("Too many requests, please try again later")
    """

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = 'Rate limit exceeded'
    default_code = 'rate_limited'
