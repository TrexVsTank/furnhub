package com.furnhub.service;

import com.furnhub.entity.AssetFurniture;
import java.util.List;

public interface AssetFurnitureService {
    AssetFurniture createFurnitureAsset(AssetFurniture asset);
    AssetFurniture getFurnitureAssetById(Long id);
    List<AssetFurniture> getAllFurnitureAssets();
    AssetFurniture updateFurnitureAsset(Long id, AssetFurniture updatedAsset);
    void deleteFurnitureAsset(Long id);
}
