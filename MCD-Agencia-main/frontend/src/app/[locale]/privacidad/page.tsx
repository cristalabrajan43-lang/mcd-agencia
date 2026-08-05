'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useLegalModal } from '@/contexts/LegalModalContext';

/**
 * Legacy /privacidad route — redirects to home and opens the privacy modal.
 * Kept so any bookmarked or external links still work.
 */
export default function PrivacyRedirectPage() {
  const router = useRouter();
  const locale = useLocale();
  const { openPrivacy } = useLegalModal();

  useEffect(() => {
    openPrivacy();
    router.replace(`/${locale}`);
  }, [openPrivacy, router, locale]);

  return null;
}
