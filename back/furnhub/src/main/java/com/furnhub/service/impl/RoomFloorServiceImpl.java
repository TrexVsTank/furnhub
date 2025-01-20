package com.furnhub.service.impl;

import com.furnhub.entity.RoomFloor;
import com.furnhub.repository.RoomFloorRepository;
import com.furnhub.service.RoomFloorService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RoomFloorServiceImpl implements RoomFloorService {

    private final RoomFloorRepository floorRepository;

    public RoomFloorServiceImpl(RoomFloorRepository floorRepository) {
        this.floorRepository = floorRepository;
    }

    @Override
    public RoomFloor createRoomFloor(RoomFloor roomFloor) {
        return floorRepository.save(roomFloor);
    }

    @Override
    public RoomFloor getRoomFloorById(Long id) {
        return floorRepository.findById(id).orElseThrow(() -> 
            new IllegalArgumentException("RoomFloor not found with id: " + id));
    }

    @Override
    public List<RoomFloor> getAllRoomFloorsByRoomId(Long roomId) {
        return floorRepository.findByRoomId(roomId);
    }

    @Override
    public RoomFloor updateRoomFloor(Long id, RoomFloor updatedRoomFloor) {
        RoomFloor existingRoomFloor = getRoomFloorById(id);
        existingRoomFloor.setFloorAsset(updatedRoomFloor.getFloorAsset());
        return floorRepository.save(existingRoomFloor);
    }

    @Override
    public void deleteRoomFloor(Long id) {
        floorRepository.deleteById(id);
    }
}
