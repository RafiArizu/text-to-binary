import { NgModule }     from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { IonicModule }  from '@ionic/angular';

import { SettingsPage }           from './settings.page';
import { SettingsRoutingModule }  from './settings-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SettingsRoutingModule,
  ],
  declarations: [SettingsPage],
})
export class SettingsPageModule {}
