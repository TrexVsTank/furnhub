package com.furnhub.controller;

import com.furnhub.entity.FurnitureCategory;
import com.furnhub.service.FurnitureCategoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/furniture-categories")
public class FurnitureCategoryController {

    private final FurnitureCategoryService furnitureCategoryService;

    public FurnitureCategoryController(FurnitureCategoryService furnitureCategoryService) {
        this.furnitureCategoryService = furnitureCategoryService;
    }

    @PostMapping
    public ResponseEntity<FurnitureCategory> createCategory(@RequestBody FurnitureCategory category) {
        FurnitureCategory createdCategory = furnitureCategoryService.createCategory(category);
        return ResponseEntity.ok(createdCategory);
    }

    @GetMapping("/{id}")
    public ResponseEntity<FurnitureCategory> getCategoryById(@PathVariable Long id) {
        FurnitureCategory category = furnitureCategoryService.getCategoryById(id);
        return ResponseEntity.ok(category);
    }

    @GetMapping
    public ResponseEntity<List<FurnitureCategory>> getAllCategories() {
        List<FurnitureCategory> categories = furnitureCategoryService.getAllCategories();
        return ResponseEntity.ok(categories);
    }

    @PutMapping("/{id}")
    public ResponseEntity<FurnitureCategory> updateCategory(@PathVariable Long id, @RequestBody FurnitureCategory updatedCategory) {
        FurnitureCategory category = furnitureCategoryService.updateCategory(id, updatedCategory);
        return ResponseEntity.ok(category);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        furnitureCategoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}
