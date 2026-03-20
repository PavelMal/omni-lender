// Inject @keyframes into <head> once on first import

const STYLE_ID = 'omni-agent-keyframes';

function inject() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@keyframes oa-fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes oa-slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes oa-slideInFromBottom {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes oa-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.03); }
}
`;
  document.head.appendChild(style);
}

inject();

export const fadeIn = 'oa-fadeIn';
export const slideUp = 'oa-slideUp';
export const slideInFromBottom = 'oa-slideInFromBottom';
export const pulse = 'oa-pulse';
