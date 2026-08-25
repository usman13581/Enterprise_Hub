"use client";

import { FormEvent, useState } from "react";
import { apiDelete, apiPost, apiPut, apiUpload, assetUrl } from "@/lib/api";
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from "@/lib/useCollection";
import { Pagination, SearchBox, Toast } from "@/components/ListControls";
import { EditIconButton } from "@/components/Finance";
import { FilePicker } from "@/components/FilePicker";
import { PreviewableImage } from "@/components/ImagePreview";
import type { Product, Supplier } from "@/lib/types";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

type Draft = {
  name: string;
  sku: string;
  unit: string;
  purchasePrice: string;
  sellPrice: string;
  supplierId: string;
  description: string;
  active: boolean;
};

const EMPTY: Draft = {
  name: "",
  sku: "",
  unit: "sqm",
  purchasePrice: "0",
  sellPrice: "0",
  supplierId: "",
  description: "",
  active: true,
};

export default function ProductsPage() {
  const { items, error, setError, reload } =
    usePolledList<Product>("/products");
  const { items: suppliers } = usePolledList<Supplier>("/suppliers", 10000);
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  function startCreate() {
    setDraft(EMPTY);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(item: Product) {
    setDraft({
      name: item.name,
      sku: item.sku ?? "",
      unit: item.unit,
      purchasePrice: String(item.purchasePrice),
      sellPrice: String(item.sellPrice),
      supplierId: item.supplierId ?? "",
      description: item.description ?? "",
      active: item.active !== false,
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    const wasEditing = Boolean(editingId);
    try {
      const payload = {
        name: draft.name,
        sku: draft.sku || null,
        unit: draft.unit,
        purchasePrice: Number(draft.purchasePrice) || 0,
        sellPrice: Number(draft.sellPrice) || 0,
        supplierId: draft.supplierId || null,
        description: draft.description || null,
        active: draft.active,
      };
      if (editingId) {
        await apiPut(`/products/${editingId}`, payload);
      } else {
        await apiPost("/products", payload);
      }
      setShowForm(false);
      setEditingId(null);
      setDraft(EMPTY);
      await reload();
      notify(wasEditing ? "Product saved" : "Product added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(item: Product, active: boolean) {
    try {
      await apiPut(`/products/${item.id}`, {
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        purchasePrice: item.purchasePrice,
        sellPrice: item.sellPrice,
        supplierId: item.supplierId,
        description: item.description,
        active,
      });
      await reload();
      notify(active ? "Product activated" : "Product deactivated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onUpload(productId: string, file: File) {
    setUploadingFor(productId);
    try {
      const { url } = await apiUpload(file);
      await apiPost(`/products/${productId}/images`, { url });
      await reload();
      notify("Image uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFor(null);
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Products</h1>
      <p className={page.lede}>
        Catalog with default purchase and sell prices, optional supplier, and
        multiple images. The default image is used on PDFs.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {showForm ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>
            {editingId ? "Edit product" : "New product"}
          </p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Name *</label>
              <input
                className={styles.input}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>SKU</label>
              <input
                className={styles.input}
                value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Unit</label>
              <input
                className={styles.input}
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="sqm, piece, slab"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Supplier (optional)</label>
              <select
                className={styles.select}
                value={draft.supplierId}
                onChange={(e) =>
                  setDraft({ ...draft, supplierId: e.target.value })
                }
              >
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Purchase price (AED)</label>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                value={draft.purchasePrice}
                onChange={(e) =>
                  setDraft({ ...draft, purchasePrice: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Sell price (AED)</label>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                value={draft.sellPrice}
                onChange={(e) =>
                  setDraft({ ...draft, sellPrice: e.target.value })
                }
              />
            </div>
          </div>
          <div className={styles.field} style={{ marginTop: "0.9rem" }}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </div>
          <div className={styles.field} style={{ marginTop: "0.9rem" }}>
            <label className={styles.label} style={{ display: "flex", gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
              />
              Active
            </label>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create"}
            </button>
            <button
              className={styles.ghost}
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count}>{items.length} products</span>
            <button className={styles.button} onClick={startCreate}>
              New product
            </button>
          </div>

          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search products by name, SKU, supplier…"
          />

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {query
                ? "No products match your search."
                : "No products yet. Create a product, then upload photos."}
            </div>
          ) : (
            <ul className={styles.list}>
              {pager.paged.map((item) => (
                <li key={item.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <EditIconButton onClick={() => startEdit(item)} />
                    <div className={styles.cardContent}>
                      <h2 className={styles.cardTitle}>
                        {item.name}
                        {item.active === false ? " (inactive)" : ""}
                      </h2>
                      <p className={styles.cardMeta}>
                        {[item.sku, `per ${item.unit}`, item.supplier?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className={styles.price}>
                        <span className={styles.priceItem}>
                          Purchase{" "}
                          <span className={styles.priceValue}>
                            AED {item.purchasePrice.toFixed(2)}
                          </span>
                        </span>
                        <span className={styles.priceItem}>
                          Sell{" "}
                          <span className={styles.priceValue}>
                            AED {item.sellPrice.toFixed(2)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.ghost}
                        onClick={() => void setActive(item, !item.active)}
                      >
                        {item.active === false ? "Activate" : "Deactivate"}
                      </button>
                    </div>
                  </div>

                  {item.images.length > 0 ? (
                    <div className={styles.images}>
                      {item.images.map((img) => (
                        <div
                          key={img.id}
                          className={`${styles.thumb} ${
                            img.isDefault ? styles.thumbDefault : ""
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <PreviewableImage
                            className={styles.thumbImg}
                            src={assetUrl(img.url) ?? ""}
                            alt={item.name}
                          />
                          {img.isDefault ? (
                            <p className={styles.defaultLabel}>DEFAULT</p>
                          ) : null}
                          <div className={styles.thumbBar}>
                            {!img.isDefault ? (
                              <button
                                className={styles.thumbBtn}
                                onClick={async () => {
                                  await apiPut(
                                    `/products/${item.id}/images/${img.id}/default`,
                                  );
                                  await reload();
                                  notify("Default image updated");
                                }}
                              >
                                Default
                              </button>
                            ) : null}
                            <button
                              className={`${styles.thumbBtn} ${styles.thumbBtnDanger}`}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    "Delete this product image?",
                                  )
                                ) {
                                  return;
                                }
                                try {
                                  await apiDelete(
                                    `/products/${item.id}/images/${img.id}`,
                                  );
                                  await reload();
                                  notify("Image deleted");
                                } catch (e) {
                                  notify(
                                    e instanceof Error
                                      ? e.message
                                      : "Could not delete image",
                                  );
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.uploadRow}>
                    <FilePicker
                      variant="compact"
                      label={
                        uploadingFor === item.id ? "Uploading…" : "Add photo"
                      }
                      busy={uploadingFor === item.id}
                      onFile={(file) => void onUpload(item.id, file)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={pager.page}
            setPage={pager.setPage}
            pageSize={pager.pageSize}
            setPageSize={pager.setPageSize}
            pageCount={pager.pageCount}
            total={pager.total}
          />
        </>
      )}

      <Toast flash={flash} />
    </section>
  );
}
