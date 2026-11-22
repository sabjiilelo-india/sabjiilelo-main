import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { UNIT_LABEL, formatINR, formatQty, nutritionFor, type Category, type Nutrition, type UnitType, type VariantInput } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, PageLoader, Select, Table, Textarea, Toggle } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { ProduceImage } from '../../components/ProduceImage';
import { toast } from '../../components/toast';

export function CatalogList() {
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const cats = useQuery({ queryKey: qk.categories, queryFn: api.manage.categories });
  const items = useQuery({ queryKey: qk.items({ categoryId, search }), queryFn: () => api.manage.items({ categoryId: categoryId || undefined, q: search || undefined }) });
  return (
    <>
      <PageHeader
        title="Items"
        subtitle="Your area's catalog. Daily prices and stock are set on their own boards."
        actions={
          <Link to="/dashboard/catalog/new">
            <Button icon={<Plus size={16} />}>New item</Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select className="max-w-xs" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {items.isLoading ? (
        <PageLoader />
      ) : !items.data?.length ? (
        <EmptyState title="No items" text="Add your first fruit or vegetable." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Packs & prices</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.data.map((i) => (
              <tr key={i.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <ProduceImage src={i.images[0]} name={i.name} className="h-10 w-10 rounded-lg" emojiClass="text-xl" />
                    <span className="font-medium text-ink">{i.name}</span>
                  </div>
                </td>
                <td className="text-muted">{i.categoryName}</td>
                <td>{UNIT_LABEL[i.unitType]}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {i.variants
                      .filter((v) => v.isActive)
                      .map((v) => (
                        <Badge key={v.id}>
                          {v.label} · {formatINR(v.pricePaise)}
                        </Badge>
                      ))}
                  </div>
                </td>
                <td>{i.isActive ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}</td>
                <td className="text-right">
                  <Link to={`/dashboard/catalog/${i.id}`}>
                    <Button size="sm" variant="outline" icon={<Pencil size={14} />}>
                      Edit
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

const BASE_SUFFIX: Record<UnitType, string> = { KG: 'g', GRAM: 'g', LITRE: 'ml', PIECE: 'pcs', BUNCH: 'bunch', DOZEN: 'dozen', PACK: 'pack' };

type VariantRow = VariantInput & { key: string };

export function ItemEditor() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: qk.categories, queryFn: api.manage.categories });
  const existing = useQuery({ queryKey: qk.item(id ?? ''), queryFn: () => api.manage.item(id!), enabled: !isNew });

  const [f, setF] = useState({
    name: '',
    categoryId: '',
    description: '',
    unitType: 'KG' as UnitType,
    hsnCode: '',
    sourceNote: '',
    isActive: true,
    images: [] as string[],
  });
  const [variants, setVariants] = useState<VariantRow[]>([{ key: 'v0', label: '500 g', baseQty: 500, pricePaise: 2000, mrpPaise: 2500, isActive: true }]);
  const [nut, setNut] = useState<NutritionDraft>(emptyNutrition());
  // Only send nutrition when the admin touched it, so saving other fields never clears it.
  const [nutDirty, setNutDirty] = useState(false);
  const editNut = (d: NutritionDraft) => {
    setNut(d);
    setNutDirty(true);
  };

  useEffect(() => {
    if (!isNew && existing.data) {
      const i = existing.data;
      setF({
        name: i.name,
        categoryId: i.categoryId,
        description: i.description ?? '',
        unitType: i.unitType,
        hsnCode: i.hsnCode ?? '',
        sourceNote: i.sourceNote ?? '',
        isActive: i.isActive,
        images: i.images,
      });
      setVariants(i.variants.filter((v) => v.isActive).map((v) => ({ ...v, key: v.id })));
      setNut(draftFrom(i.nutrition));
      setNutDirty(false);
    }
  }, [existing.data, isNew]);
  useEffect(() => {
    if (isNew && !f.categoryId && cats.data?.[0]) setF((s) => ({ ...s, categoryId: cats.data[0]!.id }));
  }, [cats.data, isNew, f.categoryId]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        description: f.description || null,
        hsnCode: f.hsnCode || null,
        sourceNote: f.sourceNote || null,
        variants: variants.map(({ key: _k, ...v }) => v),
        ...(nutDirty ? { nutrition: nut.enabled ? draftToNutrition(nut) : null } : {}),
      };
      return isNew ? api.manage.createItem(body) : api.manage.updateItem(id!, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manage'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
      toast.success(isNew ? 'Item created. Set its stock on the stock board.' : 'Item saved');
      nav('/dashboard/catalog');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!isNew && existing.isLoading) return <PageLoader />;
  const setV = (key: string, patch: Partial<VariantRow>) => setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  return (
    <>
      <PageHeader title={isNew ? 'New item' : `Edit ${f.name}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tomato (Desi)" />
            </Field>
            <Field label="Category">
              <Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                {cats.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sold by" hint="Stock and vendor rates use this unit">
              <Select value={f.unitType} onChange={(e) => setF({ ...f, unitType: e.target.value as UnitType })} disabled={!isNew}>
                {Object.entries(UNIT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
            <Field label="Source / freshness tag" hint="Shown on the product card, e.g. 'Nashik farms'">
              <Input value={f.sourceNote} onChange={(e) => setF({ ...f, sourceNote: e.target.value })} />
            </Field>
            <Field label="HSN code (optional)">
              <Input value={f.hsnCode} onChange={(e) => setF({ ...f, hsnCode: e.target.value })} />
            </Field>
          </Card>

          <NutritionEditor value={nut} onChange={editNut} suggestion={f.name ? nutritionFor(f.name) : null} />

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base">Pack sizes</h2>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus size={14} />}
                onClick={() => setVariants((vs) => [...vs, { key: `v${Date.now()}`, label: '', baseQty: 1, pricePaise: 0, mrpPaise: 0, isActive: true }])}
              >
                Add pack
              </Button>
            </div>
            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.key} className="grid items-end gap-3 rounded-xl bg-cream p-3 sm:grid-cols-[1fr_120px_120px_120px_auto]">
                  <Field label="Label">
                    <Input value={v.label} placeholder={formatQty(f.unitType, v.baseQty)} onChange={(e) => setV(v.key, { label: e.target.value })} />
                  </Field>
                  <Field label={`Quantity (${BASE_SUFFIX[f.unitType]})`}>
                    <Input
                      type="number"
                      min={1}
                      value={v.baseQty}
                      onChange={(e) => {
                        const baseQty = Math.max(1, Math.round(Number(e.target.value)));
                        setV(v.key, { baseQty, label: v.label || formatQty(f.unitType, baseQty) });
                      }}
                    />
                  </Field>
                  <Field label="Price">
                    <MoneyInput value={v.pricePaise} onChange={(p) => setV(v.key, { pricePaise: p })} />
                  </Field>
                  <Field label="MRP">
                    <MoneyInput value={v.mrpPaise} onChange={(p) => setV(v.key, { mrpPaise: p })} />
                  </Field>
                  <Button variant="ghost" className="text-danger" disabled={variants.length === 1} onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))} aria-label="Remove pack">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-base">Photos</h2>
            <ImageUpload folder="items" multiple value={f.images} onChange={(images) => setF({ ...f, images })} />
            <p className="mt-2 text-xs text-muted">Square photos on a light background look best. Without a photo a friendly icon is shown.</p>
          </Card>
          <Card className="p-5">
            <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Visible to customers" />
          </Card>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => nav('/dashboard/catalog')}>
              Cancel
            </Button>
            <Button block loading={save.isPending} onClick={() => save.mutate()}>
              Save item
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function Categories() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.categories, queryFn: api.manage.categories });
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  if (q.isLoading) return <PageLoader />;
  return (
    <>
      <PageHeader
        title="Categories"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            New category
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Items</th>
            <th>Order</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {q.data?.map((c) => (
            <tr key={c.id}>
              <td className="font-medium text-ink">{c.name}</td>
              <td>{c.itemCount ?? 0}</td>
              <td>{c.sort}</td>
              <td>{c.isActive ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}</td>
              <td className="text-right">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && <CategoryForm category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['manage'] })} />}
    </>
  );
}

function CategoryForm({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: category?.name ?? '', sort: category?.sort ?? 0, isActive: category?.isActive ?? true, imageUrl: category?.imageUrl ?? null });
  const m = useMutation({
    mutationFn: () => (category ? api.manage.updateCategory(category.id, f) : api.manage.createCategory(f)),
    onSuccess: () => {
      onSaved();
      onClose();
      toast.success('Saved');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={category ? 'Edit category' : 'New category'} footer={<Button loading={m.isPending} onClick={() => m.mutate()}>Save</Button>}>
      <div className="space-y-4">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Display order">
          <Input type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} />
        </Field>
        <Field label="Image (optional)">
          <ImageUpload folder="categories" value={f.imageUrl ? [f.imageUrl] : []} onChange={(u) => setF({ ...f, imageUrl: u[0] ?? null })} />
        </Field>
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Visible" />
      </div>
    </Modal>
  );
}

type NutritionDraft = {
  enabled: boolean;
  per: string;
  calories: string;
  protein: string;
  carbs: string;
  fibre: string;
  fat: string;
  tag: string;
  benefits: string;
  highlights: { key: string; name: string; amount: string; dv: string }[];
};

function emptyNutrition(): NutritionDraft {
  return { enabled: false, per: '100 g', calories: '', protein: '', carbs: '', fibre: '', fat: '', tag: '', benefits: '', highlights: [] };
}

function draftFrom(n: Nutrition | null): NutritionDraft {
  if (!n) return emptyNutrition();
  return {
    enabled: true,
    per: n.per,
    calories: String(n.calories),
    protein: String(n.protein),
    carbs: String(n.carbs),
    fibre: String(n.fibre),
    fat: String(n.fat),
    tag: n.tag ?? '',
    benefits: n.benefits.join('\n'),
    highlights: n.highlights.map((h, i) => ({ key: `h${i}`, name: h.name, amount: h.amount, dv: h.dv != null ? String(h.dv) : '' })),
  };
}

function draftToNutrition(d: NutritionDraft): Nutrition {
  const num = (s: string) => Math.max(0, Number(s) || 0);
  return {
    per: d.per.trim() || '100 g',
    calories: num(d.calories),
    protein: num(d.protein),
    carbs: num(d.carbs),
    fibre: num(d.fibre),
    fat: num(d.fat),
    highlights: d.highlights
      .filter((h) => h.name.trim())
      .map((h) => ({ name: h.name.trim(), amount: h.amount.trim(), ...(h.dv.trim() ? { dv: num(h.dv) } : {}) })),
    benefits: d.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
    ...(d.tag.trim() ? { tag: d.tag.trim() } : {}),
  };
}

function NutritionEditor({ value: d, onChange, suggestion }: { value: NutritionDraft; onChange: (d: NutritionDraft) => void; suggestion: Nutrition | null }) {
  const set = (patch: Partial<NutritionDraft>) => onChange({ ...d, ...patch });
  const macro = (k: 'calories' | 'protein' | 'carbs' | 'fibre' | 'fat', label: string) => (
    <Field label={label}>
      <Input type="number" min={0} step="0.1" value={d[k]} onChange={(e) => set({ [k]: e.target.value })} />
    </Field>
  );
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base">Nutrition &amp; benefits</h2>
          <p className="text-xs text-muted">Shown on the item page. Typical values per 100 g.</p>
        </div>
        <Toggle checked={d.enabled} onChange={(v) => set({ enabled: v })} label={d.enabled ? 'Shown' : 'Hidden'} />
      </div>
      {d.enabled && (
        <div className="mt-4 space-y-4">
          {suggestion && !d.calories && (
            <Button size="sm" variant="secondary" onClick={() => onChange(draftFrom(suggestion))}>
              Fill from our nutrition table
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Field label="Per">
              <Input value={d.per} onChange={(e) => set({ per: e.target.value })} />
            </Field>
            {macro('calories', 'Calories')}
            {macro('protein', 'Protein (g)')}
            {macro('carbs', 'Carbs (g)')}
            {macro('fibre', 'Fibre (g)')}
            {macro('fat', 'Fat (g)')}
          </div>
          <Field label="Card badge" hint="Short, e.g. 'Rich in Vitamin C'">
            <Input maxLength={40} value={d.tag} onChange={(e) => set({ tag: e.target.value })} />
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Vitamins &amp; minerals</span>
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => set({ highlights: [...d.highlights, { key: `h${Date.now()}`, name: '', amount: '', dv: '' }] })}>
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {d.highlights.map((h) => (
                <div key={h.key} className="grid grid-cols-[1fr_1fr_90px_auto] items-center gap-2">
                  <Input placeholder="Vitamin C" value={h.name} onChange={(e) => set({ highlights: d.highlights.map((x) => (x.key === h.key ? { ...x, name: e.target.value } : x)) })} />
                  <Input placeholder="14 mg" value={h.amount} onChange={(e) => set({ highlights: d.highlights.map((x) => (x.key === h.key ? { ...x, amount: e.target.value } : x)) })} />
                  <Input type="number" min={0} placeholder="% DV" value={h.dv} onChange={(e) => set({ highlights: d.highlights.map((x) => (x.key === h.key ? { ...x, dv: e.target.value } : x)) })} />
                  <Button variant="ghost" className="text-danger" aria-label="Remove" onClick={() => set({ highlights: d.highlights.filter((x) => x.key !== h.key) })}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Field label="Benefits" hint="One per line">
            <Textarea rows={4} value={d.benefits} onChange={(e) => set({ benefits: e.target.value })} />
          </Field>
        </div>
      )}
    </Card>
  );
}

