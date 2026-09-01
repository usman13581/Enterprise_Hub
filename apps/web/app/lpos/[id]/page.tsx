'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, apiPost } from '@/lib/api';
import { BackLink, EmptyState, TableScroll } from '@/components/Finance';
import type { Lpo } from '@marble/types';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Detail = Lpo & { supplier: { name: string }; receipts: Array<{ id: string; number: string; receiptDate: string }> };

export default function LpoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lpo, setLpo] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Record<string, string>>({});
  async function reload() { try { setLpo(await apiFetch<Detail>(`/lpos/${id}`)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not load LPO'); } }
  useEffect(() => { void reload(); }, [id]);
  async function action(name: 'approve' | 'send' | 'cancel') { try { await apiPost(`/lpos/${id}/${name}`, {}); await reload(); } catch (err) { setError(err instanceof Error ? err.message : `Could not ${name} LPO`); } }
  async function receive() {
    const lines = Object.entries(receipt).filter(([, value]) => Number(value) > 0).map(([lpoLineId, value]) => ({ lpoLineId, receivedQty: Number(value) }));
    if (!lines.length) return;
    try { await apiPost(`/lpos/${id}/receipts`, { receiptDate: new Date().toISOString(), lines }); setReceipt({}); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not record receipt'); }
  }
  if (error) return <section className={page.page}><BackLink href="/purchase-orders">← Purchase Orders</BackLink><p className={styles.error}>{error}</p></section>;
  if (!lpo) return <section className={page.page}><BackLink href="/purchase-orders">← Purchase Orders</BackLink><p>Loading…</p></section>;
  return <section className={page.page}><BackLink href="/purchase-orders">← Purchase Orders</BackLink><h1 className={page.title}>{lpo.number}</h1><p className={page.lede}>{lpo.supplier.name} · {lpo.status}</p><div className={styles.actions}>{lpo.status === 'draft' ? <button className={styles.button} onClick={() => void action('approve')}>Approve</button> : null}{lpo.status === 'approved' ? <button className={styles.button} onClick={() => void action('send')}>Send</button> : null}{['draft', 'approved', 'sent'].includes(lpo.status) ? <button className={styles.ghost} onClick={() => void action('cancel')}>Cancel</button> : null}</div>{lpo.lines.length ? <TableScroll><table className={finance.table}><thead><tr><th>Product</th><th>Unit</th><th className={finance.numeric}>Ordered</th><th className={finance.numeric}>Received</th><th className={finance.numeric}>Invoiced</th><th className={finance.numeric}>Receive now</th><th className={finance.numeric}>Cost</th></tr></thead><tbody>{lpo.lines.map((line) => <tr key={line.id}><td>{line.productName}</td><td>{line.unit}</td><td className={finance.numeric}>{line.orderedQty}</td><td className={finance.numeric}>{line.receivedQty}</td><td className={finance.numeric}>{line.invoicedQty}</td><td className={finance.numeric}>{['sent', 'partially_received'].includes(lpo.status) ? <input className={styles.input} style={{ width: '6rem' }} type="number" min="0" max={line.orderedQty - line.receivedQty} value={receipt[line.id] ?? ''} onChange={(event) => setReceipt({ ...receipt, [line.id]: event.target.value })} /> : '—'}</td><td className={finance.numeric}>{line.unitCost.toFixed(2)}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No lines.</EmptyState>}{['sent', 'partially_received'].includes(lpo.status) ? <div className={styles.actions}><button className={styles.button} onClick={() => void receive()}>Record receipt</button></div> : null}<h2 className={styles.formTitle}>Receipts</h2>{lpo.receipts.length ? lpo.receipts.map((receipt) => <p key={receipt.id} className={styles.count}>{receipt.number} · {new Date(receipt.receiptDate).toLocaleDateString()}</p>) : <p className={styles.count}>No receipts recorded.</p>}</section>;
}
