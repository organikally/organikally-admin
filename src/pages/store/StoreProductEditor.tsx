import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Upload, Trash2, Star, ImagePlus } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState, Spinner } from '@/components/ui/primitives';
import { MediaField } from '@/components/ui/MediaField';
import { StoreProductStatusPill } from '@/components/ui/StatusPill';
import { formatPaise, num } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type { StoreProductAdmin, StoreProductInput } from '@/api/types';

interface ProductDraft {
  sku_id: string;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  price: string;
  compare_at_price: string;
  slug: string;
  seo_title: string;
  seo_description: string;
  canonical_path: string;
  gtin: string;
  og_image: string;
  images: string[];
  max_qty_per_order: string;
  low_stock_threshold: string;
}

const EMPTY: ProductDraft = {
  sku_id: '',
  name: '',
  subtitle: '',
  description: '',
  category: '',
  price: '',
  compare_at_price: '',
  slug: '',
  seo_title: '',
  seo_description: '',
  canonical_path: '',
  gtin: '',
  og_image: '',
  images: [],
  max_qty_per_order: '',
  low_stock_threshold: '',
};

function toDraft(p: StoreProductAdmin): ProductDraft {
  return {
    sku_id: p.sku_id,
    name: p.name,
    subtitle: p.subtitle ?? '',
    description: p.description ?? '',
    category: p.category ?? '',
    price: String(p.price ?? p.price_paise / 100),
    compare_at_price:
      p.compare_at_price != null
        ? String(p.compare_at_price)
        : p.compare_at_price_paise != null
          ? String(p.compare_at_price_paise / 100)
          : '',
    slug: p.slug ?? '',
    seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '',
    canonical_path: p.canonical_path ?? '',
    gtin: p.gtin ?? '',
    og_image: p.og_image ?? '',
    images: p.images ?? [],
    max_qty_per_order: p.max_qty_per_order != null ? String(p.max_qty_per_order) : '',
    low_stock_threshold: p.low_stock_threshold != null ? String(p.low_stock_threshold) : '',
  };
}

function toInput(d: ProductDraft): StoreProductInput {
  return {
    sku_id: d.sku_id.trim(),
    name: d.name.trim(),
    subtitle: d.subtitle.trim() || undefined,
    description: d.description,
    category: d.category.trim(),
    price: Number(d.price),
    compare_at_price: d.compare_at_price === '' ? null : Number(d.compare_at_price),
    images: d.images,
    og_image: d.og_image.trim() || null,
    slug: d.slug.trim() || undefined,
    seo_title: d.seo_title.trim() || undefined,
    seo_description: d.seo_description.trim() || undefined,
    canonical_path: d.canonical_path.trim() || undefined,
    gtin: d.gtin.trim() || undefined,
    max_qty_per_order: d.max_qty_per_order === '' ? null : Number(d.max_qty_per_order),
    low_stock_threshold: d.low_stock_threshold === '' ? null : Number(d.low_stock_threshold),
  };
}

export function StoreProductEditorPage() {
  const { id = '' } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [draft, setDraft] = useState<ProductDraft>(EMPTY);

  const product = useQuery({
    queryKey: ['store', 'product', id],
    queryFn: () => storeApi.products.get(id),
    enabled: !isNew,
  });

  // SKU picker uses the store-cap-gated lookup so a pure store_manager can pick
  // a SKU by name without any field-sales capability.
  const skuQuery = useQuery({
    queryKey: ['store', 'skus', 'for-editor'],
    queryFn: () => storeApi.skus({ active: true, page_size: 200 }),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (product.data) setDraft(toDraft(product.data));
  }, [product.data]);

  function patch<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['store', 'product', id] });
    qc.invalidateQueries({ queryKey: ['store', 'products'] });
  }

  const save = useMutation({
    mutationFn: () =>
      isNew ? storeApi.products.create(toInput(draft)) : storeApi.products.update(id, toInput(draft)),
    onSuccess: (p) => {
      toast.success(isNew ? 'Product created (draft)' : 'Product saved');
      invalidate();
      if (isNew) navigate(`/store/products/${p.id}`, { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const publish = useMutation({
    mutationFn: (next: boolean) => (next ? storeApi.products.publish(id) : storeApi.products.unpublish(id)),
    onSuccess: (_d, next) => {
      toast.success(next ? 'Published — storefront revalidating' : 'Unpublished — storefront revalidating');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const archive = useMutation({
    mutationFn: () => storeApi.products.archive(id),
    onSuccess: () => {
      toast.success('Product archived');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!isNew && product.isLoading) return <LoadingState />;
  if (!isNew && (product.isError || !product.data))
    return <ErrorState message={errorMessage(product.error)} onRetry={() => product.refetch()} />;

  const p = product.data;
  const valid = draft.sku_id.trim() && draft.name.trim() && draft.category.trim() && draft.price !== '' && Number(draft.price) >= 0;

  return (
    <div>
      <PageHeader
        eyebrow={isNew ? 'New product' : `/${p?.slug}`}
        title={isNew ? 'New product' : p?.name ?? 'Product'}
        description={
          isNew
            ? 'Create a draft, then publish to push it live and trigger storefront revalidation.'
            : 'Edit pricing, copy, SEO and imagery. Publishing or changing price triggers storefront revalidation.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/store/products')}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              All products
            </Button>
            {!isNew && p && p.status !== 'published' && (
              <Button variant="secondary" disabled={publish.isPending} onClick={() => publish.mutate(true)}>
                Publish
              </Button>
            )}
            {!isNew && p && p.status === 'published' && (
              <Button variant="secondary" disabled={publish.isPending} onClick={() => publish.mutate(false)}>
                Unpublish
              </Button>
            )}
            <Button disabled={save.isPending || !valid} onClick={() => save.mutate()}>
              {save.isPending && <Spinner className="text-ink" />}
              {isNew ? 'Create draft' : 'Save changes'}
            </Button>
          </div>
        }
      />

      {!isNew && p && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-surface/60 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <span className="text-ink-faint">Status</span>
            <StoreProductStatusPill status={p.status} />
          </span>
          <Meta label="SKU" value={p.sku_code ?? p.sku_id.slice(-6)} />
          <Meta label="Pack" value={p.pack_size ?? '—'} />
          <Meta label="Available" value={num(p.qty_available ?? 0)} />
          <Meta label="Reserved" value={num(p.qty_reserved ?? 0)} />
          <Meta label="Sellable" value={num(p.sellable_qty ?? 0)} />
          <Meta label="List price" value={formatPaise(p.price_paise)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Core details */}
          <Card>
            <CardHeader title="Details" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Linked SKU" required hint="Stock and pack size join from this SKU at the fulfillment warehouse.">
                  <select
                    className="input"
                    value={draft.sku_id}
                    onChange={(e) => patch('sku_id', e.target.value)}
                    disabled={skuQuery.isLoading}
                  >
                    <option value="">{skuQuery.isLoading ? 'Loading SKUs…' : 'Select a SKU…'}</option>
                    {(skuQuery.data?.items ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name} ({s.pack_size})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Name" required>
                <input className="input" value={draft.name} onChange={(e) => patch('name', e.target.value)} />
              </Field>
              <Field label="Category" required>
                <input className="input" value={draft.category} onChange={(e) => patch('category', e.target.value)} placeholder="Oils / Pulses / Sweeteners" />
              </Field>
              <div className="col-span-2">
                <Field label="Subtitle" hint="Short tagline shown under the name">
                  <input className="input" value={draft.subtitle} onChange={(e) => patch('subtitle', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Description" required hint="Long copy (markdown/plain) for the PDP">
                  <textarea className="input h-32 py-2" value={draft.description} onChange={(e) => patch('description', e.target.value)} />
                </Field>
              </div>
            </div>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader title="Pricing" subtitle="Entered in INR — converted to integer paise on save (§0.1)." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling price (₹)" required>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => patch('price', e.target.value)}
                />
              </Field>
              <Field label="Compare-at / MRP (₹)" hint="Optional strikethrough reference">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.compare_at_price}
                  onChange={(e) => patch('compare_at_price', e.target.value)}
                />
              </Field>
              <Field label="Max qty per order" hint="Blank = unlimited within stock">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={draft.max_qty_per_order}
                  onChange={(e) => patch('max_qty_per_order', e.target.value)}
                />
              </Field>
              <Field label="Low-stock threshold" hint="Blank = use store default">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.low_stock_threshold}
                  onChange={(e) => patch('low_stock_threshold', e.target.value)}
                />
              </Field>
            </div>
          </Card>

          {/* Images */}
          <ImageManager
            images={draft.images}
            ogImage={draft.og_image}
            onImages={(imgs) => patch('images', imgs)}
            onOgImage={(u) => patch('og_image', u)}
          />

          {/* SEO */}
          <Card>
            <CardHeader title="SEO" subtitle="Powers the PDP meta tags, canonical URL and JSON-LD (§10)." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Slug" hint="URL slug; unique. 'featured' / 'hero' are reserved.">
                <input className="input" value={draft.slug} onChange={(e) => patch('slug', e.target.value)} placeholder="auto-generated from name" />
              </Field>
              <Field label="GTIN / barcode" hint="Optional, for JSON-LD">
                <input className="input" value={draft.gtin} onChange={(e) => patch('gtin', e.target.value)} />
              </Field>
              <div className="col-span-2">
                <Field label="SEO title" hint="Defaults to the product name">
                  <input className="input" value={draft.seo_title} onChange={(e) => patch('seo_title', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="SEO description" hint="Defaults to a truncated description (~160 chars)">
                  <textarea className="input h-20 py-2" value={draft.seo_description} onChange={(e) => patch('seo_description', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Canonical path" hint="Defaults to /store/{slug}/ (trailing slash)">
                  <input className="input" value={draft.canonical_path} onChange={(e) => patch('canonical_path', e.target.value)} placeholder="/store/{slug}/" />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* Side rail: merchandising + danger */}
        <div className="space-y-4">
          {isNew ? (
            <Card>
              <CardHeader title="Merchandising" />
              <p className="text-sm text-ink-faint">
                Featured / hero / badges and sort order become available once the draft is created.
              </p>
            </Card>
          ) : (
            p && <MerchandisingCard product={p} />
          )}

          {!isNew && p && (
            <Card>
              <CardHeader title="Lifecycle" />
              <div className="space-y-2 text-sm">
                <p className="text-ink-faint">
                  Publishing or changing the price fires an on-demand revalidation of the storefront listing and sitemap.
                </p>
                {p.status === 'published' ? (
                  <Button variant="secondary" className="w-full" disabled={publish.isPending} onClick={() => publish.mutate(false)}>
                    Unpublish (back to draft)
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" disabled={publish.isPending} onClick={() => publish.mutate(true)}>
                    Publish to storefront
                  </Button>
                )}
                {p.status !== 'archived' && (
                  <Button
                    variant="danger"
                    className="w-full"
                    disabled={archive.isPending}
                    onClick={() => {
                      if (confirm('Archive this product? It will be removed from the storefront.')) archive.mutate();
                    }}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    Archive product
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium tnum">{value}</span>
    </span>
  );
}

// ---- Merchandising flags (saved via the dedicated /flags endpoint, §6.1) ----
function MerchandisingCard({ product }: { product: StoreProductAdmin }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [featured, setFeatured] = useState(product.featured);
  const [isHero, setIsHero] = useState(product.is_hero);
  const [badges, setBadges] = useState((product.badges ?? []).join(', '));
  const [sortOrder, setSortOrder] = useState(String(product.sort_order ?? 0));

  useEffect(() => {
    setFeatured(product.featured);
    setIsHero(product.is_hero);
    setBadges((product.badges ?? []).join(', '));
    setSortOrder(String(product.sort_order ?? 0));
  }, [product]);

  const save = useMutation({
    mutationFn: () =>
      storeApi.products.flags(product.id, {
        featured,
        is_hero: isHero,
        badges: badges.split(',').map((b) => b.trim()).filter(Boolean),
        sort_order: Number(sortOrder) || 0,
      }),
    onSuccess: () => {
      toast.success('Merchandising updated — storefront revalidating');
      qc.invalidateQueries({ queryKey: ['store', 'product', product.id] });
      qc.invalidateQueries({ queryKey: ['store', 'products'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardHeader title="Merchandising" action={<Star className="h-4 w-4 text-gold-ink" strokeWidth={1.5} />} />
      <div className="space-y-3">
        <label className="flex items-center justify-between text-sm">
          <span>Featured rail</span>
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>
            Storefront hero
            <span className="ml-1 text-xs text-ink-faint">(clears it on all others)</span>
          </span>
          <input type="checkbox" checked={isHero} onChange={(e) => setIsHero(e.target.checked)} />
        </label>
        <Field label="Badges" hint="Comma-separated, e.g. Cold-pressed, Bestseller">
          <input className="input" value={badges} onChange={(e) => setBadges(e.target.value)} />
        </Field>
        <Field label="Sort order" hint="Ascending; lower shows first">
          <input className="input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
          Save merchandising
        </Button>
      </div>
    </Card>
  );
}

// ---- Image manager: upload via /media or paste a URL; images[0] is primary ----
function ImageManager({
  images,
  ogImage,
  onImages,
  onOgImage,
}: {
  images: string[];
  ogImage: string;
  onImages: (imgs: string[]) => void;
  onOgImage: (u: string) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');

  const upload = useMutation({
    mutationFn: (file: File) => storeApi.media.upload(file, 'store_product'),
    onSuccess: (res) => {
      onImages([...images, res.url]);
      toast.success('Image uploaded');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function addUrl() {
    const u = url.trim();
    if (!u) return;
    onImages([...images, u]);
    setUrl('');
  }
  function removeAt(i: number) {
    onImages(images.filter((_, idx) => idx !== i));
  }
  function makePrimary(i: number) {
    if (i === 0) return;
    const next = [...images];
    const [m] = next.splice(i, 1);
    next.unshift(m);
    onImages(next);
  }

  return (
    <Card>
      <CardHeader
        title="Images"
        subtitle="First image is the primary / card image. OG image falls back to it."
        action={
          <Button variant="ghost" className="h-8 px-2.5" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            {upload.isPending ? <Spinner /> : <Upload className="h-4 w-4" strokeWidth={1.5} />}
            Upload
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />

      {images.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-chip border border-dashed border-line py-8 text-ink-faint">
          <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
          <span className="text-xs">No images yet — upload or add a URL</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img + i} className="group relative aspect-square overflow-hidden rounded-chip border border-line">
              <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-pill bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-paper">
                  primary
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink/70 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  className="text-[10px] font-semibold text-paper hover:underline disabled:opacity-40"
                  disabled={i === 0}
                  onClick={() => makePrimary(i)}
                >
                  Set primary
                </button>
                <button className="text-paper hover:text-danger" onClick={() => removeAt(i)} aria-label="Remove image">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addUrl()}
          placeholder="Or paste an image URL…"
        />
        <Button variant="secondary" className="shrink-0" onClick={addUrl}>
          Add
        </Button>
      </div>

      <div className="mt-3">
        <Field label="OG / social image" hint="Optional; defaults to the primary image">
          <MediaField value={ogImage} onChange={onOgImage} kind="store_product" />
        </Field>
      </div>
    </Card>
  );
}
