'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HOME_ITEM = {
  href: '/',
  label: 'Home',
  accent: 'neutral',
  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5 10v9h14v-9" />,
};

const TOOL_ITEMS = [
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
  {
    href: '/screener',
    label: 'Screener',
    accent: 'orange',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm8 16-4.35-4.35" />,
  },
  {
    href: '/sector-rotation',
    label: 'Sector Rotation',
    accent: 'rose',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h4v-6H4v6Zm6 0h4V9h-4v10Zm6 0h4V4h-4v15Z" />,
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
    href: '/options-strategy',
    label: 'Options Strategy',
    accent: 'indigo',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="m12 2 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
  },
];

const ACCENT_ACTIVE = {
  neutral: 'bg-white/10 text-white border-white/20',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
};

const ACCENT_TEXT = {
  neutral: 'text-white',
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  purple: 'text-purple-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  orange: 'text-orange-300',
  indigo: 'text-indigo-300',
};

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const activeTool = TOOL_ITEMS.find((item) => item.href === pathname);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 py-3">
          <Link
            href={HOME_ITEM.href}
            aria-current={pathname === '/' ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === '/'
                ? ACCENT_ACTIVE[HOME_ITEM.accent]
                : 'border-transparent text-gray-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              {HOME_ITEM.icon}
            </svg>
            {HOME_ITEM.label}
          </Link>

          <span className="text-gray-700 select-none">/</span>

          <div className="relative" ref={containerRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTool
                  ? ACCENT_ACTIVE[activeTool.accent]
                  : open
                    ? 'border-white/10 bg-white/5 text-white'
                    : 'border-transparent text-gray-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 1 1-5.66 5.66L4 17l3-3 5.04-5.04a4 4 0 0 1 2.66-2.66Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m14 14 4 4" />
              </svg>
              Tools
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {open && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-700 bg-gray-950 p-1.5 shadow-2xl">
                {TOOL_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? ACCENT_ACTIVE[item.accent] : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
                        {item.icon}
                      </svg>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {activeTool && (
            <>
              <span className="text-gray-700 select-none">/</span>
              <span className={`px-1 text-sm font-medium ${ACCENT_TEXT[activeTool.accent]}`}>{activeTool.label}</span>
            </>
          )}

          <Link
            href="/options-strategy/strategies"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/60 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.25C10.5 5 8.5 4.5 6 4.5v13.5c2.5 0 4.5.5 6 1.75m0-13.5c1.5-1.25 3.5-1.75 6-1.75v13.5c-2.5 0-4.5.5-6 1.75m0-13.5v13.5" />
            </svg>
            Guides
          </Link>
        </div>
      </div>
    </nav>
  );
}
