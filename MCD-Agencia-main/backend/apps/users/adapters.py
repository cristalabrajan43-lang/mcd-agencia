"""
Custom Allauth Adapters for MCD-Agencia.

This module provides custom adapters for django-allauth to handle
OAuth authentication flow with JWT tokens for the SPA frontend.
"""

from django.conf import settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

# Whitelist of allowed redirect path prefixes to prevent open redirect attacks
ALLOWED_REDIRECT_PREFIXES = [
    '/es',
    '/en',
    '/catalogo',
    '/mi-cuenta',
    '/ventas',
    '/admin',
    '/checkout',
    '/cart',
    '/cotizacion',
]


def is_valid_redirect_url(url: str) -> bool:
    """
    Validates a redirect URL to prevent open redirect attacks.
    Only allows internal paths that start with allowed prefixes.
    """
    if not url or not isinstance(url, str):
        return False

    # Must start with a single forward slash (not //)
    if not url.startswith('/') or url.startswith('//'):
        return False

    # Check for protocol injection attempts
    lower_url = url.lower()
    if any(proto in lower_url for proto in ['javascript:', 'data:', 'vbscript:', 'file:']):
        return False

    # Must match one of the allowed prefixes
    return any(
        url == prefix or url.startswith(f'{prefix}/') or url.startswith(f'{prefix}?')
        for prefix in ALLOWED_REDIRECT_PREFIXES
    )


class CustomAccountAdapter(DefaultAccountAdapter):
    """
    Custom account adapter to handle redirects to frontend.
    """

    def get_login_redirect_url(self, request):
        """
        Always redirect to our JWT callback endpoint after login.
        Store the original 'next' URL in session for later use.
        """
        # Default safe redirect
        default_redirect = '/es'

        # Get the next parameter from various sources
        next_url = (
            request.GET.get('next') or
            request.POST.get('next') or
            request.session.get('next') or
            request.session.get('socialaccount_state', (None, None))[1] if isinstance(request.session.get('socialaccount_state'), tuple) else None or
            default_redirect
        )

        # Validate redirect URL to prevent open redirect attacks
        if not is_valid_redirect_url(next_url):
            next_url = default_redirect

        # Store it in session for the callback view to use
        request.session['oauth_next'] = next_url
        request.session.modified = True

        # Always redirect to our JWT callback
        return '/api/v1/auth/google/callback/'


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom social account adapter to handle OAuth signups and redirects.
    """

    def pre_social_login(self, request, sociallogin):
        """
        Called before the social login is processed.
        - Connect existing users by email automatically
        - Store the next URL from the state with validation.
        """
        from apps.users.models import User

        # If social account already connected, nothing to do
        if sociallogin.is_existing:
            return

        # Check if a user with this email already exists
        email = sociallogin.account.extra_data.get('email')
        if email:
            try:
                existing_user = User.objects.get(email__iexact=email)
                # Connect the social account to the existing user
                sociallogin.connect(request, existing_user)
            except User.DoesNotExist:
                pass  # New user, will be created

        # Default safe redirect
        default_redirect = '/es'

        # Try to get next URL from the original request state
        state = request.session.get('socialaccount_state')
        if state and isinstance(state, tuple) and len(state) > 1:
            next_url = state[1]
            # Validate redirect URL to prevent open redirect attacks
            if next_url and is_valid_redirect_url(next_url):
                request.session['oauth_next'] = next_url
                request.session.modified = True
            elif next_url:
                # Invalid URL provided, use default
                request.session['oauth_next'] = default_redirect
                request.session.modified = True

    def get_login_redirect_url(self, request):
        """
        Always redirect to our JWT callback endpoint after OAuth login.
        """
        return '/api/v1/auth/google/callback/'

    def get_connect_redirect_url(self, request, socialaccount):
        """
        Redirect after connecting a social account.
        """
        return '/api/v1/auth/google/callback/'

    def populate_user(self, request, sociallogin, data):
        """
        Populate user data from social account.
        """
        user = super().populate_user(request, sociallogin, data)
        
        # Set first_name and last_name from OAuth data
        if not user.first_name and data.get('first_name'):
            user.first_name = data.get('first_name', '')
        if not user.last_name and data.get('last_name'):
            user.last_name = data.get('last_name', '')
            
        return user

    def save_user(self, request, sociallogin, form=None):
        """
        Save user and mark email as verified for OAuth users.
        """
        user = super().save_user(request, sociallogin, form)

        # Mark email as verified for OAuth users since Google verified it
        user.is_email_verified = True
        user.save(update_fields=['is_email_verified'])

        # In-app notification to admins: new user via Google OAuth
        try:
            from apps.notifications.models import Notification
            Notification.notify_admins(
                notification_type=Notification.TYPE_NEW_USER,
                title='Nuevo usuario (Google)',
                message=f'{user.full_name} ({user.email})',
                entity_type='User',
                entity_id=user.id,
                action_url='/dashboard/clientes',
            )
        except Exception:
            pass

        return user
