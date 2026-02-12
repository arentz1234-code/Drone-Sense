'use client';
import { useState, useEffect } from 'react';

interface PropertyPhotosProps {
  coordinates: { lat: number; lng: number } | null;
  address?: string;
  apn?: string;
}

interface Photo {
  url: string;
  label: string;
  type: string;
  available: boolean;
}

export function PropertyPhotos({ coordinates, address, apn }: PropertyPhotosProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!coordinates) return;

    const fetchPhotos = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates, address, apn }),
        });
        const data = await res.json();
        setPhotos(data.photos || []);
      } catch (e) {
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [coordinates?.lat, coordinates?.lng, address, apn]);

  if (!coordinates) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Property Photos</h4>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo, idx) => (
            <div
              key={idx}
              className="relative cursor-pointer group"
              onClick={() => setLightboxIndex(idx)}
            >
              <img
                src={photo.url}
                alt={photo.label}
                className="w-full h-24 object-cover rounded-lg border border-[var(--border-color)]"
              />
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white">
                {photo.label}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">No photos available</p>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <img
            src={photos[lightboxIndex].url}
            alt={photos[lightboxIndex].label}
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setLightboxIndex(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
