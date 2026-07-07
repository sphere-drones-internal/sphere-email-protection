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
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold">Sphere DMARC</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in with your Sphere Google account
        </p>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}