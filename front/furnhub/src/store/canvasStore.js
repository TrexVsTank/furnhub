import { SVG } from "@svgdotjs/svg.js";

// 내부 상태 변수
let draw = null;
let startPoint = null;
let backgroundRect = null;
const mmToPx = 0.05; // 1mm = 0.05px 기준

// 캔버스 초기화
export const initializeCanvas = (canvas, widthMM, heightMM) => {
  const widthPx = widthMM.value * mmToPx;
  const heightPx = heightMM.value * mmToPx;

  draw = SVG().addTo(canvas.value).size(widthPx, heightPx);
  draw.viewbox(0, 0, widthMM.value, heightMM.value);

  // 배경 Rect 생성
  backgroundRect = draw.rect(widthMM.value, heightMM.value).fill("#e0e0e0");
};

// 캔버스 크기 조정
export const resizeCanvas = (newWidth, newHeight) => {
  const widthPx = newWidth * mmToPx;
  const heightPx = newHeight * mmToPx;

  if (draw) {
    draw.size(widthPx, heightPx).viewbox(0, 0, newWidth, newHeight);
    if (backgroundRect) {
      backgroundRect.size(newWidth, newHeight).fill("#e0e0e0");
    }
  }
};

// 그리기 시작
export const startDrawingWall = (event) => {
  const { offsetX, offsetY } = event;
  startPoint = { x: offsetX, y: offsetY };
};

// 그리기 완료
export const finishDrawingWall = (event) => {
  if (!startPoint) return;
  const { offsetX, offsetY } = event;

  if (draw) {
    draw.line(startPoint.x, startPoint.y, offsetX, offsetY).stroke({ width: 2, color: "#000" });
  }
  startPoint = null;
};
