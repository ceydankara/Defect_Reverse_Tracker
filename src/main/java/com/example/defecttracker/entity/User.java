package com.example.defecttracker.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    /** Örn: Kalite Uzmanı, Kalite Müdürü, Satış Temsilcisi */
    @Column(name = "job_title", length = 80)
    private String jobTitle;

    @Column(nullable = false, length = 30)
    private String role;

    @Column(nullable = false)
    private boolean active = true;
}
