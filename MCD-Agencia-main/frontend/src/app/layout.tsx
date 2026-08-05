/**
 * Root Layout for MCD-Agencia
 * This is a minimal layout for non-localized routes (like /auth/callback)
 */

import '@/styles/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950 text-white">
        {children}
      </body>
    </html>
  );
}
