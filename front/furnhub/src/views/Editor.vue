<script setup>
import { onMounted, ref } from "vue";
import { SVG } from "@svgdotjs/svg.js";

const canvas = ref(null);

onMounted(() => {
  const draw = SVG().addTo(canvas.value).size("100%", "100%");
  // 기본 그리기 작업
  draw.rect(800, 400).fill("#e0e0e0").move(50, 50);
});
</script>

<template>
  <div ref="canvas" style="width: 100%; height: 100%; border: 1px solid #ccc;"></div>
</template>

<style scoped>
div {
  position: relative;
}
</style>
