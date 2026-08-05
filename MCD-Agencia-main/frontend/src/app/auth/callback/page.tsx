'use client';

/**
 * OAuth Callback Page for MCD-Agencia.
 *
 * This page handles the callback from OAuth providers (Google).
 * It receives JWT tokens from the backend and stores them in localStorage,
 * then redirects immediately to the landing page.
 *
 * This page is invisible during normal operation - it only shows UI on error.
 */

import { useEffect, useState } from 'react';

// Whitelist of allowed redirect path prefixes to prevent open redirect attacks
const ALLOWED_REDIRECT_PREFIXES = [
  '/es',
  '/en',
  '/catalogo',
  '/mi-cuenta',
  '/dashboard',
  '/checkout',
  '/cart',
  '/cotizacion',
];

/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows internal paths that start with allowed prefixes.
 */
function isValidRedirectUrl(url: string): boolean {
  // Must start with a single forward slash (not //)
  if (!url.startsWith('/') || url.startsWith('//')) {
    return false;
  }

  // Check for protocol injection attempts
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('javascript:') || lowerUrl.includes('data:') || lowerUrl.includes('vbscript:')) {
    return false;
  }

  // Must match one of the allowed prefixes
  return ALLOWED_REDIRECT_PREFIXES.some(prefix =>
    url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)
  );
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Default safe redirect
    const DEFAULT_REDIRECT = '/es';

    // Process immediately on mount
    const urlParams = new URLSearchParams(window.location.search);

    // Check for error from OAuth
    const oauthError = urlParams.get('error');
    if (oauthError) {
      setError(oauthError === 'authentication_failed'
        ? 'Error de autenticación. Por favor intenta de nuevo.'
        : 'Ocurrió un error durante el inicio de sesión.');
      return;
    }

    // Get tokens from URL
    const accessToken = urlParams.get('access');
    const refreshToken = urlParams.get('refresh');

    if (!accessToken || !refreshToken) {
      setError('No se recibieron los tokens de autenticación.');
      return;
    }

    // Store tokens
    try {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    } catch {
      setError('Error al guardar la sesión.');
      return;
    }

    // Get destination URL with validation
    let nextUrl = urlParams.get('next') || DEFAULT_REDIRECT;
    try {
      const storedRedirect = sessionStorage.getItem('oauth_redirect');
      if (storedRedirect) {
        nextUrl = storedRedirect;
        sessionStorage.removeItem('oauth_redirect');
      }
    } catch {
      // Ignore sessionStorage errors
    }

    // Validate redirect URL to prevent open redirect attacks
    const destination = isValidRedirectUrl(nextUrl) ? nextUrl : DEFAULT_REDIRECT;
    window.location.replace(destination);
  }, []);

  // Only show UI if there's an error - otherwise render nothing (invisible page)
  if (!error) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <div className="text-center p-8">
        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-white text-lg">Error de autenticación</p>
        <p className="text-neutral-400 mt-2">{error}</p>
        <button
          onClick={() => window.location.href = '/es/login'}
          className="mt-4 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}
