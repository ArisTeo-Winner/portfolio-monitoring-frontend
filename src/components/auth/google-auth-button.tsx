"use client";

import { Button } from "@/components/ui/button";
import { startGoogleLogin } from "@/features/auth/api/google-login";

export function GoogleAuthButton({ label, className }: { label: string; className?: string }) {
  return (
    <Button
      block
      className={className}
      icon={<GoogleIcon />}
      onClick={() => startGoogleLogin()}
      type="button"
      variant="outline"
    >
      {label}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M21.8 12.23c0-.72-.06-1.25-.2-1.8H12v3.36h5.64c-.11.84-.69 2.1-1.98 2.95l-.02.11 2.69 2.04.19.02c1.73-1.56 2.72-3.85 2.72-6.68Z" fill="#4285F4" />
      <path d="M12 22c2.76 0 5.08-.89 6.78-2.42l-3.23-2.47c-.86.59-2.01 1-3.55 1-2.7 0-4.99-1.74-5.81-4.14l-.11.01-2.8 2.12-.04.1C4.93 19.6 8.18 22 12 22Z" fill="#34A853" />
      <path d="M6.19 13.97A5.86 5.86 0 0 1 5.85 12c0-.69.12-1.35.33-1.97l-.01-.13-2.84-2.15-.09.04A9.8 9.8 0 0 0 2.2 12c0 1.57.38 3.06 1.04 4.21l2.95-2.24Z" fill="#FBBC05" />
      <path d="M12 5.89c1.94 0 3.24.82 3.99 1.5l2.92-2.79C17.07 2.93 14.76 2 12 2 8.18 2 4.93 4.4 3.24 7.79l2.94 2.24C7.01 7.63 9.3 5.89 12 5.89Z" fill="#EA4335" />
    </svg>
  );
}
