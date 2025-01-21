<script setup>
// 임포트
import { onMounted, ref, reactive } from "vue"; 
import { SVG } from "@svgdotjs/svg.js";

// 캔버스 관련 변수
const canvas = ref(null); // Vue ref를 사용해 캔버스 DOM을 참조
let draw = null; // SVG.js의 그리기 객체
let startPoint = null; // 시작 좌표 (벽 그리기 등에서 사용 가능)
const mmToPx = 0.05; // mm당 픽셀 비율로 SVG 좌표 계산에 활용
let isPanning = false; // 화면 이동 여부 플래그
let panStart = { x: 0, y: 0 }; // 화면 이동 시작 좌표
let viewbox = reactive({ x: 0, y: 0, width: 2000, height: 2000 }); // SVG viewbox 설정
const gridSize = 100; // 작은 그리드 간격 (단위: mm)
const majorGridSize = 1000; // 큰 그리드 간격 (단위: mm)

// 선택된 개체 정보
const selectedElement = reactive({
  type: null,
  properties: {},
});

// 그리드 추가
const addGrid = () => {
  if (!draw) return;

  // 기존 그리드 제거
  draw.find(".grid-line").forEach((line) => line.remove());

  const minorColor = "#555"; // 작은 그리드 색상
  const majorColor = "#111"; // 큰 그리드 색상

  // 캔버스 크기 가져오기
  const canvasWidthPx = canvas.value.clientWidth; // px 단위
  const canvasHeightPx = canvas.value.clientHeight; // px 단위
  const canvasWidthMM = canvasWidthPx / mmToPx; // mm 단위
  const canvasHeightMM = canvasHeightPx / mmToPx; // mm 단위

  // 그리드 시작 및 끝점 계산
  const startX = Math.floor((viewbox.x - canvasWidthMM / 2) / gridSize) * gridSize;
  const startY = Math.floor((viewbox.y - canvasHeightMM / 2) / gridSize) * gridSize;
  const endX = viewbox.x + canvasWidthMM;
  const endY = viewbox.y + canvasHeightMM;

  // 수평선 추가
  for (let y = startY; y <= endY; y += gridSize) {
    const isMajor = y % majorGridSize === 0;
    draw
      .line(startX, y, endX, y)
      .stroke({ width: isMajor ? 1 : 0.5, color: isMajor ? majorColor : minorColor })
      .addClass("grid-line");
  }

  // 수직선 추가
  for (let x = startX; x <= endX; x += gridSize) {
    const isMajor = x % majorGridSize === 0;
    draw
      .line(x, startY, x, endY)
      .stroke({ width: isMajor ? 1 : 0.5, color: isMajor ? majorColor : minorColor })
      .addClass("grid-line");
  }
};

// 화면 이동 시작
const startPan = (event) => {
  isPanning = true;
  panStart.x = event.clientX;
  panStart.y = event.clientY;
};

// 화면 이동 중
const panCanvas = (event) => {
  if (!isPanning) return;
  const dx = (event.clientX - panStart.x) * viewbox.width / canvas.value.clientWidth;
  const dy = (event.clientY - panStart.y) * viewbox.height / canvas.value.clientHeight;

  viewbox.x -= dx;
  viewbox.y -= dy;

  draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
  panStart.x = event.clientX;
  panStart.y = event.clientY;

  // 화면 이동 후 그리드 갱신
  addGrid();
};

// 화면 이동 종료
const endPan = () => {
  isPanning = false;
};

// 줌 기능
const zoomCanvas = (event) => {
  const zoomFactor = 0.1;
  const direction = event.deltaY > 0 ? 1 : -1;

  const newWidth = viewbox.width * (1 + direction * zoomFactor);
  const newHeight = viewbox.height * (1 + direction * zoomFactor);

  viewbox.x += (viewbox.width - newWidth) / 2;
  viewbox.y += (viewbox.height - newHeight) / 2;

  viewbox.width = newWidth;
  viewbox.height = newHeight;

  draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);

  // 줌 후 그리드 갱신
  addGrid();
};

// 선택된 개체 정보 설정
const selectElement = (type, properties) => {
  selectedElement.type = type;
  selectedElement.properties = { ...properties };
};

// 마운트
onMounted(() => {
  draw = SVG()
    .addTo(canvas.value)
    .size("100%", "100%")
    .viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);

  addGrid(); // 초기 그리드 추가
});
</script>

<template>
  <div class="editor">
    <!-- 왼쪽 사이드바 -->
    <aside class="sidebar left">
      <router-link to="/">
        <button>홈으로</button>
      </router-link>
      <h2>툴 모음</h2>
      <button>선택 툴</button>
      <button>벽 그리기 툴</button>
      <button>사각형 툴</button>
      <button>영역 자르기 툴</button>
      <button>여닫이문</button>
      <button>미닫이문</button>
      <button>미닫이창문</button>
      <button>여닫이창문</button>
    </aside>

    <!-- 캔버스 -->
    <div
      class="canvas"
      ref="canvas"
      @mousedown="startPan"
      @mousemove="panCanvas"
      @mouseup="endPan"
      @mouseleave="endPan"
      @wheel.prevent="zoomCanvas"
    ></div>

    <!-- 오른쪽 속성 사이드바 -->
    <aside class="sidebar right">
      <router-link to="furniture-editor">
        <button>가구배치로</button>
      </router-link>
      <h2>속성 편집</h2>
      <div>
        <p>선택된 개체가 없습니다.</p>
      </div>
    </aside>
    
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden; /* 스크롤 제거 */
}

.sidebar {
  width: 200px;
  height: 100%;
  background-color: #f9f9f9;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box; /* 경계 포함 */
}

.sidebar.left {
  border-right: 1px solid #ccc; /* 캔버스와의 경계 */
}

.sidebar.right {
  border-left: 1px solid #ccc; /* 캔버스와의 경계 */
}

.sidebar h2 {
  font-size: 18px;
  margin-bottom: 10px;
}

.sidebar button {
  padding: 10px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.sidebar button:hover {
  background-color: #45a049;
}

.canvas {
  flex: 1;
  background-color: #fff;
  cursor: grab;
  overflow: hidden;
  position: relative;
}
</style>
