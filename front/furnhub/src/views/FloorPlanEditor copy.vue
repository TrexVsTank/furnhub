// src/views/FloorPlanEditor.vue
<script setup>
// 임포트
import { onMounted, ref, reactive, watch } from "vue"; 
import { SVG } from "@svgdotjs/svg.js";
import "@/styles/global.scss"; // SCSS 파일 임포트
import "@/styles/FloorPlanEditor.scss"; // SCSS 파일 임포트
import { useToolStore } from "@/stores/tools";

// 화면 제어 변수
const canvas = ref(null); // Vue ref를 사용해 캔버스 DOM을 참조
let draw = null; // SVG.js의 그리기 객체
let viewbox = reactive({ x: -3000, y: -3000, width: 6000, height: 6000 }); // SVG viewbox 설정
const BOUNDARY = { minX: -50000, minY: -50000, maxX: 50000, maxY: 50000 }; // 최대범위

// 스냅 계산
const snapToWalls = (x, y) => {
  const snapRange = 100; // 스냅 범위 (단위: mm)
  for (const wall of walls) {
    const start = wall.start;
    const end = wall.end;
    if (Math.abs(x - start.x) < snapRange && Math.abs(y - start.y) < snapRange) {
      return { x: start.x, y: start.y };
    }
    if (Math.abs(x - end.x) < snapRange && Math.abs(y - end.y) < snapRange) {
      return { x: end.x, y: end.y };
    }
  }
  return { x, y };
};

// 그리드 변수
const gridSize = 100; // 작은 그리드 간격 (단위: mm)
const majorGridSize = 1000; // 큰 그리드 간격 (단위: mm)
// 그리드 추가
const addGrid = () => {
  if (!draw) return;
  draw.find(".grid-line").forEach((line) => line.remove()); // 기존 그리드 제거
  const minorColor = "#555"; // 작은 그리드 색상
  const majorColor = "#111"; // 큰 그리드 색상
  // 캔버스 크기 가져오기
  const canvasWidthPx = canvas.value.clientWidth; // px 단위
  const canvasHeightPx = canvas.value.clientHeight; // px 단위
  const canvasWidthMM = canvasWidthPx; // mm 단위
  const canvasHeightMM = canvasHeightPx; // mm 단위
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
  // 중심 수직선
  draw
  .line(BOUNDARY.minX, 0, BOUNDARY.maxX, 0)
  .stroke({ width: 5, color: '#111' })
  .addClass("grid-line");
  // 중심 수평선
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
const toolState = ref("select"); // `ref`를 사용하여 반응형 상태로 선언
const tools = {
  // 선택 툴
  select: {
    mousedown: (event) => startPan(event),
    mousemove: (event) => panCanvas(event),
    mouseup: (event) => endPan(event),
  },
  // 벽 툴
  wall: {
    click: (event) => handleCanvasClick(event),
    mousemove: (event) => handleMouseMove(event),
  },
  // 사각 툴
  rectangle: {},
  // 자르기 툴
  cut: {},
};
// 툴 실행 함수
const executeToolEvent = (eventName, event) => {
  const currentTool = tools[toolState.value];
  if (currentTool && typeof currentTool[eventName] === "function") {
    currentTool[eventName](event);
  }
};







// 화면 이동 관련 변수
let isPanning = false; // 화면 이동 여부 플래그
let panStart = { x: 0, y: 0 }; // 화면 이동 시작 좌표
// 화면 이동 관련 로직
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
  // 뷰박스 갱신
  viewbox.x -= dx;
  viewbox.y -= dy;
  viewbox.width = newWidth;
  viewbox.height = newHeight;
  draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
  // 줌 후 갱신
  addGrid(); 
  addBoundary();
  updateWallKeys();
  updateWallTextSize();
};





// 키 크기 동적 조정
const calculateKeySize = () => {
  const scaleFactor = canvas.value.clientWidth / viewbox.width; // 줌 상태에 따른 스케일 계산
  return 20 / scaleFactor; // 키 크기를 일정하게 유지
};
// 벽 키 업데이트 함수
const updateWallKeys = () => {
  const keySize = calculateKeySize(); // 현재 줌 상태에 따른 크기 계산
  walls.forEach((wallData) => {
    // 키가 이미 존재한다면 삭제 후 재생성
    if (wallData.startKey) wallData.startKey.remove();
    if (wallData.endKey) wallData.endKey.remove();
    // 새 키 생성
    wallData.startKey = draw
      .rect(keySize, keySize)
      .center(wallData.start.x, wallData.start.y)
      .fill("white")
      .stroke({ color: "black", width: 1 });
    wallData.endKey = draw
      .rect(keySize, keySize)
      .center(wallData.end.x, wallData.end.y)
      .fill("white")
      .stroke({ color: "black", width: 1 });
  });
};
const calculateTextSize = () => {
  const scaleFactor = canvas.value.clientWidth / viewbox.width; // 줌 상태에 따른 스케일 계산
  return 30 / scaleFactor; // 텍스트 크기를 일정하게 유지
};
const updateWallTextSize = () => {
  const textSize = calculateTextSize(); // 현재 줌 상태에 따른 텍스트 크기 계산
  walls.forEach((wallData) => {
    if (wallData.lengthText) {
      wallData.lengthText.font({ size: textSize }); // 텍스트 크기 업데이트
    }
  });
};
// 벽 생성 관련 변수
const wallThickness = 100; // 벽 두께 (mm)
const walls = reactive([]); // 생성된 벽 데이터 저장
// 벽 생성 함수
const createWall = (start, end) => {
  // 벽
  const wall = draw.line(start.x, start.y, end.x, end.y).stroke({
    width: wallThickness, // 100mm 고정 두께
    color: "#422",
  });
  // 벽 길이
  const length = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
  );
  const lengthText = draw // 텍스트 생성
  .text(`${Math.round(length)}mm`)
  .font({ size: calculateTextSize() })
  .move((start.x + end.x) / 2, (start.y + end.y) / 2)
  .front()
  .addClass("length-text");
  walls.push({ start, end, lengthText }); // 벽 데이터 저장
  updateWallKeys(); // 키 크기 업데이트
};
// 미리보기 업데이트
const updatePreview = (start, current) => {
  const snappedPoint = snapToWalls(current.x, current.y);
  // 직각 제한
  if (Math.abs(current.x - start.x) > Math.abs(current.y - start.y)) {
    current.y = start.y;
  } else {
    current.x = start.x;
  }
  // 미리보기 선 업데이트
  previewLine.plot(start.x, start.y, current.x, current.y);
};
// SVG 내 마우스 클릭 위치를 계산
const getSvgCoordinates = (event) => {
  const point = draw.node.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformedPoint = point.matrixTransform(draw.node.getScreenCTM().inverse());
  return {
    x: transformedPoint.x,
    y: transformedPoint.y,
  };
};
// 마우스 이벤트 처리
let isDrawing = false; // 벽 긋기 중 여부
let startPoint = null; // 벽 시작점
let previewLine = null; // 미리보기 선
// 캔버스 클릭 핸들러
const handleCanvasClick = (event) => {
  const svgPoint = getSvgCoordinates(event); // 변환된 SVG 좌표
  if (!isDrawing) {
    // 시작점 설정
    startPoint = svgPoint;
    isDrawing = true;
    // 미리보기 선 생성
    previewLine = draw
      .line(startPoint.x, startPoint.y, startPoint.x, startPoint.y)
      .stroke({ width: wallThickness, color: "gray", dasharray: "5,5" });
  } else {
    // 벽 생성 및 미리보기 제거
    createWall(startPoint, svgPoint);
    isDrawing = false;
    previewLine.remove();
    previewLine = null;
  }
};
// 마우스 이동 핸들러
const handleMouseMove = (event) => {
  if (!isDrawing || !previewLine) return;
  const svgPoint = getSvgCoordinates(event); // 변환된 SVG 좌표
  updatePreview(startPoint, svgPoint);
};




// 마운트
onMounted(() => {
  draw = SVG()
    .addTo(canvas.value)
    .size("100%", "100%")
    .viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
  // 마운트시 갱신
  addGrid();
  addBoundary();
  updateWallKeys();
  updateWallTextSize();
});
</script>






<template>
  <div class="editor">
    <!-- 왼쪽 사이드바 -->
    <aside class="sidebar">
      <router-link to="/">
        <button>홈으로</button>
      </router-link>
      <h2>툴 모음</h2>
      <p>현재 툴 : {{ toolState }}</p>
      <button @click="toolState = 'select'">선택 툴</button>
      <button @click="toolState = 'wall'">벽 툴</button>
      <button @click="toolState = 'rectangle'">사각형 툴</button>
      <button @click="toolState = 'cut'">영역 자르기 툴</button>
    </aside>
    <!-- 캔버스 -->
    <div
      class="canvas"
      ref="canvas"
      @mousedown="executeToolEvent('mousedown', $event)"
      @mousemove="executeToolEvent('mousemove', $event)"
      @mouseup="executeToolEvent('mouseup', $event)"
      @mouseleave="endPan"
      @click="executeToolEvent('click', $event)"
      @wheel.prevent="zoomCanvas"
    ></div>
    <!-- 오른쪽 속성 사이드바 -->
    <aside class="sidebar">
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