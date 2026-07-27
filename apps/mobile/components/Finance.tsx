import { Pressable, StyleSheet, Text, View } from 'react-native';
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

export function RowActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
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

const styles = StyleSheet.create({
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
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
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 12,
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  dangerBorder: {
    borderColor: 'rgba(194,59,59,0.3)',
  },
  disabled: {
    opacity: 0.4,
  },
});
