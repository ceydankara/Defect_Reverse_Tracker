import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DefectService } from '../../core/services/defect'; // Path'i kendi proje yapınıza göre kontrol edin
import { AnalysisResponseDto } from '../../core/models/defect.model';

type StageStatus = 'OK' | 'BEKLEMEDE' | 'ANOMALİ';

interface StageCard {
  title: string;
  status: StageStatus;
  value: string;
  delta: string;
}

interface SensorCard {
  title: string;
  value: string;
  unit: string;
  delta: string;
  state: string;
  stageName?: string; // Sensörün hangi aşamaya ait olduğunu belirtir
  spark: 'amber' | 'cyan' | 'violet' | 'teal';
}

interface ResultRow {
  label: string;
  value: string;
}

@Component({
  selector: 'app-defect-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './defect-tracker.html',
  styleUrl: './defect-tracker.scss'
})
export class DefectTrackerComponent {
  batchId: string = 'BOBIN-2026-9041';
  defectType: string = 'DEF_EDGE';

  isAnalyzed: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  // Filtreleme için durum takibi
  selectedStageName: string | null = null;
  allSensors: SensorCard[] = [];      // Backend'den gelen tüm sensörler (16 adet)
  filteredSensors: SensorCard[] = []; // Ekranda listelenen filtrelenmiş sensörler

  stages: StageCard[] = [
    { title: 'Çelikhane', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' },
    { title: 'Sıcak Haddehane', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' },
    { title: 'Asitleme', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' },
    { title: 'Soğuk Haddehane', status: 'BEKLEMEDE', value: '4 sensör', delta: '0%' }
  ];

  indicators: string[] = [];
  rootCauses: ResultRow[] = [];

  constructor(private defectService: DefectService) {}

  onStartAnalysis(): void {
    if (!this.batchId || this.batchId.trim() === '') {
      alert('Lütfen bir Bobin ID giriniz!');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.selectedStageName = null; // Analiz her başladığında filtreyi sıfırla

    this.defectService.getAnalysis(this.batchId.trim()).subscribe({
      next: (data: AnalysisResponseDto) => {
        console.log('Backend Response:', data);

        if (!data) {
          this.errorMessage = 'Bobin bulundu ancak analiz verisi boş geldi.';
          this.isLoading = false;
          return;
        }

        this.defectType = data.defectCode || this.defectType;

        // 1. Üretim Hattı Aşamaları Güncelleme
        if (data.stages && data.stages.length > 0) {
          this.stages = data.stages.map(s => ({
            title: s.stageName,
            status: (s.status === 'ANOMALI' ? 'ANOMALİ' : 'OK') as StageStatus,
            value: `${s.sensorCount || 4} sensör`,
            delta: s.status === 'ANOMALI' ? 'Anomali Sapması' : 'Nominal'
          }));
        }

        // 2. Kök Neden ve Aksiyon Güncelleme
        if (data.rootCause) {
          this.rootCauses = [
            { label: 'Equipment / Cihaz', value: data.rootCause.equipment || '-' },
            { label: 'Hata / Arıza Kaynağı', value: data.rootCause.faultSource || '-' },
            { label: 'Güven Oranı', value: `%${data.rootCause.confidenceRate || 0}` },
            { label: 'Üretim Etkisi', value: `%${data.rootCause.productionImpactPct || 0}` },
            { label: 'Lojistik Etkisi', value: `%${data.rootCause.logisticImpactPct || 0}` }
          ];

          this.indicators = [
            data.rootCause.detectionDetail || 'Tespit detayı bulunamadı.',
            `Tavsiye Edilen Aksiyon: ${data.rootCause.recommendedAction || 'Aksiyon yok.'}`
          ];
        }

        // 3. Sensör Kartları Güncelleme ve Hafızaya Alma
        if (data.sensorSummaries && data.sensorSummaries.length > 0) {
          const colors: ('amber' | 'cyan' | 'violet' | 'teal')[] = ['amber', 'cyan', 'violet', 'teal'];

          this.allSensors = data.sensorSummaries.map((s, index) => ({
            title: s.sensorKey,
            value: s.lastActualValue !== undefined && s.lastActualValue !== null ? s.lastActualValue.toString() : '0',
            unit: 'değer',
            delta: `${s.percentageDeviation && s.percentageDeviation > 0 ? '+' : ''}${s.percentageDeviation || 0}%`,
            state: s.status === 'ANOMALI' ? 'Anormal' : 'Normal',
            stageName: (s as any).stageName, // (s as any) ile TypeScript tip hatası engellendi
            spark: colors[index % colors.length]
          }));

          // İlk analiz açılışında tüm sensörleri yükle
          this.filteredSensors = [...this.allSensors];
        }

        this.isAnalyzed = true;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('API Hatası:', err);
        this.errorMessage = 'Girdiğiniz Bobin ID veritabanında bulunamadı veya backend servisine erişilemedi!';
        this.isAnalyzed = false;
        this.isLoading = false;
      }
    });
  }

  // AŞAMA KARTLARINA TIKLANDIĞINDA SENSÖRLERİ AKILLI FİLTRELEYEN METOD
  selectStage(stageTitle: string): void {
    if (!this.isAnalyzed) return; // Analiz yapılmadıysa tıklamayı pasif tut

    // Aynı aşamaya tekrar tıklandığında filtreyi kaldırır (Tüm sensörleri gösterir)
    if (this.selectedStageName === stageTitle) {
      this.selectedStageName = null;
      this.filteredSensors = [...this.allSensors];
      return;
    }

    this.selectedStageName = stageTitle;

    // 1. Yaklaşım: Doğrudan stageName eşleşmesi kontrol edilir
    let matches = this.allSensors.filter(sensor =>
      sensor.stageName && sensor.stageName.toLowerCase().trim() === stageTitle.toLowerCase().trim()
    );

    // 2. Yaklaşım: Eğer DTO'dan stageName boş geldiyse, sensör başlığındaki anahtar kelimelere göre filtrele
    if (matches.length === 0) {
      const titleLower = stageTitle.toLowerCase();

      matches = this.allSensors.filter(sensor => {
        const sKey = sensor.title.toLowerCase();

        if (titleLower.includes('çelikhane')) {
          return sKey.includes('fırın') || sKey.includes('pota') || sKey.includes('argon') || sKey.includes('cüruf') || sKey.includes('sıcaklık');
        } else if (titleLower.includes('sıcak')) {
          return sKey.includes('merdane') || sKey.includes('şerit') || sKey.includes('rulman') || sKey.includes('emülsiyon') || sKey.includes('kuvvet');
        } else if (titleLower.includes('asitleme')) {
          return sKey.includes('asit') || sKey.includes('tank') || sKey.includes('ph') || sKey.includes('banyo') || sKey.includes('sıyırıcı');
        } else if (titleLower.includes('soğuk')) {
          return sKey.includes('gerginlik') || sKey.includes('sac') || sKey.includes('kalınlık') || sKey.includes('x-ray') || sKey.includes('yağlama');
        }

        return sKey.includes(titleLower);
      });
    }

    // Filtrelenen sensör varsa gösterir, yoksa güvenlik amacıyla tüm sensörleri listeler
    this.filteredSensors = matches.length > 0 ? matches : [...this.allSensors];
  }
}
