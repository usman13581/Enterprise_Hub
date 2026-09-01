'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, apiPost, apiPut } from '@/lib/api';
import { usePolledList } from '@/lib/useCollection';
import { BackLink, EmptyState, TableScroll, TotalsBlock } from '@/components/Finance';
import {
  discountTotalsRows,
} from '@/components/DiscountFields';
import { LpoForm, type LpoSavePayload } from '@/components/PurchasingForms';
import type { Lpo, Product, Supplier } from '@marble/types';
import { computePurchasingTotals } from '@marble/domain';
import { todayIso } from '@/lib/dates';
import { amount, day, moneyHeader } from '@/lib/format';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Detail = Lpo & {
  supplier: { name: string };
  receipts: Array<{ id: string; number: string; receiptDate: string }>;
};

export default function LpoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: products } = usePolledList<Product>('/products');
  const [lpo, setLpo] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [saving, setSaving] = useState(false);

  async function reload() {
    try {
      setLpo(await apiFetch<Detail>(`/lpos/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load LPO');
    }
  }

  useEffect(() => {
    void reload();
  }, [id]);

  async function action(name: 'approve' | 'send' | 'cancel') {
    try {
      await apiPost(`/lpos/${id}/${name}`, {});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${name} LPO`);
    }
  }

  async function saveDraft(payload: LpoSavePayload) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPut(`/lpos/${id}`, payload);
      setEditing(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save LPO');
    } finally {
      setSaving(false);
    }
  }

  async function receive() {
    const lines = Object.entries(receipt)
      .filter(([, value]) => Number(value) > 0)
      .map(([lpoLineId, value]) => ({
        lpoLineId,
        receivedQty: Number(value),
      }));
    if (!lines.length) return;
    try {
      await apiPost(`/lpos/${id}/receipts`, {
        receiptDate: todayIso(),
        lines,
      });
      setReceipt({});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record receipt');
    }
  }

  if (error && !lpo) {
    return (
      <section className={page.page}>
        <BackLink href="/purchase-orders">← Purchase Orders</BackLink>
        <p className={styles.error}>{error}</p>
      </section>
    );
  }

  if (!lpo) {
    return (
      <section className={page.page}>
        <BackLink href="/purchase-orders">← Purchase Orders</BackLink>
        <p>Loading…</p>
      </section>
    );
  }

  const totals = computePurchasingTotals(
    lpo.lines.map((line) => ({
      qty: line.orderedQty,
      unitCost: line.unitCost,
      vatRate: line.vatRate,
      discountMode: line.discountMode,
      discountValue: line.discountValue,
    })),
    {
      discountMode: lpo.discountMode,
      discountValue: lpo.discountValue,
    },
  );

  if (editing && lpo.status === 'draft') {
    return (
      <section className={page.page}>
        <BackLink href="/purchase-orders">← Purchase Orders</BackLink>
        {error ? <p className={styles.error}>{error}</p> : null}
        <LpoForm
          suppliers={suppliers}
          products={products}
          lpo={lpo}
          saving={saving}
          onSave={saveDraft}
          onCancel={() => setEditing(false)}
        />
      </section>
    );
  }

  return (
    <section className={page.page}>
      <BackLink href="/purchase-orders">← Purchase Orders</BackLink>
      <h1 className={page.title}>{lpo.number}</h1>
      <p className={page.lede}>
        {lpo.supplier.name} · {lpo.status}
        {lpo.requestedDeliveryDate
          ? ` · Requested delivery ${day(lpo.requestedDeliveryDate)}`
          : ''}
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.actions}>
        {lpo.status === 'draft' ? (
          <>
            <button className={styles.ghost} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className={styles.button} onClick={() => void action('approve')}>
              Approve
            </button>
          </>
        ) : null}
        {lpo.status === 'approved' ? (
          <button className={styles.button} onClick={() => void action('send')}>
            Send
          </button>
        ) : null}
        {['draft', 'approved', 'sent'].includes(lpo.status) ? (
          <button className={styles.ghost} onClick={() => void action('cancel')}>
            Cancel
          </button>
        ) : null}
      </div>

      {lpo.lines.length ? (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th className={finance.numeric}>Ordered</th>
                <th className={finance.numeric}>Received</th>
                <th className={finance.numeric}>Invoiced</th>
                <th className={finance.numeric}>Receive now</th>
                <th className={finance.numeric}>{moneyHeader('Cost')}</th>
                <th className={finance.numeric}>{moneyHeader('Total')}</th>
              </tr>
            </thead>
            <tbody>
              {lpo.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.productName}</td>
                  <td>{line.unit}</td>
                  <td className={finance.numeric}>{line.orderedQty}</td>
                  <td className={finance.numeric}>{line.receivedQty}</td>
                  <td className={finance.numeric}>{line.invoicedQty}</td>
                  <td className={finance.numeric}>
                    {['sent', 'partially_received'].includes(lpo.status) ? (
                      <input
                        className={styles.input}
                        style={{ width: '6rem' }}
                        type="number"
                        min="0"
                        max={line.orderedQty - line.receivedQty}
                        value={receipt[line.id] ?? ''}
                        onChange={(event) =>
                          setReceipt({ ...receipt, [line.id]: event.target.value })
                        }
                      />
                    ) : (
                      '—'
                    )}
                  </td>
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
        currency={lpo.currency}
      />

      {['sent', 'partially_received'].includes(lpo.status) ? (
        <div className={styles.actions}>
          <button className={styles.button} onClick={() => void receive()}>
            Record receipt
          </button>
        </div>
      ) : null}

      <h2 className={styles.formTitle}>Receipts</h2>
      {lpo.receipts.length ? (
        lpo.receipts.map((item) => (
          <p key={item.id} className={styles.count}>
            {item.number} · {new Date(item.receiptDate).toLocaleDateString()}
          </p>
        ))
      ) : (
        <p className={styles.count}>No receipts recorded.</p>
      )}
    </section>
  );
}
