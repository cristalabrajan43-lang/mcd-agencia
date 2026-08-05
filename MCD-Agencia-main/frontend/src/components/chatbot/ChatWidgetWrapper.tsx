'use client';

import dynamic from 'next/dynamic';

// Load ChatWidget dynamically to avoid SSR issues
const ChatWidget = dynamic(
  () => import('./ChatWidget').then((mod) => mod.ChatWidget),
  { ssr: false }
);

export function ChatWidgetWrapper() {
  return <ChatWidget />;
}
