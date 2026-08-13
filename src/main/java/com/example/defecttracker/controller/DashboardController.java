package com.example.defecttracker.controller;

import com.example.defecttracker.dto.DashboardStatsDto;
import com.example.defecttracker.entity.User;
import com.example.defecttracker.service.DashboardService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public DashboardStatsDto getStats(HttpServletRequest request) {
        User user = (User) request.getAttribute("currentUser");
        return dashboardService.getStats(user);
    }
}
