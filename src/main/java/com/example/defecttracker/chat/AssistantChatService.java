package com.example.defecttracker.chat;

import com.example.defecttracker.dto.ChatRequestDto;
import com.example.defecttracker.dto.ChatResponseDto;
import com.example.defecttracker.dto.ChatTurnDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class AssistantChatService {

    private static final int MAX_HISTORY = 10;
    private static final String SYSTEM_PROMPT = """
            Sen çelik bobin hasar takip sisteminin kalite asistanısın.
            Operatörlere resmi, doğru Türkçe yaz. Sayı, yüzde ve sınıf uydurma.

            Araç seçimi:
            - CAPA, düzeltici, önleyici, 8D, "analiz metni yaz" → get_capa_brief. get_coil_analysis yeterli değil.
            - Kısa hasar özeti / "neden hurda" → get_coil_analysis
            - "bekleyen", "kalite kuyruğu" → list_quality_queue(status=pending). Hurda aracını çağırma.
            - "karar verilen" → list_quality_queue(status=decided)
            - Açıkça "hurda" → list_scrap_recommended_coils
            - Açık saha dosyaları → list_open_field_cases
            - Panel özeti → get_dashboard_stats

            CAPA metni (get_capa_brief sonrası, kopyalanabilir taslak):
            - Başlık: **CAPA taslak — {bobin}**
            - Bölümler, her biri **Başlık** satırı + 2-4 cümle:
              1. Olay özeti (müşteri, dosya no, kusur, tarih)
              2. Problem tanımı
              3. Kanıt ve tespit (sensör, sapma %, ekipman — araçtaki rakamlar)
              4. Kök neden
              5. Düzeltici faaliyet (hemen: izolasyon / müşteri / hat)
              6. Önleyici faaliyet (prosedür, bakım, KK kaçırma)
              7. Sorumluluk (üretim / lojistik / müşteri % — araçtaki formül)
              8. Doğrulama ve kapanış (ölçüt, sahip rol)
            - "Analiz sonuçları aşağıdadır" yazma. Hasar Kaynağı / Kalite Önerisi etiket listesi basma.
            - Saha dosyası yoksa bunu bir cümleyle belirt; uydurma müşteri yazma.
            - Taslak olduğunu, kayda işlenmediğini sonda bir cümleyle söyle.

            Diğer cevaplar:
            - Kuyruk: önce sayı + filtre, sonra bobin · kusur · durum.
            - Yazım hatalarını tolere et. Yetki yoksa kısaca söyle.
            """;

    private final ObjectProvider<ChatModel> chatModels;
    private final AssistantChatTools tools;
    private volatile ChatClient chatClient;

    public AssistantChatService(ObjectProvider<ChatModel> chatModels, AssistantChatTools tools) {
        this.chatModels = chatModels;
        this.tools = tools;
    }

    public boolean isAvailable() {
        return chatClient() != null;
    }

    public ChatResponseDto reply(ChatRequestDto request) {
        ChatClient client = chatClient();
        if (client == null) {
            throw new AssistantUnavailableException();
        }

        String message = request == null || request.message() == null ? "" : request.message().trim();
        if (message.isBlank()) {
            return new ChatResponseDto("Bir soru yazın; örneğin «9080 analizi» veya «açık saha dosyaları».", true);
        }

        try {
            var spec = client.prompt();
            List<Message> prior = toMessages(request.history());
            if (!prior.isEmpty()) {
                spec = spec.messages(prior);
            }
            String reply = spec.user(message).call().content();
            if (reply == null || reply.isBlank()) {
                return new ChatResponseDto("Asistan boş yanıt döndü. Soruyu biraz daha somut yazıp tekrar deneyin.", true);
            }
            return new ChatResponseDto(reply.trim(), true);
        } catch (RuntimeException ex) {
            log.warn("Kalite asistanı yanıt üretemedi: {}", explain(ex));
            throw ex;
        }
    }

    private ChatClient chatClient() {
        ChatClient existing = this.chatClient;
        if (existing != null) {
            return existing;
        }
        ChatModel model = chatModels.getIfAvailable();
        if (model == null) {
            return null;
        }
        synchronized (this) {
            if (this.chatClient == null) {
                this.chatClient = ChatClient.builder(model)
                        .defaultSystem(SYSTEM_PROMPT)
                        .defaultTools(tools)
                        .build();
            }
            return this.chatClient;
        }
    }

    private List<Message> toMessages(List<ChatTurnDto> history) {
        if (history == null || history.isEmpty()) {
            return List.of();
        }
        int from = Math.max(0, history.size() - MAX_HISTORY);
        List<Message> messages = new ArrayList<>();
        for (ChatTurnDto turn : history.subList(from, history.size())) {
            if (turn == null || turn.content() == null || turn.content().isBlank()) {
                continue;
            }
            if ("assistant".equalsIgnoreCase(turn.role())) {
                messages.add(new AssistantMessage(turn.content()));
            } else {
                messages.add(new UserMessage(turn.content()));
            }
        }
        return messages;
    }

    private static String explain(Throwable error) {
        StringBuilder text = new StringBuilder();
        Throwable current = error;
        while (current != null) {
            if (text.length() > 0) {
                text.append(" <- ");
            }
            text.append(current.getClass().getSimpleName());
            if (current.getMessage() != null) {
                text.append(": ").append(current.getMessage());
            }
            current = current.getCause();
        }
        return text.toString();
    }
}
