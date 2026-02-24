export function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  // When accessing the app from another device on the LAN (e.g. http://192.168.x.x:3000),
  // "localhost" would point to that other device. Derive API host from the current page.
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return "http://localhost:3001";
}

