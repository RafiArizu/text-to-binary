import { Component, OnInit } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';
import { Clipboard }    from '@capacitor/clipboard';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
 
// ─── FORMAT TYPE ─────────────────────────────────────────────
export type ConvertFormat = 'Text' | 'Binary' | 'Decimal' | 'Hexadecimal' | 'Octal';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
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
 
  // ── SAVE TXT ─────────────────────────────────────────────
  async onSaveTxt(): Promise<void> {
    if (!this.outputText) {
      this.showToast('Tidak ada hasil untuk disimpan.', 'warning');
      return;
    }
 
    const loading = await this.loadingCtrl.create({ message: 'Menyimpan file...' });
    await loading.present();
 
    const filename = `enigma_${this.fromFormat}_to_${this.toFormat}_${Date.now()}.txt`;
 
    try {
      await Filesystem.writeFile({
        path:      filename,
        data:      this.outputText,
        directory: Directory.Documents,
        encoding:  Encoding.UTF8,
      });
      await loading.dismiss();
      this.showToast(`Tersimpan: ${filename}`, 'success');
    } catch {
      await loading.dismiss();
      // Fallback: browser download
      this.downloadViaBrowser(this.outputText, filename, 'text/plain');
      this.showToast('File diunduh ke perangkat. ✓', 'success');
    }
  }
 
  // ── SAVE BIN ─────────────────────────────────────────────
  async onSaveBin(): Promise<void> {
    if (!this.outputText) {
      this.showToast('Tidak ada hasil untuk disimpan.', 'warning');
      return;
    }
 
    const loading = await this.loadingCtrl.create({ message: 'Menyimpan file biner...' });
    await loading.present();
 
    const filename = `enigma_${Date.now()}.bin`;
 
    try {
      // Encode output ke base64 untuk disimpan sebagai binary
      const base64 = btoa(unescape(encodeURIComponent(this.outputText)));
      await Filesystem.writeFile({
        path:      filename,
        data:      base64,
        directory: Directory.Documents,
      });
      await loading.dismiss();
      this.showToast(`File .bin tersimpan: ${filename}`, 'success');
    } catch {
      await loading.dismiss();
      this.downloadViaBrowser(
        this.outputText,
        filename,
        'application/octet-stream'
      );
      this.showToast('File .bin diunduh ke perangkat. ✓', 'success');
    }
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
 
  /** Download file langsung dari browser (fallback) */
  private downloadViaBrowser(
    content:  string,
    filename: string,
    mimeType: string,
  ): void {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

