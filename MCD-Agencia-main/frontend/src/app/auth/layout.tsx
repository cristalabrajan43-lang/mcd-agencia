/**
 * Auth Layout - Redirect to locale-specific auth pages
 * This file handles redirects for non-localized auth URLs
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout should not be used directly - auth routes should use [locale]/(auth)
  // Return a minimal layout that won't cause styling issues
  return (
    <>{children}</>
  );
}
