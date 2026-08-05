'use client';

/**
 * Global Providers for MCD-Agencia
 *
 * This component wraps the application with all necessary providers:
 * - React Query (server state management)
 * - Toast notifications
 * - Auth Context
 * - Cart Context
 *
 * @module components/providers
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// =============================================================================
// Props Interface
// =============================================================================

interface ProvidersProps {
  children: React.ReactNode;
}

// =============================================================================
// Providers Component
// =============================================================================

export function Providers({ children }: ProvidersProps) {
  // Create a stable QueryClient instance
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: 5 minutes
            staleTime: 5 * 60 * 1000,
            // Cache time: 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry once on failure
            retry: 1,
            // Refetch on window focus (production)
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
          },
          mutations: {
            // Retry once on failure
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          // Default options
          duration: 4000,
          style: {
            background: '#262626',
            color: '#fff',
            border: '1px solid #404040',
          },
          // Success toast
          success: {
            iconTheme: {
              primary: '#00FFFF',
              secondary: '#000',
            },
          },
          // Error toast
          error: {
            iconTheme: {
              primary: '#FF00FF',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* React Query Devtools (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
