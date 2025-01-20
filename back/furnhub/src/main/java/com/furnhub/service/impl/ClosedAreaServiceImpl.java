package com.furnhub.service.impl;

import com.furnhub.entity.ClosedArea;
import com.furnhub.repository.ClosedAreaRepository;
import com.furnhub.service.ClosedAreaService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ClosedAreaServiceImpl implements ClosedAreaService {

    private final ClosedAreaRepository closedAreaRepository;

    public ClosedAreaServiceImpl(ClosedAreaRepository closedAreaRepository) {
        this.closedAreaRepository = closedAreaRepository;
    }

    @Override
    public ClosedArea createClosedArea(ClosedArea closedArea) {
        return closedAreaRepository.save(closedArea);
    }

    @Override
    public ClosedArea getClosedAreaById(Long id) {
        return closedAreaRepository.findById(id).orElseThrow(() -> 
            new IllegalArgumentException("ClosedArea not found with id: " + id));
    }

    @Override
    public List<ClosedArea> getAllClosedAreasByRoomId(Long roomId) {
        return closedAreaRepository.findByRoomId(roomId);
    }

    @Override
    public ClosedArea updateClosedArea(Long id, ClosedArea updatedClosedArea) {
        ClosedArea existingClosedArea = getClosedAreaById(id);
        existingClosedArea.setArea(updatedClosedArea.getArea());
        existingClosedArea.setCenterX(updatedClosedArea.getCenterX());
        existingClosedArea.setCenterY(updatedClosedArea.getCenterY());
        return closedAreaRepository.save(existingClosedArea);
    }

    @Override
    public void deleteClosedArea(Long id) {
        closedAreaRepository.deleteById(id);
    }
}
