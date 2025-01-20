package com.furnhub.service.impl;

import com.furnhub.entity.AssetFurniture;
import com.furnhub.repository.AssetFurnitureRepository;
import com.furnhub.service.AssetFurnitureService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AssetFurnitureServiceImpl implements AssetFurnitureService {

    private final AssetFurnitureRepository furnitureRepository;

    public AssetFurnitureServiceImpl(AssetFurnitureRepository furnitureRepository) {
        this.furnitureRepository = furnitureRepository;
    }

    @Override
    public AssetFurniture createAssetFurniture(AssetFurniture asset) {
        return furnitureRepository.save(asset);
    }

    @Override
    public AssetFurniture getAssetFurnitureById(Long id) {
        return furnitureRepository.findById(id).orElseThrow(() -> 
            new IllegalArgumentException("Furniture asset not found with id: " + id));
    }

    @Override
    public List<AssetFurniture> getAllAssetFurnitures() {
        return furnitureRepository.findAll();
    }

    @Override
    public AssetFurniture updateAssetFurniture(Long id, AssetFurniture updatedAsset) {
        AssetFurniture existingAsset = getAssetFurnitureById(id);
        existingAsset.setName(updatedAsset.getName());
        existingAsset.setFolderName(updatedAsset.getFolderName());
        return furnitureRepository.save(existingAsset);
    }

    @Override
    public void deleteAssetFurniture(Long id) {
        furnitureRepository.deleteById(id);
    }
}
