import { useEffect, useState } from "react";
import { ExternalLink, MapPinned, Navigation, Phone, ShieldAlert } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { apiErrorMessage, hospitalApi } from "../lib/api";
import type { Hospital } from "../types";

function osmEmbed(lat: number, lng: number, hospitals: Hospital[]) {
  const delta = 0.05;
  const minLon = lng - delta;
  const minLat = lat - delta;
  const maxLon = lng + delta;
  const maxLat = lat + delta;
  const markers = [`${lat}%2C${lng}`]
    .concat(hospitals.filter((item) => item.latitude && item.longitude).slice(0, 8).map((item) => `${item.latitude}%2C${item.longitude}`))
    .join("%7C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${markers}`;
}

function isFallback(hospital: Hospital) {
  return (hospital.address || "").toLowerCase().includes("offline fallback");
}

export function HospitalsPage() {
  const { showToast } = useToast();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState("");

  function locate() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        try {
          const results = await hospitalApi.nearby(lat, lng);
          setHospitals(results);
          if (!results.length) showToast({ tone: "info", title: "No facilities found nearby" });
        } catch (error) {
          showToast({ tone: "error", title: "Hospital lookup failed", message: apiErrorMessage(error) });
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setGeoError("Location permission was denied or unavailable. Enable location access and try again.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  useEffect(() => {
    locate();
  }, []);

  const showingFallback = hospitals.some(isFallback);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Nearby hospitals & clinics</p>
            <p className="mt-1 text-xs text-ink-2">Powered by OpenStreetMap / Overpass using your browser location.</p>
          </div>
          <Button onClick={locate} disabled={loading}><MapPinned className="h-4 w-4" />Refresh location</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {geoError && <div className="rounded-xl border border-med/30 bg-med-tint px-4 py-3 text-sm text-ink font-read">{geoError}</div>}
          {showingFallback && (
            <div className="flex items-start gap-2.5 rounded-xl border border-med/30 bg-med-tint px-4 py-3 text-sm text-ink font-read">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-med" />
              <p><strong className="text-med">Showing approximate offline results — not verified.</strong> These are stand-in facilities, not confirmed care near you. Refresh for live OpenStreetMap data.</p>
            </div>
          )}
          {coords ? (
            <div className="overflow-hidden rounded-xl border border-rule">
              <iframe title="Nearby healthcare map" className="h-[360px] w-full" src={osmEmbed(coords.lat, coords.lng, hospitals)} />
            </div>
          ) : (
            <Skeleton className="h-[360px]" />
          )}
          <p className="text-[13px] text-ink-2">Your location is read on this device and only used to find nearby care. Results are approximate — always confirm before travelling.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36" />)}
        {!loading && hospitals.map((hospital) => {
          const emergency = (hospital.type || "").toLowerCase() === "emergency";
          return (
            <Card key={`${hospital.id}-${hospital.name}`} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{hospital.name}</p>
                  <p className={`mt-1 text-xs font-semibold ${emergency ? "text-high" : "text-ink-2"}`}>{hospital.type || "Healthcare facility"}</p>
                </div>
                {hospital.distance != null && <span className="shrink-0 rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-bold tabular-nums text-ink-2">{typeof hospital.distance === "number" ? `${hospital.distance.toFixed(1)} km` : hospital.distance}</span>}
              </div>
              {hospital.address && <p className="mt-3 text-xs leading-5 text-ink-2">{hospital.address}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {hospital.phone && <a href={`tel:${hospital.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rule px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-alt"><Phone className="h-3.5 w-3.5" />Call</a>}
                {hospital.latitude && hospital.longitude && (
                  <a href={`https://www.openstreetmap.org/directions?from=&to=${hospital.latitude}%2C${hospital.longitude}#map=15/${hospital.latitude}/${hospital.longitude}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-fg transition-colors hover:bg-brand-strong">
                    <Navigation className="h-3.5 w-3.5" />Directions <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </Card>
          );
        })}
        {!loading && !hospitals.length && !geoError && (
          <Card className="p-8 text-center md:col-span-2 xl:col-span-3">
            <p className="text-sm font-semibold text-ink">No nearby results yet</p>
            <p className="mt-2 text-xs text-ink-2">Allow location access or widen your search by refreshing.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
