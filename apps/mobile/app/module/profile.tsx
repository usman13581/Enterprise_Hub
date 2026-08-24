import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch, apiPut, apiUploadImage, assetUrl } from "../../lib/api";
import { useFlash } from "../../lib/useCollection";
import { Toast } from "../../components/ListControls";
import { ScreenScroll } from "../../components/ScreenScroll";
import type { Company } from "../../lib/types";
import { colors, ui } from "../../lib/ui";
import { UploadChip } from "../../components/Finance";

type Draft = {
  legalName: string;
  tradeName: string;
  address: string;
  phone: string;
  email: string;
  trn: string;
  bankDetails: string;
  quotationPrefix: string;
  invoicePrefix: string;
  currency: string;
  logoUrl: string;
  signatureUrl: string;
};

const EMPTY: Draft = {
  legalName: "",
  tradeName: "",
  address: "",
  phone: "",
  email: "",
  trn: "",
  bankDetails: "",
  quotationPrefix: "QT",
  invoicePrefix: "INV",
  currency: "AED",
  logoUrl: "",
  signatureUrl: "",
};

export default function ProfileScreen() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { flash, notify } = useFlash();

  const load = useCallback(async () => {
    try {
      const company = await apiFetch<Company>("/company/me");
      const p = company.profile;
      if (p) {
        setDraft({
          legalName: p.legalName,
          tradeName: p.tradeName ?? "",
          address: p.address ?? "",
          phone: p.phone ?? "",
          email: p.email ?? "",
          trn: p.trn ?? "",
          bankDetails: p.bankDetails ?? "",
          quotationPrefix: p.quotationPrefix,
          invoicePrefix: p.invoicePrefix,
          currency: p.currency,
          logoUrl: p.logoUrl ?? "",
          signatureUrl: p.signatureUrl ?? "",
        });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pick(field: "logoUrl" | "signatureUrl") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo permission is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const purpose = field === 'logoUrl' ? 'logo' : 'signature';
      const { url } = await apiUploadImage(result.assets[0].uri, { purpose });
      setDraft((d) => ({ ...d, [field]: url }));
      notify(
        field === 'logoUrl'
          ? 'Logo uploaded — save to apply'
          : 'Signature uploaded — save to apply',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPut('/company/profile', draft);
      await load();
      notify('Company profile saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>Company profile</Text>
        <Text style={ui.lede}>
          Branding and legal details printed on quotations and tax invoices.
        </Text>

        {error ? <Text style={ui.error}>{error}</Text> : null}

        <View style={ui.card}>
          <Text style={ui.label}>Legal name *</Text>
          <TextInput
            style={ui.input}
            value={draft.legalName}
            onChangeText={(v) => setDraft({ ...draft, legalName: v })}
          />
          <Text style={ui.label}>Trade name</Text>
          <TextInput
            style={ui.input}
            value={draft.tradeName}
            onChangeText={(v) => setDraft({ ...draft, tradeName: v })}
          />
          <Text style={ui.label}>TRN</Text>
          <TextInput
            style={ui.input}
            value={draft.trn}
            onChangeText={(v) => setDraft({ ...draft, trn: v })}
          />
          <Text style={ui.label}>Phone</Text>
          <TextInput
            style={ui.input}
            value={draft.phone}
            keyboardType="phone-pad"
            onChangeText={(v) => setDraft({ ...draft, phone: v })}
          />
          <Text style={ui.label}>Email</Text>
          <TextInput
            style={ui.input}
            value={draft.email}
            autoCapitalize="none"
            onChangeText={(v) => setDraft({ ...draft, email: v })}
          />
          <Text style={ui.label}>Address</Text>
          <TextInput
            style={[ui.input, { height: 70 }]}
            value={draft.address}
            multiline
            onChangeText={(v) => setDraft({ ...draft, address: v })}
          />
          <Text style={ui.label}>Bank details</Text>
          <TextInput
            style={[ui.input, { height: 70 }]}
            value={draft.bankDetails}
            multiline
            onChangeText={(v) => setDraft({ ...draft, bankDetails: v })}
          />
          <Text style={ui.label}>Quotation prefix</Text>
          <TextInput
            style={ui.input}
            value={draft.quotationPrefix}
            onChangeText={(v) => setDraft({ ...draft, quotationPrefix: v })}
          />
          <Text style={ui.label}>Invoice prefix</Text>
          <TextInput
            style={ui.input}
            value={draft.invoicePrefix}
            onChangeText={(v) => setDraft({ ...draft, invoicePrefix: v })}
          />
          <Text style={ui.label}>Currency</Text>
          <TextInput
            style={ui.input}
            value={draft.currency}
            onChangeText={(v) => setDraft({ ...draft, currency: v })}
          />

          <Text style={ui.label}>Logo</Text>
          <View style={styles.assetRow}>
            {draft.logoUrl ? (
              <Image
                source={{ uri: assetUrl(draft.logoUrl) }}
                style={styles.asset}
                resizeMode="contain"
              />
            ) : null}
            <UploadChip
              label={draft.logoUrl ? "Replace logo" : "Choose logo"}
              onPress={() => void pick("logoUrl")}
            />
          </View>

          <Text style={ui.label}>Signature</Text>
          <View style={styles.assetRow}>
            {draft.signatureUrl ? (
              <Image
                source={{ uri: assetUrl(draft.signatureUrl) }}
                style={styles.asset}
                resizeMode="contain"
              />
            ) : null}
            <UploadChip
              label={
                draft.signatureUrl ? "Replace signature" : "Choose signature"
              }
              onPress={() => void pick("signatureUrl")}
            />
          </View>

          <View style={ui.cardActions}>
            <Pressable style={ui.button} onPress={() => void save()}>
              <Text style={ui.buttonText}>
                {saving ? "Saving…" : "Save profile"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScreenScroll>

      <Toast flash={flash} />
    </View>
  );
}

const styles = StyleSheet.create({
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  asset: {
    width: 90,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
  },
});
