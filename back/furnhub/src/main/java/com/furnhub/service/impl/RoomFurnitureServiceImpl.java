package com.furnhub.service.impl;

import com.furnhub.entity.RoomFurniture;
import com.furnhub.repository.RoomFurnitureRepository;
import com.furnhub.service.RoomFurnitureService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RoomFurnitureServiceImpl implements RoomFurnitureService {

    private final RoomFurnitureRepository furnitureRepository;

    public RoomFurnitureServiceImpl(RoomFurnitureRepository furnitureRepository) {
        this.furnitureRepository = furnitureRepository;
    }

    @Override
    public RoomFurniture createFurniture(RoomFurniture furniture) {
        return furnitureRepository.save(furniture);
    }

    @Override
    public RoomFurniture getFurnitureById(Long id) {
        return furnitureRepository.findById(id).orElseThrow(() -> 
            new IllegalArgumentException("Furniture not found with id: " + id));
    }

    @Override
    public List<RoomFurniture> getAllFurnitureByRoomId(Long roomId) {
        return furnitureRepository.findByRoomId(roomId);
    }

    @Override
    public RoomFurniture updateFurniture(Long id, RoomFurniture updatedFurniture) {
        RoomFurniture existingFurniture = getFurnitureById(id);
        existingFurniture.setAssetName(updatedFurniture.getAssetName());
        existingFurniture.setPositionX(updatedFurniture.getPositionX());
        existingFurniture.setPositionY(updatedFurniture.getPositionY());
        existingFurniture.setRotation(updatedFurniture.getRotation());
        existingFurniture.setScaleX(updatedFurniture.getScaleX());
        existingFurniture.setScaleY(updatedFurniture.getScaleY());
        return furnitureRepository.save(existingFurniture);
    }

    @Override
    public void deleteFurniture(Long id) {
        furnitureRepository.deleteById(id);
    }
}
