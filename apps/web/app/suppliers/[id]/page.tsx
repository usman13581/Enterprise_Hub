'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { amount, moneyHeader } from '@/lib/format';
import { BackLink, EmptyState, Stat, TableScroll } from '@/components/Finance';
import page from '../../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Hub = {
  supplier: { id: string; name: string; email: string | null; phone: string | null; active: boolean };
  products: Array<{ id: string; name: string; sku: string | null; purchasePrice: number; sellPrice: number; active: boolean }>;
  quotationLines: Array<{ id: string; qty: number; purchasePrice: number; sellPrice: number; quotation: { number: string; status: string; customer: { name: string } }; product: { name: string } | null }>;
  lpos: Array<{ id: string; number: string; status: string; total: number }>;
  purchaseInvoices: Array<{ id: string; number: string; status: string; total: number; balance: number }>;
  payments: Array<{ id: string; number: string; paidAt: string; amount: number; method: string; reference: string | null; unappliedAmount: number }>;
  priceHistory: Array<{ id: string; productName: string; unitCost: number; currency: string; effectiveAt: string; sourceType: string }>;
  finance: { payable: number; overdue: number; advances: number; openLpos: number; pendingReceipts: number; postedPurchaseInvoices: number };
  summary: { productCount: number; activeProductCount: number; catalogPurchaseValue: number; catalogSellValue: number; quotedCost: number; quotedValue: number; estimatedQuotedMargin: number };
  note: string;
};

export default function SupplierHubPage() {
  const { id } = useParams<{ id: string }>();
  const [hub, setHub] = useState<Hub | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void apiFetch<Hub>(`/suppliers/${id}/hub`).then(setHub).catch((err) => setError(err instanceof Error ? err.message : 'Could not load supplier hub'));
  }, [id]);
  if (error) return <section className={page.page}><BackLink href="/suppliers">← Suppliers</BackLink><p className={styles.error}>{error}</p></section>;
  if (!hub) return <section className={page.page}><BackLink href="/suppliers">← Suppliers</BackLink><p>Loading supplier hub…</p></section>;
  return (
    <section className={page.page}>
      <BackLink href="/suppliers">← Suppliers</BackLink>
      <h1 className={page.title}>{hub.supplier.name}</h1>
      <p className={page.lede}>{[hub.supplier.email, hub.supplier.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
      <div className={styles.actions}>
        <Link className={styles.ghost} href={`/purchase-invoices?supplierId=${id}`}>View purchase invoices</Link>
        <Link className={styles.ghost} href={`/supplier-payments?supplierId=${id}`}>Record supplier payment</Link>
      </div>
      <div className={finance.statGrid}>
        <Stat title="Products" value={`${hub.summary.activeProductCount}/${hub.summary.productCount}`} />
        <Stat title={moneyHeader('Catalog purchase')} value={amount(hub.summary.catalogPurchaseValue)} />
        <Stat title={moneyHeader('Quoted cost')} value={amount(hub.summary.quotedCost)} />
        <Stat title={moneyHeader('Estimated quoted margin')} value={amount(hub.summary.estimatedQuotedMargin)} />
        <Stat title={moneyHeader('Payable')} value={amount(hub.finance.payable)} />
        <Stat title={moneyHeader('Overdue')} value={amount(hub.finance.overdue)} />
        <Stat title={moneyHeader('Supplier advances')} value={amount(hub.finance.advances)} />
        <Stat title="Open LPOs" value={`${hub.finance.openLpos}`} />
      </div>
      <div className={styles.toolbar}><strong>Supplier products</strong><Link className={styles.ghost} href={`/reports/supplier-product-register?supplierId=${id}`}>Open reports</Link></div>
      {hub.products.length ? <TableScroll><table className={finance.table}><thead><tr><th>Product</th><th>SKU</th><th className={finance.numeric}>{moneyHeader('Purchase')}</th><th className={finance.numeric}>{moneyHeader('Sell')}</th><th>Status</th></tr></thead><tbody>{hub.products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.sku || '—'}</td><td className={finance.numeric}>{amount(product.purchasePrice)}</td><td className={finance.numeric}>{amount(product.sellPrice)}</td><td>{product.active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No products are assigned to this supplier.</EmptyState>}
      <div className={styles.toolbar}><strong>Quotation usage</strong><span className={styles.count}>{hub.quotationLines.length} lines</span></div>
      {hub.quotationLines.length ? <TableScroll><table className={finance.table}><thead><tr><th>Quotation</th><th>Customer</th><th>Product</th><th className={finance.numeric}>Qty</th><th className={finance.numeric}>{moneyHeader('Cost')}</th><th className={finance.numeric}>{moneyHeader('Margin')}</th></tr></thead><tbody>{hub.quotationLines.map((line) => <tr key={line.id}><td>{line.quotation.number}</td><td>{line.quotation.customer.name}</td><td>{line.product?.name || '—'}</td><td className={finance.numeric}>{line.qty}</td><td className={finance.numeric}>{amount(line.purchasePrice * line.qty)}</td><td className={finance.numeric}>{amount((line.sellPrice - line.purchasePrice) * line.qty)}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No quotation usage recorded.</EmptyState>}
      <div className={styles.toolbar}><strong>Purchasing documents</strong><span><Link className={styles.ghost} href={`/purchase-invoices?supplierId=${id}`}>View purchase invoices</Link><Link className={styles.ghost} href={`/suppliers/${id}/statement`}>Supplier statement</Link></span></div>
      {hub.lpos.length || hub.purchaseInvoices.length ? <TableScroll><table className={finance.table}><thead><tr><th>Document</th><th>Type</th><th>Status</th><th className={finance.numeric}>{moneyHeader('Total')}</th><th className={finance.numeric}>{moneyHeader('Balance')}</th></tr></thead><tbody>{hub.lpos.map((item) => <tr key={item.id}><td>{item.number}</td><td>LPO</td><td>{item.status}</td><td className={finance.numeric}>{amount(item.total)}</td><td className={finance.numeric}>—</td></tr>)}{hub.purchaseInvoices.map((item) => <tr key={item.id}><td>{item.number}</td><td>Purchase invoice</td><td>{item.status}</td><td className={finance.numeric}>{amount(item.total)}</td><td className={finance.numeric}>{amount(item.balance)}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No purchasing documents recorded.</EmptyState>}
      <div className={styles.toolbar}><strong>Supplier payments</strong><span><Link className={styles.ghost} href={`/supplier-payments?supplierId=${id}`}>Record payment</Link> <Link className={styles.ghost} href={`/reports/supplier-payment-register?supplierId=${id}`}>Payment report</Link></span></div>
      {hub.payments.length ? <TableScroll><table className={finance.table}><thead><tr><th>Payment</th><th>Date</th><th>Method</th><th>Reference</th><th className={finance.numeric}>{moneyHeader('Amount')}</th><th className={finance.numeric}>{moneyHeader('Unapplied')}</th></tr></thead><tbody>{hub.payments.map((payment) => <tr key={payment.id}><td>{payment.number}</td><td>{new Date(payment.paidAt).toLocaleDateString()}</td><td>{payment.method}</td><td>{payment.reference || '—'}</td><td className={finance.numeric}>{amount(payment.amount)}</td><td className={finance.numeric}>{amount(payment.unappliedAmount)}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No supplier payments recorded.</EmptyState>}
      <div className={styles.toolbar}><strong>Purchase price history</strong><Link className={styles.ghost} href={`/reports/supplier-price-history?supplierId=${id}`}>Price report</Link></div>
      {hub.priceHistory.length ? <TableScroll><table className={finance.table}><thead><tr><th>Date</th><th>Product</th><th className={finance.numeric}>{moneyHeader('Unit cost')}</th><th>Source</th></tr></thead><tbody>{hub.priceHistory.map((price) => <tr key={price.id}><td>{new Date(price.effectiveAt).toLocaleDateString()}</td><td>{price.productName}</td><td className={finance.numeric}>{amount(price.unitCost)}</td><td>{price.sourceType}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No posted purchase prices recorded.</EmptyState>}
      <p className={styles.count}>{hub.note}</p>
    </section>
  );
}
