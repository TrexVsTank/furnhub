package com.furnhub.controller;

import com.furnhub.entity.Wall;
import com.furnhub.service.WallService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/walls")
public class WallController {

    private final WallService wallService;

    public WallController(WallService wallService) {
        this.wallService = wallService;
    }

    @PostMapping
    public ResponseEntity<Wall> createWall(@RequestBody Wall wall) {
        Wall createdWall = wallService.createWall(wall);
        return ResponseEntity.ok(createdWall);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Wall> getWallById(@PathVariable Long id) {
        Wall wall = wallService.getWallById(id);
        return ResponseEntity.ok(wall);
    }

    @GetMapping("/room/{roomId}")
    public ResponseEntity<List<Wall>> getAllWallsByRoomId(@PathVariable Long roomId) {
        List<Wall> walls = wallService.getAllWallsByRoomId(roomId);
        return ResponseEntity.ok(walls);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Wall> updateWall(@PathVariable Long id, @RequestBody Wall updatedWall) {
        Wall wall = wallService.updateWall(id, updatedWall);
        return ResponseEntity.ok(wall);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWall(@PathVariable Long id) {
        wallService.deleteWall(id);
        return ResponseEntity.noContent().build();
    }
}
