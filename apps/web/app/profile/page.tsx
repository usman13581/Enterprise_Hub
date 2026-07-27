"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, apiPut, apiUpload, assetUrl } from "@/lib/api";
import { useFlash } from "@/lib/useCollection";
import { Toast } from "@/components/ListControls";
import type { Company } from "@/lib/types";
import page from "../page.module.css";
import styles from "@/components/crud.module.css";

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

export default function ProfilePage() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      setError(e instanceof Error ? e.message : "Failed to load profile");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiPut("/company/profile", draft);
      await load();
      notify("Company profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function upload(field: "logoUrl" | "signatureUrl", file: File) {
    try {
      const { url } = await apiUpload(file);
      setDraft((d) => ({ ...d, [field]: url }));
      notify(
        field === "logoUrl"
          ? "Logo uploaded — save to apply"
          : "Signature uploaded — save to apply",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Company profile</h1>
      <p className={page.lede}>
        Branding and legal details printed on quotations and tax invoices.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={onSubmit}>
        <p className={styles.formTitle}>Details</p>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Legal name *</label>
            <input
              className={styles.input}
              value={draft.legalName}
              onChange={(e) =>
                setDraft({ ...draft, legalName: e.target.value })
              }
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Trade name</label>
            <input
              className={styles.input}
              value={draft.tradeName}
              onChange={(e) =>
                setDraft({ ...draft, tradeName: e.target.value })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>TRN</label>
            <input
              className={styles.input}
              value={draft.trn}
              onChange={(e) => setDraft({ ...draft, trn: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Phone</label>
            <input
              className={styles.input}
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Currency</label>
            <input
              className={styles.input}
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Quotation prefix</label>
            <input
              className={styles.input}
              value={draft.quotationPrefix}
              onChange={(e) =>
                setDraft({ ...draft, quotationPrefix: e.target.value })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Invoice prefix</label>
            <input
              className={styles.input}
              value={draft.invoicePrefix}
              onChange={(e) =>
                setDraft({ ...draft, invoicePrefix: e.target.value })
              }
            />
          </div>
        </div>

        <div className={styles.field} style={{ marginTop: "0.9rem" }}>
          <label className={styles.label}>Address</label>
          <textarea
            className={styles.textarea}
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
          />
        </div>

        <div className={styles.field} style={{ marginTop: "0.9rem" }}>
          <label className={styles.label}>Bank details</label>
          <textarea
            className={styles.textarea}
            value={draft.bankDetails}
            onChange={(e) =>
              setDraft({ ...draft, bankDetails: e.target.value })
            }
          />
        </div>

        <div className={styles.grid} style={{ marginTop: "1.1rem" }}>
          <div className={styles.field}>
            <label className={styles.label}>Logo</label>
            <div className={styles.uploadRow}>
              {draft.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.preview}
                  src={assetUrl(draft.logoUrl) ?? ""}
                  alt="Logo"
                />
              ) : null}
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload("logoUrl", f);
                }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Signature</label>
            <div className={styles.uploadRow}>
              {draft.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.preview}
                  src={assetUrl(draft.signatureUrl) ?? ""}
                  alt="Signature"
                />
              ) : null}
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload("signatureUrl", f);
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <Toast flash={flash} />
    </section>
  );
}
