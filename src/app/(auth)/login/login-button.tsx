"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function LoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    try {
      setLoading(true);
      setError(null);
      await signIn("azure-ad", { callbackUrl: "/dashboard" });
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        className="w-full cursor-pointer"
        disabled={loading}
        onClick={handleSignIn}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" fill="none">
            <path d="M10 0H0V10H10V0Z" fill="#F25022" />
            <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
            <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
            <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
          </svg>
        )}
        {loading ? "Signing in…" : "Sign in with Microsoft"}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
