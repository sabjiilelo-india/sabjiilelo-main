import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from './toast';
import { Spinner } from './ui';

type Folder = 'items' | 'categories' | 'banners' | 'proofs' | 'issues';

export function ImageUpload({ value, onChange, folder, multiple }: { value: string[]; onChange: (urls: string[]) => void; folder: Folder; multiple?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append('file', f);
        urls.push((await api.uploads.image(folder, form)).url);
      }
      onChange(multiple ? [...value, ...urls] : urls.slice(0, 1));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {value.map((url) => (
        <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-line">
          <img src={url} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(value.filter((u) => u !== url))}
            className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-danger opacity-0 shadow transition group-hover:opacity-100"
            aria-label="Remove image"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {(multiple || value.length === 0) && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-xs text-muted transition hover:border-primary hover:text-primary"
        >
          {busy ? <Spinner /> : <ImagePlus size={22} />}
          {busy ? 'Uploading' : 'Add photo'}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} className="hidden" onChange={(e) => upload(e.target.files)} />
    </div>
  );
}
