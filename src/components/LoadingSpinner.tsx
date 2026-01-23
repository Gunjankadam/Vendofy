import { memo } from "react";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

// Ultra-lightweight spinner without external icon dependency
const LoadingSpinnerComponent = memo(({ 
  message = "Loading...", 
  size = "md" 
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-[3px]",
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div 
          className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin`}
          aria-label="Loading"
        />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
});

LoadingSpinnerComponent.displayName = "LoadingSpinner";

export const LoadingSpinner = LoadingSpinnerComponent;

