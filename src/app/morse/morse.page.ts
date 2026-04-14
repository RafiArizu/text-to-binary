// ============================================================
// MORSE PAGE — THE ENIGMA ENGINE
// Features: Text↔Morse, Web Audio API, Light, Haptics, MP3, Share
// ============================================================

import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ToastController, LoadingController }   from '@ionic/angular';
import { Clipboard }    from '@capacitor/clipboard';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Haptics, ImpactStyle }  from '@capacitor/haptics';
import { Share }        from '@capacitor/share';
import { Preferences }  from '@capacitor/preferences';

// ─── MORSE CODE MAP ──────────────────────────────────────────
const MORSE_MAP: Record<string, string> = {
  A:'.-',   B:'-...', C:'-.-.', D:'-..',  E:'.',    F:'..-.',
  G:'--.',  H:'....', I:'..',   J:'.---', K:'-.-',  L:'.-..',
  M:'--',   N:'-.',   O:'---',  P:'.--.',  Q:'--.-', R:'.-.',
  S:'...',  T:'-',    U:'..-',  V:'...-',  W:'.--',  X:'-..-',
  Y:'-.--', Z:'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-',
  '5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  '.':'.-.-.-', ',':'--..--', '?':'..--..', "'":'.----.',
  '!':'-.-.--', '/':'-..-.', '(':'-.--.', ')':'-.--.-',
  '&':'.-...', ':':'---...', ';':'-.-.-.', '=':'-...-',
  '+':'.-.-.', '-':'-....-', '_':'..--.-', '"':'.-..-.','@':'.--.-.',
};

// Reverse map untuk Morse → Text
const REVERSE_MAP: Record<string, string> = {};
Object.keys(MORSE_MAP).forEach(k => {
  REVERSE_MAP[MORSE_MAP[k]] = k;
});

// ─── TIMING INTERFACE ────────────────────────────────────────
interface MorseEvent {
  type: 'on' | 'off';
  duration: number; // ms
}

export type MorseDir = 'Text' | 'Morse';

@Component({
  selector:    'app-morse',
  templateUrl: './morse.page.html',
  styleUrls:   ['./morse.page.scss'],
  standalone: false,
})
export class MorsePage implements OnInit, OnDestroy {

  // ── FORM STATE ───────────────────────────────────────────
  fromFormat:   MorseDir   = 'Text';
  toFormat:     MorseDir   = 'Morse';
  morseOptions: MorseDir[] = ['Text', 'Morse'];
  inputText:    string     = '';
  outputText:   string     = '';

  // ── SLIDER STATE ─────────────────────────────────────────
  speed:  number = 20;   // WPM
  pitch:  number = 600;  // Hz
  volume: number = 85;   // 0-100

  // ── AUDIO STATE ──────────────────────────────────────────
  isPlaying:  boolean = false;
  isPaused:   boolean = false;

  // ── FEATURE STATE ────────────────────────────────────────
  isLightActive:   boolean = false;
  isVibrateActive: boolean = false;
  isScreenOn:      boolean = false;

  // ── PRIVATE ──────────────────────────────────────────────
  private audioCtx:       AudioContext | null = null;
  private gainNode:       GainNode | null     = null;
  private scheduledNodes: OscillatorNode[]    = [];
  private playTimer:      ReturnType<typeof setTimeout> | null = null;
  private lightTimer:     ReturnType<typeof setTimeout> | null = null;
  private vibrateTimer:   ReturnType<typeof setTimeout> | null = null;

  // Menyimpan blob MP3 terakhir untuk Share
  private lastMp3Blob:     Blob | null = null;
  private lastMp3Filename: string      = '';

  constructor(
    private toastCtrl:   ToastController,
    private loadingCtrl: LoadingController,
    private ngZone:      NgZone,
  ) {}

  // ─── LIFECYCLE ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.loadSliderPrefs();
  }

  ngOnDestroy(): void {
    this.stopAudio();
    this.clearLightEffect();
  }

  // ─── PLACEHOLDER ────────────────────────────────────────────
  get inputPlaceholder(): string {
    return this.fromFormat === 'Text'
      ? 'Enter message to encode...'
      : 'Masukkan kode morse (titik · strip ─ spasi /)...';
  }

  get outputPlaceholder(): string {
    return this.toFormat === 'Morse'
      ? '- . .-.. .-.. --- / .-- --- .-. .-.. -..'
      : 'Hasil dekode muncul di sini...';
  }

  // ─── CONVERT ────────────────────────────────────────────────
  onConvert(): void {
    if (!this.inputText.trim()) {
      this.toast('Kolom masukan tidak boleh kosong.', 'warning');
      return;
    }
    this.outputText =
      this.fromFormat === 'Text'
        ? this.textToMorse(this.inputText)
        : this.morseToText(this.inputText);
  }

  // ─── SWAP ───────────────────────────────────────────────────
  onSwap(): void {
    const tmp       = this.fromFormat;
    this.fromFormat = this.toFormat;
    this.toFormat   = tmp;
    this.inputText  = '';
    this.outputText = '';
    this.stopAudio();
    this.clearLightEffect();
  }

  // ─── RESET ──────────────────────────────────────────────────
  onReset(): void {
    this.inputText  = '';
    this.outputText = '';
    this.stopAudio();
    this.clearLightEffect();
  }

  // ─── COPY ───────────────────────────────────────────────────
  async onCopy(): Promise<void> {
    if (!this.outputText) { this.toast('Tidak ada hasil.', 'warning'); return; }
    try {
      await Clipboard.write({ string: this.outputText });
      this.toast('Hasil disalin! ✓', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(this.outputText);
        this.toast('Hasil disalin! ✓', 'success');
      } catch { this.toast('Gagal menyalin.', 'danger'); }
    }
  }

  // ─── SLIDER PREFERENCE ──────────────────────────────────────
  async onSliderChange(): Promise<void> {
    try {
      await Preferences.set({ key: 'morse_speed',  value: String(this.speed)  });
      await Preferences.set({ key: 'morse_pitch',  value: String(this.pitch)  });
      await Preferences.set({ key: 'morse_volume', value: String(this.volume) });
    } catch {}
  }

  private async loadSliderPrefs(): Promise<void> {
    try {
      const s = await Preferences.get({ key: 'morse_speed'  });
      const p = await Preferences.get({ key: 'morse_pitch'  });
      const v = await Preferences.get({ key: 'morse_volume' });
      if (s.value) this.speed  = Number(s.value);
      if (p.value) this.pitch  = Number(p.value);
      if (v.value) this.volume = Number(v.value);
    } catch {}
  }

  // ─── AUDIO: PLAY ────────────────────────────────────────────
  async onPlay(): Promise<void> {
    if (this.isPaused) {
      await this.audioCtx?.resume();
      this.isPaused  = false;
      this.isPlaying = true;
      return;
    }

    const morse = this.getMorseText();
    if (!morse) { this.toast('Konversi teks ke morse dahulu.', 'warning'); return; }

    this.stopAudio();

    // Buat konteks audio baru
    this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(this.volume / 100, this.audioCtx.currentTime);
    this.gainNode.connect(this.audioCtx.destination);

    const unitMs    = this.wpmToUnit(this.speed);
    const timings   = this.buildTimings(morse, unitMs);
    const startTime = this.audioCtx.currentTime + 0.05;
    let   cursor    = startTime;

    // Jadwalkan semua nada sekaligus (pre-scheduled)
    for (const ev of timings) {
      const sec = ev.duration / 1000;
      if (ev.type === 'on') {
        const osc  = this.audioCtx.createOscillator();
        const env  = this.audioCtx.createGain();
        const ramp = 0.005;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(this.pitch, cursor);

        env.gain.setValueAtTime(0, cursor);
        env.gain.linearRampToValueAtTime(1, cursor + ramp);
        env.gain.setValueAtTime(1, cursor + sec - ramp);
        env.gain.linearRampToValueAtTime(0, cursor + sec);

        osc.connect(env);
        env.connect(this.gainNode);
        osc.start(cursor);
        osc.stop(cursor + sec);
        this.scheduledNodes.push(osc);
      }
      cursor += sec;
    }

    this.isPlaying = true;

    // Callback setelah selesai
    const totalMs = (cursor - startTime) * 1000 + 200;
    this.playTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.isPlaying = false;
        this.isPaused  = false;
      });
    }, totalMs);
  }

  // ─── AUDIO: PAUSE ───────────────────────────────────────────
  onPause(): void {
    if (!this.isPlaying) return;
    this.audioCtx?.suspend();
    this.isPlaying = false;
    this.isPaused  = true;
    if (this.playTimer) clearTimeout(this.playTimer);
  }

  // ─── AUDIO: STOP ────────────────────────────────────────────
  onStop(): void {
    this.stopAudio();
    this.clearLightEffect();
  }

  // ─── AUDIO: REPLAY ──────────────────────────────────────────
  async onReplay(): Promise<void> {
    this.stopAudio();
    await this.onPlay();
  }

  // ─── LIGHT EFFECT ───────────────────────────────────────────
  onLight(): void {
    if (this.isLightActive) {
      this.clearLightEffect();
      return;
    }

    const morse = this.getMorseText();
    if (!morse) { this.toast('Konversi teks ke morse dahulu.', 'warning'); return; }

    const unitMs  = this.wpmToUnit(this.speed);
    const timings = this.buildTimings(morse, unitMs);
    this.isLightActive = true;
    this.runLightSeq(timings, 0);
  }

  private runLightSeq(timings: MorseEvent[], idx: number): void {
    if (!this.isLightActive || idx >= timings.length) {
      this.ngZone.run(() => {
        this.isLightActive = false;
        this.isScreenOn    = false;
      });
      return;
    }

    const ev = timings[idx];
    this.ngZone.run(() => { this.isScreenOn = ev.type === 'on'; });

    this.lightTimer = setTimeout(() => {
      this.runLightSeq(timings, idx + 1);
    }, ev.duration);
  }

  private clearLightEffect(): void {
    if (this.lightTimer) clearTimeout(this.lightTimer);
    this.lightTimer    = null;
    this.isLightActive = false;
    this.isScreenOn    = false;
  }

  // ─── VIBRATE ────────────────────────────────────────────────
  async onVibrate(): Promise<void> {
    if (this.isVibrateActive) {
      this.isVibrateActive = false;
      return;
    }

    const morse = this.getMorseText();
    if (!morse) { this.toast('Konversi teks ke morse dahulu.', 'warning'); return; }

    const unitMs  = this.wpmToUnit(this.speed);
    const timings = this.buildTimings(morse, unitMs);
    this.isVibrateActive = true;
    await this.runVibrateSeq(timings, 0);
  }

  private async runVibrateSeq(timings: MorseEvent[], idx: number): Promise<void> {
    if (!this.isVibrateActive || idx >= timings.length) {
      this.ngZone.run(() => { this.isVibrateActive = false; });
      return;
    }

    const ev = timings[idx];

    if (ev.type === 'on') {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {
        if ('vibrate' in navigator) navigator.vibrate(ev.duration);
      }
    }

    await new Promise<void>(res => {
      this.vibrateTimer = setTimeout(res, ev.duration);
    });

    await this.runVibrateSeq(timings, idx + 1);
  }

  // ─── SAVE MP3 ───────────────────────────────────────────────
  async onSave(): Promise<void> {
    const morse = this.getMorseText();
    if (!morse) { this.toast('Konversi teks ke morse dahulu.', 'warning'); return; }

    const loading = await this.loadingCtrl.create({ message: 'Menghasilkan audio morse…' });
    await loading.present();

    try {
      const unitMs  = this.wpmToUnit(this.speed);
      const timings = this.buildTimings(morse, unitMs);
      const pcm     = this.generatePCM(timings);
      const blob    = await this.encodeMp3(pcm);

      this.lastMp3Filename = `morse_${Date.now()}.mp3`;
      this.lastMp3Blob     = blob;

      const base64 = await this.blobToBase64(blob);
      await Filesystem.writeFile({
        path:      this.lastMp3Filename,
        data:      base64,
        directory: Directory.Cache,
      });

      await loading.dismiss();
      this.toast(`Tersimpan: ${this.lastMp3Filename} ✓`, 'success');
    } catch (e) {
      await loading.dismiss();
      console.error('Save MP3 error:', e);
      // Fallback: browser download
      if (this.lastMp3Blob) {
        this.browserDownload(this.lastMp3Blob, `morse_${Date.now()}.mp3`);
        this.toast('Audio diunduh ke perangkat. ✓', 'success');
      } else {
        this.toast('Gagal menyimpan audio.', 'danger');
      }
    }
  }

  // ─── SEND TO FRIEND ─────────────────────────────────────────
  async onSendToFriend(): Promise<void> {
    // Jika belum ada file, generate dulu
    if (!this.lastMp3Blob) {
      await this.onSave();
      if (!this.lastMp3Blob) return;
    }

    try {
      const uri = await Filesystem.getUri({
        path:      this.lastMp3Filename,
        directory: Directory.Cache,
      });

      await Share.share({
        title:       'Pesan Morse — Enigma Engine',
        text:        `Pesan morse: ${this.outputText || this.inputText}`,
        url:         uri.uri,
        dialogTitle: 'Bagikan audio morse via…',
      });
    } catch (e) {
      console.error('Share error:', e);
      this.toast('Gagal membagikan. Simpan file dulu.', 'danger');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: MORSE LOGIC
  // ═══════════════════════════════════════════════════════════

  /** Text → Morse code string */
  private textToMorse(text: string): string {
    return text
      .toUpperCase()
      .split('')
      .map(ch => (ch === ' ' ? '/' : (MORSE_MAP[ch] ?? '?')))
      .join(' ');
  }

  /** Morse code string → Text */
  private morseToText(morse: string): string {
    return morse
      .trim()
      .split(' / ')
      .map(word =>
        word.split(' ')
          .map(sym => (sym ? (REVERSE_MAP[sym] ?? '?') : ''))
          .join('')
      )
      .join(' ');
  }

  /** Ambil morse output atau input yang sudah berbentuk morse */
  private getMorseText(): string {
    if (this.toFormat === 'Morse' && this.outputText) return this.outputText;
    if (this.fromFormat === 'Morse' && this.inputText)  return this.inputText;
    return '';
  }

  /** WPM → unit duration (ms). Rumus: 1200 / WPM */
  private wpmToUnit(wpm: number): number {
    return Math.round(1200 / wpm);
  }

  /**
   * Bangun array timing on/off dari morse string.
   * Aturan: dot=1u, dash=3u, sim-gap=1u, char-gap=3u, word-gap=7u
   */
  private buildTimings(morse: string, unitMs: number): MorseEvent[] {
    const events: MorseEvent[] = [];
    const tokens = morse.trim().split(' ');

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token === '/') {
        // Tambahkan 4u ekstra ke gap yang sudah ada (char-gap 3u + 4u = 7u)
        if (events.length && events[events.length - 1].type === 'off') {
          events[events.length - 1].duration += 4 * unitMs;
        } else {
          events.push({ type: 'off', duration: 7 * unitMs });
        }
        continue;
      }

      for (let j = 0; j < token.length; j++) {
        // ON event
        const sym = token[j];
        events.push({
          type:     'on',
          duration: sym === '-' ? 3 * unitMs : unitMs,
        });

        // Symbol gap (1u) — kecuali simbol terakhir dalam karakter
        if (j < token.length - 1) {
          events.push({ type: 'off', duration: unitMs });
        }
      }

      // Character gap (3u) antara token, kecuali sebelum word-gap
      if (i < tokens.length - 1 && tokens[i + 1] !== '/') {
        events.push({ type: 'off', duration: 3 * unitMs });
      }
    }

    return events;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: AUDIO ENGINE
  // ═══════════════════════════════════════════════════════════

  private stopAudio(): void {
    if (this.playTimer) { clearTimeout(this.playTimer); this.playTimer = null; }
    this.scheduledNodes.forEach(n => { try { n.stop(); } catch {} });
    this.scheduledNodes = [];
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
    this.isPlaying = false;
    this.isPaused  = false;
  }

  /** Generate raw PCM samples dari timing morse */
  private generatePCM(timings: MorseEvent[], sampleRate = 44100): Int16Array {
    const ramp    = 0.005;
    let   total   = 0;
    for (const ev of timings) total += Math.ceil((ev.duration / 1000) * sampleRate);
    total += sampleRate; // 1s tail

    const pcm    = new Int16Array(total);
    const vol    = this.volume / 100;
    let   offset = 0;

    for (const ev of timings) {
      const n = Math.ceil((ev.duration / 1000) * sampleRate);
      if (ev.type === 'on') {
        const rampN = Math.floor(ramp * sampleRate);
        for (let i = 0; i < n; i++) {
          const t   = (offset + i) / sampleRate;
          let   env = 1.0;
          if (i < rampN)          env = i / rampN;
          else if (i > n - rampN) env = (n - i) / rampN;
          const s = Math.sin(2 * Math.PI * this.pitch * t) * vol * env;
          pcm[offset + i] = Math.max(-32768, Math.min(32767, Math.floor(s * 32767)));
        }
      }
      offset += n;
    }
    return pcm;
  }

  /** Encode PCM ke MP3 via lamejs, fallback ke WAV */
  private async encodeMp3(pcm: Int16Array, sampleRate = 44100): Promise<Blob> {
    const lame = (window as any).lamejs;
    if (lame) {
      try {
        const enc   = new lame.Mp3Encoder(1, sampleRate, 128);
        const chunk = 1152;
        // Pakai ArrayBuffer[] agar kompatibel dengan BlobPart[]
        const parts: ArrayBuffer[] = [];
        for (let i = 0; i < pcm.length; i += chunk) {
          const buf = enc.encodeBuffer(pcm.subarray(i, i + chunk));
          if (buf.length) {
            // Salin ke ArrayBuffer baru supaya type-safe
            const ab = new ArrayBuffer(buf.length);
            new Uint8Array(ab).set(buf);
            parts.push(ab);
          }
        }
        const flush = enc.flush();
        if (flush.length) {
          const ab = new ArrayBuffer(flush.length);
          new Uint8Array(ab).set(flush);
          parts.push(ab);
        }
        return new Blob(parts as BlobPart[], { type: 'audio/mp3' });
      } catch (e) {
        console.warn('lamejs gagal, fallback ke WAV:', e);
      }
    }
    return this.encodeWav(pcm, sampleRate);
  }

  /** Encode PCM ke WAV Blob (fallback) */
  private encodeWav(pcm: Int16Array, sampleRate: number): Blob {
    const buf  = new ArrayBuffer(44 + pcm.byteLength);
    const view = new DataView(buf);
    const str  = (off: number, s: string) =>
      [...s].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));

    str(0,  'RIFF');
    view.setUint32(4,  36 + pcm.byteLength, true);
    str(8,  'WAVE');
    str(12, 'fmt ');
    view.setUint32(16, 16,          true);
    view.setUint16(20, 1,           true); // PCM
    view.setUint16(22, 1,           true); // mono
    view.setUint32(24, sampleRate,  true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2,           true);
    view.setUint16(34, 16,          true);
    str(36, 'data');
    view.setUint32(40, pcm.byteLength, true);
    new Int16Array(buf, 44).set(pcm);
    return new Blob([buf], { type: 'audio/wav' });
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: UTILITIES
  // ═══════════════════════════════════════════════════════════

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  private browserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  private async toast(
    msg:   string,
    color: 'success' | 'danger' | 'warning' = 'success',
  ): Promise<void> {
    const t = await this.toastCtrl.create({
      message:  msg,
      duration: 2500,
      color,
      position: 'bottom',
      cssClass:  'enigma-toast',
    });
    await t.present();
  }
}
