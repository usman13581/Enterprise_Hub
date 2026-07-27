'use client';

import { useRef } from 'react';
import styles from './FilePicker.module.css';

type Props = {
  accept?: string;
  label?: string;
  hint?: string;
  busy?: boolean;
  disabled?: boolean;
  /** compact = inline chip next to a preview; default = dropzone-style control */
  variant?: 'default' | 'compact';
  onFile: (file: File) => void;
};

/**
 * Hides the native file control and shows a current-looking choose button.
 * Used for logo, signature, and product image uploads.
 */
export function FilePicker({
  accept = 'image/*',
  label = 'Choose file',
  hint = 'PNG or JPG',
  busy = false,
  disabled = false,
  variant = 'default',
  onFile,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = busy || disabled;

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        className={styles.hidden}
        type="file"
        accept={accept}
        disabled={blocked}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        className={variant === 'compact' ? styles.compact : styles.dropzone}
        disabled={blocked}
        onClick={() => inputRef.current?.click()}
      >
        <span className={styles.icon} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V4m0 0l-4 4m4-4l4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.copy}>
          <span className={styles.label}>
            {busy ? 'Uploading…' : label}
          </span>
          {variant === 'default' && hint ? (
            <span className={styles.hint}>{hint}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
