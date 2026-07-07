export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[GA4-ready]", eventName, params);
  }
}
