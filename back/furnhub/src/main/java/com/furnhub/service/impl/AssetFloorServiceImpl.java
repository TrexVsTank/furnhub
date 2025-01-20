package com.furnhub.service.impl;

import com.furnhub.entity.AssetFloor;
import com.furnhub.repository.AssetFloorRepository;
import com.furnhub.service.AssetFloorService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AssetFloorServiceImpl implements AssetFloorService {

    private final AssetFloorRepository floorRepository;

    public AssetFloorServiceImpl(AssetFloorRepository floorRepository) {
        this.floorRepository = floorRepository;
    }

    @Override
    public AssetFloor createAssetFloor(AssetFloor asset) {
        return floorRepository.save(asset);
    }

    @Override
    public AssetFloor getAssetFloorById(Long id) {
        return floorRepository.findById(id).orElseThrow(() -> 
            new IllegalArgumentException("Floor asset not found with id: " + id));
    }

    @Override
    public List<AssetFloor> getAllAssetFloors() {
        return floorRepository.findAll();
    }

    @Override
    public AssetFloor updateAssetFloor(Long id, AssetFloor updatedAsset) {
        AssetFloor existingAsset = getAssetFloorById(id);
        existingAsset.setName(updatedAsset.getName());
        existingAsset.setTexturePath(updatedAsset.getTexturePath());
        return floorRepository.save(existingAsset);
    }

    @Override
    public void deleteAssetFloor(Long id) {
        floorRepository.deleteById(id);
    }
}
