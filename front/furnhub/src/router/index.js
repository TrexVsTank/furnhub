import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import Editor from "@/views/Editor.vue";
import Furniture from "@/views/Furniture.vue";

const routes = [
  { path: "/", name: "Home", component: Home },
  { path: "/editor", name: "Editor", component: Editor },
  { path: "/furniture", name: "Furniture", component: Furniture },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
