package com.example.defecttracker.config;

import com.example.defecttracker.entity.User;
import com.example.defecttracker.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private static final Set<String> ANALYSIS_ROLES = Set.of("ADMIN", "QUALITY", "MAINTENANCE");
    private static final Set<String> QUALITY_ROLES = Set.of("ADMIN", "QUALITY");

    private final AuthService authService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.startsWith("Bearer ")
                ? authorization.substring(7)
                : authorization;

        var userOpt = authService.validateToken(token);
        if (userOpt.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Yetkisiz erişim. Lütfen giriş yapın.\"}");
            return false;
        }

        User user = userOpt.get();
        request.setAttribute("currentUser", user);

        String path = request.getRequestURI();
        if (path.startsWith("/api/analysis") && !hasAnyRole(user, ANALYSIS_ROLES)) {
            return forbidden(response, "Hasar analizi için yetkiniz yok.");
        }
        if (path.startsWith("/api/quality") && !hasAnyRole(user, QUALITY_ROLES)) {
            return forbidden(response, "Kalite sınıflandırma için yetkiniz yok.");
        }
        if (path.startsWith("/api/tickets/queue") && !hasAnyRole(user, QUALITY_ROLES)) {
            return forbidden(response, "Kalite kuyruğu için yetkiniz yok.");
        }

        return true;
    }

    private boolean hasAnyRole(User user, Set<String> roles) {
        return user.getRole() != null && roles.contains(user.getRole());
    }

    private boolean forbidden(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
        return false;
    }
}
