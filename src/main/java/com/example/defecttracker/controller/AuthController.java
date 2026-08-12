package com.example.defecttracker.controller;

import com.example.defecttracker.dto.LoginRequestDto;
import com.example.defecttracker.dto.LoginResponseDto;
import com.example.defecttracker.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public LoginResponseDto login(@RequestBody LoginRequestDto request) {
        return authService.login(request.getUsername(), request.getPassword())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Geçersiz kullanıcı adı veya şifre"));
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    @PostMapping("/logout")
    public Map<String, String> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        authService.logout(extractToken(authorization));
        return Map.of("message", "Çıkış yapıldı");
    }

    @GetMapping("/me")
    public LoginResponseDto me(@RequestHeader("Authorization") String authorization) {
        return authService.validateToken(extractToken(authorization))
                .map(user -> new LoginResponseDto(extractToken(authorization), user.getUsername(), user.getFullName(), user.getRole()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Oturum geçersiz"));
    }

    private String extractToken(String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        return authorization;
    }
}
