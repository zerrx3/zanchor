'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero: beach + waves with text overlay */}
      <section className="relative min-h-[70vh] w-full overflow-hidden flex items-center justify-center">
        <Image
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80"
          alt="Beach and waves"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Dark overlay so text stays readable */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60"
          aria-hidden
        />
        {/* Animated SVG waves */}
        <div className="absolute inset-0 flex flex-col justify-end pointer-events-none">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="w-full h-24 sm:h-32 text-white/30 animate-wave"
          >
            <path
              fill="currentColor"
              d="M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z"
            />
          </svg>
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="w-full h-20 sm:h-28 text-white/20 animate-wave-slow -mt-8"
          >
            <path
              fill="currentColor"
              d="M0,70 C200,20 400,100 600,70 C800,40 1000,100 1200,70 L1200,120 L0,120 Z"
            />
          </svg>
        </div>
        {/* Hero text + buttons over the image */}
        <div className="relative z-10 text-center px-4 py-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl drop-shadow-lg">
            <span className="block text-white">Hi, I&apos;m</span>
            <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Zanchor
            </span>
          </h1>
          <p className="mt-6 text-lg text-gray-200 max-w-2xl mx-auto drop-shadow-md">
            Building things on the web. This is my portfolio — a simple home for projects and links.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="#projects"
              className="px-6 py-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              View work
            </Link>
            <a
              href="mailto:hello@example.com"
              className="px-6 py-3 border-2 border-white/80 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              Get in touch
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">

        {/* Section placeholder */}
        <section id="projects" className="py-16">
          <h2 className="text-2xl font-semibold text-white mb-6">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors">
              <h3 className="text-lg font-medium text-white">Project one</h3>
              <p className="mt-2 text-sm text-gray-400">
                Short description. Add your projects here.
              </p>
              <span className="inline-block mt-3 text-sm text-purple-400">Coming soon</span>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors">
              <h3 className="text-lg font-medium text-white">Project two</h3>
              <p className="mt-2 text-sm text-gray-400">
                Another project placeholder.
              </p>
              <span className="inline-block mt-3 text-sm text-purple-400">Coming soon</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-gray-800 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} — Built with Next.js & Tailwind
        </footer>
      </div>
    </div>
  );
}
