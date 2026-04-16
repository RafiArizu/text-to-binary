// ============================================================
// SETTINGS PAGE — THE ENIGMA ENGINE
// Fitur: Tema Layar, Getaran Global, Kebijakan Privasi, Beri Nilai
// ============================================================

import { Component, OnInit, Renderer2 } from '@angular/core';
import { ModalController }              from '@ionic/angular';
import { Preferences }                  from '@capacitor/preferences';
import { Haptics, ImpactStyle }         from '@capacitor/haptics';

// Tipe pilihan tema
export type AppTheme = 'Terang' | 'Gelap' | 'Bawaan Sistem';

@Component({
  selector:    'app-settings',
  templateUrl: './settings.page.html',
  styleUrls:   ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {

  // ── STATE ────────────────────────────────────────────────
  selectedTheme:    AppTheme = 'Terang';
  themeOptions:     AppTheme[] = ['Terang', 'Gelap', 'Bawaan Sistem'];
  isVibrationOn:    boolean   = true;
  showPrivacyModal: boolean   = false;

  // Versi aplikasi
  readonly appVersion = '4.2.1-Alpha';

  // URL Play Store (ganti dengan URL aplikasi Anda)
  readonly playStoreUrl = 'https://play.google.com/store/apps/details?id=com.enigmaengine.app';

  constructor(
    private renderer: Renderer2,
  ) {}

  // ─── LIFECYCLE ──────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.loadPreferences();
    this.applyTheme(this.selectedTheme);
  }

  // ─── LOAD PREFERENCES ───────────────────────────────────
  private async loadPreferences(): Promise<void> {
    try {
      const theme   = await Preferences.get({ key: 'app_theme' });
      const vibrate = await Preferences.get({ key: 'app_vibration' });

      if (theme.value) {
        this.selectedTheme = theme.value as AppTheme;
      }
      if (vibrate.value !== null) {
        this.isVibrationOn = vibrate.value === 'true';
      }
    } catch {}
  }

  // ─── TEMA LAYAR ─────────────────────────────────────────
  async onThemeChange(): Promise<void> {
    this.applyTheme(this.selectedTheme);
    try {
      await Preferences.set({ key: 'app_theme', value: this.selectedTheme });
    } catch {}
  }

  private applyTheme(theme: AppTheme): void {
    const body = document.body;

    // Hapus semua kelas tema sebelumnya
    body.classList.remove('theme-dark', 'theme-light', 'theme-system');

    if (theme === 'Gelap') {
      body.classList.add('theme-dark');
    } else if (theme === 'Terang') {
      body.classList.add('theme-light');
    } else {
      // Bawaan Sistem — deteksi otomatis
      body.classList.add('theme-system');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        body.classList.add('theme-dark');
      }
    }
  }

  // ─── GETARAN GLOBAL ─────────────────────────────────────
  async onVibrationToggle(): Promise<void> {
    // Feedback getar singkat saat sakelar diaktifkan
    if (this.isVibrationOn) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {}
    }
    try {
      await Preferences.set({ key: 'app_vibration', value: String(this.isVibrationOn) });
    } catch {}
  }

  // ─── KEBIJAKAN PRIVASI ──────────────────────────────────
  openPrivacyPolicy(): void {
    this.showPrivacyModal = true;
  }

  closePrivacyModal(): void {
    this.showPrivacyModal = false;
  }

  // ─── BERI NILAI ─────────────────────────────────────────
  onRateApp(): void {
    // Buka Play Store di browser / WebView
    window.open(this.playStoreUrl, '_blank');
  }
}
