<!-- src/views/FloorPlanEditor.vue -->

<!-- 스크립트 -->
<script setup>

// vue
import { ref, onMounted } from "vue";

// SCSS
import "@/styles/global.scss";
import "@/styles/FloorPlanEditor.scss";

// Pinia
import { useFloorPlanStore } from "@/stores/floorPlanStore";
const store = useFloorPlanStore();

// canvas
const canvas = ref(null);

// onMounted
onMounted(() => {
  store.initializeCanvas(canvas.value);
  window.addEventListener('keydown', store.handleKeyDown);
});
</script>

<!-- 템플릿 -->
<template>

  <!-- 에디터 -->
  <div class="editor">

    <!-- 왼쪽 사이드바 -->
    <aside class="sidebar left">
      <router-link to="/"><button>홈으로</button></router-link>
      <p>툴 모음</p>
      <p>현재 툴 : {{ store.toolState.currentTool }}</p>
      <button @click="store.toolState.currentTool = 'select'">선택 툴</button>
      <button @click="store.toolState.currentTool = 'wall'">벽 툴</button>
      <div>
      <label>벽 두께 (mm)</label>
      <input 
      type="number" 
      :value="store.toolState.wallThickness"
      @input="store.setWallThickness($event.target.value)"
      min="1"
      step="10"
      placeholder="100"
      >
      <div>
        <button @click="store.setWallThickness(store.toolState.wallThickness - 10)">-</button>
        <button @click="store.setWallThickness(store.toolState.wallThickness + 10)">+</button>
      </div>
    </div>
      <button @click="store.toolState.currentTool = 'rect'">사각형 툴</button>
      <button @click="store.toolState.currentTool = 'cut'">영역 자르기 툴</button>
    </aside>

    <!-- 캔버스 -->
    <div
      class="canvas"
      ref="canvas"
      @mousedown="store.executeToolEvent('onMouseDown', $event)"
      @mousemove="store.executeToolEvent('onMouseMove', $event)"
      @mouseup="store.executeToolEvent('onMouseUp', $event)"
      @click="store.executeToolEvent('onClick', $event)"
      @wheel.prevent="store.zoomCanvas"
    ></div>

    <!-- 오른쪽 속성 사이드바 -->
    <aside class="sidebar right">
      <router-link to="furniture-editor"><button>가구배치로</button></router-link>
      <p>속성 편집</p>
      <div><p>선택된 개체가 없습니다.</p></div>
    </aside>
  </div>
</template>

<!-- 스타일 -->
<style scoped>
</style>