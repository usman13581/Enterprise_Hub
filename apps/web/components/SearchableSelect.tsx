'use client';

import { useMemo, useState } from 'react';
import styles from './crud.module.css';

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  allowEmpty = false,
  emptyLabel = 'None',
  placeholder = 'Search…',
  required,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const listOptions = useMemo(() => {
    const entityOptions = options.filter((option) => option.id !== '');
    if (!allowEmpty) return entityOptions;
    return [{ id: '', label: emptyLabel }, ...entityOptions];
  }, [allowEmpty, emptyLabel, options]);

  const selected = listOptions.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listOptions;
    return listOptions.filter((option) =>
      option.label.toLowerCase().includes(normalized),
    );
  }, [listOptions, query]);

  const closedValue = selected && selected.id !== '' ? selected.label : '';
  const inputPlaceholder = open
    ? placeholder
    : closedValue
      ? placeholder
      : allowEmpty
        ? emptyLabel
        : placeholder;

  return (
    <label className={styles.field}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.searchSelectWrap}>
        <input
          className={styles.input}
          value={open ? query : closedValue}
          placeholder={inputPlaceholder}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onChange={(event) => {
            setOpen(true);
            setQuery(event.target.value);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          disabled={disabled}
          required={required && !value}
        />
        {open ? (
          <div className={styles.searchList} role="listbox">
            {filtered.length === 0 ? (
              <div className={styles.searchEmpty}>No matches.</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id || '__empty'}
                  type="button"
                  className={[
                    styles.searchOption,
                    option.id === value ? styles.searchOptionActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.id);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}
