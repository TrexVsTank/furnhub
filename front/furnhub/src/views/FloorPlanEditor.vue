// src/views/FloorPlanEditor.vue
<script setup>
// 임포트
import { onMounted, ref, reactive } from "vue"; 
import { SVG } from "@svgdotjs/svg.js";
import "@/styles/global.scss"; // SCSS 파일 임포트
import "@/styles/FloorPlanEditor.scss"; // SCSS 파일 임포트

// 캔버스 관련 변수
const canvas = ref(null); // Vue ref를 사용해 캔버스 DOM을 참조
let draw = null; // SVG.js의 그리기 객체
const mmToPx = 0.05; // mm당 픽셀 비율로 SVG 좌표 계산에 활용

// 뷰박스 초기화
let viewbox = reactive({ x: -1000, y: -1000, width: 2000, height: 2000 }); // SVG viewbox 설정

// 경계 설정
const BOUNDARY = { minX: -50000, minY: -50000, maxX: 50000, maxY: 50000 };

// 드래그 관련 변수
let isPanning = false; // 화면 이동 여부 플래그
let panStart = { x: 0, y: 0 }; // 화면 이동 시작 좌표

// 그리드 설정
const gridSize = 100; // 작은 그리드 간격 (단위: mm)
const majorGridSize = 1000; // 큰 그리드 간격 (단위: mm)

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
  for (let y = BOUNDARY.minY; y <= BOUNDARY.maxY; y += gridSize) {
    const isMajor = y % majorGridSize === 0;
    draw
      .line(BOUNDARY.minX, y, BOUNDARY.maxX, y)
      .stroke({ width: isMajor ? 1 : 0.5, color: isMajor ? majorColor : minorColor })
      .addClass("grid-line");
  }

  // 수직선 추가
  for (let x = BOUNDARY.minX; x <= BOUNDARY.maxX; x += gridSize) {
    const isMajor = x % majorGridSize === 0;
    draw
      .line(x, BOUNDARY.minY, x, BOUNDARY.maxY)
      .stroke({ width: isMajor ? 1 : 0.5, color: isMajor ? majorColor : minorColor })
      .addClass("grid-line");
  }

  draw
  .line(BOUNDARY.minX, 0, BOUNDARY.maxX, 0)
  .stroke({ width: 5, color: '#111' })
  .addClass("grid-line");

  draw
  .line(0, BOUNDARY.minY, 0, BOUNDARY.maxY)
  .stroke({ width: 5, color: '#111' })
  .addClass("grid-line");
};

// 범위 제한 사각형 표시
const addBoundary = () => {
  draw
    .rect(100000, 100000)
    .move(-50000, -50000)
    .fill("none")
    .stroke({ color: "red", width: 2 });
};





// 툴 상태 관리 (선택 툴, 벽 툴)
const toolState = ref("select"); // 기본값: 선택 툴
let isDrawing = false; // 벽 긋기 중 여부
let startPoint = null; // 벽 시작점
let previewLine = null; // 미리보기 선
const wallThickness = 100; // 벽 두께 (mm)

// 스냅 계산
const snapToGrid = (value) => Math.round(value / 100) * 100;






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

  // 화면 이동 후 그리드, 범위 갱신
  addGrid();
  addBoundary();
};

// 화면 이동 종료
const endPan = () => {
  isPanning = false;
};

// 줌 기능
const zoomCanvas = (event) => {
  const zoomFactor = 0.1; // 줌 비율
  const direction = event.deltaY > 0 ? 1 : -1; // 줌 방향 (스크롤 위: 줌인, 아래: 줌아웃)

  // 현재 마우스 커서의 SVG 좌표를 계산
  const cursorPoint = draw.node.createSVGPoint();
  cursorPoint.x = event.clientX;
  cursorPoint.y = event.clientY;
  const cursorSVGPoint = cursorPoint.matrixTransform(draw.node.getScreenCTM().inverse());

  // 줌 후 새로운 뷰박스 크기 계산
  const newWidth = viewbox.width * (1 + direction * zoomFactor);
  const newHeight = viewbox.height * (1 + direction * zoomFactor);

  // 커서 기준으로 뷰박스 이동 계산
  const dx = (cursorSVGPoint.x - viewbox.x) * (newWidth / viewbox.width - 1);
  const dy = (cursorSVGPoint.y - viewbox.y) * (newHeight / viewbox.height - 1);

  viewbox.x -= dx;
  viewbox.y -= dy;

  viewbox.width = newWidth;
  viewbox.height = newHeight;

  draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);

  // 줌 후 그리드, 범위 갱신
  addGrid(); 
  addBoundary();
};







// 벽 생성 함수
const createWall = (start, end) => {
  const wall = draw.line(start.x, start.y, end.x, end.y).stroke({
    width: wallThickness * mmToPx,
    color: "black",
  });

  // 양 끝 사각형 키 시각화
  draw
    .rect(200, 200) // 100mm = 200px
    .center(start.x, start.y)
    .fill("white")
    .stroke({ color: "black", width: 2 });
  draw
    .rect(200, 200)
    .center(end.x, end.y)
    .fill("white")
    .stroke({ color: "black", width: 2 });

  return wall;
};

// 마우스 클릭으로 시작점 설정
const handleCanvasClick = (event) => {
  const point = draw.point(event.offsetX, event.offsetY);
  const snappedPoint = {
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
  };

  if (!isDrawing) {
    // 시작점 설정
    startPoint = snappedPoint;
    isDrawing = true;

    // 미리보기 선 초기화
    previewLine = draw
      .line(snappedPoint.x, snappedPoint.y, snappedPoint.x, snappedPoint.y)
      .stroke({ width: wallThickness * mmToPx, color: "gray", dasharray: "5,5" });
  } else {
    // 끝점 설정 및 벽 생성
    createWall(startPoint, snappedPoint);

    // 초기화
    isDrawing = false;
    startPoint = null;
    previewLine.remove();
    previewLine = null;
  }
};

// 마우스 이동 시 미리보기 업데이트
const handleMouseMove = (event) => {
  if (!isDrawing || !previewLine) return;

  const point = draw.point(event.offsetX, event.offsetY);
  const snappedPoint = {
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
  };

  // 직각 제한: 시작점 기준으로 x 또는 y 고정
  if (Math.abs(snappedPoint.x - startPoint.x) > Math.abs(snappedPoint.y - startPoint.y)) {
    snappedPoint.y = startPoint.y;
  } else {
    snappedPoint.x = startPoint.x;
  }

  previewLine.plot(startPoint.x, startPoint.y, snappedPoint.x, snappedPoint.y);
};

// 마운트
onMounted(() => {
  draw = SVG()
    .addTo(canvas.value)
    .size("100%", "100%")
    .viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
  // 초기 그리드, 범위
  addGrid();
  addBoundary();
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
</style>