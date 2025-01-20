package com.furnhub.controller;

import com.furnhub.entity.AssetFloor;
import com.furnhub.service.AssetFloorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/asset-floor")
public class AssetFloorController {

    private final AssetFloorService assetFloorService;

    public AssetFloorController(AssetFloorService assetFloorService) {
        this.assetFloorService = assetFloorService;
    }

    @PostMapping
    public ResponseEntity<AssetFloor> createAssetFloor(@RequestBody AssetFloor assetFloor) {
        AssetFloor createdAssetFloor = assetFloorService.createAssetFloor(assetFloor);
        return ResponseEntity.ok(createdAssetFloor);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssetFloor> getAssetFloorById(@PathVariable Long id) {
        AssetFloor assetFloor = assetFloorService.getAssetFloorById(id);
        return ResponseEntity.ok(assetFloor);
    }

    @GetMapping
    public ResponseEntity<List<AssetFloor>> getAllAssetFloors() {
        List<AssetFloor> assetFloors = assetFloorService.getAllAssetFloors();
        return ResponseEntity.ok(assetFloors);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AssetFloor> updateAssetFloor(@PathVariable Long id, @RequestBody AssetFloor updatedAssetFloor) {
        AssetFloor assetFloor = assetFloorService.updateAssetFloor(id, updatedAssetFloor);
        return ResponseEntity.ok(assetFloor);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssetFloor(@PathVariable Long id) {
        assetFloorService.deleteAssetFloor(id);
        return ResponseEntity.noContent().build();
    }
}
