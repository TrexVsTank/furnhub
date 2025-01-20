package com.furnhub.controller;

import com.furnhub.entity.ClosedArea;
import com.furnhub.service.ClosedAreaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/closed-areas")
public class ClosedAreaController {

    private final ClosedAreaService closedAreaService;

    public ClosedAreaController(ClosedAreaService closedAreaService) {
        this.closedAreaService = closedAreaService;
    }

    @PostMapping
    public ResponseEntity<ClosedArea> createClosedArea(@RequestBody ClosedArea closedArea) {
        ClosedArea createdClosedArea = closedAreaService.createClosedArea(closedArea);
        return ResponseEntity.ok(createdClosedArea);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClosedArea> getClosedAreaById(@PathVariable Long id) {
        ClosedArea closedArea = closedAreaService.getClosedAreaById(id);
        return ResponseEntity.ok(closedArea);
    }

    @GetMapping("/room/{roomId}")
    public ResponseEntity<List<ClosedArea>> getAllClosedAreasByRoomId(@PathVariable Long roomId) {
        List<ClosedArea> closedAreas = closedAreaService.getAllClosedAreasByRoomId(roomId);
        return ResponseEntity.ok(closedAreas);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClosedArea> updateClosedArea(@PathVariable Long id, @RequestBody ClosedArea updatedClosedArea) {
        ClosedArea closedArea = closedAreaService.updateClosedArea(id, updatedClosedArea);
        return ResponseEntity.ok(closedArea);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClosedArea(@PathVariable Long id) {
        closedAreaService.deleteClosedArea(id);
        return ResponseEntity.noContent().build();
    }
}
