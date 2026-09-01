'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { usePolledList } from '@/lib/useCollection';
import { EmptyState, TableScroll } from '@/components/Finance';
import { Toast } from '@/components/ListControls';
import { useFlash } from '@/lib/useCollection';
import type { PurchaseInvoice } from '@marble/types';
import { PurchaseInvoiceForm } from '@/components/PurchasingForms';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

export default function PurchaseInvoicesPage() {
  const searchParams = useSearchParams();
  const supplierId = searchParams.get('supplierId');
  const { items, error, setError, reload } = usePolledList<PurchaseInvoice>(supplierId ? `/purchase-invoices?supplierId=${supplierId}` : '/purchase-invoices');
  const { flash, notify } = useFlash();
  const [showForm, setShowForm] = useState(false);
  async function post(id: string) {
    try { await apiPost(`/purchase-invoices/${id}/post`, {}); await reload(); notify('Purchase invoice posted'); } catch (err) { setError(err instanceof Error ? err.message : 'Could not post invoice'); }
  }
  return <section className={page.page}><h1 className={page.title}>Purchase invoices</h1><p className={page.lede}>Supplier bills, input VAT, and accounts payable. Job invoices remain in the main invoice workflow.</p>{error ? <p className={styles.error}>{error}</p> : null}{showForm ? <PurchaseInvoiceForm onSaved={async () => { setShowForm(false); await reload(); notify('Purchase invoice saved'); }} onError={setError} onCancel={() => setShowForm(false)} /> : <div className={styles.toolbar}><span className={styles.count}>{items.length} purchase invoices</span><button className={styles.button} onClick={() => setShowForm(true)}>New purchase invoice</button></div>}{items.length ? <TableScroll><table className={finance.table}><thead><tr><th>Invoice</th><th>Supplier</th><th>Supplier ref</th><th>Issue date</th><th>Status</th><th className={finance.numeric}>Balance</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><Link className={finance.link} href={`/purchase-invoices/${item.id}`}>{item.number}</Link></td><td>{item.supplier?.name || item.supplierId}</td><td>{item.supplierInvoiceNumber || '—'}</td><td>{new Date(item.issueDate).toLocaleDateString()}</td><td>{item.status}</td><td className={finance.numeric}>{item.currency} {item.balance.toFixed(2)}</td><td>{item.status === 'draft' ? <button className={styles.ghost} onClick={() => void post(item.id)}>Post</button> : null}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No purchase invoices recorded.</EmptyState>}<Toast flash={flash} /></section>;
}
