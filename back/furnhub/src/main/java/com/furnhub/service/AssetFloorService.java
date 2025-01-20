package com.furnhub.service;

import com.furnhub.entity.AssetFloor;
import java.util.List;

public interface AssetFloorService {
    AssetFloor createAssetFloor(AssetFloor asset);
    AssetFloor getAssetFloorById(Long id);
    List<AssetFloor> getAllAssetFloors();
    AssetFloor updateAssetFloor(Long id, AssetFloor updatedAsset);
    void deleteAssetFloor(Long id);
}
