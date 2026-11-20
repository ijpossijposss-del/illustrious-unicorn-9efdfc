import type { SVGProps } from 'react';

export type AppIconName =
  | 'dashboard' | 'receipt' | 'box' | 'categories' | 'branch' | 'users'
  | 'tools' | 'trophy' | 'moon' | 'activity' | 'handshake' | 'wallet'
  | 'chart' | 'return' | 'briefcase' | 'shield' | 'settings' | 'lock'
  | 'broom' | 'shopping-cart' | 'cash' | 'coins' | 'card';

const paths: Record<AppIconName, string> = {
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  box: 'm4 7 8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10',
  categories: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z',
  branch: 'M12 20V8M12 8 7 4M12 8l5-4M7 4v4h10V4',
  users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 20v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75',
  tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L14 12l-2-2 2.7-3.7z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4',
  moon: 'M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z',
  activity: 'M3 12h4l2-7 4 14 2-7h6',
  handshake: 'm3 11 4-4 4 2 2-2 8 4-3 6-5-3-4-4-3 2-3-2-4 4 2 2',
  wallet: 'M3 6h18v14H3zM3 6l2-3h14l2 3M15 13h6',
  chart: 'M4 19V5M4 19h17M8 15l3-4 3 2 5-7',
  return: 'M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6',
  briefcase: 'M4 7h16v13H4zM8 7V4h8v3M4 12h16M10 12v3h4v-3',
  shield: 'M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19 12l2-1-1-3-2 .2a7 7 0 0 0-1.5-1.5L17 4l-3-1-1 2a7 7 0 0 0-2 0L10 3 7 4l.5 2.7A7 7 0 0 0 6 8.2L4 8 3 11l2 1a7 7 0 0 0 0 2l-2 1 1 3 2-.2a7 7 0 0 0 1.5 1.5L7 21l3 1 1-2a7 7 0 0 0 2 0l1 2 3-1-.5-2.7a7 7 0 0 0 1.5-1.5L20 17l1-3-2-1a7 7 0 0 0 0-1z',
  lock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',
  broom: 'm4 19 6-6M3 21l4-1 11-11-3-3L4 17l-1 4zM14 6l3-3 3 3-3 3',
  'shopping-cart': 'M3 4h2l2.5 11h10L20 8H6M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01',
  cash: 'M4 6h16v12H4zM8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0z',
  coins: 'M5 8a7 3 0 1 0 14 0 7 3 0 1 0-14 0zM5 8v4a7 3 0 0 0 14 0V8M5 12v4a7 3 0 0 0 14 0v-4',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
};

export function AppIcon({ name, size = 18, ...props }: { name: AppIconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
