import { MODULE_NAV } from "@marble/types";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

const DESCRIPTIONS: Record<string, string> = {
  home: "Overview and bootstrap company session.",
  customers:
    "Customer hub with receivables, advances, quotations, jobs, invoices, and ledger.",
  suppliers: "Supplier directory. Products can optionally tag a supplier.",
  products:
    "Catalog with purchase/sell defaults, multi-image upload, and default PDF image.",
  quotations:
    "Quotations with adjustable line purchase/sell. Approve creates a job.",
  jobs: "Jobs from approved quotations. Progress, advances, invoices, P&L.",
  invoices: "Progressive, custom, and final UAE tax invoices.",
  accounts: "Company AR, advances, and P&L summaries.",
  reports: "Finance and invoice reports with Print PDF.",
  profile: "Logo, name, signature, TRN, and document prefixes.",
  audit: "History of creates, updates, and status changes.",
};

export default function ModuleScreen() {
  const { key, label } = useLocalSearchParams<{
    key: string;
    label?: string;
  }>();
  const item = MODULE_NAV.find((m) => m.key === key);
  const title = label || item?.label || "Module";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.lede}>
        {DESCRIPTIONS[key ?? ""] ??
          "Coming in later phases. Navigation shell is ready."}
      </Text>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Coming in later phases</Text>
        <Text style={styles.panelBody}>
          Feature CRUD lands in Phases 1–3. This screen matches the web module
          dashboard.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 10,
    backgroundColor: "#f4f6f8",
  },
  title: {
    color: "#14202b",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  lede: {
    color: "#5d6b78",
    lineHeight: 22,
    fontSize: 15,
  },
  panel: {
    marginTop: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(20,32,43,0.08)",
  },
  panelTitle: {
    color: "#1a6b7a",
    fontWeight: "600",
    marginBottom: 6,
    fontSize: 13,
  },
  panelBody: {
    color: "#5d6b78",
    lineHeight: 21,
    fontSize: 15,
  },
});
