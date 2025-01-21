// src/store/FloorPlanEditor.js
import { defineStore } from "pinia";

export const useFloorPlanStore = defineStore("floorPlan", {
  state: () => ({
    viewbox: { x: 0, y: 0, width: 2000, height: 2000 },
    gridSize: 100,
    majorGridSize: 1000,
    isPanning: false,
    panStart: { x: 0, y: 0 },
  }),

  actions: {
    startPan(clientX, clientY) {
      this.isPanning = true;
      this.panStart = { x: clientX, y: clientY };
    },
    panCanvas(clientX, clientY, canvasWidth, canvasHeight) {
      if (!this.isPanning) return;

      const dx = ((clientX - this.panStart.x) * this.viewbox.width) / canvasWidth;
      const dy = ((clientY - this.panStart.y) * this.viewbox.height) / canvasHeight;

      this.viewbox.x -= dx;
      this.viewbox.y -= dy;

      this.panStart = { x: clientX, y: clientY };
    },
    endPan() {
      this.isPanning = false;
    },
    zoomCanvas(cursor, zoomFactor, direction) {
      const newWidth = this.viewbox.width * (1 + direction * zoomFactor);
      const newHeight = this.viewbox.height * (1 + direction * zoomFactor);

      const dx = (cursor.x - this.viewbox.x) * (newWidth / this.viewbox.width - 1);
      const dy = (cursor.y - this.viewbox.y) * (newHeight / this.viewbox.height - 1);

      this.viewbox.x -= dx;
      this.viewbox.y -= dy;

      this.viewbox.width = newWidth;
      this.viewbox.height = newHeight;
    },
  },
});
