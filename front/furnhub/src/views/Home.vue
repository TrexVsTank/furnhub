<script setup>
  import "@/styles/global.scss"; // SCSS 파일 임포트
</script>

<template>
  <div>
    <h1>홈</h1>
    <!-- 도면 에디터로 이동 -->
    <router-link to="/floor-plan-editor">
      <button>도면 에디터로</button>
    </router-link>
  </div>
</template>

<style scoped>
/* 필요하면 버튼 스타일 추가 */
</style>
