package com.furnhub.service;

import com.furnhub.entity.Wall;
import java.util.List;

public interface WallService {
    Wall createWall(Wall wall);
    Wall getWallById(Long id);
    List<Wall> getAllWallsByRoomId(Long roomId);
    Wall updateWall(Long id, Wall updatedWall);
    void deleteWall(Long id);
}
