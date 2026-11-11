export const CONSENT_KEY = "mundo-natural.consent.v1";
export const FAVORITES_KEY = "mundo-natural.favorites.v1";
export const CONSENT_EVENT = "mundo-natural-consent";
export function parseConsent(raw, now = Date.now()) {
  try {
    const data = JSON.parse(raw);
    return data &&
      data.version === 1 &&
      typeof data.preferences === "boolean" &&
      Number.isFinite(data.savedAt) &&
      data.savedAt <= now &&
      now - data.savedAt < 180 * 86400000
      ? data
      : null;
  } catch {
    return null;
  }
}
export function readConsent() {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}
export function saveConsent(preferences) {
  const consent = {
    version: 1,
    necessary: true,
    preferences: !!preferences,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    if (!preferences) window.localStorage.removeItem(FAVORITES_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  return consent;
}
