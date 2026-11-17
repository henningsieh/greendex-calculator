import {
  preferenceOptions,
  type Preference,
} from "@/lib/ui-preferences/definitions";

export function writePreference<T>(preference: Preference<T>, value: T): void {
  try {
    const secure =
      preferenceOptions.secureOnHttps && location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${preference.name}=${encodeURIComponent(preference.serialize(value))}; Path=${preferenceOptions.path}; Max-Age=${preferenceOptions.maxAge}; SameSite=${preferenceOptions.sameSite}${secure}`;
  } catch {
    // Preferences must not prevent interaction when browser storage is unavailable.
  }
}
