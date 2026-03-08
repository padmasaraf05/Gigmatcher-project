// src/components/LiveLocationMap.tsx
// PHASE 11 — Real GPS tracking with Leaflet + OpenStreetMap
//
// Replaces the fake CSS grid with a real interactive map.
// No API key required — uses OpenStreetMap tiles (free, open source).
//
// INSTALL before using:
//   npm install leaflet react-leaflet @types/leaflet
//
// ADD to src/main.tsx (or src/index.css):
//   import 'leaflet/dist/leaflet.css';
//
// Worker side:
//   - Requests GPS permission via navigator.geolocation.watchPosition
//   - Updates worker_latitude/worker_longitude in jobs table every ~5s
//   - Shows worker's own position on map
//
// Customer side:
//   - Reads worker_latitude/worker_longitude from Realtime subscription
//   - Worker pin moves in real-time as worker moves
//   - Job pin stays fixed at job address coordinates

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useLiveLocation } from "@/hooks/useJobLifecycle";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation, MapPin, WifiOff } from "lucide-react";

// ── Fix Leaflet default marker icons broken by Vite/Webpack bundling ──────────
// Leaflet tries to load marker icons from node_modules which Vite can't resolve.
// We override with inline SVG icons instead.

const workerIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:24px;height:24px;">
      <div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:2px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.3);position:absolute;top:4px;left:4px;"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const jobIcon = L.divIcon({
  className: "",
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#EF4444"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>
    </div>
  `,
  iconSize: [24, 32],
  iconAnchor: [12, 32],
});

// ── Helper — auto-pan map when worker position changes ────────────────────────

function MapPanner({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevPos = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (prevPos.current) {
      // Smooth pan without resetting zoom
      map.panTo([lat, lng], { animate: true, duration: 1 });
    } else {
      map.setView([lat, lng], 15);
    }
    prevPos.current = [lat, lng];
  }, [lat, lng, map]);

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface LiveLocationMapProps {
  jobId: string;
  isTracking: boolean;
  address?: string;
}

export default function LiveLocationMap({ jobId, isTracking, address }: LiveLocationMapProps) {
  const { data, isLoading } = useLiveLocation(jobId, isTracking);

  if (!isTracking) return null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Live Location</h4>
        <Skeleton className="h-[220px] w-full rounded-xl" />
      </div>
    );
  }

  // GPS error — worker denied permission or device has no GPS
  if (data.isWorker && data.gpsError) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Live Location</h4>
        <div className="h-[100px] rounded-xl border border-border bg-muted flex flex-col items-center justify-center gap-2 px-4 text-center">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium">
            GPS unavailable: {data.gpsError}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Allow location access in your browser settings
          </p>
        </div>
      </div>
    );
  }

  // Worker location not yet received — waiting for first GPS fix
  const hasWorkerPos = data.workerLat !== null && data.workerLng !== null;
  const hasJobPos    = data.jobLat    !== null && data.jobLng    !== null;

  // Default center: Indore (fallback before first GPS fix)
  const centerLat = data.workerLat ?? data.jobLat ?? 22.7196;
  const centerLng = data.workerLng ?? data.jobLng ?? 75.8577;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-foreground">Live Location</h4>

      {/* ── Leaflet Map ──────────────────────────────────────────────────────── */}
      <div className="h-[220px] rounded-xl overflow-hidden border border-border">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          {/* OpenStreetMap tiles — free, no API key */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Worker marker — pulsing blue dot */}
          {hasWorkerPos && (
            <>
              <Marker
                position={[data.workerLat!, data.workerLng!]}
                icon={workerIcon}
              >
                <Popup>
                  <span className="text-xs font-semibold">
                    {data.isWorker ? "Your location" : "Worker"}
                  </span>
                </Popup>
              </Marker>
              {/* Auto-pan to worker position */}
              <MapPanner lat={data.workerLat!} lng={data.workerLng!} />
            </>
          )}

          {/* Job location marker — red pin */}
          {hasJobPos && (
            <Marker position={[data.jobLat!, data.jobLng!]} icon={jobIcon}>
              <Popup>
                <span className="text-xs font-semibold">📍 {address ?? "Job location"}</span>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* ── Distance + status bar ─────────────────────────────────────────────── */}
      <div className="rounded-xl bg-accent/5 border border-accent/20 p-3.5 flex items-center gap-3">
        {hasWorkerPos ? (
          <>
            <div className="relative shrink-0">
              <div className="h-3.5 w-3.5 rounded-full bg-accent" />
              <div className="absolute inset-0 h-3.5 w-3.5 rounded-full bg-accent/40 animate-ping" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {data.isWorker
                ? "Broadcasting your location"
                : <>Worker is <span className="text-accent">{data.distance}</span> away</>
              }
            </p>
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              {data.isWorker ? "Acquiring GPS signal…" : "Waiting for worker location…"}
            </p>
          </>
        )}
      </div>

      {/* ── Get Directions button — unchanged from original ───────────────────── */}
      <button
        onClick={() => {
          const lat = data.jobLat ?? centerLat;
          const lng = data.jobLng ?? centerLng;
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
        }}
        className="touch-target w-full flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-semibold text-primary transition-default hover:bg-primary/5"
      >
        <Navigation className="h-4 w-4" /> Get Directions
      </button>
    </div>
  );
}