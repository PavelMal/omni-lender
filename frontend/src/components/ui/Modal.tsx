import { colors, radii, spacing, fontSizes } from '../../styles/tokens';
import { buttonStyle } from '../../styles/common';
import { fadeIn } from '../../styles/animations';

interface ModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function Modal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        animation: `${fadeIn} 0.15s ease`,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: colors.bgCard,
          border: `1px solid ${colors.borderLight}`,
          borderRadius: radii.xl,
          padding: spacing.xxxl,
          maxWidth: 440,
          width: '90%',
          animation: `${fadeIn} 0.2s ease`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: fontSizes.xl,
            fontWeight: 700,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.md,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontSize: fontSizes.md,
            color: colors.textSecondary,
            lineHeight: 1.6,
            margin: 0,
            marginBottom: spacing.xxl,
          }}
        >
          {description}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: spacing.md,
          }}
        >
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              ...buttonStyle('secondary'),
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              ...buttonStyle(confirmVariant),
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
