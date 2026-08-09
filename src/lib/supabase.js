import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

function oauthErrorFromLocation() {
  if (typeof window === "undefined") return "";
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = query.get("error_code") || hash.get("error_code") || "";
  const description =
    query.get("error_description") || hash.get("error_description") || "";
  if (!code && !description) return "";

  // OAuth codes are short-lived credentials. Never render the raw code from
  // Supabase's error URL or retain it in browser history.
  window.history.replaceState({}, document.title, window.location.pathname);
  if (description.toLowerCase().startsWith("unable to exchange external code")) {
    return (
      "Supabase received Google's response but could not exchange it. " +
      "Re-save the matching Google Web Client ID and Client Secret in Supabase."
    );
  }
  return description || `Google authentication failed (${code})`;
}

export const oauthCallbackError = oauthErrorFromLocation();

export const supabaseConfigError =
  !supabaseUrl || !publishableKey
    ? "Supabase frontend configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
    : "";

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, publishableKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

export async function signInWithGoogle() {
  if (!supabase) throw new Error(supabaseConfigError);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
