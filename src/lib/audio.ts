let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playTacticalChime(
  kind: 'start' | 'pause' | 'complete' | 'alert',
  enabled = true,
  volumePercent = 70
) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const gainLevel = Math.max(0.02, Math.min(0.4, (volumePercent / 100) * 0.25));
  const now = ctx.currentTime;

  const playTone = (freq: number, offset: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'alert' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now + offset);
    gain.gain.setValueAtTime(0.001, now + offset);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + duration + 0.02);
  };

  if (kind === 'start') {
    playTone(523.25, 0, 0.14);
    playTone(659.25, 0.09, 0.18);
  } else if (kind === 'pause') {
    playTone(440, 0, 0.12);
    playTone(349.23, 0.08, 0.16);
  } else if (kind === 'complete') {
    playTone(523.25, 0, 0.18);
    playTone(659.25, 0.12, 0.18);
    playTone(783.99, 0.24, 0.34);
  } else {
    playTone(587.33, 0, 0.16);
    playTone(880, 0.14, 0.25);
  }
}

export function triggerHaptic(enabled = true) {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(14);
  } catch {
    // Ignore on unsupported browsers
  }
}

export function speakTacticalVoice(text: string, enabled = true) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 0.92;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors
  }
}
