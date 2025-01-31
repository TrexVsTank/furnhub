// store/floorPlanStore.js
import { defineStore } from "pinia";
import { SVG } from "@svgdotjs/svg.js";
import { reactive, computed, watch } from "vue";

export const useFloorPlanStore = defineStore("floorPlanStore", () => {
  
  // ===== SVG 객체 ===== //
  let draw = null;

  // ===== 도구 ===== //
  //도구 상태 (반응형)
  const toolState = reactive({
    currentTool: "select",
    wallThickness: 100,
    snapDistance: 100,
    rectStart: null,
    rectPreview: null,
    rectLabels: { width: null, height: null }
  });
  // 이벤트 처리기 실행 함수 (이벤트 이름, 이벤트 객체)
  const executeToolEvent = (eventName, event) => {
    const tool = tools[toolState.currentTool];
    if (tool?.[eventName]) {
      tool[eventName](event);
    }
  };

  // ===== 단축키 ===== //
  // 단축키 처리 함수
  const handleKeyDown = (event) => {
    // 입력 필드에서 무시
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    switch (event.key) {
      case "Escape": // ESC
        if (toolState.currentTool === 'rect') {
          rectControls.cleanup();
        } else {
          wallStart = null;
          cleanupPreview();
        }
        labelLayer.front();
        break;
      case "Delete": // Delete
        if (selection.selectedWall) {
          // 레이블 제거
          const wallStart = {
            x: selection.selectedWall.attr('x1'),
            y: selection.selectedWall.attr('y1')
          };
          const wallEnd = {
            x: selection.selectedWall.attr('x2'),
            y: selection.selectedWall.attr('y2')
          };
          const labels = labelLayer.find('.length-label');
          labels.forEach(label => {
            const labelX = parseFloat(label.attr('x'));
            const labelY = parseFloat(label.attr('y'));
            if (isPointNearLine(labelX, labelY, wallStart, wallEnd)) {
              label.remove();
            }
          });
          selection.selectedWall.remove(); selection.selectedWall = null; // 벽 제거
          cleanupOrphanedElements(); // 고아 키 제거
          detectClosedSpaces(); // 공간 갱신
          fillEmptyCorners(); // 코너 갱신
          saveState(); // 상태 저장
        }
        break;
      case "1": toolState.currentTool = "select"; break; // 1 : 선택
      case "2": toolState.currentTool = "wall"; break; // 2 : 벽
      case "3": toolState.currentTool = "rect"; break; // 3 : 사각형
      case "4": toolState.currentTool = "cut"; break; // 4 : 자르기
      default:
        if (event.ctrlKey) { // Ctrl
          switch (event.key) {
            case "z": // Ctrl + z
              event.preventDefault();
              undo();
              break;
            case "y": // Ctrl + y
              event.preventDefault();
              redo();
              break;
          }
        }
        break;
    }
  };
  // 고아 키 정리
  const cleanupOrphanedElements = () => {
    const walls = wallLayer.children();
    const keyPoints = labelLayer.find('.key');
    keyPoints.forEach(key => {
      const cx = parseFloat(key.attr('cx'));
      const cy = parseFloat(key.attr('cy'));
      let isConnected = false;
      walls.forEach(wall => {
        const x1 = parseFloat(wall.attr('x1'));
        const y1 = parseFloat(wall.attr('y1'));
        const x2 = parseFloat(wall.attr('x2'));
        const y2 = parseFloat(wall.attr('y2'));
        if ((Math.abs(x1 - cx) < 1 && Math.abs(y1 - cy) < 1) ||
            (Math.abs(x2 - cx) < 1 && Math.abs(y2 - cy) < 1)) {
          isConnected = true;
        }
      });
      if (!isConnected) { key.remove(); }
    });
  };
  // 히스토리
  const history = reactive({ undoStack: [], redoStack: [], current: null });
  // 현재 상태 저장 함수
  const saveState = () => {
    const state = {
      walls: wallLayer.children().map(wall => ({
        x1: parseFloat(wall.attr("x1")), y1: parseFloat(wall.attr("y1")),
        x2: parseFloat(wall.attr("x2")), y2: parseFloat(wall.attr("y2")),
        thickness: wall.data("wallThickness")
      })),
      labels: labelLayer.find(".length-label").map(label => {
        const text = label.text().replace("mm", "");
        if (!text || text === "0") return null;
        return { text, x: label.attr("x"), y: label.attr("y") };
      }).filter(label => label !== null),
      keyPoints: labelLayer.find(".key").map(key => ({
        x: key.cx(), y: key.cy(), size: key.attr("r") * 2
      })),
      spaces: spaceLayer.children().map(space => ({
        points: space.toArray ? space.toArray() : [],
        fill: space.attr("fill"), opacity: space.attr("opacity")
      }))
    };
    history.undoStack.push(JSON.stringify(state));
    history.redoStack = [];
    history.current = state;
  };
  // 저장 상태 복원 함수
  const restoreState = (state) => {
    wallLayer.children().forEach(child => child.remove());
    labelLayer.children().forEach(child => child.remove());
    spaceLayer.children().forEach(child => child.remove());
    cleanupPreview();
    state.walls.forEach(wall => {
      wallLayer.line(wall.x1, wall.y1, wall.x2, wall.y2)
        .stroke({ width: wall.thickness, color: "#999" })
        .data("wallThickness", wall.thickness);
    });
    state.labels.forEach(label => createLabel(label.text, label.x, label.y));
    state.keyPoints.forEach(point => drawKeyPoint(point.x, point.y));
    state.spaces?.forEach(space => {
      spaceLayer.polygon(space.points)
        .fill({ color: space.fill, opacity: space.opacity })
        .stroke({ width: 0 })
        .addClass("space-fill");
    });
    detectClosedSpaces(); // 공간 갱신
  };
  // undo 함수
  const undo = () => {
    if (history.undoStack.length > 0) {
      const currentState = history.undoStack.pop();
      history.redoStack.push(currentState);
      const previousState = history.undoStack[history.undoStack.length - 1];
      if (previousState) {
        restoreState(JSON.parse(previousState));
      }
    }
  };
  // redo 함수
  const redo = () => {
    if (history.redoStack.length > 0) {
      const nextState = history.redoStack.pop();
      history.undoStack.push(nextState);
      restoreState(JSON.parse(nextState));
    }
  };

  // ===== 화면제어 ===== //
  const viewbox = reactive({ x: -3000, y: -3000, width: 6000, height: 6000 }); // 화면제어 상태
  let isPanning = false; // 화면 이동 여부
  let panStart = { x: 0, y: 0 }; // 화면 이동 시작점
  // 화면이동 함수
  const panControls = {
    // 1. 클릭
    start: (event) => {
      isPanning = true; // 이동 여부 true
      panStart = { x: event.clientX, y: event.clientY }; // 클릭지점 저장
    },
    // 2. 드래그
    move: (event) => {
      if (!isPanning) return; // 이동 여부 체크
      // 뷰박스 갱신
      const dx = (event.clientX - panStart.x) * viewbox.width / draw.node.clientWidth;
      const dy = (event.clientY - panStart.y) * viewbox.height / draw.node.clientHeight;
      Object.assign(viewbox, {
        x: viewbox.x - dx,
        y: viewbox.y - dy
      });
      draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height); // 화면 갱신
      panStart = { x: event.clientX, y: event.clientY }; // 시작점 갱신
    },
    // 3. 종료
    stop: () => isPanning = false // 이동 여부 false
  };
  // 줌 함수
  const zoomCanvas = (event) => {
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9; // 휠 방향에 따라 확대 or 축소
    // 화면좌표 -> SVG좌표 변환
    const point = draw.node.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY; // 시작점
    const svgPoint = point.matrixTransform(draw.node.getScreenCTM().inverse());
    // 뷰박스 갱신
    const newWidth = viewbox.width * zoomFactor;
    const newHeight = viewbox.height * zoomFactor;
    const dx = (svgPoint.x - viewbox.x) * (newWidth / viewbox.width - 1);
    const dy = (svgPoint.y - viewbox.y) * (newHeight / viewbox.height - 1);
    Object.assign(viewbox, {
      x: viewbox.x - dx,
      y: viewbox.y - dy,
      width: newWidth,
      height: newHeight
    });
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height); // 화면 갱신
    updateVisualElements();
  };
  // 시각요소 갱신 함수
  const updateVisualElements = () => {
    draw.find(".length-label").forEach(label => {
      label.font({ size: viewbox.width * 0.025 });
      label.front();
    });
    draw.find(".key").forEach(key => {
      const { cx, cy } = key.attr();
      key.size(viewbox.width * 0.02, viewbox.width * 0.02)
        .stroke({ width: viewbox.width * 0.02 * 0.1 })
        .center(cx, cy);
    });
    labelLayer.front();
  };
  // 캔버스 초기화 함수
  const initializeCanvas = (canvasElement) => {
    draw = SVG().addTo(canvasElement).size("100%", "100%"); // SVG 캔버스 생성
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height); // 뷰박스
    addGrid();
    spaceLayer = draw.group().addClass("space-layer");
    wallLayer = draw.group().addClass("wall-layer");
    labelLayer = draw.group().addClass("label-layer");
    labelLayer.front();
  };
  // 그리드 생성 함수
  const addGrid = () => {
    const GRID_BOUNDARY = { min: -50000, max: 50000 }; // 상하좌우 50m
    draw.find(".grid-line").forEach(line => line.remove()); // 기존 그리드 제거
    // 격자 선 그리기 (가로, 세로)
    for (let i = GRID_BOUNDARY.min; i <= GRID_BOUNDARY.max; i += 100) {
      draw.line(GRID_BOUNDARY.min, i, GRID_BOUNDARY.max, i)
        .stroke({
          width: i % 1000 === 0 ? 1 : 0.5,
          color: i % 1000 === 0 ? "#111" : "#555"
        })
        .addClass("grid-line");
      draw.line(i, GRID_BOUNDARY.min, i, GRID_BOUNDARY.max)
        .stroke({
          width: i % 1000 === 0 ? 1 : 0.5,
          color: i % 1000 === 0 ? "#111" : "#555"
        })
        .addClass("grid-line");
    }
    // 중심선 (십자선) 그리기
    draw.line(GRID_BOUNDARY.min, 0, GRID_BOUNDARY.max, 0)
      .stroke({ width: 10, color: '#000' })
      .addClass("grid-line");
    draw.line(0, GRID_BOUNDARY.min, 0, GRID_BOUNDARY.max)
      .stroke({ width: 10, color: '#000' })
      .addClass("grid-line");
    // 경계선 그리기 (빨간색)
    [GRID_BOUNDARY.min, GRID_BOUNDARY.max].forEach(pos => {
      draw.line(pos, GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max)
        .stroke({ width: 50, color: '#f00' })
        .addClass("grid-line");
      draw.line(GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max, pos)
        .stroke({ width: 50, color: '#f00' })
        .addClass("grid-line");
    });
  };

  // ===== 벽 ===== //
  let wallLayer = null, labelLayer = null, spaceLayer = null; // 레이어
  const wallThicknessState = reactive({ value: 0 }); // 벽 두께 상태 (반응형)
  // 선택 상태 (반응형)
  const selection = reactive({ selectedWall: null }); // 현재 선택된 벽
  // 선택 벽 두께 반환 함수
  const getSelectedWallThickness = computed(() => {
    return selection.selectedWall ? parseInt(selection.selectedWall.data("wallThickness")) || 100 : 0;
  });
  // 선택 벽 두께 변경 함수
  const updateSelectedWallThickness = (newThickness) => {
    if (!selection.selectedWall) return;
    let updatedThickness = typeof newThickness === "string" && newThickness.includes("+")
      ? wallThicknessState.value + 10
      : typeof newThickness === "string" && newThickness.includes("-")
      ? wallThicknessState.value - 10
      : parseInt(newThickness);
    if (isNaN(updatedThickness) || updatedThickness < 1) return;
    selection.selectedWall.stroke({ width: updatedThickness });
    selection.selectedWall.data("wallThickness", updatedThickness);
    wallThicknessState.value = updatedThickness;
    saveState();
    detectClosedSpaces(); // 공간 갱신
  };
  // 선택한 벽의 두께 변경시 업데이트
  watch(() => selection.selectedWall, (newWall) => {
    if (newWall) {
      wallThicknessState.value = parseInt(newWall.data("wallThickness")) || 100;
    }
  });
  let wallStart = null; // 벽 시작
  let wallPreview = null; // 벽 미리보기
  let lengthLabel = null; // 벽 길이
  // 모서리 채우기 함수
  const fillEmptyCorners = () => {
    const walls = wallLayer.children();
    const corners = new Map();
    // 모든 벽의 끝점을 찾아서 저장
    walls.forEach(wall => {
      const x1 = parseFloat(wall.attr("x1"));
      const y1 = parseFloat(wall.attr("y1"));
      const x2 = parseFloat(wall.attr("x2"));
      const y2 = parseFloat(wall.attr("y2"));
      const thickness = parseFloat(wall.data("wallThickness") || wall.attr("stroke-width"));
      const key1 = `${x1},${y1}`;
      const key2 = `${x2},${y2}`;
      if (!corners.has(key1)) corners.set(key1, []);
      if (!corners.has(key2)) corners.set(key2, []);
      corners.get(key1).push({ x: x1, y: y1, thickness, wall });
      corners.get(key2).push({ x: x2, y: y2, thickness, wall });
    });
    // 각 코너에서 2개 이상의 벽이 만나는 곳을 찾아 빈 모서리 채우기
    corners.forEach((wallsAtCorner, key) => {
      if (wallsAtCorner.length === 2) {
        const [wallA, wallB] = wallsAtCorner;
        const commonPoint = { x: wallA.x, y: wallA.y };
        // 두 벽의 방향을 확인
        const isWallAVertical = Math.abs(wallA.wall.attr("x1") - wallA.wall.attr("x2")) < 1;
        const isWallBVertical = Math.abs(wallB.wall.attr("x1") - wallB.wall.attr("x2")) < 1;
        // 두 벽이 수직으로 만나는 경우
        if (isWallAVertical !== isWallBVertical) {
          const width = isWallAVertical ? wallA.thickness : wallB.thickness;
          const height = isWallAVertical ? wallB.thickness : wallA.thickness;
          // 모서리에 해당하는 사각형 생성
          spaceLayer.rect(width, height)
            .move(commonPoint.x - width / 2, commonPoint.y - height / 2)
            .fill({ color: "#999", opacity: 1.0 })
            .stroke({ width: 0 });
        }
      }
    });
  };
  // 벽 그리기 함수 (개선 : 끝점을 바운더리 밖에 놓았을 때 중단해야 함)
  const wallControls = {
    // 1. 시작
    start: (coords) => {
      if (!isWithinBoundary(coords)) return;
      const walls = wallLayer.children();
      const snappedStart = getSnapPoint(coords, walls, true); // 스냅
      wallStart = snappedStart;
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
      lengthLabel = createLabel("0.00", wallStart.x, wallStart.y);
    },
    // 2. 미리보기
    preview: (coords) => {
      if (!wallStart || !coords) return;
      const orthogonalEnd = getOrthogonalPoint(wallStart, coords); // 직각
      const walls = wallLayer.children();
      const snappedEnd = getSnapPoint(orthogonalEnd, walls); // 직각 -> 스냅
      const finalEnd = { // 수평 수직 결정
        x: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? snappedEnd.x : wallStart.x,
        y: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? wallStart.y : snappedEnd.y
      };
      wallPreview?.plot(
        wallStart.x, wallStart.y,
        finalEnd.x, finalEnd.y
      );
      const distance = calculateDistance(wallStart, finalEnd);
      updateLabel(lengthLabel, distance, wallStart, finalEnd);
    },
    // 3. 완료
    finish: (coords) => {
      if (!wallStart || !coords) return;
      const orthogonalEnd = getOrthogonalPoint(wallStart, coords); // 직각
      const walls = wallLayer.children();
      const snappedEnd = getSnapPoint(orthogonalEnd, walls); // 직각 -> 스냅
      const finalEnd = { // 수평 수직 결정
        x: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? snappedEnd.x : wallStart.x,
        y: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? wallStart.y : snappedEnd.y
      };
      const distance = calculateDistance(wallStart, finalEnd);
      // 교차점 찾기
      const intersections = findIntersections(wallStart, finalEnd, walls);
      // 교차점이 있으면 분할
      if (intersections.length > 0) {
        intersections.forEach(splitWallAtIntersection);
        createWallWithIntersections(wallStart, finalEnd, intersections);
      } else {
        // 교차점이 없을 때 -> 벽 / 레이블 , 키
        wallLayer.line(wallStart.x, wallStart.y, finalEnd.x, finalEnd.y)
          .stroke({ width: toolState.wallThickness, color: "#999" })
          .data('wallThickness', toolState.wallThickness);
        const midPoint = {
          x: (wallStart.x + finalEnd.x) / 2,
          y: (wallStart.y + finalEnd.y) / 2
        };
        createLabel(distance, midPoint.x, midPoint.y);
      }
      drawKeyPoint(wallStart.x, wallStart.y);
      drawKeyPoint(finalEnd.x, finalEnd.y);
      // 이전 미리보기 제거
      wallPreview?.remove();
      lengthLabel?.remove();
      // 연속긋기를 위해 새 시작점, 미리보기 생성
      wallStart = finalEnd;
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
      lengthLabel = createLabel("0", wallStart.x, wallStart.y);
      labelLayer.front(); // 레이블 위로
      detectClosedSpaces(); // 닫힌 공간 감지
      saveState(); // 상태 저장
    }
  };
  
  // ===== 사각형 ===== //
  // 사각형 그리기 관련 변수들
  let rectPreview = null;         // 사각형 미리보기
  let widthLabel = null;          // 가로 길이 레이블
  let heightLabel = null;         // 세로 길이 레이블
  // 사각형 그리기 관련 함수들
  const rectControls = {
    // 1. 시작작
    start: (coords) => {
      if (!isWithinBoundary(coords)) return;
      // 현재 상태 저장
      saveState();
      // 시작점 스냅
      const snappedStart = getSnapPoint(coords, wallLayer.children(), true);
      toolState.rectStart = snappedStart;
      // 미리보기 요소 생성
      toolState.rectPreview = draw.group().addClass('rect-preview');
      toolState.rectPreview.line(0, 0, 0, 0).stroke({ width: toolState.wallThickness, color: "#999", dasharray: "5,5" });
      toolState.rectPreview.line(0, 0, 0, 0).stroke({ width: toolState.wallThickness, color: "#999", dasharray: "5,5" });
      toolState.rectPreview.line(0, 0, 0, 0).stroke({ width: toolState.wallThickness, color: "#999", dasharray: "5,5" });
      toolState.rectPreview.line(0, 0, 0, 0).stroke({ width: toolState.wallThickness, color: "#999", dasharray: "5,5" });
      toolState.rectLabels.width = createLabel("0", snappedStart.x, snappedStart.y - 100);
      toolState.rectLabels.height = createLabel("0", snappedStart.x + 100, snappedStart.y);
    },
    // 2. 미리보기
    preview: (coords) => {
      if (!toolState.rectStart || !coords) return;
      // 현재 마우스 위치를 스냅
      const snappedEnd = getSnapPoint(coords, wallLayer.children(), true);
      // 사각형의 네 모서리 좌표 계산
      const x1 = toolState.rectStart.x;
      const y1 = toolState.rectStart.y;
      const x2 = snappedEnd.x;
      const y2 = snappedEnd.y;
      // 미리보기 선 업데이트
      const lines = toolState.rectPreview.children();
      lines[0].plot(x1, y1, x2, y1);  // 위쪽 선
      lines[1].plot(x2, y1, x2, y2);  // 오른쪽 선
      lines[2].plot(x2, y2, x1, y2);  // 아래쪽 선
      lines[3].plot(x1, y2, x1, y1);  // 왼쪽 선
      // 길이 레이블 업데이트
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      toolState.rectLabels.width.text(`${width}mm`).center((x1 + x2) / 2, Math.min(y1, y2) - 100);
      toolState.rectLabels.height.text(`${height}mm`).center(Math.max(x1, x2) + 100, (y1 + y2) / 2);
    },
    // 3. 끝끝
    finish: (coords) => {
      if (!toolState.rectStart || !coords) return;
      // 현재 마우스 위치를 스냅
      const snappedEnd = getSnapPoint(coords, wallLayer.children(), true);
      // 사각형의 네 모서리 좌표 계산
      const x1 = toolState.rectStart.x;
      const y1 = toolState.rectStart.y;
      const x2 = snappedEnd.x;
      const y2 = snappedEnd.y;
      // 사각형의 네 변을 순서대로 그리기
      const lines = [
        { start: { x: x1, y: y1 }, end: { x: x2, y: y1 } }, // 위쪽
        { start: { x: x2, y: y1 }, end: { x: x2, y: y2 } }, // 오른쪽
        { start: { x: x2, y: y2 }, end: { x: x1, y: y2 } }, // 아래쪽
        { start: { x: x1, y: y2 }, end: { x: x1, y: y1 } }  // 왼쪽
      ];
      // 각 변마다 교차점 처리 및 벽 생성
      lines.forEach(line => {
        const walls = wallLayer.children();
        const intersections = findIntersections(line.start, line.end, walls);
        if (intersections.length > 0) {
          // 교차점이 있으면 기존 벽을 분할하고 새 벽 생성
          intersections.forEach(intersection => splitWallAtIntersection(intersection));
          createWallWithIntersections(line.start, line.end, intersections);
        } else {
          // 교차점이 없으면 새 벽만 생성
          const wall = wallLayer.line(line.start.x, line.start.y, line.end.x, line.end.y)
            .stroke({ width: toolState.wallThickness, color: "#999" })
            .data('wallThickness', toolState.wallThickness);
          // 길이 레이블 추가
          const distance = calculateDistance(line.start, line.end);
          if (Math.abs(line.end.y - line.start.y) < 1) { // 가로 벽
            createLabel(distance, (line.start.x + line.end.x) / 2, line.start.y - 100);
          } else { // 세로 벽
            createLabel(distance, line.start.x + 100, (line.start.y + line.end.y) / 2);
          }
        }
        // 끝점마다 키포인트 추가
        drawKeyPoint(line.start.x, line.start.y);
      });
      // 마지막 모서리 포인트 추가
      drawKeyPoint(x1, y1);
      // 미리보기 요소들 제거
      rectControls.cleanup();
      // 닫힌 공간 감지 및 상태 저장
      detectClosedSpaces();
      saveState();
    },
    cleanup: () => {
      toolState.rectPreview?.remove();
      toolState.rectLabels.width?.remove();
      toolState.rectLabels.height?.remove();
      toolState.rectPreview = null;
      toolState.rectLabels.width = null;
      toolState.rectLabels.height = null;
      toolState.rectStart = null;
      labelLayer.front();
    }
  };

  // ===== 유틸리티 ===== //
  // 영역 확인 함수
  const isWithinBoundary = (point) => Math.abs(point.x) <= 50000 && Math.abs(point.y) <= 50000;
  // 점과 선분 거리 계산 함수
  const pointToLineDistance = (point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };
  // 직각 보정 함수
  const getOrthogonalPoint = (start, end) => roundPoint({
    x: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? end.x : start.x,
    y: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? start.y : end.y
  });
  // 좌표 보정 함수
  const snapToMillimeter = (value) => Math.round(value / 1) * 1;
  // 점 보정 함수
  const roundPoint = (point) => ({
    x: snapToMillimeter(point.x),
    y: snapToMillimeter(point.y),
  });
  // 교차점 계산 함수
  const getIntersectionPoint = (line1Start, line1End, line2Start, line2End) => {
    const denominator = (line2End.y - line2Start.y) * (line1End.x - line1Start.x) -
                      (line2End.x - line2Start.x) * (line1End.y - line1Start.y);
    if (denominator === 0) return null;
    const ua = ((line2End.x - line2Start.x) * (line1Start.y - line2Start.y) -
                (line2End.y - line2Start.y) * (line1Start.x - line2Start.x)) / denominator;
    const ub = ((line1End.x - line1Start.x) * (line1Start.y - line2Start.y) -
                (line1End.y - line1Start.y) * (line1Start.x - line2Start.x)) / denominator;
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
    return roundPoint({
      x: line1Start.x + ua * (line1End.x - line1Start.x),
      y: line1Start.y + ua * (line1End.y - line1Start.y)
    });
  };
  // 교차점 찾고 정렬하는 함수
  const findIntersections = (newStart, newEnd, existingWalls) => {
    const intersections = [];
    existingWalls.forEach(wall => {
      const wallStart = { x: wall.attr('x1'), y: wall.attr('y1') };
      const wallEnd = { x: wall.attr('x2'), y: wall.attr('y2') };
      const intersection = getIntersectionPoint(newStart, newEnd, wallStart, wallEnd);
      if (intersection) {
        const labels = labelLayer.find('.length-label');
        labels.forEach(label => {
          const labelX = parseFloat(label.attr('x'));
          const labelY = parseFloat(label.attr('y'));
          if (isPointNearLine(labelX, labelY, wallStart, wallEnd)) {
            label.remove();
          }
        });
        intersections.push({
          point: intersection,
          wall: wall
        });
      }
    });
    return intersections.sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.point.x - newStart.x, 2) + 
        Math.pow(a.point.y - newStart.y, 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.point.x - newStart.x, 2) + 
        Math.pow(b.point.y - newStart.y, 2)
      );
      return distA - distB;
    });
  };
  // 교차점 기준으로 분할 함수
  const splitWallAtIntersection = (intersection) => {
    const { point, wall } = intersection;
    const wallStart = { x: wall.attr('x1'), y: wall.attr('y1') };
    const wallEnd = { x: wall.attr('x2'), y: wall.attr('y2') };
    const originalThickness = wall.data('wallThickness') || wall.attr('stroke-width');
    wall.remove();
    if (calculateDistance(wallStart, point) > 0) {
      wallLayer.line(wallStart.x, wallStart.y, point.x, point.y)
        .stroke({ width: originalThickness, color: "#999" })
        .data('wallThickness', originalThickness);
      const distance1 = calculateDistance(wallStart, point);
      createLabel(distance1, (wallStart.x + point.x) / 2, (wallStart.y + point.y) / 2);
    }
    if (calculateDistance(point, wallEnd) > 0) {
      wallLayer.line(point.x, point.y, wallEnd.x, wallEnd.y)
        .stroke({ width: originalThickness, color: "#999" })
        .data('wallThickness', originalThickness);;
      const distance2 = calculateDistance(point, wallEnd);
      createLabel(distance2, (point.x + wallEnd.x) / 2, (point.y + wallEnd.y) / 2);
    }
    drawKeyPoint(point.x, point.y);
  };
  // 점이 선분 근처에 있는지 확인 함수
  const isPointNearLine = (px, py, lineStart, lineEnd) => {
    const buffer = toolState.wallThickness;
    const lineLength = Math.sqrt(
      Math.pow(lineEnd.x - lineStart.x, 2) + 
      Math.pow(lineEnd.y - lineStart.y, 2)
    );
    const d1 = Math.sqrt(Math.pow(px - lineStart.x, 2) + Math.pow(py - lineStart.y, 2));
    const d2 = Math.sqrt(Math.pow(px - lineEnd.x, 2) + Math.pow(py - lineEnd.y, 2));
    const tolerance = buffer;
    return Math.abs(d1 + d2 - lineLength) <= tolerance;
  };
  // 교차점 고려 새 벽 생성 함수
  const createWallWithIntersections = (start, end, intersections) => {
    const existingLabels = labelLayer.find('.length-label');
    let currentStart = start;
    const segments = [...intersections, { point: end }];
    segments.forEach((current, index) => {
      const { point, wall } = current;
      if (calculateDistance(currentStart, point) > 1) {
        wallLayer.line(currentStart.x, currentStart.y, point.x, point.y)
          .stroke({ width: toolState.wallThickness, color: "#999" })
          .data('wallThickness', toolState.wallThickness);
        const distance = calculateDistance(currentStart, point);
        createLabel(distance, (currentStart.x + point.x) / 2, (currentStart.y + point.y) / 2);
      }
      currentStart = point;
    });
  };
  // 스냅 함수
  const getSnapPoint = (currentPoint, walls, isStart = false) => {
    currentPoint = roundPoint(currentPoint);
    const SNAP_THRESHOLD = toolState.snapDistance;
    if (isStart) {
      let closestKeyPoint = null;
      let minKeyDistance = SNAP_THRESHOLD;
      walls.forEach(wall => {
        const keyPoints = [
          roundPoint({ x: wall.attr('x1'), y: wall.attr('y1') }),
          roundPoint({ x: wall.attr('x2'), y: wall.attr('y2') })
        ];
        keyPoints.forEach(point => {
          const distance = Math.sqrt(
            Math.pow(point.x - currentPoint.x, 2) + 
            Math.pow(point.y - currentPoint.y, 2)
          );
          if (distance < minKeyDistance) {
            minKeyDistance = distance;
            closestKeyPoint = point;
          }
        });
      });
      if (closestKeyPoint) return closestKeyPoint;
      let closestPerp = null;
      let minPerpDistance = SNAP_THRESHOLD;
      walls.forEach(wall => {
        const start = roundPoint({ x: wall.attr('x1'), y: wall.attr('y1') });
        const end = roundPoint({ x: wall.attr('x2'), y: wall.attr('y2') });
        const isHorizontal = Math.abs(start.y - end.y) < Math.abs(start.x - end.x);
        const perpPoint = roundPoint(isHorizontal 
          ? { x: currentPoint.x, y: start.y }
          : { x: start.x, y: currentPoint.y });
        const inRange = isHorizontal
          ? perpPoint.x >= Math.min(start.x, end.x) && 
            perpPoint.x <= Math.max(start.x, end.x)
          : perpPoint.y >= Math.min(start.y, end.y) &&
            perpPoint.y <= Math.max(start.y, end.y);
        if (inRange) {
          const distance = Math.sqrt(
            Math.pow(perpPoint.x - currentPoint.x, 2) + 
            Math.pow(perpPoint.y - currentPoint.y, 2)
          );
          if (distance < minPerpDistance) {
            minPerpDistance = distance;
            closestPerp = perpPoint;
          }
        }
      });
      return closestPerp || currentPoint;
    }
    let closestPoint = null;
    let minDistance = SNAP_THRESHOLD;
    walls.forEach(wall => {
      const start = roundPoint({ x: wall.attr('x1'), y: wall.attr('y1') });
      const end = roundPoint({ x: wall.attr('x2'), y: wall.attr('y2') });
      const mid = roundPoint({
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      });
      const isHorizontal = Math.abs(start.y - end.y) < Math.abs(start.x - end.x);
      const perpendicularPoint = roundPoint(isHorizontal 
        ? { x: currentPoint.x, y: start.y }
        : { x: start.x, y: currentPoint.y });
      const inRange = isHorizontal
        ? perpendicularPoint.x >= Math.min(start.x, end.x) && 
          perpendicularPoint.x <= Math.max(start.x, end.x)
        : perpendicularPoint.y >= Math.min(start.y, end.y) &&
          perpendicularPoint.y <= Math.max(start.y, end.y);
      const points = [start, end, mid];
      if (inRange) {
        points.push(perpendicularPoint);
      }
      points.forEach(point => {
        const distance = Math.sqrt(
          Math.pow(point.x - currentPoint.x, 2) + 
          Math.pow(point.y - currentPoint.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      });
    });
    return closestPoint ? roundPoint(closestPoint) : currentPoint;
  };
  // 두 점 거리 계산 함수
  const calculateDistance = (start, end) => {
    start = roundPoint(start);
    end = roundPoint(end);
    return Math.round(Math.sqrt(
      Math.pow(end.x - start.x, 2) + 
      Math.pow(end.y - start.y, 2)
    )).toString();
  }
  // 마우스 좌표 -> SVG좌표 함수
  const getSVGCoordinates = (event) => {
    const point = draw.node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(draw.node.getScreenCTM().inverse());
  };
  // 길이 레이블 생성 함수
  const createLabel = (text, x, y) => {
    const label = draw.text(`${text}mm`)
      .font({ size: viewbox.width * 0.025, anchor: "middle" })  // 크기와 중앙 정렬
      .fill("#000")  // 검은색 글자
      .center(x, y)  // 위치 설정
      .addClass("length-label")  // 크기 조절을 위한 클래스
      .css({ "pointer-events": "none" });
    labelLayer.add(label);  // 레이블 레이어에 추가
    labelLayer.front();  // 최상단에 표시
    return label;
  };
  // 길이 라벨 갱신 함수
  const updateLabel = (label, distance, start, end) => {
    if (!label) return;
    const midX = (start.x + end.x) / 2;  // 벽의 중간 x좌표
    const midY = (start.y + end.y) / 2;  // 벽의 중간 y좌표
    label.text(`${distance}mm`).center(midX, midY);  // 위치와 텍스트 갱신
  };
  // 벽 미리보기 제거 함수
  const cleanupPreview = () => {
    wallPreview?.remove();  // 미리보기 선 제거
    lengthLabel?.remove();  // 길이 레이블 제거
    wallPreview = null;  
    lengthLabel = null;
    labelLayer.front();  // 레이블 레이어 최상단으로
  };
  // 닫힌 공간 감지 함수 (개선 : 갈아엎을 예정)
  const detectClosedSpaces = () => {
    const walls = wallLayer.children();
    const segments = [];
    const points = new Set();
    const connections = new Map();
    // 벽 세그먼트와 연결점 정보 수집
    walls.forEach(wall => {
      const x1 = Math.round(parseFloat(wall.attr('x1')));
      const y1 = Math.round(parseFloat(wall.attr('y1')));
      const x2 = Math.round(parseFloat(wall.attr('x2')));
      const y2 = Math.round(parseFloat(wall.attr('y2')));
      const p1 = `${x1},${y1}`;
      const p2 = `${x2},${y2}`;
      points.add(p1);
      points.add(p2);
      // 양방향 연결 정보 저장
      if (!connections.has(p1)) connections.set(p1, new Set());
      if (!connections.has(p2)) connections.set(p2, new Set());
      connections.get(p1).add(p2);
      connections.get(p2).add(p1);
      segments.push({ x1, y1, x2, y2 });
    });
    // 모든 가능한 시작점에서 닫힌 경로 찾기
    const closedPaths = [];
    const pointsArray = Array.from(points);
    // 각 시작점에서 모든 가능한 닫힌 경로 찾기
    for (let i = 0; i < pointsArray.length; i++) {
      const start = pointsArray[i];
      const pathsFromStart = [];
      findClosedPath(start, connections, new Set(), [start], pathsFromStart);
      closedPaths.push(...pathsFromStart);
    }
    // 기존 채우기 제거
    spaceLayer.clear();
    labelLayer.find('.area-label').forEach(label => label.remove());
    // 찾은 각 닫힌 공간을 채우기
    const uniquePaths = removeDuplicatePaths(closedPaths);
    uniquePaths.forEach(path => {
      if (path.length >= 4) {  // 최소 4개의 점이 필요
        const points = path.map(coords => coords).join(' ');
        // 다각형 그리기
        spaceLayer.polygon(points)
          .fill({ color: '#e6e6e6', opacity: 0.3 })
          .stroke({ width: 0 })
          .addClass('space-fill');
      }
    });
    fillEmptyCorners(); // 모서리 갱신
  };
  // 주어진 시작점에서 닫힌 경로 찾기 함수
  const findClosedPath = (current, connections, visited, path, allPaths) => {
    const neighbors = connections.get(current);
    // 현재 경로가 3개 이상의 점을 가지고 있고, 시작점으로 돌아올 수 있는 경우
    if (path.length >= 3 && neighbors.has(path[0])) {
      // 유효한 닫힌 경로를 찾으면 결과 배열에 추가
      allPaths.push([...path]);
      // 계속해서 다른 경로도 찾기 위해 null 대신 false 반환
      return false;
    }
    // 이웃한 점들을 순회하며 경로 탐색
    for (const next of neighbors) {
      const edge = `${current}-${next}`;
      if (!visited.has(edge)) {
        // 이미 방문한 점인지 확인 (시작점 제외)
        if (path.length > 0 && path.includes(next) && next !== path[0]) {
          continue;
        }
        visited.add(edge);
        visited.add(`${next}-${current}`);
        findClosedPath(next, connections, visited, [...path, next], allPaths);
        visited.delete(edge);
        visited.delete(`${next}-${current}`);
      }
    }
    return false;
  };
  // 중복된 경로 제거
  const removeDuplicatePaths = (paths) => {
    const uniquePaths = new Set();
    paths.forEach(path => {
      if (path.length >= 4) {  // 최소 4개의 점이 필요
        // 경로를 정규화(시작점을 가장 작은 좌표로)
        const normalized = normalizePath(path);
        // 면적이 0보다 큰 경로만 추가
        const coords = normalized.map(point => {
          const [x, y] = point.split(',').map(Number);
          return [x, y];
        });
        const area = Math.abs(calculatePolygonArea(coords));
        if (area > 100) {  // 최소 면적 기준 (예: 100mm²)
          uniquePaths.add(normalized.join(' '));
        }
      }
    });
    return Array.from(uniquePaths).map(pathStr => pathStr.split(' '));
  };
  // 경로 정규화 (시작점을 가장 작은 좌표로)
  const normalizePath = (path) => {
    let minIndex = 0;
    let minValue = path[0];
    for (let i = 1; i < path.length; i++) {
      if (path[i] < minValue) {
        minValue = path[i];
        minIndex = i;
      }
    }
    return [
      ...path.slice(minIndex),
      ...path.slice(0, minIndex)
    ];
  };
  // 다각형의 면적을 계산하는 함수
  const calculatePolygonArea = (points) => {
    let area = 0;
    const numPoints = points.length;
    for (let i = 0; i < numPoints; i++) {
      const j = (i + 1) % numPoints;
      const [x1, y1] = points[i];
      const [x2, y2] = points[j];
      area += x1 * y2;
      area -= y1 * x2;
    }
    return Math.abs(area) / 2;
  };
  // 키 생성 함수
  const drawKeyPoint = (x, y) => {
    const keySize = viewbox.width * 0.02;
    const key = draw.circle(keySize)
      .fill("#fff")
      .stroke({ color: "#000", width: keySize * 0.1 })
      .center(x, y)
      .addClass("key");
    labelLayer.add(key);
    key.front();
    return key;
  };

  // ===== 도구 이벤트 설정 ===== //
  const tools = {
    // 1. 선택
    select: {
      onClick: event => { // 클릭
        const coords = getSVGCoordinates(event);
        // 이전 선택 해제
        if (selection.selectedWall) {
          selection.selectedWall.stroke({ color: "#999" });
          selection.selectedWall = null;
        }
        // 벽 선택 (클릭한 점에서 가장 가까운 벽 찾기)
        const walls = wallLayer.children();
        let closestWall = null;
        let minDistance = Infinity;
        walls.forEach(wall => {
          const start = { x: wall.attr('x1'), y: wall.attr('y1') };
          const end = { x: wall.attr('x2'), y: wall.attr('y2') };
          // 점과 선분 사이의 최단 거리 계산
          const distance = pointToLineDistance(coords, start, end);
          // 선택 허용 범위 내에서 가장 가까운 벽 찾기
          if (distance < minDistance && distance < toolState.snapDistance) {
            minDistance = distance;
            closestWall = wall;
          }
        });
        // 가장 가까운 벽이 있으면 선택
        if (closestWall) {
          selection.selectedWall = closestWall;
          selection.selectedWall.stroke({ color: "#007bff" }); // 선택된 벽 강조
        }
      },
      onMouseDown: panControls.start, // 마우스 다운
      onMouseMove: panControls.move, // 드래그
      onMouseUp: panControls.stop // 마우스 업
    },
    // 2. 벽
    wall: {
      onClick: event => { // 클릭
        const coords = getSVGCoordinates(event);
        !wallStart ? wallControls.start(coords) : wallControls.finish(coords);
      },
      onMouseMove: event => wallControls.preview(getSVGCoordinates(event)) // 이동
    },
    // 3. 사각형
    rect: {
      onClick: event => {
        const coords = getSVGCoordinates(event);
        !toolState.rectStart ? rectControls.start(coords) : rectControls.finish(coords);
      },
      onMouseMove: event => {
        if (toolState.rectStart) {
          rectControls.preview(getSVGCoordinates(event));
        }
      }
    }
  };
  
  // ===== 리턴 ===== //
  return {
    toolState,
    selection,
    getSelectedWallThickness,
    updateSelectedWallThickness,
    initializeCanvas,
    executeToolEvent,
    zoomCanvas,
    handleKeyDown,
    setWallThickness: (thickness) => { // 벽 두께 설정
      const newThickness = Number(thickness);
      if (newThickness > 0) {
        toolState.wallThickness = newThickness;
      }
    },
    setSnapDistance: (distance) => { // 스냅 거리 설정
      const newDistance = Number(distance);
      if (newDistance > 0) {
        toolState.snapDistance = newDistance;
      }
    },
    undo,
    redo,
    detectClosedSpaces
  };

});