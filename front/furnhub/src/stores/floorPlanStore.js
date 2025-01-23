import { defineStore } from "pinia";
import { SVG } from "@svgdotjs/svg.js";
import { reactive } from "vue";

export const useFloorPlanStore = defineStore("floorPlanStore", () => {
  // === 기본 상태 관리 ===
  let draw = null;  // SVG 그리기 객체
  let labelLayer = null;  // 레이블을 담는 레이어 (텍스트, 키 포인트 등)
  const toolState = reactive({ 
    currentTool: "select",
    wallThickness: 100  // 기본 벽 두께 100mm
  });  // 현재 선택된 도구 상태
  const viewbox = reactive({ x: -3000, y: -3000, width: 6000, height: 6000 });  // 화면 뷰박스 설정
  
  // === 벽 그리기 관련 상태 ===
  let wallStart = null;  // 벽 시작점 좌표
  let wallPreview = null;  // 미리보기 선
  let lengthLabel = null;  // 길이 표시 레이블
  
  // === 캔버스 초기화 ===
  const initializeCanvas = (canvasElement) => {
    // SVG 캔버스 생성 및 기본 설정
    draw = SVG().addTo(canvasElement).size("100%", "100%");
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    addGrid();  // 그리드 추가
    labelLayer = draw.group().addClass("label-layer").front();  // 레이블 레이어 생성
  };

  // === 그리드 시스템 ===
  const addGrid = () => {
    const BOUNDARY = { minX: -50000, minY: -50000, maxX: 50000, maxY: 50000 };  // 그리드 경계
    draw.find(".grid-line").forEach(line => line.remove());  // 기존 그리드 제거
    
    // 작은 그리드 (100단위) 및 큰 그리드 (1000단위) 그리기
    for (let y = BOUNDARY.minY; y <= BOUNDARY.maxY; y += 100) {
      draw.line(BOUNDARY.minX, y, BOUNDARY.maxX, y)
        .stroke({ width: y % 1000 === 0 ? 1 : 0.5, color: y % 1000 === 0 ? "#111" : "#555" })
        .addClass("grid-line");
    }
    
    for (let x = BOUNDARY.minX; x <= BOUNDARY.maxX; x += 100) {
      draw.line(x, BOUNDARY.minY, x, BOUNDARY.maxY)
        .stroke({ width: x % 1000 === 0 ? 1 : 0.5, color: x % 1000 === 0 ? "#111" : "#555" })
        .addClass("grid-line");
    }

    // 중앙선 (십자선) 그리기
    draw.line(BOUNDARY.minX, 0, BOUNDARY.maxX, 0).stroke({ width: 10, color: '#000' }).addClass("grid-line");
    draw.line(0, BOUNDARY.minY, 0, BOUNDARY.maxY).stroke({ width: 10, color: '#000' }).addClass("grid-line");
    
    // 경계선 그리기
    [BOUNDARY.minX, BOUNDARY.maxX].forEach(x => {
      draw.line(x, BOUNDARY.minY, x, BOUNDARY.maxY).stroke({ width: 50, color: '#f00' }).addClass("grid-line");
    });
    [BOUNDARY.minY, BOUNDARY.maxY].forEach(y => {
      draw.line(BOUNDARY.minX, y, BOUNDARY.maxX, y).stroke({ width: 50, color: '#f00' }).addClass("grid-line");
    });
  };

  // === 화면 확대/축소 ===
  const zoomCanvas = (event) => {
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;  // 마우스 휠 방향에 따른 확대/축소 비율
    
    // 마우스 커서 위치를 SVG 좌표로 변환
    const cursorPoint = draw.node.createSVGPoint();
    cursorPoint.x = event.clientX;
    cursorPoint.y = event.clientY;
    const cursorSVGPoint = cursorPoint.matrixTransform(draw.node.getScreenCTM().inverse());
    
    // 새로운 뷰박스 크기 계산
    const newWidth = viewbox.width * zoomFactor;
    const newHeight = viewbox.height * zoomFactor;
    const dx = (cursorSVGPoint.x - viewbox.x) * (newWidth / viewbox.width - 1);
    const dy = (cursorSVGPoint.y - viewbox.y) * (newHeight / viewbox.height - 1);

    // 뷰박스 업데이트
    Object.assign(viewbox, {
      x: viewbox.x - dx,
      y: viewbox.y - dy,
      width: newWidth,
      height: newHeight
    });
    
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    updateFontSizes();  // 텍스트 크기 조정
    updateKeySizes();   // 키 포인트 크기 조정
    labelLayer.front(); // 레이블 레이어를 최상단으로
  };

  // === 화면 이동 (패닝) ===
  let isPanning = false;  // 화면 이동 중인지 여부
  let panStart = { x: 0, y: 0 };  // 화면 이동 시작 좌표

  const panControls = {
    start: (event) => {  // 화면 이동 시작
      isPanning = true;
      panStart = { x: event.clientX, y: event.clientY };
    },
    move: (event) => {   // 화면 이동 중
      if (!isPanning) return;
      const dx = (event.clientX - panStart.x) * viewbox.width / draw.node.clientWidth;
      const dy = (event.clientY - panStart.y) * viewbox.height / draw.node.clientHeight;
      Object.assign(viewbox, { x: viewbox.x - dx, y: viewbox.y - dy });
      draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
      panStart = { x: event.clientX, y: event.clientY };
    },
    stop: () => isPanning = false  // 화면 이동 종료
  };

  // === 벽 그리기 기능 ===
  // 길이 레이블 업데이트
  const updateLengthLabel = (label, distance, start, end) => {
    if (!label) return;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    label.text(`${distance}m`).center(midX, midY - 20);
  };

  const wallControls = {
    start: (coords) => {
      if (!isWithinBoundary(coords.x, coords.y)) return;
      const snapPoint = findNearestSnapPoint(coords);
      wallStart = snapPoint || coords;
      
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
      lengthLabel = createLengthLabel("0.00", wallStart.x, wallStart.y);
    },
  
    preview: (coords) => {
      if (!wallStart) return;
      if (!wallPreview) {
        wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
          .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
        lengthLabel = createLengthLabel("0.00", wallStart.x, wallStart.y);
      }
    
      const snapPoint = findNearestSnapPoint(coords);
      const targetPoint = snapPoint || coords;
      const dx = Math.abs(targetPoint.x - wallStart.x);
      const dy = Math.abs(targetPoint.y - wallStart.y);
      const isHorizontal = dx > dy;
      
      const adjustedCoords = {
        x: isHorizontal ? targetPoint.x : wallStart.x,
        y: isHorizontal ? wallStart.y : targetPoint.y
      };
        
      wallPreview.plot(wallStart.x, wallStart.y, adjustedCoords.x, adjustedCoords.y);
      const distance = calculateDistance(wallStart.x, wallStart.y, adjustedCoords.x, adjustedCoords.y);
      updateLengthLabel(lengthLabel, distance, wallStart, adjustedCoords);
      labelLayer.front();
    },
  
    finish: (coords) => {
      if (!wallStart) return;
      const snapPoint = findNearestSnapPoint(coords);
      const adjustedCoords = getOrthogonalPoint(wallStart, snapPoint || coords);
      
      draw.line(wallStart.x, wallStart.y, adjustedCoords.x, adjustedCoords.y)
        .stroke({ width: toolState.wallThickness, color: "#999" });
      drawKey(wallStart.x, wallStart.y);
      drawKey(adjustedCoords.x, adjustedCoords.y);
  
      const distance = calculateDistance(wallStart.x, wallStart.y, adjustedCoords.x, adjustedCoords.y);
      const midPoint = {
        x: (wallStart.x + adjustedCoords.x) / 2,
        y: (wallStart.y + adjustedCoords.y) / 2
      };
      createLengthLabel(distance, midPoint.x, midPoint.y - 20);
      labelLayer.front();
      
      wallStart = adjustedCoords;
      
      if (wallPreview) {
        wallPreview.remove();
        wallPreview = null;
      }
      if (lengthLabel) {
        lengthLabel.remove();
        lengthLabel = null;
      }
    }
  };

  // === 벽 두께 설정 함수 ===
  const setWallThickness = (thickness) => {
    toolState.wallThickness = Number(thickness);
  };

  // === 유틸리티 함수 ===
  // 마우스 좌표를 SVG 좌표로 변환
  const getSVGCoordinates = (event) => {
    const point = draw.node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(draw.node.getScreenCTM().inverse());
  };

  // 좌표가 경계 내에 있는지 확인
  const isWithinBoundary = (x, y) => 
    x >= -50000 && x <= 50000 && y >= -50000 && y <= 50000;

  // 두 점 사이의 거리 계산
  const calculateDistance = (x1, y1, x2, y2) =>
    Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(2);

  // 벽 위의 가장 가까운 점을 찾는 함수
  const getPointOnWall = (wall, point) => {
    const x1 = wall.attr('x1');
    const y1 = wall.attr('y1');
    const x2 = wall.attr('x2'); 
    const y2 = wall.attr('y2');

    // 벽의 방향 벡터
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    // 점과 벽의 시작점을 이은 벡터
    const px = point.x - x1;
    const py = point.y - y1;

    // 벽 위로 투영
    const projection = (px * dx + py * dy) / length;
    const t = Math.max(0, Math.min(length, projection)) / length;

    return {
      x: x1 + t * dx,
      y: y1 + t * dy,
      distance: Math.abs(px * dy - py * dx) / length 
    };
  };

  // 가장 가까운 스냅 포인트를 찾는 함수 수정
  const findNearestSnapPoint = (point) => {
    const SNAP_THRESHOLD = 100;
    let minDistance = SNAP_THRESHOLD;
    let snapPoint = null;

    // 키 포인트 체크
    const keys = draw.find('.key');
    keys.forEach(key => {
      const keyCenter = {
        x: key.cx(),
        y: key.cy()
      };
      const distance = Math.sqrt(
        Math.pow(point.x - keyCenter.x, 2) + 
        Math.pow(point.y - keyCenter.y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        snapPoint = keyCenter;
      }
    });

    // 벽 위의 점 체크
    const walls = draw.find('line').filter(line => !line.hasClass('grid-line'));
    walls.forEach(wall => {
      const pointOnWall = getPointOnWall(wall, point);
      if (pointOnWall.distance < minDistance) {
        minDistance = pointOnWall.distance;
        snapPoint = {
          x: pointOnWall.x,
          y: pointOnWall.y
        };
      }
    });

    return snapPoint;
  };
  
  // 기존 getOrthogonalPoint 함수 수정
  const getOrthogonalPoint = (start, end) => {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const isHorizontal = dx > dy;
    
    // 먼저 스냅 포인트를 찾음
    const snapPoint = findNearestSnapPoint(end);
    
    // 직각이 적용된 좌표 계산
    const orthogonalPoint = {
      x: isHorizontal ? (snapPoint ? snapPoint.x : end.x) : start.x,
      y: isHorizontal ? start.y : (snapPoint ? snapPoint.y : end.y)
    };
  
    return orthogonalPoint;
  };

  // 벽 그리기 관련 객체 정리
  const cleanupWallDrawing = () => {
    wallPreview?.remove();
    lengthLabel?.remove();
    wallPreview = null;
    lengthLabel = null;
    wallStart = null;
    labelLayer.front();
  };

  // === 키와 레이블 관리 ===
  // 폰트 크기 업데이트
  const updateFontSizes = () => {
    const fontSize = viewbox.width * 0.025;
    draw.find(".length-label").forEach(label => {
      label.font({ size: fontSize });
      label.front();
    });
  };

  // 키 포인트 크기 업데이트
  const updateKeySizes = () => {
    const keySize = viewbox.width * 0.02;
    draw.find(".key").forEach(key => {
      const { cx, cy } = key.attr();
      key.size(keySize, keySize)
        .stroke({ width: keySize * 0.1 })
        .center(cx, cy);
    });
  };

  // 키 포인트 생성
  const drawKey = (x, y) => {
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

  // 길이 레이블 생성
  const createLengthLabel = (text, x, y) => {
    const label = draw.text(`${text}m`)
      .font({ size: viewbox.width * 0.025, anchor: "middle" })
      .fill("#000")
      .center(x, y)
      .addClass("length-label");
    labelLayer.add(label);
    label.front();
    return label;
  };

  // === 도구 이벤트 핸들러 ===
  const tools = {
    select: {  // 선택 도구 (화면 이동)
      onMouseDown: panControls.start,
      onMouseMove: panControls.move,
      onMouseUp: panControls.stop
    },
    wall: {    // 벽 그리기 도구
      onClick: event => {
        const coords = getSVGCoordinates(event);
        if (!wallStart) {
          wallControls.start(coords);  // 첫 번째 클릭 - 시작점
        } else {
          wallControls.finish(coords); // 두 번째 클릭 - 종료점
        }
      },
      onMouseMove: event => wallControls.preview(getSVGCoordinates(event))
    }
  };

  // 도구 이벤트 실행 함수
  const executeToolEvent = (eventName, event) => {
    const tool = tools[toolState.currentTool];
    if (tool?.[eventName]) tool[eventName](event);
  };

  // ESC 키 처리
  const handleKeyDown = (event) => {
    if (event.key === "Escape") cleanupWallDrawing();
  };

  return {
    toolState,
    initializeCanvas,
    executeToolEvent,
    zoomCanvas,
    handleKeyDown,
    setWallThickness,
  };
});