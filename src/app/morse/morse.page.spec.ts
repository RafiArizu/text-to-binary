import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MorsePage } from './morse.page';

describe('MorsePage', () => {
  let component: MorsePage;
  let fixture: ComponentFixture<MorsePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MorsePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
