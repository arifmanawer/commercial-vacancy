"use client";

import { useState, useEffect, useMemo } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Autocomplete,
} from "@react-google-maps/api";
import { supabase } from "@/lib/supabaseClient";
import { useGoogleMapsLoader } from "@/hooks/useGoogleMapsLoader";

const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: 40.7128,
  lng: -74.006,
};

const MAP_STYLES: google.maps.MapOptions["styles"] = [
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ lightness: 20 }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#334155" }],
  },
];

const containerStyle = {
  width: "100%",
  height: "100%",
};

export type GeocodedListing = {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  property_type: string;
  position: google.maps.LatLngLiteral;
};

export type NearbyListingSummary = {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  property_type: string;
  distanceMiles: number;
};

const EARTH_RADIUS_MILES = 3958.8;

function distanceInMiles(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const haversine =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_MILES * c;
}

type MapViewProps = {
  onNearbyChange?: (nearby: NearbyListingSummary[]) => void;
};

export default function MapView({ onNearbyChange }: MapViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [searchLocation, setSearchLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [listings, setListings] = useState<GeocodedListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [userLocation, setUserLocation] =
    useState<google.maps.LatLngLiteral | null>(null);

  const { isLoaded } = useGoogleMapsLoader();

  useEffect(() => {
    async function fetchAndGeocode() {
      if (!isLoaded) return;

      setLoadingListings(true);
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("id, title, address, city, state, property_type");

        if (error) throw error;

        if (!data || data.length === 0) {
          setListings([]);
          return;
        }

        const geocoder = new google.maps.Geocoder();
        const results: GeocodedListing[] = [];

        // Geocode addresses sequentially to respect rate limits
        for (const item of data) {
          const parts = [item.address, item.city, item.state]
            .map((p) => p?.trim())
            .filter((p) => p && p.length > 0);

          const addressStr = parts.join(", ");
          if (!addressStr) continue;

          try {
            const geocodeResult = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
              geocoder.geocode({ address: addressStr }, (res, status) => {
                if (status === "OK") resolve(res);
                else resolve(null);
              });
            });

            if (geocodeResult && geocodeResult[0]?.geometry?.location) {
              results.push({
                id: item.id,
                title: item.title,
                address: item.address || "",
                city: item.city || "",
                state: item.state || "",
                property_type: item.property_type || "Space",
                position: {
                  lat: geocodeResult[0].geometry.location.lat(),
                  lng: geocodeResult[0].geometry.location.lng(),
                },
              });
            }
          } catch (e) {
            console.warn("Geocoding failed for", addressStr, e);
          }
        }
        setListings(results);
      } catch (err) {
        console.error("Error loading listings for map:", err);
      } finally {
        setLoadingListings(false);
      }
    }

    fetchAndGeocode();
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: google.maps.LatLngLiteral = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        setCenter(location);
      },
      (error) => {
        console.warn("Unable to retrieve user location:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      }
    );
  }, [isLoaded]);

  const handlePlaceChanged = () => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();

    if (!place.geometry || !place.geometry.location) {
      window.alert(
        `No details available for input: '${place.name ?? "selected place"}'`
      );
      setSearchLocation(null);
      return;
    }

    const location = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    setCenter(location);
    setSearchLocation(location);
    setActiveId(null);
  };

  const nearbyListings = useMemo(() => {
    if (!userLocation) return [];

    return listings
      .map((listing) => ({
        ...listing,
        distanceMiles: distanceInMiles(userLocation, listing.position),
      }))
      .filter((listing) => listing.distanceMiles <= 5)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [listings, userLocation]);

  const nearbyListingIds = useMemo(
    () => new Set(nearbyListings.map((listing) => listing.id)),
    [nearbyListings]
  );

  useEffect(() => {
    if (!onNearbyChange) return;

    onNearbyChange(
      nearbyListings.map(
        ({
          id,
          title,
          address,
          city,
          state,
          property_type,
          distanceMiles,
        }) => ({
          id,
          title,
          address,
          city,
          state,
          property_type,
          distanceMiles,
        })
      )
    );
  }, [nearbyListings, onNearbyChange]);

  if (!isLoaded) {
    return (
      <div className="h-[480px] w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading map...
      </div>
    );
  }

  return (
    <div className="h-[480px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
      {loadingListings && (
        <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[1px] flex items-center justify-center text-xs font-medium text-slate-600">
          Syncing listings...
        </div>
      )}
      <GoogleMap
        center={center}
        zoom={12}
        mapContainerStyle={containerStyle}
        options={{
          styles: MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        <Autocomplete
          onLoad={setAutocomplete}
          onPlaceChanged={handlePlaceChanged}
        >
          <input
            type="text"
            placeholder="Enter an address"
            className="absolute z-10 left-1/2 -translate-x-1/2 top-4 w-[min(480px,90%)] rounded-md border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </Autocomplete>

        {listings.map((space) => (
          <Marker
            key={space.id}
            position={space.position}
            icon={
              nearbyListingIds.has(space.id)
                ? {
                    url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                  }
                : undefined
            }
            onClick={() => setActiveId(space.id)}
          >
            {activeId === space.id && (
              <InfoWindow onCloseClick={() => setActiveId(null)}>
                <div className="text-xs p-1">
                  <p className="font-semibold text-slate-900">{space.title}</p>
                  <p className="text-slate-600">
                    {space.address}
                    {space.city ? `, ${space.city}` : ""}
                  </p>
                  <p className="mt-1 uppercase tracking-wide text-[10px] font-bold text-slate-500">
                    {space.property_type}
                  </p>
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}

        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            }}
          />
        )}

        {searchLocation && (
          <Marker
            position={searchLocation}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

