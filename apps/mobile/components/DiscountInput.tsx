import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DiscountMode } from '@marble/domain';
import { useCompanyCurrency } from '../lib/company-currency';
import { colors, ui } from '../lib/ui';

export type DiscountDraft = {
  discountMode: DiscountMode;
  discountValue: string;
};

export const EMPTY_DISCOUNT: DiscountDraft = {
  discountMode: 'none',
  discountValue: '0',
};

const num = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function discountFromStored(
  mode?: string | null,
  value?: number | null,
): DiscountDraft {
  const discountMode = (mode as DiscountMode) ?? 'none';
  return {
    discountMode:
      discountMode === 'fixed' || discountMode === 'percent'
        ? discountMode
        : 'none',
    discountValue: String(value ?? 0),
  };
}

export function discountPayload(draft: DiscountDraft) {
  return {
    discountMode: draft.discountMode,
    discountValue: num(draft.discountValue),
  };
}

function discountModes(currency: string): Array<{ id: DiscountMode; label: string }> {
  return [
    { id: 'none', label: 'None' },
    { id: 'fixed', label: currency },
    { id: 'percent', label: '%' },
  ];
}

export function DiscountInput({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  compact?: boolean;
}) {
  const currency = useCompanyCurrency();
  return (
    <View style={[styles.wrap, compact ? styles.compact : null]}>
      {!compact ? <Text style={ui.label}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={styles.modes}>
          {discountModes(currency).map((mode) => (
            <Pressable
              key={mode.id}
              style={[
                styles.chip,
                value.discountMode === mode.id && styles.chipActive,
              ]}
              onPress={() =>
                onChange({
                  discountMode: mode.id,
                  discountValue: mode.id === 'none' ? '0' : value.discountValue,
                })
              }
            >
              <Text
                style={[
                  styles.chipText,
                  value.discountMode === mode.id && styles.chipTextActive,
                ]}
              >
                {mode.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {value.discountMode !== 'none' ? (
          <TextInput
            style={[ui.input, styles.valueInput]}
            keyboardType="decimal-pad"
            placeholder={value.discountMode === 'percent' ? '0–100' : '0.00'}
            placeholderTextColor={colors.soft}
            value={value.discountValue}
            onChangeText={(discountValue) => onChange({ ...value, discountValue })}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginTop: 8,
  },
  compact: {
    marginTop: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  modes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 0,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.accent,
  },
  valueInput: {
    flex: 1,
    minWidth: 72,
    marginTop: 0,
  },
});
