'use client';

import { useState, useRef } from 'react';
import { uploadApi, getStrapiMediaUrl } from '@/lib/api';
import toast from 'react-hot-toast';
import { ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onUpload: (fileId: number, url: string) => void;
  currentUrl?: string;
  onClear?: () => void;
}

export default function CoverImageUpload({ onUpload, currentUrl, onClear }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('files', file);

    try {
      const res = await uploadApi.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploaded = Array.isArray(res.data) ? res.data[0] : null;
      if (!uploaded || typeof uploaded.id !== 'number' || !uploaded.url) {
        toast.error('Upload failed: invalid response from server');
        return;
      }
      const fullUrl = getStrapiMediaUrl(uploaded.url);
      setPreview(fullUrl);
      onUpload(uploaded.id, fullUrl);
      toast.success('Cover image uploaded!');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-picked after clear
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
    onClear?.();
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Cover Image</label>
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border group">
          <img
            src={preview}
            alt="Cover preview"
            className="w-full max-h-52 object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {uploading ? (
              <span className="animate-pulse">Uploading...</span>
            ) : (
              <>
                <span className="text-primary font-medium">Click to upload</span> or drag and drop
                <br />
                <span className="text-xs">PNG, JPG, WebP · Max 5MB</span>
              </>
            )}
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
