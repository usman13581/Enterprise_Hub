'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { computePurchasingTotals } from '@marble/domain';
import { apiDelete, apiFetch, apiPost, apiPut } from '@/lib/api';
import { useCompanyAdmin } from '@/lib/useCompanyAdmin';
import {
  BackLink,
  EmptyState,
  TableScroll,
  TotalsBlock,
} from '@/components/Finance';
import { discountTotalsRows } from '@/components/DiscountFields';
import {
  PurchaseInvoiceForm,
  type PurchaseInvoiceDetail,
  type PurchaseInvoiceSavePayload,
} from '@/components/PurchasingForms';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';
import { amount, moneyHeader } from '@/lib/format';
import finance from '@/components/finance.module.css';

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<PurchaseInvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [saving, setSaving] = useState(false);
  const isAdmin = useCompanyAdmin();

  async function reload() {
    try {
      setInvoice(await apiFetch<PurchaseInvoiceDetail>(`/purchase-invoices/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load purchase invoice');
    }
  }

  useEffect(() => {
    void reload();
  }, [id]);

  async function saveDraft(payload: PurchaseInvoiceSavePayload) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPut(`/purchase-invoices/${id}`, payload);
      setEditing(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save purchase invoice');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!window.confirm('Delete this draft permanently? This cannot be undone.')) {
      return;
    }
    try {
      await apiDelete(`/purchase-invoices/${id}`);
      router.push('/purchase-invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete invoice');
    }
  }

  async function post() {
    try {
      await apiPost(`/purchase-invoices/${id}/post`, {});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post invoice');
    }
  }

  if (error && !invoice) {
    return (
      <section className={page.page}>
        <BackLink href="/purchase-invoices">← Purchase invoices</BackLink>
        <p className={styles.error}>{error}</p>
      </section>
    );
  }

  if (!invoice) {
    return (
      <section className={page.page}>
        <BackLink href="/purchase-invoices">← Purchase invoices</BackLink>
        <p>Loading…</p>
      </section>
    );
  }

  if (editing && invoice.status === 'draft') {
    return (
      <section className={page.page}>
        <BackLink href="/purchase-invoices">← Purchase invoices</BackLink>
        {error ? <p className={styles.error}>{error}</p> : null}
        <PurchaseInvoiceForm
          invoice={invoice}
          saving={saving}
          onSave={saveDraft}
          onCancel={() => setEditing(false)}
        />
      </section>
    );
  }

  const totals = computePurchasingTotals(
    invoice.lines.map((line) => ({
      qty: line.qty,
      unitCost: line.unitCost,
      discountMode: line.discountMode,
      discountValue: line.discountValue,
    })),
    {
      discountMode: invoice.discountMode,
      discountValue: invoice.discountValue,
    },
    { taxInclusive: invoice.taxInclusive },
  );

  return (
    <section className={page.page}>
      <BackLink href="/purchase-invoices">← Purchase invoices</BackLink>
      <h1 className={page.title}>{invoice.number}</h1>
      <p className={page.lede}>
        {invoice.supplier.name} · {invoice.status}
        {invoice.lpo ? (
          <>
            {' · '}
            <Link className={finance.link} href={`/lpos/${invoice.lpo.id}`}>
              LPO {invoice.lpo.number}
            </Link>
          </>
        ) : null}
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {invoice.status === 'draft' ? (
        <div className={styles.actions}>
          <button className={styles.ghost} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className={styles.button} onClick={() => void post()}>
            Post invoice
          </button>
          {isAdmin ? (
            <button
              className={`${styles.ghost} ${styles.danger}`}
              onClick={() => void deleteDraft()}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
      {invoice.lines.length ? (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th className={finance.numeric}>Qty</th>
                <th className={finance.numeric}>{moneyHeader('Unit cost')}</th>
                <th className={finance.numeric}>{moneyHeader('Line total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.productName}</td>
                  <td className={finance.numeric}>{line.qty}</td>
                  <td className={finance.numeric}>{amount(line.unitCost)}</td>
                  <td className={finance.numeric}>{amount(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : (
        <EmptyState>No lines.</EmptyState>
      )}
      <TotalsBlock
        rows={discountTotalsRows({
          ...totals,
          vatAmount: totals.inputVat,
        })}
        grand={['Total', totals.total]}
        currency={invoice.currency}
      />
    </section>
  );
}
