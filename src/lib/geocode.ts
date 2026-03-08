// src/lib/geocode.ts
// Free geocoding using OpenStreetMap Nominatim API.
// No API key required. Rate limit: 1 request/second (fine for booking flow).

/**
 * Forward geocode: address text → { lat, lng }
 */
export async function geocodeAddress(
    address: string
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1&countrycodes=in`,
        { headers: { "User-Agent": "GigMatcher/1.0 (contact@gigmatcher.in)" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  }
  
  /**
   * Reverse geocode: { lat, lng } → detailed address string
   * Returns street-level detail: "House No, Street, Locality, City, State"
   */
  export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
        { headers: { "User-Agent": "GigMatcher/1.0 (contact@gigmatcher.in)" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const a = data.address ?? {};
  
      // Build detailed address: road + suburb/neighbourhood + city + state
      const parts = [
        a.road ?? a.pedestrian ?? a.footway,
        a.suburb ?? a.neighbourhood ?? a.quarter,
        a.city ?? a.town ?? a.village ?? a.county,
        a.state,
      ].filter(Boolean);
  
      return parts.length > 0 ? parts.join(", ") : data.display_name ?? null;
    } catch {
      return null;
    }
  }
  
  export interface AddressSuggestion {
    displayName: string;   // shown in dropdown
    shortName: string;     // shown in input after selection
    lat: number;
    lng: number;
  }
  
  /**
   * Autocomplete: partial text → list of address suggestions
   * Used for the manual address input dropdown in BookService.
   * Biased to India (countrycodes=in).
   */
  export async function searchAddressSuggestions(
    query: string
  ): Promise<AddressSuggestion[]> {
    if (!query || query.trim().length < 3) return [];
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=in`,
        { headers: { "User-Agent": "GigMatcher/1.0 (contact@gigmatcher.in)" } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data ?? []).map((item: {
        display_name: string;
        lat: string;
        lon: string;
        address?: {
          road?: string; suburb?: string; neighbourhood?: string;
          city?: string; town?: string; village?: string; state?: string;
        };
      }) => {
        const a = item.address ?? {};
        const short = [
          a.road ?? a.suburb ?? a.neighbourhood,
          a.city ?? a.town ?? a.village,
          a.state,
        ].filter(Boolean).join(", ");
  
        return {
          displayName: item.display_name,
          shortName:   short || item.display_name.split(",").slice(0, 3).join(","),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
      });
    } catch {
      return [];
    }
  }