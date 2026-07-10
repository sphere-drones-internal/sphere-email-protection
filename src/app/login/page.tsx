"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm rounded-lg border border-border p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sphere-logo.svg" alt="Sphere" className="mx-auto mb-6 h-8 w-auto" />
        <h1 className="mb-2 font-heading text-xl font-medium text-sphere-dark">DMARC Dashboard</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in with your Sphere Google account
        </p>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-sphere-secondary disabled:opacity-50"
        >
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}