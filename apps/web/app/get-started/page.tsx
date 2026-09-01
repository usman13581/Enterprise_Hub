"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  APP_NAME,
  APP_POWERED_BY,
  APP_VERSION,
  COUNTRIES,
  currencyForCountry,
} from "@marble/types";
import { apiPost } from "@/lib/api";
import { SearchableSelect } from "@/components/SearchableSelect";
import styles from "@/components/crud.module.css";
import page from "../page.module.css";
import login from "../login/login.module.css";

export default function GetStartedPage() {
  const [legalName, setLegalName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [emirate, setEmirate] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [trn, setTrn] = useState("");
  const [approxUsers, setApproxUsers] = useState("");
  const [planInterest, setPlanInterest] = useState("");
  const [needs, setNeeds] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [note, setNote] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const derivedCurrency = useMemo(
    () => (country ? currencyForCountry(country) : ""),
    [country],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/public/applications", {
        legalName,
        contactName,
        email,
        phone,
        country,
        emirate: emirate || undefined,
        tradeName: tradeName || undefined,
        trn: trn || undefined,
        approxUsers: approxUsers || undefined,
        planInterest: planInterest || undefined,
        needs: needs || undefined,
        heardFrom: heardFrom || undefined,
        note: note || undefined,
        honeypot,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={login.screen}>
      <div className={login.card} style={{ width: "min(100%, 560px)" }}>
        <p className={login.brand}>{APP_NAME}</p>
        <p className={login.powered}>{APP_POWERED_BY}</p>
        <p className={login.version}>v{APP_VERSION}</p>
        <h1 className={page.title}>Get started</h1>

        {done ? (
          <div className={page.panel}>
            <p className={page.panelTitle}>Application received</p>
            <p className={page.meta}>
              Thanks — we will contact you at the email you provided.
            </p>
            <p className={login.hint}>
              <Link href="/login">Back to sign in</Link>
            </p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} style={{ position: "relative" }}>
            <div
              style={{ position: "absolute", left: "-9999px" }}
              aria-hidden="true"
            >
              <label>
                Company website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Legal name *</label>
                <input
                  className={styles.input}
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact name *</label>
                <input
                  className={styles.input}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email *</label>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Phone *</label>
                <input
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <SearchableSelect
                label="Country *"
                value={country}
                onChange={setCountry}
                required
                placeholder="Search countries…"
                options={COUNTRIES.map((item) => ({
                  id: item.code,
                  label: item.name,
                }))}
              />
              {derivedCurrency ? (
                <p className={login.hint}>Currency: {derivedCurrency}</p>
              ) : (
                <p className={login.hint}>
                  Currency follows the country you select.
                </p>
              )}
              <div className={styles.field}>
                <label className={styles.label}>Emirate / region</label>
                <input
                  className={styles.input}
                  value={emirate}
                  onChange={(e) => setEmirate(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Trade name</label>
                <input
                  className={styles.input}
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>TRN</label>
                <input
                  className={styles.input}
                  value={trn}
                  onChange={(e) => setTrn(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Approx. users</label>
                <input
                  className={styles.input}
                  value={approxUsers}
                  onChange={(e) => setApproxUsers(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Plan interest</label>
                <input
                  className={styles.input}
                  value={planInterest}
                  onChange={(e) => setPlanInterest(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Heard from</label>
                <input
                  className={styles.input}
                  value={heardFrom}
                  onChange={(e) => setHeardFrom(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.field} style={{ marginTop: "0.9rem" }}>
              <label className={styles.label}>Needs</label>
              <textarea
                className={styles.textarea}
                value={needs}
                onChange={(e) => setNeeds(e.target.value)}
              />
            </div>
            <div className={styles.field} style={{ marginTop: "0.9rem" }}>
              <label className={styles.label}>Note</label>
              <textarea
                className={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button className={styles.button} type="submit" disabled={saving}>
                {saving ? "Submitting…" : "Submit application"}
              </button>
              <Link className={styles.ghost} href="/login">
                Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
