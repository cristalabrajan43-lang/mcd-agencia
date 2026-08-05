/**
 * Auth Layout - Minimal layout for authentication pages
 * Constrained to viewport height: fits between fixed navbar and screen bottom
 */

import Image from 'next/image';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="bg-neutral-950 pt-16">
      <div className="flex items-stretch min-h-[calc(100dvh-4rem)]">
        {/* Left: Logo */}
        <div className="hidden md:flex flex-col justify-center items-center w-1/2 px-8 sticky top-16 h-[calc(100dvh-4rem)]">
          <Image
            src="/images/logo.png"
            alt="Agencia MCD"
            width={700}
            height={350}
            className="w-[260px] lg:w-[320px] h-auto max-w-full drop-shadow-2xl mb-3"
            priority
          />
          <span className="text-base lg:text-xl font-bold text-white font-landing tracking-tight text-center select-none">
            Da el primer paso.<br />Crea tu cuenta o inicia sesión.
          </span>
        </div>
        {/* Right: Form — vertically centered, page scrolls if content overflows */}
        <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-4 sm:px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
