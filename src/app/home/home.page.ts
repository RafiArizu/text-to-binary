// ============================================================
// HOME PAGE — CODED LEXICON (TRANSLATE)
// ============================================================

import { Component, OnInit } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';
import { Clipboard }    from '@capacitor/clipboard';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular'

// ─── FORMAT TYPE ─────────────────────────────────────────────
export type ConvertFormat = 'Text' | 'Binary' | 'Decimal' | 'Hexadecimal' | 'Octal';

@Component({
  selector:    'app-home',
  templateUrl: 'home.page.html',
  styleUrls:   ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {

  // ── STATE ────────────────────────────────────────────────
  fromFormat:    ConvertFormat  = 'Text';
  toFormat:      ConvertFormat  = 'Binary';
  inputText:     string         = '';
  outputText:    string         = '';
  formatOptions: ConvertFormat[] = ['Text', 'Binary', 'Decimal', 'Hexadecimal', 'Octal'];

  constructor(
    private toastCtrl:   ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit() {}

  // ── PLACEHOLDER ──────────────────────────────────────────
  get inputPlaceholder(): string {
    return this.getPlaceholder(this.fromFormat);
  }

  get outputPlaceholder(): string {
    return this.getPlaceholder(this.toFormat);
  }

  private getPlaceholder(format: ConvertFormat): string {
    const map: Record<ConvertFormat, string> = {
      Text:        'Enter your query here...',
      Binary:      'Contoh: 01001000 01101001',
      Decimal:     'Contoh: 72 101 108 108 111',
      Hexadecimal: 'Contoh: 48 65 6C 6C 6F',
      Octal:       'Contoh: 110 145 154 154 157',
    };
    return map[format];
  }

  // ── CONVERT ──────────────────────────────────────────────
  onConvert(): void {
    if (!this.inputText.trim()) {
      this.showToast('Kolom masukan tidak boleh kosong.', 'warning');
      return;
    }
    this.outputText = this.convert(this.inputText, this.fromFormat, this.toFormat);
  }

  // ── SWAP ─────────────────────────────────────────────────
  onSwap(): void {
    const tmp      = this.fromFormat;
    this.fromFormat = this.toFormat;
    this.toFormat   = tmp;
    this.inputText  = '';
    this.outputText = '';
  }

  // ── RESET ────────────────────────────────────────────────
  onReset(): void {
    this.inputText  = '';
    this.outputText = '';
  }

  // ── COPY ─────────────────────────────────────────────────
  async onCopy(): Promise<void> {
    if (!this.outputText) {
      this.showToast('Tidak ada hasil untuk disalin.', 'warning');
      return;
    }
    try {
      await Clipboard.write({ string: this.outputText });
      this.showToast('Hasil berhasil disalin! ✓', 'success');
    } catch {
      // Fallback untuk browser
      try {
        await navigator.clipboard.writeText(this.outputText);
        this.showToast('Hasil berhasil disalin! ✓', 'success');
      } catch {
        this.showToast('Gagal menyalin ke clipboard.', 'danger');
      }
    }
  }

  async showSuccessPopup() {
    const alert = await this.alertCtrl.create({
    header: 'Berhasil',
    message: 'File berhasil di simpan, silahkan cek folder EntropyCode pada folder Documents ponsel anda.',
    buttons: ['OK']
    })
    await alert.present()
  }

  // ── SAVE TXT ─────────────────────────────────────────────
  async onSaveTxt(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Menyimpan file' })
    await loading.present()
    const filename = 'enigma_' + this.fromFormat + 'to' + this.toFormat + '_' + Date.now() + '.txt'

    const isWeb = Capacitor.getPlatform() === 'web'
    if (isWeb) {
    this.downloadViaBrowser(this.outputText, filename, 'text/plain')
    await loading.dismiss()
    return
    }

    let subFolder = this.toFormat
    const folderPath = 'EntropyCode/BinaryLanguage/' + subFolder
    const fullPath = folderPath + '/' + filename

    try {
    await Filesystem.mkdir({
    path: folderPath,
    directory: Directory.Documents,
    recursive: true
    })
    } catch (error) {
    console.log('Direktori sudah siap')
    }

    await Filesystem.writeFile({
    path: fullPath,
    data: this.outputText,
    directory: Directory.Documents,
    encoding: Encoding.UTF8
    })

    await loading.dismiss()
    await this.showSuccessPopup()
  }

  // ── SAVE BIN ─────────────────────────────────────────────
  async onSaveBin(): Promise<void> {

  if (!this.outputText) {
    this.showToast('Tidak ada hasil untuk disimpan.', 'warning')
    return
  }

  const loading = await this.loadingCtrl.create({ message: 'Menyimpan file biner...' })
  await loading.present()

  const filename = `enigma_${Date.now()}.bin`

  const isWeb = Capacitor.getPlatform() === 'web'
  if (isWeb) {
    const bytesWeb = this.outputToBytes(this.outputText, this.toFormat)
    this.downloadBinaryViaBrowser(bytesWeb, filename)
    await loading.dismiss()
    return
  }

  const bytes = this.outputToBytes(this.outputText, this.toFormat)
  const base64 = this.uint8ToBase64(bytes)

  let subFolder = this.toFormat
  const folderPath = 'EntropyCode/BinaryLanguage/' + subFolder
  const fullPath = folderPath + '/' + filename

  try {
    await Filesystem.mkdir({
      path: folderPath,
      directory: Directory.Documents,
      recursive: true
    })
  } catch (error) {
    console.log('Direktori sudah siap')
  }

  await Filesystem.writeFile({
    path: fullPath,
    data: base64,
    directory: Directory.Documents
  })

  await loading.dismiss()
  await this.showSuccessPopup()
  }

  // ── KONVERSI: LOGIKA UTAMA ───────────────────────────────

  private convert(
    input: string,
    from:  ConvertFormat,
    to:    ConvertFormat,
  ): string {
    if (from === to) return input;
    try {
      const codes = this.toCharCodes(input.trim(), from);
      return this.fromCharCodes(codes, to);
    } catch {
      return '[❌ Konversi gagal — periksa format masukan]';
    }
  }

  /** Langkah 1: ubah input menjadi array char code (number[]) */
  private toCharCodes(input: string, from: ConvertFormat): number[] {
    switch (from) {
      case 'Text':
        return input.split('').map(c => c.charCodeAt(0));

      case 'Binary':
        return input.trim().split(/\s+/).map(token => {
          if (!/^[01]+$/.test(token)) throw new Error(`Bukan binary: ${token}`);
          return parseInt(token, 2);
        });

      case 'Decimal':
        return input.trim().split(/\s+/).map(token => {
          const n = parseInt(token, 10);
          if (isNaN(n)) throw new Error(`Bukan desimal: ${token}`);
          return n;
        });

      case 'Hexadecimal':
        return input.trim().split(/\s+/).map(token => {
          if (!/^[0-9A-Fa-f]+$/.test(token)) throw new Error(`Bukan hex: ${token}`);
          return parseInt(token, 16);
        });

      case 'Octal':
        return input.trim().split(/\s+/).map(token => {
          if (!/^[0-7]+$/.test(token)) throw new Error(`Bukan oktal: ${token}`);
          return parseInt(token, 8);
        });
    }
  }

  /** Langkah 2: ubah array char code menjadi format target */
  private fromCharCodes(codes: number[], to: ConvertFormat): string {
    switch (to) {
      case 'Text':
        return codes.map(c => String.fromCharCode(c)).join('');

      case 'Binary':
        return codes.map(c => c.toString(2).padStart(8, '0')).join(' ');

      case 'Decimal':
        return codes.map(c => c.toString(10)).join(' ');

      case 'Hexadecimal':
        return codes.map(c => c.toString(16).toUpperCase().padStart(2, '0')).join(' ');

      case 'Octal':
        return codes.map(c => c.toString(8).padStart(3, '0')).join(' ');
    }
  }

  // ── HELPERS ──────────────────────────────────────────────

  /**
   * Konversi outputText ke Uint8Array sesuai format output.
   * - Binary  → "01001000 01101001" → [72, 105]  (byte value nyata)
   * - Hex     → "48 65 6C"          → [72, 101, 108]
   * - Decimal → "72 101 108"        → [72, 101, 108]
   * - Octal   → "110 145 154"       → [72, 101, 108]
   * - Text    → encode UTF-8
   */
  private outputToBytes(text: string, format: ConvertFormat): Uint8Array {
    try {
      switch (format) {
        case 'Binary':
          return new Uint8Array(
            text.trim().split(/\s+/).map(b => parseInt(b, 2))
          );
        case 'Hexadecimal':
          return new Uint8Array(
            text.trim().split(/\s+/).map(h => parseInt(h, 16))
          );
        case 'Decimal':
          return new Uint8Array(
            text.trim().split(/\s+/).map(d => parseInt(d, 10))
          );
        case 'Octal':
          return new Uint8Array(
            text.trim().split(/\s+/).map(o => parseInt(o, 8))
          );
        default:
          // Text — encode UTF-8
          return new TextEncoder().encode(text);
      }
    } catch {
      // Fallback aman: encode sebagai UTF-8 jika parsing gagal
      return new TextEncoder().encode(text);
    }
  }

  /** Konversi Uint8Array ke base64 string (untuk Capacitor Filesystem) */
  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  /** Download file langsung dari browser (fallback) */
  private downloadViaBrowser(
    content:  string,
    filename: string,
    mimeType: string,
  ): void {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href            = url;
    a.download        = filename;
    a.style.display   = 'none';

    // ── BUG FIX 1: elemen harus ada di DOM agar .click() bekerja ──
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // ── BUG FIX 2: tunda revoke agar browser sempat mulai download ──
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /** Download file biner (Uint8Array) dari browser (fallback khusus .bin) */
  private downloadBinaryViaBrowser(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes as any], { type: 'application/octet-stream' })
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href           = url;
    a.download       = filename;
    a.style.display  = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /** Tampilkan toast notifikasi */
  private async showToast(
    message: string,
    color:   'success' | 'danger' | 'warning' = 'success',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
      cssClass:  'enigma-toast',
    });
    await toast.present();
  }
}
