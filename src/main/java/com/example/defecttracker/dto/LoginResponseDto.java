package com.example.defecttracker.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponseDto {
    private String token;
    private String username;
    private String fullName;
    private String jobTitle;
    private String role;
}
