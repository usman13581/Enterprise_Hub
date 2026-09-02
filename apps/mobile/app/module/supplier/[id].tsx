import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '../../../lib/api';
import { amount, moneyHeader } from '../../../lib/format';
import { FilterChips, RecordRow, StatCard } from '../../../components/Finance';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { isoDate, todayIso } from '../../../lib/dates';
import { colors, ui } from '../../../lib/ui';

type Hub = {
  supplier: { name: string; email: string | null; phone: string | null };
  products: Array<{ id: string; name: string; sku: string | null; purchasePrice: number; sellPrice: number; active: boolean }>;
  quotationLines: Array<{ id: string; qty: number; purchasePrice: number; sellPrice: number; quotation: { number: string; customer: { name: string } }; product: { name: string } | null }>;
  lpos: Array<{ id: string; number: string; status: string; total: number }>;
  purchaseInvoices: Array<{ id: string; number: string; status: string; total: number; balance: number }>;
  payments: Array<{ id: string; number: string; paidAt: string; amount: number; method: string; reference: string | null; unappliedAmount: number }>;
  priceHistory: Array<{ id: string; productName: string; unitCost: number; currency: string; effectiveAt: string; sourceType: string }>;
  finance: { payable: number; overdue: number; advances: number; openLpos: number; pendingReceipts: number; postedPurchaseInvoices: number };
  summary: { productCount: number; activeProductCount: number; catalogPurchaseValue: number; catalogSellValue: number; quotedCost: number; quotedValue: number; estimatedQuotedMargin: number };
};

type Statement = {
  supplier: { name: string };
  closing: number;
  rows: Array<{
    id: string;
    occurredAt: string;
    description: string;
    direction: string;
    amount: number;
    balance: number;
  }>;
};

export default function SupplierHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hub, setHub] = useState<Hub | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'ledger'>('overview');
  const reportRange = useMemo(() => {
    const now = new Date();
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: todayIso(),
    };
  }, []);
  useEffect(() => {
    if (id) void apiFetch<Hub>(`/suppliers/${id}/hub`).then(setHub).catch((err) => setError(err instanceof Error ? err.message : 'Could not load supplier hub'));
  }, [id]);
  useEffect(() => {
    if (tab !== 'ledger' || !id) return;
    void apiFetch<Statement>(`/suppliers/${id}/statement`).then(setStatement).catch((err) => setError(err instanceof Error ? err.message : 'Could not load ledger'));
  }, [id, tab]);
  if (error) return <View style={ui.screen}><Text style={ui.error}>{error}</Text></View>;
  if (!hub) return <View style={[ui.screen, { justifyContent: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;
  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>{hub.supplier.name}</Text>
        <Text style={ui.lede}>{[hub.supplier.email, hub.supplier.phone].filter(Boolean).join(' · ') || 'No contact details'}</Text>
        <View style={styles.stats}>
          <StatCard title="Products" value={`${hub.summary.activeProductCount}/${hub.summary.productCount}`} />
          <StatCard title={moneyHeader('Catalog purchase')} value={amount(hub.summary.catalogPurchaseValue)} />
          <StatCard title={moneyHeader('Catalog sell')} value={amount(hub.summary.catalogSellValue)} />
          <StatCard title={moneyHeader('Quoted cost')} value={amount(hub.summary.quotedCost)} />
          <StatCard title={moneyHeader('Est. margin')} value={amount(hub.summary.estimatedQuotedMargin)} />
          <StatCard title={moneyHeader('Payable')} value={amount(hub.finance.payable)} />
          <StatCard title={moneyHeader('Overdue')} value={amount(hub.finance.overdue)} />
          <StatCard title={moneyHeader('Advances')} value={amount(hub.finance.advances)} />
          <StatCard title="Open LPOs" value={String(hub.finance.openLpos)} />
          <StatCard title="Pending receipts" value={String(hub.finance.pendingReceipts)} />
          <StatCard title="Posted PIs" value={String(hub.finance.postedPurchaseInvoices)} />
        </View>
        <View style={styles.actions}>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/purchase-invoices?supplierId=${id}` as never)}><Text style={ui.ghostText}>Purchase invoices</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/supplier-payments?supplierId=${id}` as never)}><Text style={ui.ghostText}>Record payment</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/reports?report=supplier-statement&supplierId=${id}&from=${reportRange.from}&to=${reportRange.to}` as never)}><Text style={ui.ghostText}>Supplier ledger report</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/reports?report=supplier-product-register&supplierId=${id}` as never)}><Text style={ui.ghostText}>Product report</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/reports?report=supplier-payment-register&supplierId=${id}` as never)}><Text style={ui.ghostText}>Payment report</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/reports?report=supplier-price-history&supplierId=${id}` as never)}><Text style={ui.ghostText}>Price report</Text></Pressable>
        </View>
        <FilterChips
          active={tab}
          onChange={setTab}
          options={[
            { key: 'overview', label: 'Overview' },
            { key: 'ledger', label: `Ledger (${statement?.rows.length ?? 0})` },
          ]}
        />
        {tab === 'ledger' ? (
          <>
            <Text style={styles.sectionTitle}>Supplier ledger</Text>
            {statement ? (
              <>
                <Text style={ui.lede}>{moneyHeader('Closing payable')} {amount(statement.closing)}</Text>
                {statement.rows.map((row) => (
                  <RecordRow
                    key={row.id}
                    title={row.description}
                    meta={`${new Date(row.occurredAt).toLocaleDateString()} · ${row.direction} ${amount(row.amount)} · Balance ${amount(row.balance)}`}
                  />
                ))}
                {statement.rows.length === 0 ? (
                  <View style={ui.empty}><Text style={ui.emptyText}>No payable activity recorded.</Text></View>
                ) : null}
              </>
            ) : (
              <ActivityIndicator color={colors.accent} />
            )}
          </>
        ) : (
          <>
        <Text style={styles.sectionTitle}>Products</Text>
        {hub.products.map((product) => <RecordRow key={product.id} title={product.name} meta={`${product.sku || 'No SKU'} · Purchase ${amount(product.purchasePrice)} · Sell ${amount(product.sellPrice)}`} />)}
        {hub.products.length === 0 ? <View style={ui.empty}><Text style={ui.emptyText}>No products assigned.</Text></View> : null}
        <Text style={styles.sectionTitle}>Quotation usage</Text>
        {hub.quotationLines.map((line) => <RecordRow key={line.id} title={line.product?.name || 'Product'} meta={`${line.quotation.number} · ${line.quotation.customer.name} · Qty ${line.qty} · Cost ${amount(line.purchasePrice * line.qty)}`} />)}
        {hub.quotationLines.length === 0 ? <View style={ui.empty}><Text style={ui.emptyText}>No quotation usage recorded.</Text></View> : null}
        <Text style={styles.sectionTitle}>Purchasing documents</Text>
        {hub.lpos.map((lpo) => <RecordRow key={lpo.id} title={lpo.number} meta={`LPO · ${lpo.status} · ${amount(lpo.total)}`} />)}
        {hub.purchaseInvoices.map((invoice) => <RecordRow key={invoice.id} title={invoice.number} meta={`Purchase invoice · ${invoice.status} · Balance ${amount(invoice.balance)}`} />)}
        {hub.payments.map((payment) => <RecordRow key={payment.id} title={payment.number} meta={`Payment · ${payment.method} · ${amount(payment.amount)} · Unapplied ${amount(payment.unappliedAmount)}`} />)}
        <Text style={styles.sectionTitle}>Purchase price history</Text>
        {hub.priceHistory.map((price) => <RecordRow key={price.id} title={price.productName} meta={`${amount(price.unitCost)} · ${new Date(price.effectiveAt).toLocaleDateString()} · ${price.sourceType}`} />)}
          </>
        )}
      </ScreenScroll>
    </View>
  );
}

const styles = {
  stats: { gap: 10, marginBottom: 12 },
  actions: { gap: 8, marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' as const, marginTop: 18, marginBottom: 8 },
};
