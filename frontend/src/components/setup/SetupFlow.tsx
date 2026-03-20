import { useState, useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { colors, spacing, radii, fontSizes } from '../../styles/tokens';
import { cardStyle, buttonStyle } from '../../styles/common';
import { ApproveDeposit } from '../ApproveDeposit';

interface Props {
  ownerAddress: string;
  onReady: (operatorAddr: string) => void;
}

type Step = 1 | 2 | 3;

const stepInfo = [
  {
    number: 1,
    title: 'Connect Wallet',
    description: 'Your wallet is connected. Make sure you are on the Sepolia test network.',
  },
  {
    number: 2,
    title: 'Approve USDT',
    description: 'Delegate a USDT budget to the agent. Funds stay in your wallet -- the agent uses a spending allowance.',
  },
  {
    number: 3,
    title: 'Ready to Go',
    description: 'Your agent is configured and ready to manage your portfolio autonomously.',
  },
];

export function SetupFlow({ ownerAddress, onReady }: Props) {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [operatorAddr, setOperatorAddr] = useState<string | null>(null);

  const wrongNetwork = chainId !== sepolia.id;

  useEffect(() => {
    if (!wrongNetwork && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [wrongNetwork, currentStep]);

  const handleAgentReady = (addr: string) => {
    setOperatorAddr(addr);
    setCurrentStep(3);
  };

  const handleActivate = () => {
    if (operatorAddr) {
      onReady(operatorAddr);
    }
  };

  return (
    <div style={{
      maxWidth: 640,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.xxl,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
        <h2 style={{
          fontSize: fontSizes.hero,
          fontWeight: 800,
          color: colors.textPrimary,
          marginBottom: spacing.md,
          letterSpacing: -0.5,
        }}>
          Set Up Your Agent
        </h2>
        <p style={{
          fontSize: fontSizes.lg,
          color: colors.textSecondary,
          maxWidth: 400,
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Three steps to deploy your autonomous AI economic agent on Sepolia.
        </p>
      </div>

      {/* Step indicators */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.lg,
      }}>
        {stepInfo.map((s, i) => {
          const isComplete = currentStep > s.number;
          const isActive = currentStep === s.number;

          return (
            <div key={s.number} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: radii.pill,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: fontSizes.md,
                fontWeight: 800,
                transition: 'all 0.3s ease',
                background: isComplete
                  ? colors.brand
                  : isActive
                    ? `${colors.brand}22`
                    : colors.bgInset,
                color: isComplete
                  ? colors.bgPrimary
                  : isActive
                    ? colors.brand
                    : colors.textMuted,
                border: isActive
                  ? `2px solid ${colors.brand}`
                  : isComplete
                    ? `2px solid ${colors.brand}`
                    : `2px solid ${colors.border}`,
              }}>
                {isComplete ? (
                  <span style={{ fontSize: fontSizes.lg }}>&#10003;</span>
                ) : (
                  s.number
                )}
              </div>
              {i < stepInfo.length - 1 && (
                <div style={{
                  width: 48,
                  height: 2,
                  background: isComplete ? colors.brand : colors.border,
                  transition: 'background 0.3s ease',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingLeft: spacing.sm,
        paddingRight: spacing.sm,
        marginBottom: spacing.xl,
      }}>
        {stepInfo.map(s => {
          const isActive = currentStep === s.number;
          const isComplete = currentStep > s.number;
          return (
            <div key={s.number} style={{
              flex: 1,
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: fontSizes.sm,
                fontWeight: 700,
                color: isActive ? colors.brand : isComplete ? colors.textSecondary : colors.textMuted,
                transition: 'color 0.3s ease',
              }}>
                {s.title}
              </p>
            </div>
          );
        })}
      </div>

      {/* Step 1: Network check */}
      {currentStep === 1 && (
        <div style={cardStyle()}>
          <h3 style={{
            fontSize: fontSizes.xl,
            fontWeight: 700,
            color: colors.textPrimary,
            marginBottom: spacing.md,
          }}>
            Welcome
          </h3>
          <p style={{
            fontSize: fontSizes.md,
            color: colors.textSecondary,
            lineHeight: 1.7,
            marginBottom: spacing.xl,
          }}>
            Your wallet is connected. OmniAgent operates on the Sepolia testnet.
            {wrongNetwork
              ? ' Please switch your network to continue.'
              : ' You are on the correct network.'}
          </p>

          {wrongNetwork ? (
            <div style={{
              padding: spacing.lg,
              borderRadius: radii.md,
              background: `${colors.red}0a`,
              border: `1px solid ${colors.red}33`,
              marginBottom: spacing.lg,
            }}>
              <p style={{
                color: colors.red,
                fontSize: fontSizes.md,
                fontWeight: 600,
                marginBottom: spacing.md,
              }}>
                Wrong network detected. Please switch to Sepolia to continue.
              </p>
              <button
                onClick={() => switchChain({ chainId: sepolia.id })}
                style={{
                  ...buttonStyle('danger'),
                  fontSize: fontSizes.md,
                  padding: `${spacing.md}px ${spacing.xxl}px`,
                }}
              >
                Switch to Sepolia
              </button>
            </div>
          ) : (
            <div style={{
              padding: spacing.lg,
              borderRadius: radii.md,
              background: `${colors.brand}0a`,
              border: `1px solid ${colors.brand}33`,
            }}>
              <p style={{
                color: colors.brand,
                fontSize: fontSizes.md,
                fontWeight: 600,
              }}>
                Connected to Sepolia. Proceeding to next step...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Approve USDT */}
      {currentStep === 2 && (
        <div>
          <div style={{
            ...cardStyle(),
            marginBottom: spacing.lg,
          }}>
            <h3 style={{
              fontSize: fontSizes.xl,
              fontWeight: 700,
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}>
              Delegate USDT to Your Agent
            </h3>
            <p style={{
              fontSize: fontSizes.md,
              color: colors.textSecondary,
              lineHeight: 1.7,
              marginBottom: spacing.md,
            }}>
              Choose how much USDT the agent can manage on your behalf. This sets an
              ERC-20 spending allowance -- your funds remain in your wallet at all times.
              The agent uses <code style={{ color: colors.purple }}>transferFrom</code> to
              move funds only when executing approved strategies.
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.sm,
              padding: spacing.md,
              background: colors.bgInset,
              borderRadius: radii.md,
              fontSize: fontSizes.sm,
              color: colors.textMuted,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <div style={{ width: 6, height: 6, borderRadius: radii.pill, background: colors.brand }} />
                <span>Funds never leave your wallet without a signed approval</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <div style={{ width: 6, height: 6, borderRadius: radii.pill, background: colors.blue }} />
                <span>You can revoke the allowance at any time</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <div style={{ width: 6, height: 6, borderRadius: radii.pill, background: colors.purple }} />
                <span>Every transaction is logged in the on-chain audit trail</span>
              </div>
            </div>
          </div>
          <ApproveDeposit ownerAddress={ownerAddress} onAgentReady={handleAgentReady} />
        </div>
      )}

      {/* Step 3: Ready */}
      {currentStep === 3 && (
        <div style={cardStyle()}>
          <div style={{ textAlign: 'center', padding: `${spacing.xxl}px 0` }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: radii.pill,
              background: `${colors.brand}18`,
              border: `2px solid ${colors.brand}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              marginBottom: spacing.xl,
              fontSize: fontSizes.xxl,
              color: colors.brand,
            }}>
              &#10003;
            </div>
            <h3 style={{
              fontSize: fontSizes.xl,
              fontWeight: 700,
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}>
              Agent Ready
            </h3>
            <p style={{
              fontSize: fontSizes.md,
              color: colors.textSecondary,
              lineHeight: 1.7,
              maxWidth: 400,
              margin: '0 auto',
              marginBottom: spacing.xxl,
            }}>
              Your agent is configured and ready to operate. It will autonomously manage
              DeFi positions, lending, and tipping within the budget you approved. All
              decisions are logged with full reasoning in the audit trail.
            </p>
            <button
              onClick={handleActivate}
              style={{
                ...buttonStyle('primary'),
                fontSize: fontSizes.lg,
                padding: `${spacing.lg}px ${spacing.xxxl * 2}px`,
                borderRadius: radii.lg,
              }}
            >
              Launch Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
