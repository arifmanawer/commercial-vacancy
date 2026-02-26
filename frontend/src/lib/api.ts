export function getApiUrl() {
  const url =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : "http://localhost:5000");
  return url.replace(/\/+$/, ""); // strip trailing slash
}

