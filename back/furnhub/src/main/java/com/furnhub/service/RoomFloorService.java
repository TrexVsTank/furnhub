package com.furnhub.service;

import com.furnhub.entity.RoomFloor;

import java.util.List;

public interface RoomFloorService {
    RoomFloor createRoomFloor(RoomFloor roomFloor);
    RoomFloor getRoomFloorById(Long id);
    List<RoomFloor> getAllRoomFloorsByRoomId(Long roomId);
    RoomFloor updateRoomFloor(Long id, RoomFloor updatedRoomFloor);
    void deleteRoomFloor(Long id);
}
