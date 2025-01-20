package com.furnhub.service;

import com.furnhub.entity.AssetFurniture;
import java.util.List;

public interface AssetFurnitureService {
    AssetFurniture createAssetFurniture(AssetFurniture asset);
    AssetFurniture getAssetFurnitureById(Long id);
    List<AssetFurniture> getAllAssetFurnitures();
    AssetFurniture updateAssetFurniture(Long id, AssetFurniture updatedAsset);
    void deleteAssetFurniture(Long id);
}
