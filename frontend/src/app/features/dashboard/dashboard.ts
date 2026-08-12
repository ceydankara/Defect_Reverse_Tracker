import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
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

  stats: DashboardStats | null = null;
  loading = true;
  errorMessage = '';

  private stageChart: Chart | null = null;
  private defectChart: Chart | null = null;
  private chartsReady = false;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.renderChartsIfReady();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Panel verileri yüklenemedi.';
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
  }

  private renderChartsIfReady(): void {
    if (!this.chartsReady || !this.stats) return;

    this.stageChart?.destroy();
    this.defectChart?.destroy();

    this.renderBarChart(
      this.stageChartRef,
      this.stats.anomaliesByStage.map((x) => x.label),
      this.stats.anomaliesByStage.map((x) => x.count),
      '#ff4d6d',
      (chart) => (this.stageChart = chart),
    );

    this.renderBarChart(
      this.defectChartRef,
      this.stats.defectsByCode.map((x) => x.label),
      this.stats.defectsByCode.map((x) => x.count),
      '#1a6dff',
      (chart) => (this.defectChart = chart),
    );
  }

  private renderBarChart(
    ref: ElementRef<HTMLCanvasElement>,
    labels: string[],
    values: number[],
    color: string,
    assign: (chart: Chart) => void,
  ): void {
    if (!ref?.nativeElement || !labels.length) return;

    const ctx = ref.nativeElement.getContext('2d');
    if (!ctx) return;

    assign(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: color,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#8a9bb5' }, grid: { display: false } },
            y: { ticks: { color: '#8a9bb5', precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          },
        },
      }),
    );
  }
}
