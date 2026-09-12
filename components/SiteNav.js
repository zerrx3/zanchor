'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    accent: 'neutral',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5 10v9h14v-9" />,
  },
  {
    href: '/market-newsletter',
    label: 'Market Newsletter',
    accent: 'purple',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16v12H4V6Zm0 0 8 7 8-7"
      />
    ),
  },
  {
    href: '/portfolio-analyzer',
    label: 'Portfolio Analyzer',
    accent: 'cyan',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M6 19V9m6 10V5m6 14v-7" />,
  },
  {
    href: '/stock-analyzer',
    label: 'Stock Analyzer',
    accent: 'emerald',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l5-5.5 4 3L21 5M21 5h-5M21 5v5" />,
  },
  {
    href: '/swing-strategy',
    label: 'Swing Strategy',
    accent: 'amber',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3 8 4-16 3 8h4" />,
  },
];

const ACCENT_ACTIVE = {
  neutral: 'bg-white/10 text-white border-white/20',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? ACCENT_ACTIVE[item.accent]
                    : 'border-transparent text-gray-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
