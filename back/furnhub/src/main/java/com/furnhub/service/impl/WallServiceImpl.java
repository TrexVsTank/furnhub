package com.furnhub.service.impl;

import com.furnhub.entity.Wall;
import com.furnhub.repository.WallRepository;
import com.furnhub.service.WallService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WallServiceImpl implements WallService {

    private final WallRepository wallRepository;

    public WallServiceImpl(WallRepository wallRepository) {
        this.wallRepository = wallRepository;
    }

    @Override
    public Wall createWall(Wall wall) {
        return wallRepository.save(wall);
    }

    @Override
    public Wall getWallById(Long id) {
        return wallRepository.findById(id).orElseThrow(() -> 
            new IllegalArgumentException("Wall not found with id: " + id));
    }

    @Override
    public List<Wall> getAllWallsByRoomId(Long roomId) {
        return wallRepository.findByRoomId(roomId);
    }

    @Override
    public Wall updateWall(Long id, Wall updatedWall) {
        Wall existingWall = getWallById(id);
        existingWall.setStartX(updatedWall.getStartX());
        existingWall.setStartY(updatedWall.getStartY());
        existingWall.setEndX(updatedWall.getEndX());
        existingWall.setEndY(updatedWall.getEndY());
        existingWall.setThickness(updatedWall.getThickness());
        existingWall.setColor(updatedWall.getColor());
        return wallRepository.save(existingWall);
    }

    @Override
    public void deleteWall(Long id) {
        wallRepository.deleteById(id);
    }
}
