"use client";

import { useLoadScript, type Libraries } from "@react-google-maps/api";

const GOOGLE_MAPS_LIBRARIES: Libraries = ["places"];

export function useGoogleMapsLoader() {
  return useLoadScript({
    id: "google-maps-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
}
