/** Little bits of physical feedback: haptic taps and celebrations. */

let native: null | { impact: (o: { style: string }) => Promise<void>; notification: (o: { type: string }) => Promise<void> } = null;

import('@capacitor/core').then(async ({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics } = await import('@capacitor/haptics');
  native = Haptics as never;
});

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function tick(strength: 'light' | 'medium' | 'heavy' = 'light') {
  if (native) return void native.impact({ style: strength.toUpperCase() }).catch(() => {});
  navigator.vibrate?.(strength === 'light' ? 6 : strength === 'medium' ? 12 : 20);
}

export function success() {
  if (native) return void native.notification({ type: 'SUCCESS' }).catch(() => {});
  navigator.vibrate?.([10, 40, 18]);
}

const COLORS = ['#ff7a59', '#ffd36e', '#8fc79a', '#8fcbf0', '#ff9fc0', '#c4a8ff'];

/** A small burst of paper confetti from a point on screen. */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 28) {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 140;
    p.style.cssText = `left:${x}px;top:${y}px;background:${COLORS[i % COLORS.length]};--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 60}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 60}ms`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1400);
}

/** Floating hearts that pop out of an element. */
export function heartBurst(el: Element, count = 6) {
  if (reduced()) return;
  const r = el.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'heart-burst';
  for (let i = 0; i < count; i++) {
    const h = document.createElement('i');
    h.textContent = '♥';
    h.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${(Math.random() - 0.5) * 90}px;--dy:${-40 - Math.random() * 60}px;--s:${0.6 + Math.random() * 0.7};animation-delay:${i * 25}ms`;
    layer.appendChild(h);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1000);
}

/** Finishing a book deserves a party. */
export function celebrate(from?: Element | null) {
  success();
  const r = from?.getBoundingClientRect();
  confetti(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined);
}
