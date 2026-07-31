import { useCallback, useState } from "react";

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  error: string;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    error: "",
    loading: false,
  });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState((current) => ({ ...current, error: "Geolocation is not supported in this browser.", loading: false }));
      return;
    }
    setState((current) => ({ ...current, loading: true, error: "" }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: "",
          loading: false,
        });
      },
      () => {
        setState((current) => ({
          ...current,
          loading: false,
          error: "Location permission was denied or unavailable.",
        }));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  return { ...state, locate };
}
