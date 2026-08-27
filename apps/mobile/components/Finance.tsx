import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openPdf } from '../lib/api';
import { colors, ui } from '../lib/ui';
import { label, money } from '../lib/format';

export function StatCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: 'due' | 'credit' | 'clear';
}) {
  const toneColor =
    tone === 'due'
      ? colors.danger
      : tone === 'credit'
        ? colors.accent
        : colors.ink;

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{title}</Text>
      <Text style={[styles.statValue, { color: toneColor }]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function BalanceCard({
  title,
  amount,
}: {
  title: string;
  amount: number;
}) {
  const tone =
    amount > 0.004 ? 'due' : amount < -0.004 ? 'credit' : 'clear';
  const hint =
    tone === 'due'
      ? 'Owed to us'
      : tone === 'credit'
        ? 'Held on account'
        : 'Settled';
  return (
    <StatCard
      title={title}
      value={money(Math.abs(amount))}
      hint={hint}
      tone={tone}
    />
  );
}

export function StatusPill({ status }: { status: string }) {
  const palette =
    status === 'cancelled' || status === 'credit_note'
      ? { bg: 'rgba(194,59,59,0.1)', fg: colors.danger }
      : status === 'draft' || status === 'closed'
        ? { bg: 'rgba(20,32,43,0.07)', fg: colors.muted }
        : { bg: colors.accentSoft, fg: colors.accent };

  return (
    <Text style={[styles.pill, { backgroundColor: palette.bg, color: palette.fg }]}>
      {label(status)}
    </Text>
  );
}

export function FilterChips<T extends string>({
  options,
  active,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.key === active;
        return (
          <Pressable
            key={option.key}
            style={[styles.chip, selected && styles.chipActive]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Compact list row used on every mobile records screen.
 * Left: title + one meta line. Right: status with PDF tucked under it.
 * Optional footer for slim text actions (Edit / Approve / …).
 */
export function RecordRow({
  title,
  meta,
  status,
  pdfPath,
  onPdfError,
  onPress,
  onEdit,
  children,
}: {
  title: string;
  meta: string;
  status?: string;
  pdfPath?: string;
  onPdfError?: (message: string) => void;
  onPress?: () => void;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <View style={styles.rowMain}>
        {onEdit ? <EditIconButton onPress={onEdit} /> : null}
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={2}>
            {meta}
          </Text>
        </View>
        {(status || pdfPath) && (
          <View style={styles.rowSide}>
            {status ? <StatusPill status={status} /> : null}
            {pdfPath && onPdfError ? (
              <PdfButton path={pdfPath} onError={onPdfError} compact />
            ) : null}
          </View>
        )}
      </View>
      {children ? <View style={styles.rowFooter}>{children}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.row} onPress={onPress}>
        {body}
      </Pressable>
    );
  }

  return <View style={styles.row}>{body}</View>;
}

export function BackLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.backLink}>
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function EditIconButton({
  onPress,
  label = 'Edit',
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      style={styles.editIcon}
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Text style={styles.editIconGlyph} accessibilityElementsHidden>
        ✎
      </Text>
    </Pressable>
  );
}

/** Slim text action for list footers — keeps rows short. */
export function LinkAction({
  label: text,
  onPress,
  tone = 'default',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={disabled && styles.disabled}
    >
      <Text
        style={[
          styles.link,
          tone === 'primary' && styles.linkPrimary,
          tone === 'danger' && styles.linkDanger,
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

export function ActionButton({
  label: text,
  onPress,
  tone = 'ghost',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[
        tone === 'primary' ? ui.button : ui.ghost,
        tone === 'danger' && styles.dangerBorder,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={[
          tone === 'primary' ? ui.buttonText : ui.ghostText,
          tone === 'danger' && ui.dangerText,
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

/** Modern choose-file control for logo / photo picks on mobile. */
export function UploadChip({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      style={[styles.uploadChip, busy && styles.disabled]}
      disabled={busy}
      onPress={onPress}
    >
      <Text style={styles.uploadIcon}>↑</Text>
      <Text style={styles.uploadLabel}>{busy ? 'Uploading…' : label}</Text>
    </Pressable>
  );
}

/** Fetches a PDF from the API and opens the device print / share sheet. */
export function PdfButton({
  path,
  onError,
  label: text = 'PDF',
  compact = false,
}: {
  path: string;
  onError: (message: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  function run() {
    setBusy(true);
    void openPdf(path)
      .catch((error) =>
        onError(
          error instanceof Error ? error.message : 'Could not open the PDF',
        ),
      )
      .finally(() => setBusy(false));
  }

  if (compact) {
    return (
      <Pressable
        style={[styles.pdfChip, busy && styles.disabled]}
        disabled={busy}
        onPress={run}
        hitSlop={4}
      >
        <Text style={styles.pdfChipText}>{busy ? '…' : text}</Text>
      </Pressable>
    );
  }

  return (
    <ActionButton
      label={busy ? '…' : text}
      disabled={busy}
      onPress={run}
    />
  );
}

const styles = StyleSheet.create({
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    padding: 14,
    marginTop: 10,
  },
  statLabel: {
    color: colors.soft,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  statHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  editIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  editIconGlyph: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 18,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  rowSide: {
    alignItems: 'flex-end',
    gap: 4,
    paddingTop: 1,
  },
  rowFooter: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  backLink: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backLinkText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  link: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  linkPrimary: {
    color: colors.accent,
  },
  linkDanger: {
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 12,
  },
  dangerBorder: {
    borderColor: 'rgba(194,59,59,0.3)',
  },
  disabled: {
    opacity: 0.4,
  },
  uploadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(26,107,122,0.28)',
    backgroundColor: colors.accentSoft,
  },
  uploadIcon: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  uploadLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  pdfChip: {
    marginTop: 2,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: colors.ink,
    alignSelf: 'flex-end',
  },
  pdfChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
