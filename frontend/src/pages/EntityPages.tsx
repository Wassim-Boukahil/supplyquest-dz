import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Edit3, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Card, ErrorState, Input, LoadingState, Modal, Select } from "../components/ui";
import { DetailCard, EmptyPanel, FormField, PageHeader, PaginationBar, RowLink, StatusBadge, Table, Toolbar } from "../components/phase1";
import { apiRequest, ApiError } from "../lib/api";
import { asNumber, type Category, type Contact, type ListResult, type Product, type Warehouse } from "../lib/phase1";
import { algerianWilayas } from "../data/wilayas";

type EntityKind = "products" | "categories" | "suppliers" | "customers" | "warehouses";
type Entity = Product | Category | Contact | Warehouse;

const labels: Record<EntityKind, { title: string; singular: string; description: string; placeholder: string }> = {
  products: { title: "Products", singular: "Product", description: "Manage your catalog, pricing, and replenishment thresholds.", placeholder: "Search by name or SKU" },
  categories: { title: "Categories", singular: "Category", description: "Keep your catalog organized for faster operational decisions.", placeholder: "Search categories" },
  suppliers: { title: "Suppliers", singular: "Supplier", description: "Maintain supplier contacts and purchasing relationships.", placeholder: "Search suppliers" },
  customers: { title: "Customers", singular: "Customer", description: "Manage the businesses you serve and their order history.", placeholder: "Search customers" },
  warehouses: { title: "Warehouses", singular: "Warehouse", description: "Track storage locations and operational capacity.", placeholder: "Search warehouses" },
};

function useEntityOptions() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  useEffect(() => {
    Promise.all([
      apiRequest<ListResult<Category>>("/api/v1/categories?pageSize=100"),
      apiRequest<ListResult<Contact>>("/api/v1/suppliers?pageSize=100"),
    ]).then(([categoryResult, supplierResult]) => {
      setCategories(categoryResult.items);
      setSuppliers(supplierResult.items);
    }).catch(() => undefined);
  }, []);
  return { categories, suppliers };
}

function ProductFields({ value, setValue }: { value: Record<string, string>; setValue: (key: string, value: string) => void }) {
  const { categories, suppliers } = useEntityOptions();
  return <>
    <div className="form-grid two-up">
      <FormField label="SKU"><Input required value={value.sku ?? ""} onChange={(event) => setValue("sku", event.target.value)} /></FormField>
      <FormField label="Product name"><Input required value={value.name ?? ""} onChange={(event) => setValue("name", event.target.value)} /></FormField>
      <FormField label="Unit"><Input required value={value.unit ?? "carton"} onChange={(event) => setValue("unit", event.target.value)} /></FormField>
      <FormField label="Category"><Select value={value.categoryId ?? ""} onChange={(event) => setValue("categoryId", event.target.value)}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></FormField>
      <FormField label="Purchase price (DZD)"><Input required type="number" min="0" step="0.01" value={value.purchasePrice ?? "0"} onChange={(event) => setValue("purchasePrice", event.target.value)} /></FormField>
      <FormField label="Selling price (DZD)"><Input required type="number" min="0" step="0.01" value={value.sellingPrice ?? "0"} onChange={(event) => setValue("sellingPrice", event.target.value)} /></FormField>
      <FormField label="Minimum stock"><Input type="number" min="0" value={value.minimumStock ?? "0"} onChange={(event) => setValue("minimumStock", event.target.value)} /></FormField>
      <FormField label="Safety stock"><Input type="number" min="0" value={value.safetyStock ?? "0"} onChange={(event) => setValue("safetyStock", event.target.value)} /></FormField>
    </div>
    <FormField label="Preferred supplier"><Select value={value.preferredSupplierId ?? ""} onChange={(event) => setValue("preferredSupplierId", event.target.value)}><option value="">No preferred supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select></FormField>
    <FormField label="Description"><textarea className="input textarea" value={value.description ?? ""} onChange={(event) => setValue("description", event.target.value)} /></FormField>
  </>;
}

function ContactFields({ value, setValue, supplier }: { value: Record<string, string>; setValue: (key: string, value: string) => void; supplier?: boolean }) {
  return <>
    <FormField label={supplier ? "Supplier name" : "Business name"}><Input required value={value.name ?? ""} onChange={(event) => setValue("name", event.target.value)} /></FormField>
    <div className="form-grid two-up">
      <FormField label="Email"><Input type="email" value={value.email ?? ""} onChange={(event) => setValue("email", event.target.value)} /></FormField>
      <FormField label="Phone"><Input value={value.phone ?? ""} onChange={(event) => setValue("phone", event.target.value)} /></FormField>
      <FormField label="Wilaya"><Select value={value.wilaya ?? ""} onChange={(event) => setValue("wilaya", event.target.value)}><option value="">Select a wilaya</option>{algerianWilayas.map((wilaya) => <option key={wilaya.code} value={wilaya.name}>{wilaya.name}</option>)}</Select></FormField>
      {supplier && <FormField label="Average lead time (days)"><Input type="number" min="0" value={value.averageLeadTime ?? ""} onChange={(event) => setValue("averageLeadTime", event.target.value)} /></FormField>}
    </div>
    <FormField label="Address"><textarea className="input textarea" value={value.address ?? ""} onChange={(event) => setValue("address", event.target.value)} /></FormField>
  </>;
}

function WarehouseFields({ value, setValue }: { value: Record<string, string>; setValue: (key: string, value: string) => void }) {
  return <>
    <div className="form-grid two-up">
      <FormField label="Warehouse name"><Input required value={value.name ?? ""} onChange={(event) => setValue("name", event.target.value)} /></FormField>
      <FormField label="Code"><Input required value={value.code ?? ""} onChange={(event) => setValue("code", event.target.value)} /></FormField>
      <FormField label="Wilaya"><Select value={value.wilaya ?? ""} onChange={(event) => setValue("wilaya", event.target.value)}><option value="">Select a wilaya</option>{algerianWilayas.map((wilaya) => <option key={wilaya.code} value={wilaya.name}>{wilaya.name}</option>)}</Select></FormField>
      <FormField label="Capacity"><Input type="number" min="1" value={value.capacity ?? ""} onChange={(event) => setValue("capacity", event.target.value)} /></FormField>
    </div>
    <FormField label="Location"><Input value={value.location ?? ""} onChange={(event) => setValue("location", event.target.value)} /></FormField>
  </>;
}

function formDefaults(kind: EntityKind, item?: Entity): Record<string, string> {
  const source = (item ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(source).filter(([key]) => ["sku", "name", "description", "unit", "purchasePrice", "sellingPrice", "minimumStock", "safetyStock", "categoryId", "preferredSupplierId", "email", "phone", "address", "wilaya", "averageLeadTime", "code", "capacity", "location"].includes(key)).map(([key, value]) => [key, value == null ? "" : String(value)]));
}

function EntityForm({ kind, item, onDone }: { kind: EntityKind; item?: Entity; onDone: () => void }) {
  const [value, setValueState] = useState(() => formDefaults(kind, item));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const setValue = (key: string, next: string) => setValueState((current) => ({ ...current, [key]: next }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSaving(true);
    const numericKeys = ["purchasePrice", "sellingPrice", "minimumStock", "safetyStock", "averageLeadTime", "capacity"];
    const payload = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== "").map(([key, entry]) => [key, numericKeys.includes(key) ? Number(entry) : entry]));
    try {
      await apiRequest(kind === "products" ? `/api/v1/products${item ? `/${(item as Product).id}` : ""}` : ` /api/v1/${kind}${item ? `/${(item as Entity & { id: string }).id}` : ""}`.trim(), { method: item ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onDone();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to save this record."); } finally { setSaving(false); }
  }
  return <form className="form-stack" onSubmit={submit}>
    {error && <div className="form-error">{error}</div>}
    {kind === "products" ? <ProductFields value={value} setValue={setValue} /> : kind === "categories" ? <FormField label="Category name"><Input required value={value.name ?? ""} onChange={(event) => setValue("name", event.target.value)} /></FormField> : kind === "warehouses" ? <WarehouseFields value={value} setValue={setValue} /> : <ContactFields value={value} setValue={setValue} supplier={kind === "suppliers"} />}
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" disabled={saving}><Save size={15} />{saving ? "Saving..." : item ? "Save changes" : `Create ${labels[kind].singular.toLowerCase()}`}</Button></div>
  </form>;
}

export function EntityListPage({ kind }: { kind: EntityKind }) {
  const config = labels[kind];
  const [result, setResult] = useState<ListResult<Entity> | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ item?: Entity } | null>(null);
  const load = () => apiRequest<ListResult<Entity>>(`/api/v1/${kind}?page=${page}&pageSize=20${query ? `&search=${encodeURIComponent(query)}` : ""}`).then(setResult).catch((err) => setError(err instanceof Error ? err.message : "Unable to load records."));
  useEffect(() => { setError(""); load(); }, [kind, page, query]);
  async function archive(item: Entity) {
    const id = (item as Entity & { id: string }).id;
    const path = kind === "categories" ? `/api/v1/${kind}/${id}` : `/api/v1/${kind}/${id}/${(item as Entity & { isActive?: boolean }).isActive ? "archive" : "activate"}`;
    try { await apiRequest(path, { method: kind === "categories" ? "DELETE" : "POST" }); load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update this record."); }
  }
  const columns = useMemo(() => kind === "products" ? ["Product", "Category", "Pricing", "Stock policy", "Status", ""] : kind === "categories" ? ["Category", ""] : kind === "warehouses" ? ["Warehouse", "Wilaya", "Capacity", "Status", ""] : [kind === "suppliers" ? "Supplier" : "Customer", "Contact", "Wilaya", "Status", ""] , [kind]);
  return <AppShell><PageHeader eyebrow={`Catalog / ${config.title}`} title={config.title} description={config.description} action={<Button onClick={() => setModal({})}><Plus size={16} /> Add {config.singular}</Button>} />
    <Card className="list-card"><Toolbar search={query} onSearch={(value) => { setQuery(value); setPage(1); }} placeholder={config.placeholder}><span className="result-count">{result?.pagination.total ?? 0} records</span></Toolbar>
      {error ? <ErrorState message={error} /> : !result ? <LoadingState /> : result.items.length === 0 ? <EmptyPanel title={`No ${kind} yet`} message="Create a record to start managing this part of your workspace." onAdd={() => setModal({})} /> : <Table headers={columns}>{result.items.map((item) => {
        const id = (item as Entity & { id: string }).id;
        return <tr key={id}>{kind === "products" && <><td><RowLink to={`/products/${id}`}><span className="table-primary">{(item as Product).name}</span><small>{(item as Product).sku}</small></RowLink></td><td>{(item as Product).category?.name ?? "—"}</td><td><span>{asNumber((item as Product).sellingPrice).toLocaleString()} DZD</span><small>Buy {asNumber((item as Product).purchasePrice).toLocaleString()} DZD</small></td><td><span>Min {(item as Product).minimumStock}</span><small>Safety {(item as Product).safetyStock}</small></td><td><StatusBadge status={(item as Product).isActive ? "ACTIVE" : "ARCHIVED"} /></td></>}
        {kind === "categories" && <td><RowLink to={`/categories/${id}`}><span className="table-primary">{(item as Category).name}</span></RowLink></td>}
        {kind === "warehouses" && <><td><RowLink to={`/warehouses/${id}`}><span className="table-primary">{(item as Warehouse).name}</span><small>{(item as Warehouse).code}</small></RowLink></td><td>{(item as Warehouse).wilaya ?? "—"}</td><td>{(item as Warehouse).capacity?.toLocaleString() ?? "—"}</td><td><StatusBadge status={(item as Warehouse).isActive ? "ACTIVE" : "ARCHIVED"} /></td></>}
        {(kind === "suppliers" || kind === "customers") && <><td><RowLink to={`/${kind}/${id}`}><span className="table-primary">{(item as Contact).name}</span></RowLink></td><td><span>{(item as Contact).email ?? "—"}</span><small>{(item as Contact).phone ?? ""}</small></td><td>{(item as Contact).wilaya ?? "—"}</td><td><StatusBadge status={(item as Contact).isActive === false ? "ARCHIVED" : "ACTIVE"} /></td></>}
        {kind !== "categories" && <td className="table-actions"><Button variant="ghost" onClick={() => setModal({ item })} aria-label={`Edit ${config.singular}`}><Edit3 size={15} /></Button><Button variant="ghost" onClick={() => archive(item)} aria-label="Archive"><Archive size={15} /></Button></td>}
        {kind === "categories" && <td className="table-actions"><Button variant="ghost" onClick={() => setModal({ item })}><Edit3 size={15} /></Button><Button variant="ghost" onClick={() => archive(item)}><Trash2 size={15} /></Button></td>}
        </tr>;
      })}</Table>}
      {result && <PaginationBar page={result.pagination.page} totalPages={result.pagination.totalPages} onPage={setPage} />}
    </Card>
    <Modal open={Boolean(modal)} title={`${modal?.item ? "Edit" : "Add"} ${config.singular}`} onClose={() => setModal(null)}>{modal && <EntityForm kind={kind} item={modal.item} onDone={() => { setModal(null); load(); }} />}</Modal>
  </AppShell>;
}

export function EntityDetailPage({ kind }: { kind: EntityKind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Entity | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (id) apiRequest<Entity>(`/api/v1/${kind}/${id}`).then(setItem).catch((err) => setError(err instanceof Error ? err.message : "Unable to load record.")); }, [id, kind]);
  if (error) return <AppShell><PageHeader eyebrow={labels[kind].title} title="Record unavailable" back={`/${kind}`} /><ErrorState message={error} /></AppShell>;
  if (!item) return <AppShell><LoadingState /></AppShell>;
  const record = item as Contact & Warehouse & Product;
  const productDetail = record as unknown as Product & { inventoryLevels?: { warehouse: Warehouse; onHandQuantity: number; reservedQuantity: number }[] };
  return <AppShell><PageHeader eyebrow={`Catalog / ${labels[kind].title}`} title={record.name} description={kind === "products" ? `${(record as Product).sku} · ${(record as Product).unit}` : (record as Contact).email ?? undefined} back={`/${kind}`} action={<Button variant="secondary" onClick={() => navigate(`/${kind}`)}><Edit3 size={15} /> Manage record</Button>} />
    <div className="detail-grid"><DetailCard title="Overview"><div className="detail-list">
      {kind === "products" && <><div><span>Purchase price</span><strong>{asNumber((record as Product).purchasePrice).toLocaleString()} DZD</strong></div><div><span>Selling price</span><strong>{asNumber((record as Product).sellingPrice).toLocaleString()} DZD</strong></div><div><span>Category</span><strong>{(record as Product).category?.name ?? "—"}</strong></div><div><span>Preferred supplier</span><strong>{(record as Product).preferredSupplier?.name ?? "—"}</strong></div><div><span>Minimum stock</span><strong>{(record as Product).minimumStock}</strong></div><div><span>Safety stock</span><strong>{(record as Product).safetyStock}</strong></div></>}
      {kind === "warehouses" && <><div><span>Code</span><strong>{(record as Warehouse).code}</strong></div><div><span>Wilaya</span><strong>{(record as Warehouse).wilaya ?? "—"}</strong></div><div><span>Location</span><strong>{(record as Warehouse).location ?? "—"}</strong></div><div><span>Capacity</span><strong>{(record as Warehouse).capacity?.toLocaleString() ?? "—"}</strong></div></>}
      {(kind === "suppliers" || kind === "customers") && <><div><span>Email</span><strong>{(record as Contact).email ?? "—"}</strong></div><div><span>Phone</span><strong>{(record as Contact).phone ?? "—"}</strong></div><div><span>Wilaya</span><strong>{(record as Contact).wilaya ?? "—"}</strong></div><div><span>Address</span><strong>{(record as Contact).address ?? "—"}</strong></div></>}
      {kind === "categories" && <div><span>Category name</span><strong>{record.name}</strong></div>}
    </div></DetailCard>
    {kind === "products" && <DetailCard title="Inventory by warehouse">{productDetail.inventoryLevels?.length ? <Table headers={["Warehouse", "On hand", "Reserved", "Available"]}>{productDetail.inventoryLevels.map((level) => <tr key={level.warehouse.id}><td>{level.warehouse.name}</td><td>{level.onHandQuantity}</td><td>{level.reservedQuantity}</td><td><strong>{level.onHandQuantity - level.reservedQuantity}</strong></td></tr>)}</Table> : <p className="muted-copy">No inventory has been recorded for this product yet.</p>}</DetailCard>}
    </div>
  </AppShell>;
}