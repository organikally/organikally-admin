import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, ExternalLink, X } from 'lucide-react';
import { media } from '@/api/client';
import { Button, Spinner } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';

const ACCEPT: Record<Kind, string> = {
  image: 'image/*',
  video: 'video/*',
  both: 'image/*,video/*',
};

type Kind = 'image' | 'video' | 'both';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * Upload-or-paste media control. Uploads the chosen file to S3 via /media/upload
 * and writes the returned URL back through `onChange`; a URL can still be pasted
 * directly. Renders an inline preview of the current value. Drop this inside a
 * <Field> for the label/hint.
 */
export function MediaField({
  value,
  onChange,
  kind = 'admin',
  accept = 'image',
  placeholder = 'Upload a file or paste a URL…',
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  /** S3 layout bucket: sku | recipe | store_product | admin … */
  kind?: string;
  /** Which file types the picker accepts. */
  accept?: Kind;
  placeholder?: string;
  disabled?: boolean;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => media.upload(file, kind),
    onSuccess: (res) => {
      onChange(res.url);
      toast.success('Uploaded');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const val = value.trim();
  const isVideo = VIDEO_EXT.test(val);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || upload.isPending}
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={disabled || upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {upload.isPending ? <Spinner /> : <Upload className="h-4 w-4" strokeWidth={1.5} />}
          Upload
        </Button>
        {val && (
          <>
            <a
              href={val}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-ink-faint hover:text-ink"
              aria-label="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
            </a>
            <button
              type="button"
              onClick={() => onChange('')}
              className="shrink-0 text-ink-faint hover:text-danger"
              aria-label="Clear"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT[accept]}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />

      {val && (
        <div className="overflow-hidden rounded-chip border border-line bg-surface">
          {isVideo ? (
            <video src={val} controls className="max-h-44 w-full object-contain" />
          ) : (
            <img src={val} alt="" className="max-h-44 w-full object-contain" loading="lazy" />
          )}
        </div>
      )}
    </div>
  );
}
