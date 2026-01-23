import { lazy, Suspense } from "react";

// Lazy load Header to reduce initial bundle size
const Header = lazy(() => import("./Header"));

export const LazyHeader = () => (
  <Suspense fallback={
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="font-sans text-xl font-bold tracking-tight">Vendofy</div>
        <nav className="flex items-center gap-6">
          <div className="h-9 w-20 bg-muted animate-pulse rounded" />
        </nav>
      </div>
    </header>
  }>
    <Header />
  </Suspense>
);




