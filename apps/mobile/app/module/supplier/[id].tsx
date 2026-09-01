import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '../../../lib/api';
import { amount, moneyHeader } from '../../../lib/format';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { RecordRow, StatCard } from '../../../components/Finance';
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

export default function SupplierHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hub, setHub] = useState<Hub | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (id) void apiFetch<Hub>(`/suppliers/${id}/hub`).then(setHub).catch((err) => setError(err instanceof Error ? err.message : 'Could not load supplier hub'));
  }, [id]);
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
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/supplier-statement?supplierId=${id}` as never)}><Text style={ui.ghostText}>Supplier statement</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/reports?report=supplier-product-register&supplierId=${id}` as never)}><Text style={ui.ghostText}>Product report</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/reports?report=supplier-payment-register&supplierId=${id}` as never)}><Text style={ui.ghostText}>Payment report</Text></Pressable>
        <Pressable style={ui.ghost} onPress={() => router.push(`/module/reports?report=supplier-price-history&supplierId=${id}` as never)}><Text style={ui.ghostText}>Price report</Text></Pressable>
        </View>
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
      </ScreenScroll>
    </View>
  );
}

const styles = {
  stats: { gap: 10, marginBottom: 12 },
  actions: { gap: 8, marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' as const, marginTop: 18, marginBottom: 8 },
};
