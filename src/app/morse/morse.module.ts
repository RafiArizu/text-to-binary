import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MorseRoutingModule } from './morse-routing.module';

import { MorsePage } from './morse.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MorseRoutingModule
  ],
  declarations: [MorsePage]
})
export class MorsePageModule {}
