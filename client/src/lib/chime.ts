/**
 * نغمة انتهاء الوقت — ثلاث نبضات قصيرة تُولَّد في المتصفّح.
 *
 * بلا ملف صوت: لا شيء يُحمَّل ولا شيء يُرخَّص. وكل ما فيها محاط بـtry، فمتصفّح
 * يمنع الصوت قبل أول لمسة لا يُسقط المؤقّت من أجل نغمة.
 */
export function chime(): void {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const audio = new Context();
    [0, 0.28, 0.56].forEach((offset, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = index === 2 ? 880 : 660;
      const at = audio.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.26);
    });
    window.setTimeout(() => void audio.close(), 1200);
  } catch {
    /* لا صوت: الشاشة تقول إن الوقت انتهى. */
  }
}
