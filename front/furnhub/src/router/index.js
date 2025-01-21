  import { createRouter, createWebHistory } from "vue-router";
  import Home from "@/views/Home.vue";
  import FloorPlanEditor from "@/views/FloorPlanEditor.vue";
  import FurnitureEditor from "@/views/FurnitureEditor.vue";

  const routes = [
    { path: "/", name: "Home", component: Home },
    { path: "/floor-plan-editor", name: "FloorPlanEditor", component: FloorPlanEditor }, // 경로 수정
    { path: "/furniture-editor", name: "FurnitureEditor", component: FurnitureEditor }, // 경로 수정
  ];

  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  export default router;
