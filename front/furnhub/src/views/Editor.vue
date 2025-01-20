<template>
    <div class="editor">
      <h1>Editor Mode</h1>
      <p>Start creating your room layout.</p>
      <button @click="saveAndSwitch">Save and Switch to Furniture Mode</button>
    </div>
  </template>
  
  <script setup>
  import { useRouter } from "vue-router";
  
  const router = useRouter();
  
  const saveAndSwitch = () => {
    // 저장 로직 추가 예정
    router.push("/furniture");
  };
  </script>
  
  <style scoped>
  .editor {
    text-align: center;
    margin-top: 50px;
  }
  </style>
  