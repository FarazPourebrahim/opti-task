import type { CSSProperties } from 'react';
import { useTokenValue } from '@/modules/dev/hooks/useTokenValue';
import styles from './TokenSwatch.module.css';

type TokenSwatchProps = {
  token: string;
  /** How the chip visualizes the token. */
  preview: 'color' | 'radius' | 'shadow' | 'size';
  label?: string;
};

function previewStyle(
  token: string,
  preview: TokenSwatchProps['preview'],
): CSSProperties {
  switch (preview) {
    case 'color':
      return { backgroundColor: `var(${token})` };
    case 'radius':
      return { borderRadius: `var(${token})` };
    case 'shadow':
      return { boxShadow: `var(${token})` };
    case 'size':
      return { inlineSize: `var(${token})` };
  }
}

export function TokenSwatch({ token, preview, label }: TokenSwatchProps) {
  const value = useTokenValue(token);

  return (
    <div className={styles.swatch}>
      <div
        className={styles.swatchChip}
        data-preview={preview}
        style={previewStyle(token, preview)}
      />
      <span className={styles.swatchName}>{label ?? token}</span>
      <span className={styles.swatchValue}>{value}</span>
    </div>
  );
}
