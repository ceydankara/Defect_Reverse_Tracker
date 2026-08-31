import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AssistantChatService, ChatTurn } from '../../core/services/assistant-chat.service';

interface Suggestion {
  label: string;
  hint: string;
  prompt: string;
}

interface MessageBlock {
  type: 'p' | 'li' | 'h' | 'kv';
  text: string;
  label?: string;
}

@Component({
  selector: 'app-assistant-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assistant-chat.html',
  styleUrl: './assistant-chat.scss',
})
export class AssistantChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('thread') threadRef?: ElementRef<HTMLDivElement>;
  @ViewChild('composer') composerRef?: ElementRef<HTMLTextAreaElement>;

  open = false;
  draft = '';
  loading = false;
  available: boolean | null = null;
  statusMessage = '';
  messages: ChatTurn[] = [];

  private shouldScroll = false;
  private pendingFocus = false;

  constructor(
    private chat: AssistantChatService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.chat.status().subscribe({
      next: (status) => {
        this.available = status.available;
        this.statusMessage = status.message;
      },
      error: () => {
        this.available = false;
        this.statusMessage = 'Asistan servisine ulaşılamadı.';
      },
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.shouldScroll = false;
      const el = this.threadRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
    if (this.pendingFocus) {
      this.pendingFocus = false;
      this.composerRef?.nativeElement.focus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.open = false;
    }
  }

  get statusLabel(): string {
    if (this.available === false) {
      return 'Çevrimdışı';
    }
    if (this.available) {
      return 'Çevrimiçi';
    }
    return 'Bağlanıyor';
  }

  get userInitial(): string {
    return this.auth.user()?.fullName?.charAt(0)?.toUpperCase() || 'S';
  }

  get composerDisabled(): boolean {
    return this.loading || this.available === false;
  }

  suggestions(): Suggestion[] {
    const items: Suggestion[] = [
      {
        label: 'Panel özeti',
        hint: 'KPI ve anomali görünümü',
        prompt: 'Ana panel özetini kısaca anlat.',
      },
    ];
    if (this.auth.canAnalyze()) {
      items.push({
        label: '9080 analizi',
        hint: 'Kök neden ve kalite önerisi',
        prompt: '9080 bobininin hasar analizini açıkla.',
      });
      items.push({
        label: '9080 CAPA taslağı',
        hint: 'Düzeltici / önleyici metin',
        prompt: '9080 numaralı bobin için CAPA analiz metni yaz.',
      });
    }
    if (this.auth.canManageFieldCases()) {
      items.push({
        label: 'Açık saha dosyaları',
        hint: 'Müşteri şikâyet kuyruğu',
        prompt: 'Açık müşteri / saha hasar dosyalarını listele.',
      });
    }
    if (this.auth.canGradeQuality()) {
      items.push({
        label: 'Bekleyen kuyruk',
        hint: 'Karar bekleyen bobinler',
        prompt: 'Fabrika kalite kuyruğunda bekleyen bobinleri sırala.',
      });
    }
    return items;
  }

  formatMessage(content: string): MessageBlock[] {
    const blocks: MessageBlock[] = [];
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        continue;
      }
      const heading = line.match(/^\*\*(.+?)\*\*\s*$/);
      if (heading) {
        blocks.push({ type: 'h', text: heading[1] });
        continue;
      }
      const kv = line.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.*)$/);
      if (kv) {
        blocks.push({ type: 'kv', label: kv[1], text: kv[2] });
        continue;
      }
      const labeled = line.match(/^([^:]{2,40}):\s+(.+)$/);
      if (labeled && !line.startsWith('http')) {
        blocks.push({ type: 'kv', label: labeled[1], text: labeled[2] });
        continue;
      }
      const bullet = line.match(/^([*\-•]|\d+[.)])\s+(.*)$/);
      const text = this.stripMarkdown(bullet ? bullet[2] : line);
      if (!text) {
        continue;
      }
      blocks.push({ type: bullet ? 'li' : 'p', text });
    }
    return blocks.length ? blocks : [{ type: 'p', text: content }];
  }

  copyMessage(content: string): void {
    void navigator.clipboard?.writeText(content);
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.shouldScroll = true;
      this.pendingFocus = true;
    }
  }

  clearThread(): void {
    this.messages = [];
    this.draft = '';
    this.pendingFocus = true;
  }

  sendSuggestion(prompt: string): void {
    if (this.composerDisabled) {
      return;
    }
    this.draft = prompt;
    this.send();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.composerDisabled) {
      return;
    }

    this.messages = [...this.messages, { role: 'user', content: text }];
    this.draft = '';
    this.loading = true;
    this.shouldScroll = true;

    const history = this.messages.slice(0, -1);
    this.chat.send(text, history).subscribe({
      next: (res) => {
        this.available = res.available;
        this.messages = [...this.messages, { role: 'assistant', content: res.reply }];
        this.loading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        const fallback =
          err?.error?.message ||
          (err?.status === 0
            ? 'Backend servisine bağlanılamadı.'
            : 'Asistan yanıt veremedi. Biraz sonra tekrar deneyin.');
        this.available = err?.status === 503 ? false : this.available;
        this.messages = [...this.messages, { role: 'assistant', content: fallback }];
        this.loading = false;
        this.shouldScroll = true;
      },
    });
  }

  private stripMarkdown(value: string): string {
    return value.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  }
}
