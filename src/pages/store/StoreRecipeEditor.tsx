import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState, Spinner } from '@/components/ui/primitives';
import { MediaField } from '@/components/ui/MediaField';
import { Pill } from '@/components/ui/StatusPill';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type { RecipeAdmin, RecipeInput } from '@/api/types';

// Suggested types match the storefront's known collections; free text is allowed
// since recipe_type is a display key (key == label, like StoreProduct.category).
const RECIPE_TYPE_SUGGESTIONS = ['Breakfast', 'Dals & Curries', 'Mains', 'Sweets', 'Sides & Salads', 'Drinks'];
const DIFFICULTIES = ['Easy', 'Medium', 'Involved'];

interface IngredientGroupDraft {
  heading: string; // '' → null on save (single ungrouped list)
  itemsText: string; // one ingredient per line
}

interface RecipeDraft {
  slug: string;
  title: string;
  subtitle: string;
  recipe_type: string;
  description: string;
  hero_image: string;
  og_image: string;
  video_url: string;
  prep_min: string;
  cook_min: string;
  servings: string;
  difficulty: string;
  ingredients: IngredientGroupDraft[];
  stepsText: string; // one step per line
  tipsText: string; // one tip per line
  tagsText: string; // comma- or newline-separated
  relatedText: string; // one product slug per line
  featured: boolean;
  sort_order: string;
  seo_title: string;
  seo_description: string;
}

const EMPTY: RecipeDraft = {
  slug: '',
  title: '',
  subtitle: '',
  recipe_type: '',
  description: '',
  hero_image: '',
  og_image: '',
  video_url: '',
  prep_min: '',
  cook_min: '',
  servings: '',
  difficulty: 'Easy',
  ingredients: [{ heading: '', itemsText: '' }],
  stepsText: '',
  tipsText: '',
  tagsText: '',
  relatedText: '',
  featured: false,
  sort_order: '0',
  seo_title: '',
  seo_description: '',
};

function toDraft(r: RecipeAdmin): RecipeDraft {
  return {
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle ?? '',
    recipe_type: r.recipe_type,
    description: r.description ?? '',
    hero_image: r.hero_image ?? '',
    og_image: r.og_image ?? '',
    video_url: r.video_url ?? '',
    prep_min: String(r.prep_min ?? 0),
    cook_min: String(r.cook_min ?? 0),
    servings: String(r.servings ?? 0),
    difficulty: r.difficulty || 'Easy',
    ingredients:
      (r.ingredients ?? []).length > 0
        ? (r.ingredients ?? []).map((g) => ({ heading: g.heading ?? '', itemsText: (g.items ?? []).join('\n') }))
        : [{ heading: '', itemsText: '' }],
    stepsText: (r.steps ?? []).join('\n'),
    tipsText: (r.tips ?? []).join('\n'),
    tagsText: (r.tags ?? []).join(', '),
    relatedText: (r.related_product_slugs ?? []).join('\n'),
    featured: r.featured,
    sort_order: String(r.sort_order ?? 0),
    seo_title: r.seo_title ?? '',
    seo_description: r.seo_description ?? '',
  };
}

function splitLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toInput(d: RecipeDraft): RecipeInput {
  return {
    slug: d.slug.trim(),
    title: d.title.trim(),
    recipe_type: d.recipe_type.trim(),
    subtitle: d.subtitle.trim() || null,
    description: d.description,
    hero_image: d.hero_image.trim() || undefined,
    og_image: d.og_image.trim() || null,
    video_url: d.video_url.trim() || null,
    prep_min: Number(d.prep_min) || 0,
    cook_min: Number(d.cook_min) || 0,
    servings: Number(d.servings) || 0,
    difficulty: d.difficulty,
    ingredients: d.ingredients
      .map((g) => ({
        heading: g.heading.trim() || null,
        items: splitLines(g.itemsText),
      }))
      .filter((g) => g.items.length > 0),
    steps: splitLines(d.stepsText),
    tips: splitLines(d.tipsText),
    tags: splitList(d.tagsText),
    related_product_slugs: splitLines(d.relatedText),
    featured: d.featured,
    sort_order: Number(d.sort_order) || 0,
    seo_title: d.seo_title.trim() || null,
    seo_description: d.seo_description.trim() || null,
  };
}

export function StoreRecipeEditorPage() {
  const { id = '' } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [draft, setDraft] = useState<RecipeDraft>(EMPTY);

  const recipe = useQuery({
    queryKey: ['store', 'recipe', id],
    queryFn: () => storeApi.recipes.get(id),
    enabled: !isNew,
  });

  useEffect(() => {
    if (recipe.data) setDraft(toDraft(recipe.data));
  }, [recipe.data]);

  function patch<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function patchGroup(i: number, value: Partial<IngredientGroupDraft>) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((g, idx) => (idx === i ? { ...g, ...value } : g)),
    }));
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['store', 'recipe', id] });
    qc.invalidateQueries({ queryKey: ['store', 'recipes'] });
  }

  const save = useMutation({
    mutationFn: () =>
      isNew ? storeApi.recipes.create(toInput(draft)) : storeApi.recipes.update(id, toInput(draft)),
    onSuccess: (r) => {
      toast.success(isNew ? 'Recipe created' : 'Recipe saved');
      invalidate();
      if (isNew) navigate(`/store/recipes/${r.id}`, { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const publish = useMutation({
    mutationFn: (next: boolean) => (next ? storeApi.recipes.publish(id) : storeApi.recipes.unpublish(id)),
    onSuccess: (_d, next) => {
      toast.success(next ? 'Published — storefront revalidating' : 'Unpublished — storefront revalidating');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => storeApi.recipes.remove(id),
    onSuccess: () => {
      toast.success('Recipe deleted');
      qc.invalidateQueries({ queryKey: ['store', 'recipes'] });
      navigate('/store/recipes');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!isNew && recipe.isLoading) return <LoadingState />;
  if (!isNew && (recipe.isError || !recipe.data))
    return <ErrorState message={errorMessage(recipe.error)} onRetry={() => recipe.refetch()} />;

  const r = recipe.data;
  const valid = Boolean(draft.title.trim() && draft.slug.trim() && draft.recipe_type.trim());

  return (
    <div>
      <PageHeader
        eyebrow={isNew ? 'New recipe' : `/recipes/${r?.slug}`}
        title={isNew ? 'New recipe' : r?.title ?? 'Recipe'}
        description={
          isNew
            ? 'Draft a recipe, then publish to push it live on the storefront. Culinary copy only — no health or medical claims.'
            : 'Edit copy, ingredients, steps and SEO. Publishing triggers storefront revalidation. Culinary copy only — no health or medical claims.'
        }
        actions={
          <Button variant="ghost" onClick={() => navigate('/store/recipes')}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            All recipes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Basics */}
          <Card>
            <CardHeader title="Basics" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title" required>
                <input className="input" value={draft.title} onChange={(e) => patch('title', e.target.value)} />
              </Field>
              <Field label="Slug" required hint="lowercase-with-dashes; used in the URL">
                <input className="input" value={draft.slug} onChange={(e) => patch('slug', e.target.value)} placeholder="khichdi-with-ghee" />
              </Field>
              <div className="col-span-2">
                <Field label="Subtitle" hint="One-line hook shown under the title">
                  <input className="input" value={draft.subtitle} onChange={(e) => patch('subtitle', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Type" required hint="Display collection on the storefront, e.g. Dals & Curries">
                  <input
                    className="input"
                    list="recipe-type-suggestions"
                    value={draft.recipe_type}
                    onChange={(e) => patch('recipe_type', e.target.value)}
                    placeholder="Dals & Curries"
                  />
                  <datalist id="recipe-type-suggestions">
                    {RECIPE_TYPE_SUGGESTIONS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Description" hint="Intro paragraph, plain text">
                  <textarea className="input h-28 py-2" value={draft.description} onChange={(e) => patch('description', e.target.value)} />
                </Field>
              </div>
            </div>
          </Card>

          {/* Ingredients */}
          <Card>
            <CardHeader
              title="Ingredients"
              subtitle="Group ingredients under optional headings, e.g. “For the tadka”. Leave the heading blank for a single ungrouped list."
              action={
                <Button
                  variant="ghost"
                  className="h-8 px-2.5"
                  onClick={() => patch('ingredients', [...draft.ingredients, { heading: '', itemsText: '' }])}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  Add group
                </Button>
              }
            />
            <div className="space-y-3">
              {draft.ingredients.map((g, i) => (
                <div key={i} className="space-y-2 rounded-chip border border-line p-3">
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      value={g.heading}
                      onChange={(e) => patchGroup(i, { heading: e.target.value })}
                      placeholder="Group heading (optional), e.g. For the tadka"
                    />
                    <Button
                      variant="ghost"
                      className="h-9 shrink-0 px-2.5"
                      disabled={draft.ingredients.length === 1}
                      onClick={() => patch('ingredients', draft.ingredients.filter((_, idx) => idx !== i))}
                      aria-label="Remove group"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                  </div>
                  <Field label="Items" hint="One ingredient per line, e.g. 2 tbsp Organikaly Yellow Mustard Oil">
                    <textarea
                      className="input h-28 py-2"
                      value={g.itemsText}
                      onChange={(e) => patchGroup(i, { itemsText: e.target.value })}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </Card>

          {/* Steps */}
          <Card>
            <CardHeader title="Steps" />
            <Field label="Method" hint="One step per line — numbered automatically on the site">
              <textarea className="input h-40 py-2" value={draft.stepsText} onChange={(e) => patch('stepsText', e.target.value)} />
            </Field>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader title="Tips" />
            <Field label="Kitchen tips" hint="Optional; one tip per line">
              <textarea className="input h-24 py-2" value={draft.tipsText} onChange={(e) => patch('tipsText', e.target.value)} />
            </Field>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader title="SEO" />
            <div className="space-y-3">
              <Field label="SEO title" hint="Brand-free — the site appends · Organikaly">
                <input className="input" value={draft.seo_title} onChange={(e) => patch('seo_title', e.target.value)} />
              </Field>
              <Field label="SEO description">
                <div>
                  <textarea
                    className="input h-20 py-2"
                    value={draft.seo_description}
                    onChange={(e) => patch('seo_description', e.target.value)}
                  />
                  <div className={`mt-1 text-right text-xs tnum ${draft.seo_description.length > 160 ? 'text-warning' : 'text-ink-faint'}`}>
                    {draft.seo_description.length}/160
                    {draft.seo_description.length > 160 && ' — may be truncated in search results'}
                  </div>
                </div>
              </Field>
            </div>
          </Card>
        </div>

        {/* Side rail */}
        <div className="space-y-4">
          {/* Publish */}
          <Card>
            <CardHeader
              title="Publish"
              action={
                <Pill tone={!isNew && r?.status === 'published' ? 'brand' : 'neutral'}>
                  {isNew ? 'new' : r?.status ?? 'draft'}
                </Pill>
              }
            />
            <div className="space-y-2">
              <Button className="w-full" disabled={save.isPending || !valid} onClick={() => save.mutate()}>
                {save.isPending && <Spinner className="text-ink" />}
                {isNew ? 'Create recipe' : 'Save changes'}
              </Button>
              {!isNew && r && (
                r.status === 'published' ? (
                  <Button variant="secondary" className="w-full" disabled={publish.isPending} onClick={() => publish.mutate(false)}>
                    Unpublish (back to draft)
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" disabled={publish.isPending} onClick={() => publish.mutate(true)}>
                    Publish to storefront
                  </Button>
                )
              )}
              {!isNew && (
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm('Delete this recipe? It will be removed from the storefront permanently.')) remove.mutate();
                  }}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  Delete recipe
                </Button>
              )}
              {!valid && <p className="text-xs text-ink-faint">Title, slug and type are required.</p>}
            </div>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader title="Media" />
            <div className="space-y-3">
              <Field label="Hero image" hint="Upload a file or paste an absolute URL.">
                <MediaField value={draft.hero_image} onChange={(v) => patch('hero_image', v)} kind="recipe" />
              </Field>
              <Field label="OG / social image" hint="Optional; falls back to the hero image">
                <MediaField value={draft.og_image} onChange={(v) => patch('og_image', v)} kind="recipe" />
              </Field>
              <Field label="How-to video" hint="Optional; shown on the recipe page. Upload a file or paste a URL.">
                <MediaField value={draft.video_url} onChange={(v) => patch('video_url', v)} kind="recipe" accept="video" />
              </Field>
            </div>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader title="Details" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prep (min)">
                <input className="input" type="number" min={0} value={draft.prep_min} onChange={(e) => patch('prep_min', e.target.value)} />
              </Field>
              <Field label="Cook (min)">
                <input className="input" type="number" min={0} value={draft.cook_min} onChange={(e) => patch('cook_min', e.target.value)} />
              </Field>
              <Field label="Servings">
                <input className="input" type="number" min={1} value={draft.servings} onChange={(e) => patch('servings', e.target.value)} />
              </Field>
              <Field label="Difficulty">
                <select className="input" value={draft.difficulty} onChange={(e) => patch('difficulty', e.target.value)}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center justify-between text-sm">
                <span>Featured</span>
                <input type="checkbox" checked={draft.featured} onChange={(e) => patch('featured', e.target.checked)} />
              </label>
              <Field label="Sort order" hint="Ascending; lower shows first">
                <input className="input" type="number" value={draft.sort_order} onChange={(e) => patch('sort_order', e.target.value)} />
              </Field>
            </div>
          </Card>

          {/* Linking */}
          <Card>
            <CardHeader title="Linking" />
            <div className="space-y-3">
              <Field label="Tags" hint="Comma- or newline-separated; used as JSON-LD keywords">
                <textarea className="input h-16 py-2" value={draft.tagsText} onChange={(e) => patch('tagsText', e.target.value)} />
              </Field>
              <Field label="Related products" hint="Product slugs from Store → Products; one per line">
                <textarea className="input h-20 py-2" value={draft.relatedText} onChange={(e) => patch('relatedText', e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
