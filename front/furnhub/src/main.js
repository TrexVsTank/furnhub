// src/main.js
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";

// 글로벌 스타일
import "@/styles/global.scss";

const app = createApp(App);
app.use(router);
app.use(createPinia());
app.mount("#app");
