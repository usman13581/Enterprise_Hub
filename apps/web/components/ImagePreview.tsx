'use client';

import { useEffect, useState } from 'react';
import styles from './ImagePreview.module.css';

/** Full-screen lightbox opened when a thumbnail is clicked. */
export function ImagePreview({
  src,
  alt = 'Preview',
  open,
  onClose,
}: {
  src: string | null;
  alt?: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close preview"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * Clickable image that opens ImagePreview. Drop-in replacement for <img>
 * wherever product / logo / signature thumbnails are shown.
 */
export function PreviewableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={`Preview ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={className} src={src} alt={alt} />
      </button>
      <ImagePreview
        src={src}
        alt={alt}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
