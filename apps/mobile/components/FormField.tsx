import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, ui } from '../lib/ui';

type FormFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  first?: boolean;
};

export function FormField({
  label,
  required,
  first,
  style,
  ...rest
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[ui.label, first ? styles.labelFirst : null]}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        style={[ui.input, style]}
        placeholderTextColor={colors.soft}
        {...rest}
      />
    </View>
  );
}

export function FormPicker({
  label,
  first,
  children,
}: {
  label: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[ui.label, first ? styles.labelFirst : null]}>{label}</Text>
      {children}
    </View>
  );
}

export function FormChipSelect({
  label,
  value,
  options,
  onChange,
  first,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (next: string) => void;
  first?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[ui.label, first ? styles.labelFirst : null]}>{label}</Text>
      <View style={styles.chips}>
        <Pressable
          style={[styles.chip, !value && styles.chipActive]}
          onPress={() => onChange('')}
        >
          <Text style={[styles.chipText, !value && styles.chipTextActive]}>
            None
          </Text>
        </Pressable>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => onChange(option.id)}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextActive]}
                numberOfLines={1}
              >
                {option.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    alignSelf: 'stretch',
  },
  labelFirst: {
    marginTop: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    maxWidth: '100%',
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
});
