package com.example.defecttracker.service;

import com.example.defecttracker.dto.LoginResponseDto;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final long TOKEN_TTL_SECONDS = 8 * 60 * 60;

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, SessionEntry> sessions = new ConcurrentHashMap<>();

    public Optional<LoginResponseDto> login(String username, String password) {
        return userRepository.findByUsernameAndActiveTrue(username.trim())
                .filter(user -> passwordEncoder.matches(password, user.getPasswordHash()))
                .map(user -> {
                    String token = UUID.randomUUID().toString();
                    sessions.put(token, new SessionEntry(user.getUsername(), Instant.now().plusSeconds(TOKEN_TTL_SECONDS)));
                    return new LoginResponseDto(
                            token,
                            user.getUsername(),
                            user.getFullName(),
                            user.getJobTitle(),
                            user.getRole());
                });
    }

    public Optional<User> validateToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        SessionEntry session = sessions.get(token);
        if (session == null || session.expiresAt().isBefore(Instant.now())) {
            sessions.remove(token);
            return Optional.empty();
        }
        return userRepository.findByUsernameAndActiveTrue(session.username());
    }

    public void logout(String token) {
        if (token != null) {
            sessions.remove(token);
        }
    }

    public String hashPassword(String raw) {
        return passwordEncoder.encode(raw);
    }

    private record SessionEntry(String username, Instant expiresAt) {}
}
