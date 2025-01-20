import { defineStore } from "pinia";

export const useEditorStore = defineStore("editor", {
  state: () => ({
    walls: [],
    selectedTool: null,
  }),
  actions: {
    addWall(wall) {
      this.walls.push(wall);
    },
    setSelectedTool(tool) {
      this.selectedTool = tool;
    },
  },
});
