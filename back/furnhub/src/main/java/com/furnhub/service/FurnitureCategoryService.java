package com.furnhub.service;

import com.furnhub.entity.FurnitureCategory;
import java.util.List;

public interface FurnitureCategoryService {
    FurnitureCategory createCategory(FurnitureCategory category);
    FurnitureCategory getCategoryById(Long id);
    List<FurnitureCategory> getAllCategories();
    FurnitureCategory updateCategory(Long id, FurnitureCategory updatedCategory);
    void deleteCategory(Long id);
}
