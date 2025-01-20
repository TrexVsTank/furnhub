package com.furnhub.service;

import com.furnhub.entity.Room;
import java.util.List;

public interface RoomService {
    Room createRoom(Room room);
    Room getRoomById(Long id);
    List<Room> getAllRooms();
    Room updateRoom(Long id, Room updatedRoom);
    void deleteRoom(Long id);
}
