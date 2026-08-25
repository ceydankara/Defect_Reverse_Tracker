package com.example.defecttracker.config;

import com.example.defecttracker.entity.User;

import java.util.Set;

public final class RolePermissions {

    private static final Set<String> ANALYSIS_ROLES = Set.of("ADMIN", "QUALITY", "MAINTENANCE");
    private static final Set<String> QUALITY_ROLES = Set.of("ADMIN", "QUALITY");
    private static final Set<String> FIELD_CASE_ROLES = Set.of("ADMIN", "SALES");

    private RolePermissions() {
    }

    public static boolean canAnalyze(User user) {
        return user != null && user.getRole() != null && ANALYSIS_ROLES.contains(user.getRole());
    }

    public static boolean canGradeQuality(User user) {
        return user != null && user.getRole() != null && QUALITY_ROLES.contains(user.getRole());
    }

    public static boolean canManageFieldCases(User user) {
        return user != null && user.getRole() != null && FIELD_CASE_ROLES.contains(user.getRole());
    }

    public static boolean canViewRecentTickets(User user) {
        return user != null && user.getRole() != null && ANALYSIS_ROLES.contains(user.getRole());
    }

    public static boolean canCreateDamageTicket(User user) {
        return user != null && user.getRole() != null;
    }
}
