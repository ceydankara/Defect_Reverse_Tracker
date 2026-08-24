import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisResponseDto } from '../../core/models/defect.model';

@Component({
  selector: 'app-analysis-summary',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './analysis-summary.html',
  styleUrl: './analysis-summary.scss',
})
export class AnalysisSummaryComponent {
  @Input({ required: true }) analysis!: AnalysisResponseDto;
  @Input() coilId = '';
  @Input() showFullLink = true;
  @Input() linkQueryParams: Record<string, string> | null = null;

  get analysisLinkParams(): Record<string, string> {
    return this.linkQueryParams ?? { coil: this.coilId, auto: '1' };
  }

  stageClass(status: string): string {
    return status === 'ANOMALI' ? 'anomaly' : 'ok';
  }

  stageLabel(status: string): string {
    return status === 'ANOMALI' ? 'ANOMALİ' : 'OK';
  }

  classificationLabel(): string {
    switch (this.analysis.classificationType) {
      case 'PRODUCTION':
        return 'Üretim Kaynaklı';
      case 'NO_DATA':
        return 'Sensör verisi yok';
      default:
        return 'Lojistik / Dış Etken';
    }
  }
}
