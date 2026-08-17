import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardStats } from '../../core/models/auth.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stageChart') stageChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('defectChart') defectChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sourceChart') sourceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gradeChart') gradeChartRef!: ElementRef<HTMLCanvasElement>;

  stats: DashboardStats | null = null;
  loading = true;
  errorMessage = '';
  accessDeniedMessage = '';

  private stageChart: Chart | null = null;
  private defectChart: Chart | null = null;
  private sourceChart: Chart | null = null;
  private gradeChart: Chart | null = null;
  private chartsReady = false;

  constructor(
    private dashboardService: DashboardService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('denied') === 'role') {
        this.accessDeniedMessage = 'Bu sayfaya erişim yetkiniz yok. Kalite paneli yalnızca kalite ve yönetici hesapları içindir.';
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { denied: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });

    this.dashboardService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.renderChartsIfReady();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Panel verileri yüklenemedi. Backend çalışıyor mu kontrol edin.';
      },
    });
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    this.renderChartsIfReady();
  }

  ngOnDestroy(): void {
    this.stageChart?.destroy();
    this.defectChart?.destroy();
    this.sourceChart?.destroy();
    this.gradeChart?.destroy();
  }

  barPercent(value: number, total: number): number {
    if (!total) return 0;
    return Math.max(4, (value / total) * 100);
  }

  sourcePercent(value: number): number {
    if (!this.stats) return 0;
    const total = this.stats.productionAnomalyCount + this.stats.logisticsCaseCount;
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  formatDefectCode(code: string): string {
    return code.replace(/^DEF_/, '').replace(/_/g, ' ');
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  gradeChipClass(label: string): string {
    if (label.includes('Müşteri')) return 'chip-customer';
    if (label.includes('Hurda')) return 'chip-scrap';
    return 'chip-second';
  }

  private renderChartsIfReady(): void {
    if (!this.chartsReady || !this.stats) return;

    this.stageChart?.destroy();
    this.defectChart?.destroy();
    this.sourceChart?.destroy();
    this.gradeChart?.destroy();

    if (this.stats.anomaliesByStage.length) {
      this.renderBarChart(
        this.stageChartRef,
        this.stats.anomaliesByStage.map((x) => x.label),
        this.stats.anomaliesByStage.map((x) => x.count),
        ['#ff4d6d', '#ff758f', '#ff8fa3', '#ffb3c1'],
        (chart) => (this.stageChart = chart),
        true,
      );
    }

    if (this.stats.defectsByCode.length) {
      this.renderBarChart(
        this.defectChartRef,
        this.stats.defectsByCode.map((x) => this.formatDefectCode(x.label)),
        this.stats.defectsByCode.map((x) => x.count),
        ['#1a6dff', '#3b82f6', '#60a5fa', '#93c5fd'],
        (chart) => (this.defectChart = chart),
        true,
      );
    }

    const prod = this.stats.productionAnomalyCount;
    const log = this.stats.logisticsCaseCount;
    if (prod + log > 0) {
      this.renderDoughnutChart(
        this.sourceChartRef,
        ['Üretim', 'Lojistik'],
        [prod, log],
        ['#ff4d6d', '#b794f6'],
        (chart) => (this.sourceChart = chart),
      );
    }

    if (this.stats.qualityByGrade?.length) {
      this.renderDoughnutChart(
        this.gradeChartRef,
        this.stats.qualityByGrade.map((x) => x.label),
        this.stats.qualityByGrade.map((x) => x.count),
        ['#10b981', '#f59e0b', '#ef4444'],
        (chart) => (this.gradeChart = chart),
      );
    }
  }

  private renderBarChart(
    ref: ElementRef<HTMLCanvasElement>,
    labels: string[],
    values: number[],
    colors: string[],
    assign: (chart: Chart) => void,
    horizontal = false,
  ): void {
    if (!ref?.nativeElement || !labels.length) return;

    const ctx = ref.nativeElement.getContext('2d');
    if (!ctx) return;

    const bgColors = values.map((_, i) => colors[i % colors.length]);

    assign(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: bgColors,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          indexAxis: horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: { color: '#64748b', font: { size: 11 } },
              grid: { display: false },
            },
            y: {
              ticks: { color: '#64748b', precision: 0, font: { size: 11 } },
              grid: { color: 'rgba(15, 23, 42, 0.08)' },
            },
          },
        },
      }),
    );
  }

  private renderDoughnutChart(
    ref: ElementRef<HTMLCanvasElement>,
    labels: string[],
    values: number[],
    colors: string[],
    assign: (chart: Chart) => void,
  ): void {
    if (!ref?.nativeElement || !labels.length) return;

    const ctx = ref.nativeElement.getContext('2d');
    if (!ctx) return;

    assign(
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      }),
    );
  }
}
