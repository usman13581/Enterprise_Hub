'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { apiPost } from '@/lib/api';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import { EmptyState, TableScroll } from '@/components/Finance';
import { SearchableSelect } from '@/components/SearchableSelect';
import { searchItems, useFlash, usePagination, usePolledList } from '@/lib/useCollection';
import type { Lpo, Product, Supplier } from '@marble/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

export default function LposPage() {
  const searchParams = useSearchParams();
  const { items, error, setError, reload } = usePolledList<Lpo>('/lpos');
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: products } = usePolledList<Product>('/products');
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState(searchParams.get('supplierId') ?? '');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => searchItems(items, query), [items, query]);
  const pager = usePagination(filtered, query);
  const supplierProducts = products.filter((product) => product.supplierId === supplierId);

  async function create() {
    const product = products.find((item) => item.id === productId);
    if (!supplierId || !productId || !product || Number(qty) <= 0 || Number(unitCost) < 0 || saving) return;
    setSaving(true);
    try {
      await apiPost('/lpos', { supplierId, lines: [{ productId, productName: product.name, unit: product.unit, orderedQty: Number(qty), unitCost: Number(unitCost) }] });
      setShowForm(false);
      setSupplierId('');
      setProductId('');
      await reload();
      notify('LPO created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create LPO');
    } finally {
      setSaving(false);
    }
  }

  async function transition(id: string, action: 'approve' | 'send' | 'cancel') {
    try {
      await apiPost(`/lpos/${id}/${action}`, {});
      await reload();
      notify(`LPO ${action}d`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action} LPO`);
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Purchase Orders</h1>
      <p className={page.lede}>Create supplier commitments, approve them, and track receipt before posting supplier bills.</p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {showForm ? <div className={styles.form}><h2 className={styles.formTitle}>New LPO</h2><div className={styles.grid}>
        <SearchableSelect label="Supplier" value={supplierId} onChange={(value) => { setSupplierId(value); setProductId(''); }} placeholder="Search suppliers…" options={suppliers.filter((item) => item.active).map((item) => ({ id: item.id, label: item.name }))} />
        <SearchableSelect label="Product" value={productId} onChange={(value) => { const product = products.find((item) => item.id === value); setProductId(value); setUnitCost(String(product?.purchasePrice ?? 0)); }} disabled={!supplierId} placeholder="Search products…" options={supplierProducts.map((item) => ({ id: item.id, label: item.name }))} />
        <label className={styles.field}><span className={styles.label}>Quantity</span><input className={styles.input} type="number" min="0.01" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
        <label className={styles.field}><span className={styles.label}>Unit cost</span><input className={styles.input} type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} /></label>
      </div><div className={styles.actions}><button className={styles.button} onClick={() => void create()} disabled={saving}>{saving ? 'Saving…' : 'Create LPO'}</button><button className={styles.ghost} onClick={() => setShowForm(false)}>Cancel</button></div></div> : null}
      {!showForm ? <><div className={styles.toolbar}><span className={styles.count}>{items.length} LPOs</span><button className={styles.button} onClick={() => setShowForm(true)}>Create new LPO</button></div><SearchBox value={query} onChange={setQuery} placeholder="Search LPOs or suppliers…" /></> : null}
      {filtered.length ? <TableScroll><table className={finance.table}><thead><tr><th>LPO</th><th>Supplier</th><th>Status</th><th className={finance.numeric}>Total</th><th /></tr></thead><tbody>{pager.paged.map((item) => <tr key={item.id}><td><Link className={finance.link} href={`/purchase-orders/${item.id}`}>{item.number}</Link></td><td>{item.supplier?.name || item.supplierId}</td><td>{item.status}</td><td className={finance.numeric}>{item.currency} {item.total.toFixed(2)}</td><td>{item.status === 'draft' ? <button className={styles.ghost} onClick={() => void transition(item.id, 'approve')}>Approve</button> : item.status === 'approved' ? <button className={styles.ghost} onClick={() => void transition(item.id, 'send')}>Send</button> : item.status === 'sent' ? <button className={styles.ghost} onClick={() => void transition(item.id, 'cancel')}>Cancel</button> : null}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No LPOs match your search.</EmptyState>}
      <Pagination page={pager.page} setPage={pager.setPage} pageSize={pager.pageSize} setPageSize={pager.setPageSize} pageCount={pager.pageCount} total={pager.total} />
      <Toast flash={flash} />
    </section>
  );
}
