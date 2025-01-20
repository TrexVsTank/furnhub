package com.furnhub.controller;

import com.furnhub.entity.RoomFloor;
import com.furnhub.service.RoomFloorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/room-floor")
public class RoomFloorController {

    private final RoomFloorService roomFloorService;

    public RoomFloorController(RoomFloorService roomFloorService) {
        this.roomFloorService = roomFloorService;
    }

    @PostMapping
    public ResponseEntity<RoomFloor> createRoomFloor(@RequestBody RoomFloor roomFloor) {
        RoomFloor createdRoomFloor = roomFloorService.createRoomFloor(roomFloor);
        return ResponseEntity.ok(createdRoomFloor);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoomFloor> getRoomFloorById(@PathVariable Long id) {
        RoomFloor roomFloor = roomFloorService.getRoomFloorById(id);
        return ResponseEntity.ok(roomFloor);
    }

    @GetMapping("/room/{roomId}")
    public ResponseEntity<List<RoomFloor>> getAllRoomFloorsByRoomId(@PathVariable Long roomId) {
        List<RoomFloor> roomFloors = roomFloorService.getAllRoomFloorsByRoomId(roomId);
        return ResponseEntity.ok(roomFloors);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RoomFloor> updateRoomFloor(@PathVariable Long id, @RequestBody RoomFloor updatedRoomFloor) {
        RoomFloor roomFloor = roomFloorService.updateRoomFloor(id, updatedRoomFloor);
        return ResponseEntity.ok(roomFloor);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoomFloor(@PathVariable Long id) {
        roomFloorService.deleteRoomFloor(id);
        return ResponseEntity.noContent().build();
    }
}
