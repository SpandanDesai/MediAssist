import { useState, useEffect } from 'react';
import api from '../lib/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Hospital {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address: string | null;
}

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  map.setView(center);
  return null;
};

const Hospitals = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchHospitals = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const response = await api.get(`/hospitals?lat=${lat}&lng=${lng}&radius=5000`);
      setHospitals(response.data.hospitals);
    } catch (err) {
      setError('Failed to fetch nearby hospitals.');
    } finally {
      setLoading(false);
    }
  };

  const locateUser = () => {
    setError('');
    setLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
          setLocation(coords);
          fetchHospitals(coords[0], coords[1]);
        },
        (err) => {
          setError('Location access denied. Please allow location access to find nearby hospitals.');
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
    }
  };

  useEffect(() => {
    locateUser();
  }, []);

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-300">
      <div className="w-full md:w-1/3 flex flex-col bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2 mb-2">
            <MapPin className="text-rose-500" /> Nearby Facilities
          </h2>
          <p className="text-sm text-slate-500">Hospitals and clinics within 5km</p>
          <button 
            onClick={locateUser}
            className="w-full mt-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" /> Refresh Location
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Finding healthcare facilities...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          
          {!loading && !error && hospitals.length === 0 && location && (
            <div className="text-center text-slate-500 py-8">
              No facilities found in your immediate area.
            </div>
          )}
          
          {!loading && hospitals.map((hospital) => (
            <div key={hospital.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
              <h3 className="font-bold text-slate-900 dark:text-white">{hospital.name}</h3>
              <p className="text-xs text-[#0EA5E9] font-medium uppercase tracking-wider mb-1">{hospital.type}</p>
              {hospital.address && <p className="text-sm text-slate-500 dark:text-slate-400">{hospital.address}</p>}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 z-0 relative">
        {!location ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            Waiting for location...
          </div>
        ) : (
          <MapContainer center={location} zoom={13} className="w-full h-full">
            <ChangeView center={location} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* User Location */}
            <Marker position={location}>
              <Popup>You are here</Popup>
            </Marker>
            
            {/* Hospitals */}
            {hospitals.map((hospital) => (
              <Marker key={hospital.id} position={[hospital.lat, hospital.lng]}>
                <Popup>
                  <strong>{hospital.name}</strong><br/>
                  {hospital.type}<br/>
                  {hospital.address}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default Hospitals;
