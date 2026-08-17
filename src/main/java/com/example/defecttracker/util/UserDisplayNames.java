package com.example.defecttracker.util;

import com.example.defecttracker.entity.User;

public final class UserDisplayNames {

    private UserDisplayNames() {
    }

    public static String formatInspector(User user) {
        if (user == null) {
            return "Kalite Kontrol";
        }
        return formatInspector(user.getJobTitle(), user.getFullName());
    }

    public static String formatInspector(String jobTitle, String fullName) {
        String title = jobTitle != null ? jobTitle.trim() : "";
        String name = fullName != null ? fullName.trim() : "";
        if (!title.isEmpty() && !name.isEmpty()) {
            return title + " " + name;
        }
        if (!name.isEmpty()) {
            return name;
        }
        if (!title.isEmpty()) {
            return title;
        }
        return "Kalite Kontrol";
    }
}
