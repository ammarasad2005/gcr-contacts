'use client';

import { useState } from 'react';

/**
 * CopyButton — copies text to clipboard, shows ✓ for 1.5s.
 * @param {string}  text         Text to copy
 * @param {string}  [className]  Extra CSS class
 * @param {boolean} [disabled]   Disable button when no email
 * @param {string}  [label]      Button label (default: clipboard icon)
 */
export default function CopyButton({ text, className = '', disabled = false, label }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard access denied */
    }
  }

  return (
    <button
      className={`${className} ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      disabled={disabled || !text}
      title={disabled || !text ? 'No email to copy' : `Copy: ${text}`}
      aria-label={disabled || !text ? 'No email available' : `Copy email ${text}`}
    >
      {label || (copied ? '✓' : '⎘')}
    </button>
  );
}
