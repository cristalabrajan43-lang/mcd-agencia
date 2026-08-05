"""
Pagination Classes for MCD-Agencia API.

This module provides custom pagination classes used throughout the API.
These classes extend Django REST Framework's pagination to provide
consistent response formats and configurable page sizes.

Usage:
    # In a ViewSet
    class MyViewSet(ModelViewSet):
        pagination_class = StandardResultsSetPagination

    # Override page size per view
    class MyViewSet(ModelViewSet):
        pagination_class = LargeResultsSetPagination
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination class for API responses.

    Provides page-based pagination with configurable page sizes.
    Default page size is 10 items, max is 100.

    Response format:
        {
            "count": 100,           # Total number of items
            "total_pages": 10,      # Total number of pages
            "current_page": 1,      # Current page number
            "next": "http://...",   # URL to next page (null if last)
            "previous": null,       # URL to previous page (null if first)
            "results": [...]        # Array of items
        }

    Query parameters:
        page: Page number (default: 1)
        page_size: Items per page (default: 10, max: 100)
    """

    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100
    page_query_param = 'page'

    def get_paginated_response(self, data):
        """
        Return paginated response with additional metadata.

        Args:
            data: Serialized page data

        Returns:
            Response with pagination metadata
        """
        return Response({
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })

    def get_paginated_response_schema(self, schema):
        """
        Return schema for paginated response (for API documentation).

        Args:
            schema: Schema of the results array

        Returns:
            Complete paginated response schema
        """
        return {
            'type': 'object',
            'properties': {
                'count': {
                    'type': 'integer',
                    'description': 'Total number of items',
                    'example': 100,
                },
                'total_pages': {
                    'type': 'integer',
                    'description': 'Total number of pages',
                    'example': 5,
                },
                'current_page': {
                    'type': 'integer',
                    'description': 'Current page number',
                    'example': 1,
                },
                'next': {
                    'type': 'string',
                    'nullable': True,
                    'format': 'uri',
                    'description': 'URL to next page',
                },
                'previous': {
                    'type': 'string',
                    'nullable': True,
                    'format': 'uri',
                    'description': 'URL to previous page',
                },
                'results': schema,
            },
        }


class LargeResultsSetPagination(StandardResultsSetPagination):
    """
    Pagination for large result sets.

    Used for admin panels and bulk operations where more items
    per page are needed. Default page size is 50 items, max is 500.
    """

    page_size = 50
    max_page_size = 500


class SmallResultsSetPagination(StandardResultsSetPagination):
    """
    Pagination for small result sets.

    Used for mobile-optimized endpoints or preview lists.
    Default page size is 10 items, max is 50.
    """

    page_size = 10
    max_page_size = 50


# Aliases for backwards compatibility
StandardPagination = StandardResultsSetPagination
LargePagination = LargeResultsSetPagination
SmallPagination = SmallResultsSetPagination


class CursorPagination(PageNumberPagination):
    """
    Cursor-based pagination for real-time data.

    This pagination method is more efficient for large datasets
    and doesn't suffer from the "shifting window" problem when
    items are added or removed during pagination.

    Best used for:
        - Chat messages
        - Activity feeds
        - Audit logs
    """

    from rest_framework.pagination import CursorPagination as BaseCursorPagination

    page_size = 20
    ordering = '-created_at'
    cursor_query_param = 'cursor'
