'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, apiPost } from '@/lib/api';
import { BackLink, EmptyState, PdfButton, TableScroll } from '@/components/Finance';
import type { PurchaseInvoice } from '@marble/types';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Detail = PurchaseInvoice & { lines: Array<{ id: string; productName: string; qty: number; unitCost: number; lineTotal: number }>; supplier: { name: string }; };

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiFetch<Detail>(`/purchase-invoices/${id}`).then(setInvoice).catch((err) => setError(err instanceof Error ? err.message : 'Could not load purchase invoice')); }, [id]);
  async function post() { try { await apiPost(`/purchase-invoices/${id}/post`, {}); setInvoice(await apiFetch<Detail>(`/purchase-invoices/${id}`)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not post invoice'); } }
  if (error) return <section className={page.page}><BackLink href="/purchase-invoices">← Purchase invoices</BackLink><p className={styles.error}>{error}</p></section>;
  if (!invoice) return <section className={page.page}><BackLink href="/purchase-invoices">← Purchase invoices</BackLink><p>Loading…</p></section>;
  return <section className={page.page}><BackLink href="/purchase-invoices">← Purchase invoices</BackLink><h1 className={page.title}>{invoice.number}</h1><p className={page.lede}>{invoice.supplier.name} · {invoice.status}</p>{invoice.lines.length ? <TableScroll><table className={finance.table}><thead><tr><th>Product</th><th className={finance.numeric}>Qty</th><th className={finance.numeric}>Unit cost</th><th className={finance.numeric}>Line total</th></tr></thead><tbody>{invoice.lines.map((line) => <tr key={line.id}><td>{line.productName}</td><td className={finance.numeric}>{line.qty}</td><td className={finance.numeric}>{line.unitCost.toFixed(2)}</td><td className={finance.numeric}>{line.lineTotal.toFixed(2)}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No lines.</EmptyState>}<div className={styles.toolbar}><strong>Total {invoice.currency} {invoice.total.toFixed(2)}</strong>{invoice.status === 'draft' ? <button className={styles.button} onClick={() => void post()}>Post invoice</button> : null}</div></section>;
}
