'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type LegalModalType = 'privacy' | 'terms' | null;

interface LegalModalContextValue {
  /** Currently open modal type (null = closed) */
  activeModal: LegalModalType;
  /** Open the Privacy Notice modal */
  openPrivacy: () => void;
  /** Open the Terms & Conditions modal */
  openTerms: () => void;
  /** Close whichever modal is open */
  closeModal: () => void;
}

const LegalModalContext = createContext<LegalModalContextValue | null>(null);

export function LegalModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<LegalModalType>(null);

  const openPrivacy = useCallback(() => setActiveModal('privacy'), []);
  const openTerms = useCallback(() => setActiveModal('terms'), []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  return (
    <LegalModalContext.Provider
      value={{ activeModal, openPrivacy, openTerms, closeModal }}
    >
      {children}
    </LegalModalContext.Provider>
  );
}

export function useLegalModal() {
  const ctx = useContext(LegalModalContext);
  if (!ctx) {
    throw new Error('useLegalModal must be used within a LegalModalProvider');
  }
  return ctx;
}
