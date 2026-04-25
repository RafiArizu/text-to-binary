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
  isVibrationOn:    boolean   = true;
  showPrivacyModal: boolean   = false;

  // Versi aplikasi
  readonly appVersion = '1.0-Beta';

  // URL Play Store (ganti dengan URL aplikasi Anda)
  readonly playStoreUrl = 'https://play.google.com/store/apps/details?id=com.enigmaengine.app';

  constructor(
    private renderer: Renderer2,
  ) {}

  // ─── LIFECYCLE ──────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.loadPreferences();
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
