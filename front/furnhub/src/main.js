//src.main.js
import { createApp } from "vue";
import { createPinia } from "pinia"; // Pinia 가져오기
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia); // Pinia 등록
app.use(router);

app.mount("#app");
