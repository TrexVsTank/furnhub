package com.furnhub.controller;

import com.furnhub.entity.AssetFurniture;
import com.furnhub.service.AssetFurnitureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/asset-furniture")
public class AssetFurnitureController {

    private final AssetFurnitureService assetFurnitureService;

    public AssetFurnitureController(AssetFurnitureService assetFurnitureService) {
        this.assetFurnitureService = assetFurnitureService;
    }

    @PostMapping
    public ResponseEntity<AssetFurniture> createAssetFurniture(@RequestBody AssetFurniture assetFurniture) {
        AssetFurniture createdAssetFurniture = assetFurnitureService.createAssetFurniture(assetFurniture);
        return ResponseEntity.ok(createdAssetFurniture);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssetFurniture> getAssetFurnitureById(@PathVariable Long id) {
        AssetFurniture assetFurniture = assetFurnitureService.getAssetFurnitureById(id);
        return ResponseEntity.ok(assetFurniture);
    }

    @GetMapping
    public ResponseEntity<List<AssetFurniture>> getAllAssetFurniture() {
        List<AssetFurniture> assetFurnitureList = assetFurnitureService.getAllAssetFurnitures();
        return ResponseEntity.ok(assetFurnitureList);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AssetFurniture> updateAssetFurniture(@PathVariable Long id, @RequestBody AssetFurniture updatedAssetFurniture) {
        AssetFurniture assetFurniture = assetFurnitureService.updateAssetFurniture(id, updatedAssetFurniture);
        return ResponseEntity.ok(assetFurniture);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssetFurniture(@PathVariable Long id) {
        assetFurnitureService.deleteAssetFurniture(id);
        return ResponseEntity.noContent().build();
    }
}
