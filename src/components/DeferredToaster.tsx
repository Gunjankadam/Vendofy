import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

/**
 * DeferredToaster - Loads toast components after initial render
 * to improve initial page load performance
 */
export const DeferredToaster = () => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Defer loading toaster components until after initial render
    // This allows the main content to render first
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(
        () => setShouldRender(true),
        { timeout: 1 }
      );
      return () => cancelIdleCallback(id);
    } else {
      // Fallback for browsers without requestIdleCallback
      const timer = setTimeout(() => setShouldRender(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!shouldRender) return null;

  return (
    <>
      <Toaster />
      <Sonner />
    </>
  );
};

