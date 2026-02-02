'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface PhotoUploadProps {
  images: string[];
  setImages: (images: string[]) => void;
}

export default function PhotoUpload({ images, setImages }: PhotoUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImages([...images, base64]);
      };
      reader.readAsDataURL(file);
    });
  }, [images, setImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Drone / Site Photos</h3>
        <span className="text-xs text-[var(--text-muted)]">{images.length} image(s) uploaded</span>
      </div>

      <div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[var(--text-primary)]">
              {isDragActive ? 'Drop images here...' : 'Drag & drop drone images here'}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              or click to browse • Max 10MB per file
            </p>
          </div>
        </div>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {images.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={img}
                alt={`Upload ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-[var(--border-color)]"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 w-6 h-6 bg-[var(--accent-red)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                #{index + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
