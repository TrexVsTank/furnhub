package com.furnhub.service;

import com.furnhub.entity.AssetFloor;
import java.util.List;

public interface AssetFloorService {
    AssetFloor createFloorAsset(AssetFloor asset);
    AssetFloor getFloorAssetById(Long id);
    List<AssetFloor> getAllFloorAssets();
    AssetFloor updateFloorAsset(Long id, AssetFloor updatedAsset);
    void deleteFloorAsset(Long id);
}
