import { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FileUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  accept?: string;
  required?: boolean;
}

export function FileUploadField({ label, value, onChange, folder = 'general', accept = 'image/*,.pdf', required }: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : resolve(file),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Compress images before uploading
      const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;
      const ext = file.type.startsWith('image/') ? 'jpg' : file.name.split('.').pop();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(path, processedFile, {
        contentType: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
      });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      onChange(publicUrl);
      toast({ title: 'File uploaded' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const isImage = value?.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);

  return (
    <div className="space-y-1">
      <Label>{label}{required && ' *'}</Label>
      {value ? (
        <div className="relative border rounded-lg p-3 bg-muted/30">
          {isImage ? (
            <img src={value} alt={label} className="w-full max-h-32 object-contain rounded" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <a href={value} target="_blank" rel="noopener noreferrer" className="underline truncate">View document</a>
            </div>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">{uploading ? 'Uploading...' : 'Click to upload'}</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={handleUpload} className="hidden" />
    </div>
  );
}
