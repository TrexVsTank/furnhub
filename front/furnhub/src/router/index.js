import { createRouter, createWebHashHistory } from "vue-router";
// import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import FloorPlanEditor from "@/views/FloorPlanEditor.vue";
import FurnitureEditor from "@/views/FurnitureEditor.vue";

const routes = [
  { path: "/", name: "Home", component: Home },
  { path: "/floor-plan-editor", name: "FloorPlanEditor", component: FloorPlanEditor },
  { path: "/furniture-editor", name: "FurnitureEditor", component: FurnitureEditor },
];

const router = createRouter({
  history: createWebHashHistory(),
  // history: createWebHistory(),
  routes,
});

export default router;
