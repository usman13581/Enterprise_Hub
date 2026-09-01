'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { usePolledList } from '@/lib/useCollection';
import type { Lpo, Product, Supplier } from '@marble/types';
import { SearchableSelect } from '@/components/SearchableSelect';
import styles from './crud.module.css';

export function PurchaseInvoiceForm({
  onSaved,
  onError,
  onCancel,
}: {
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: products } = usePolledList<Product>('/products');
  const [supplierId, setSupplierId] = useState('');
  const [lpoId, setLpoId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [saving, setSaving] = useState(false);
  const { items: lpos } = usePolledList<Lpo>(supplierId ? `/lpos?supplierId=${supplierId}&status=sent` : '/lpos?status=sent');
  const supplierProducts = products.filter((product) => product.supplierId === supplierId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const product = products.find((item) => item.id === productId);
    if (!supplierId || !product || Number(qty) <= 0 || Number(unitCost) < 0 || saving) return;
    setSaving(true);
    try {
      await apiPost('/purchase-invoices', { supplierId, lpoId: lpoId || null, supplierInvoiceNumber: supplierInvoiceNumber || null, issueDate, dueDate: dueDate || null, taxInclusive, lines: [{ productId, productName: product.name, unit: product.unit, qty: Number(qty), unitCost: Number(unitCost) }] });
      await onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not create purchase invoice');
    } finally {
      setSaving(false);
    }
  }

  return <form className={styles.form} onSubmit={submit}><p className={styles.formTitle}>New purchase invoice</p><div className={styles.grid}>
    <SearchableSelect label="Supplier *" value={supplierId} onChange={(value) => { setSupplierId(value); setProductId(''); setLpoId(''); }} required placeholder="Search suppliers…" options={suppliers.filter((item) => item.active).map((item) => ({ id: item.id, label: item.name }))} />
    <SearchableSelect label="LPO" value={lpoId} onChange={setLpoId} allowEmpty emptyLabel="No LPO" disabled={!supplierId} placeholder="Search LPOs…" options={lpos.map((item) => ({ id: item.id, label: item.number }))} />
    <SearchableSelect label="Product *" value={productId} onChange={(value) => { const product = products.find((item) => item.id === value); setProductId(value); setUnitCost(String(product?.purchasePrice ?? 0)); }} required disabled={!supplierId} placeholder="Search products…" options={supplierProducts.map((item) => ({ id: item.id, label: item.name }))} />
    <label className={styles.field}><span className={styles.label}>Supplier invoice no.</span><input className={styles.input} value={supplierInvoiceNumber} onChange={(event) => setSupplierInvoiceNumber(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.label}>Issue date *</span><input className={styles.input} type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.label}>Due date</span><input className={styles.input} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.label}>Quantity</span><input className={styles.input} type="number" min="0.01" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.label}>Unit cost</span><input className={styles.input} type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} /></label>
  </div><label className={styles.label}><input type="checkbox" checked={taxInclusive} onChange={(event) => setTaxInclusive(event.target.checked)} /> Prices include input VAT</label><div className={styles.actions}><button className={styles.button} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button><button className={styles.ghost} type="button" onClick={onCancel}>Cancel</button></div></form>;
}
