package com.furnhub.service.impl;

import com.furnhub.entity.FurnitureCategory;
import com.furnhub.repository.FurnitureCategoryRepository;
import com.furnhub.service.FurnitureCategoryService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FurnitureCategoryServiceImpl implements FurnitureCategoryService {

    private final FurnitureCategoryRepository categoryRepository;

    public FurnitureCategoryServiceImpl(FurnitureCategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Override
    public FurnitureCategory createCategory(FurnitureCategory category) {
        return categoryRepository.save(category);
    }

    @Override
    public FurnitureCategory getCategoryById(Long id) {
        return categoryRepository.findById(id).orElseThrow(() -> 
            new IllegalArgumentException("Category not found with id: " + id));
    }

    @Override
    public List<FurnitureCategory> getAllCategories() {
        return categoryRepository.findAll();
    }

    @Override
    public FurnitureCategory updateCategory(Long id, FurnitureCategory updatedCategory) {
        FurnitureCategory existingCategory = getCategoryById(id);
        existingCategory.setName(updatedCategory.getName());
        return categoryRepository.save(existingCategory);
    }

    @Override
    public void deleteCategory(Long id) {
        categoryRepository.deleteById(id);
    }
}
