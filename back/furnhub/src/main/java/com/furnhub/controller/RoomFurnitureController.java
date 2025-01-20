package com.furnhub.controller;

import com.furnhub.entity.RoomFurniture;
import com.furnhub.service.RoomFurnitureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/room-furniture")
public class RoomFurnitureController {

    private final RoomFurnitureService roomFurnitureService;

    public RoomFurnitureController(RoomFurnitureService roomFurnitureService) {
        this.roomFurnitureService = roomFurnitureService;
    }

    @PostMapping
    public ResponseEntity<RoomFurniture> createFurniture(@RequestBody RoomFurniture furniture) {
        RoomFurniture createdFurniture = roomFurnitureService.createFurniture(furniture);
        return ResponseEntity.ok(createdFurniture);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoomFurniture> getFurnitureById(@PathVariable Long id) {
        RoomFurniture furniture = roomFurnitureService.getFurnitureById(id);
        return ResponseEntity.ok(furniture);
    }

    @GetMapping("/room/{roomId}")
    public ResponseEntity<List<RoomFurniture>> getAllFurnitureByRoomId(@PathVariable Long roomId) {
        List<RoomFurniture> furnitureList = roomFurnitureService.getAllFurnitureByRoomId(roomId);
        return ResponseEntity.ok(furnitureList);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RoomFurniture> updateFurniture(@PathVariable Long id, @RequestBody RoomFurniture updatedFurniture) {
        RoomFurniture furniture = roomFurnitureService.updateFurniture(id, updatedFurniture);
        return ResponseEntity.ok(furniture);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFurniture(@PathVariable Long id) {
        roomFurnitureService.deleteFurniture(id);
        return ResponseEntity.noContent().build();
    }
}
