package com.furnhub.service;

import com.furnhub.entity.RoomFurniture;
import java.util.List;

public interface RoomFurnitureService {
    RoomFurniture createFurniture(RoomFurniture furniture);
    RoomFurniture getFurnitureById(Long id);
    List<RoomFurniture> getAllFurnitureByRoomId(Long roomId);
    RoomFurniture updateFurniture(Long id, RoomFurniture updatedFurniture);
    void deleteFurniture(Long id);
}
