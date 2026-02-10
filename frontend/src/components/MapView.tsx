"use client";

import { useState } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  useLoadScript,
  Autocomplete,
} from "@react-google-maps/api";

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

const sampleSpaces: {
   id: string;
   position: google.maps.LatLngLiteral;
   title: string;
   type: "retail" | "office" | "event";
   address: string;
 }[] = [
   {
     id: "1",
     position: { lat: 40.719, lng: -74.002 },
     title: "SoHo Pop-Up Retail Space",
     type: "retail",
     address: "SoHo, Manhattan",
   },
   {
     id: "2",
     position: { lat: 40.7306, lng: -73.9866 },
     title: "Creative Studio Loft",
     type: "event",
     address: "East Village, Manhattan",
   },
   {
     id: "3",
     position: { lat: 40.7527, lng: -73.9772 },
     title: "Flexible Office Suite",
     type: "office",
     address: "Midtown, Manhattan",
   },
 ];

export default function MapView() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [searchLocation, setSearchLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: ["places"],
  });

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

  if (!isLoaded) {
    return (
      <div className="h-[480px] w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading map...
      </div>
    );
  }

  return (
    <div className="h-[480px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm">
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

        {sampleSpaces.map((space) => (
          <Marker
            key={space.id}
            position={space.position}
            onClick={() => setActiveId(space.id)}
          >
            {activeId === space.id && (
              <InfoWindow onCloseClick={() => setActiveId(null)}>
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">{space.title}</p>
                  <p className="text-slate-600">{space.address}</p>
                  <p className="mt-1 uppercase tracking-wide text-[10px] text-slate-500">
                    {space.type} space
                  </p>
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}

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

