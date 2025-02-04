// store/floorPlanStore.js
import { defineStore } from "pinia";
import { SVG } from "@svgdotjs/svg.js";
import { reactive, computed, watch } from "vue";
import { v4 as uuidv4 } from "uuid";

// 이동스냅고쳐야됨
export const useFloorPlanStore = defineStore("floorPlanStore", () => {
  
  // 객체 선언
  let draw = null; // SVG 객체

  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  let wallLayer = null;
  let wallStart = null, wallPreview = null;

  const walls = reactive([]);

  const toolState = reactive({
    currentTool: "select",
    wallThickness: 100,
    snapDistance: 100,
  });

  let isMovingWall = false;
  let moveStartCoords = { x: 0, y: 0 };

  const selection = reactive({ selectedWallId: null });
  
  const selectedWall = computed(() => {
    return walls.find(wall => wall.id === selection.selectedWallId) || null;
  });

  const viewbox = reactive({ x: -3000, y: -3000, width: 6000, height: 6000 });
  
  // 팬 컨트롤
  const panControls = {
    start: (event) => {
      isPanning = true;
      panStart = { x: event.clientX, y: event.clientY };
    },
    move: (event) => {
      if (!isPanning) return;
      const dx = (event.clientX - panStart.x) * viewbox.width / draw.node.clientWidth;
      const dy = (event.clientY - panStart.y) * viewbox.height / draw.node.clientHeight;
      viewbox.x -= dx;
      viewbox.y -= dy;
      draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
      panStart = { x: event.clientX, y: event.clientY };
    },
    stop: () => isPanning = false
  };

  // 줌 컨트롤롤
  const zoomCanvas = (event) => {
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const point = draw.node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(draw.node.getScreenCTM().inverse());
    const newWidth = viewbox.width * zoomFactor;
    const newHeight = viewbox.height * zoomFactor;
    const dx = (svgPoint.x - viewbox.x) * (newWidth / viewbox.width - 1);
    const dy = (svgPoint.y - viewbox.y) * (newHeight / viewbox.height - 1);
    viewbox.x -= dx;
    viewbox.y -= dy;
    viewbox.width = newWidth;
    viewbox.height = newHeight;
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    updateVisualElements();
  };

  // 벽 생성 컨트롤
  const wallControls = {
    start: (coords) => {
      const snappedStart = getSnapPoint(coords, wallLayer.children());
      wallStart = {
        x: snapToMillimeter(snappedStart.x),
        y: snapToMillimeter(snappedStart.y),
      };
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: toolState.wallThickness, color: "#999", dasharray: "5,5" });
    },
    preview: (coords) => {
      if (!wallStart) return;
      const snappedEnd = getSnapPoint(coords, wallLayer.children());
      const end = getOrthogonalPoint(wallStart, snappedEnd);
      wallPreview?.plot(wallStart.x, wallStart.y, end.x, end.y);
    },
    finish: (coords) => {
      if (!wallStart) return;
  
  const snappedEnd = getSnapPoint(coords, wallLayer.children());
  const end = getOrthogonalPoint(wallStart, snappedEnd);
  
  const changes = wallCreationMethods.createWallWithIntersections(
    wallStart,
    end,
    toolState.wallThickness
  );
  
  wallCreationMethods.applyWallChanges(changes);
  
  wallPreview?.remove();
  wallStart = null;
  updateVisualElements();
    },
    cancel: () => {
      if (wallStart) {
        wallPreview?.remove();
        wallPreview = null;
        wallStart = null;
      }
    },
  };

  // 벽 이동 컨트롤롤
  const moveWallControls = {
    start: (event) => {
      if (!selection.selectedWallId) return;
      isMovingWall = true;
      moveStartCoords = getSVGCoordinates(event);
    },
    move: (event) => {
      if (!isMovingWall || !selection.selectedWallId) return;
      const currentCoords = getSVGCoordinates(event);
      const dx = currentCoords.x - moveStartCoords.x;
      const dy = currentCoords.y - moveStartCoords.y;
      const wall = walls.find(w => w.id === selection.selectedWallId);
      if (!wall) return;

      // 원래 벽의 길이와 각도 계산
      const originalLength = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
      const originalAngle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);

      // 새로운 시작점 계산 (스냅 포함)
      const newStart = getSnapPointForMove({ x: wall.x1 + dx, y: wall.y1 + dy }, walls, wall.id);

      // 원래 각도와 길이를 유지하면서 새로운 끝점 계산
      const newEnd = {
        x: newStart.x + originalLength * Math.cos(originalAngle),
        y: newStart.y + originalLength * Math.sin(originalAngle)
      };

      // 끝점에 대한 스냅 확인
      const snappedEnd = getSnapPointForMove(newEnd, walls, wall.id);

      // 끝점이 스냅된 경우, 시작점을 재조정하여 길이와 각도 유지
      if (snappedEnd.x !== newEnd.x || snappedEnd.y !== newEnd.y) {
        wall.x2 = snappedEnd.x;
        wall.y2 = snappedEnd.y;
        wall.x1 = snappedEnd.x - originalLength * Math.cos(originalAngle);
        wall.y1 = snappedEnd.y - originalLength * Math.sin(originalAngle);
      } else {
        // 시작점이 스냅된 경우
        wall.x1 = newStart.x;
        wall.y1 = newStart.y;
        wall.x2 = newEnd.x;
        wall.y2 = newEnd.y;
      }

      const wallElement = wallLayer.find(`[data-id='${wall.id}']`);
      if (wallElement) {
        wallElement.plot(wall.x1, wall.y1, wall.x2, wall.y2);
      }
      moveStartCoords = currentCoords;
      updateVisualElements();
    },
    stop: () => {
      isMovingWall = false;
      updateVisualElements();
    },
  };

  // == 유틸리티 함수들 == //

  // 직각 보정 함수
  const getOrthogonalPoint = (start, end) => roundPoint({
    x: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? end.x : start.x,
    y: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? start.y : end.y
  });

  // 좌표 보정 함수
  const snapToMillimeter = (value) => Math.round(value);

  // 점 보정 함수
  const roundPoint = (point) => ({
    x: snapToMillimeter(point.x),
    y: snapToMillimeter(point.y),
  });

  //  키 생성 함수
  const drawKeyPoint = (x, y) => {
    const keySize = viewbox.width * 0.02;
    draw.circle(keySize)
      .fill("#fff")
      .stroke({ color: "#000", width: keySize * 0.1 })
      .center(x, y)
      .addClass("key")
  };

  // 키 렌더링
  const renderKeyPoints = () => {
    draw.find('.key').forEach(key => key.remove());
    wallLayer.children().forEach(wall => {
      drawKeyPoint(parseFloat(wall.attr('x1')), parseFloat(wall.attr('y1')));
      drawKeyPoint(parseFloat(wall.attr('x2')), parseFloat(wall.attr('y2')));
    });
  };

  // 화면갱신
  const updateVisualElements = () => {
    renderKeyPoints();
  };

  // 이동용 스냅 함수
  const getSnapPointForMove = (currentPoint, walls, excludeId) => {
    currentPoint = roundPoint(currentPoint);
    const SNAP_THRESHOLD = toolState.snapDistance;
  
    let closestPoint = null;
    let minDistance = SNAP_THRESHOLD;
  
    for (const wall of walls) {
      if (wall.id === excludeId) continue; // 이동 중인 벽은 제외
  
      const start = { x: wall.x1, y: wall.y1 };
      const end = { x: wall.x2, y: wall.y2 };
  
      // 끝점 스냅 확인
      [start, end].forEach(point => {
        const distance = Math.hypot(point.x - currentPoint.x, point.y - currentPoint.y);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = { x: point.x, y: point.y };
        }
      });
    }
  
    return closestPoint ? roundPoint(closestPoint) : currentPoint;
  };

  /// 스냅 대상 찾기
  const getSnapPoint = (currentPoint, walls) => {
    currentPoint = roundPoint(currentPoint);
    const SNAP_THRESHOLD = toolState.snapDistance;

    for (const wall of walls) {
      const start = { x: +wall.attr('x1'), y: +wall.attr('y1') };
      const end = { x: +wall.attr('x2'), y: +wall.attr('y2') };

      if (Math.hypot(start.x - currentPoint.x, start.y - currentPoint.y) < SNAP_THRESHOLD) {
        return roundPoint(start);
      }
      if (Math.hypot(end.x - currentPoint.x, end.y - currentPoint.y) < SNAP_THRESHOLD) {
        return roundPoint(end);
      }
    }

    let closestPoint = null;
    let minDistance = SNAP_THRESHOLD;

    for (const wall of walls) {
      const start = { x: +wall.attr('x1'), y: +wall.attr('y1') };
      const end = { x: +wall.attr('x2'), y: +wall.attr('y2') };

      const projectedPoint = getClosestPointOnLine(start, end, currentPoint);
      const projectedDistance = Math.hypot(projectedPoint.x - currentPoint.x, projectedPoint.y - currentPoint.y);

      if (projectedDistance < minDistance) {
        minDistance = projectedDistance;
        closestPoint = projectedPoint;
      }
    }

    return closestPoint ? roundPoint(closestPoint) : currentPoint;
  };

  // 선분 위의 가장 가까운 점 찾기
  const getClosestPointOnLine = (start, end, point) => {
    const lengthSquared = Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2);
    if (lengthSquared === 0) return start;

    let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    return { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) };
  };

  // 벽 두께 설정 함수
  const setWallThickness = (thickness) => {
    const newThickness = Math.max(1, Number(thickness));
    toolState.wallThickness = newThickness;
  };

  // 스냅 거리 설정 함수
  const setSnapDistance = (distance) => {
    const newDistance = Math.max(1, Number(distance));
    toolState.snapDistance = newDistance;
  };

  // 벽 선택 함수
  const selectWall = (coords) => {
    if (!coords) return;
  
    const walls = wallLayer.children();
    let closestWallId = null;
    let minDistance = toolState.snapDistance;
  
    walls.forEach(wall => {
      const start = { x: +wall.attr('x1'), y: +wall.attr('y1') };
      const end = { x: +wall.attr('x2'), y: +wall.attr('y2') };
  
      const projectedPoint = getClosestPointOnLine(start, end, coords);
      const distance = Math.hypot(projectedPoint.x - coords.x, projectedPoint.y - coords.y);
  
      if (distance < minDistance) {
        minDistance = distance;
        closestWallId = wall.data('id');
      }
    });
    selection.selectedWallId = closestWallId;
    updateWallSelectionVisuals();
  };
  
  // 선택된 벽 강조 함수수
  const updateWallSelectionVisuals = () => {
    wallLayer.children().forEach(wall => {
      const wallData = walls.find(w => w.id === wall.data('id'));
      if (wallData) {
        if (wall.data('id') === selection.selectedWallId) {
          wall.stroke({ 
            color: "#007bff", 
            width: wallData.thickness + 2 
          });
        } else {
          wall.stroke({ 
            color: "#999", 
            width: wallData.thickness 
          });
        }
      }
    });
  };

  // 선택된 벽의 두께
  const selectedWallThickness = computed(() => {
    const wall = walls.find(wall => wall.id === selection.selectedWallId);
    return wall ? wall.thickness : 100;
  });

  // 선택된 벽의 두께 조절 함수
  const updateSelectedWallThickness = (newThickness) => {
    if (!selectedWall.value) return;
    let updatedThickness = typeof newThickness === "string" && newThickness.includes("+")
      ? selectedWall.value.thickness + 10
      : typeof newThickness === "string" && newThickness.includes("-")
      ? selectedWall.value.thickness - 10
      : parseInt(newThickness);
    if (isNaN(updatedThickness) || updatedThickness < 1) return;
    selectedWall.value.thickness = updatedThickness;
    const wallElement = wallLayer.find(`[data-id='${selectedWall.value.id}']`);
    if (wallElement) {
      wallElement.stroke({ width: updatedThickness });
    }
  };

  // 선택된 벽의 길이
  const selectedWallLength = computed(() => {
    if (!selectedWall.value) return 0;
    const { x1, y1, x2, y2 } = selectedWall.value;
    return Math.round(Math.hypot(x2 - x1, y2 - y1));
  });

  // 선택된 벽의 길이 변경 함수
  const updateSelectedWallLength = (newLength) => {
    if (!selectedWall.value) return;
    let updatedLength = typeof newLength === "string" && newLength.includes("+")
      ? selectedWallLength.value + 100
      : typeof newLength === "string" && newLength.includes("-")
      ? selectedWallLength.value - 100
      : parseInt(newLength);
    if (isNaN(updatedLength) || updatedLength < 1) return;
    const { x1, y1, x2, y2 } = selectedWall.value;
    const isHorizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
    const newX2 = isHorizontal ? x1 + (x2 > x1 ? updatedLength : -updatedLength) : x1;
    const newY2 = isHorizontal ? y1 : y1 + (y2 > y1 ? updatedLength : -updatedLength);
    selectedWall.value.x2 = newX2;
    selectedWall.value.y2 = newY2;
    const wallElement = wallLayer.find(`[data-id='${selectedWall.value.id}']`);
    if (wallElement) {
      wallElement.plot(x1, y1, newX2, newY2);
    }
    updateVisualElements();
  };

  // 클릭한 좌표에 가장 가까운 벽 찾기
  const getWallAtCoords = (coords) => {
    let closestWallId = null;
    let minDistance = toolState.snapDistance;
    walls.forEach(wall => {
      const start = { x: wall.x1, y: wall.y1 };
      const end = { x: wall.x2, y: wall.y2 };
      const projectedPoint = getClosestPointOnLine(start, end, coords);
      const distance = Math.hypot(projectedPoint.x - coords.x, projectedPoint.y - coords.y);
      if (distance < minDistance) {
        minDistance = distance;
        closestWallId = wall.id;
      }
    });
    return closestWallId;
  };

  // 선분 교차점 계산 함수
  const getIntersection = (line1, line2) => {
    const x1 = line1.x1, y1 = line1.y1;
    const x2 = line1.x2, y2 = line1.y2;
    const x3 = line2.x1, y3 = line2.y1;
    const x4 = line2.x2, y4 = line2.y2;
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denominator === 0) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  };

  // 벽 분할 함수
  const splitWallAtPoint = (wall, point) => {
    return [
      {
        id: uuidv4(),
        x1: wall.x1,
        y1: wall.y1,
        x2: point.x,
        y2: point.y,
        thickness: wall.thickness
      },
      {
        id: uuidv4(),
        x1: point.x,
        y1: point.y,
        x2: wall.x2,
        y2: wall.y2,
        thickness: wall.thickness
      }
    ];
  };

  // 벽 생성 및 분할 관련 메서드들
  const wallCreationMethods = {
    // 새로운 벽 생성
    createWall: (start, end, thickness) => {
      return {
        id: uuidv4(),
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        thickness: thickness,
      };
    },

    // 벽 렌더링
    renderWall: (wall) => {
      const element = wallLayer.line(wall.x1, wall.y1, wall.x2, wall.y2)
        .stroke({ width: wall.thickness, color: "#999" })
        .data('id', wall.id);
      return element;
    },

    // 교차점을 포함한 벽 생성
    createWallWithIntersections: (start, end, thickness) => {
      const newWall = wallCreationMethods.createWall(start, end, thickness);
      
      // 교차점 확인
      const intersections = [];
      const wallsToRemove = [];
      const newWalls = [];

      walls.forEach(existingWall => {
        const intersection = getIntersection(newWall, existingWall);
        if (intersection) {
          intersections.push({
            point: intersection,
            wall: existingWall
          });
          wallsToRemove.push(existingWall.id);
        }
      });

      // 교차점이 있는 경우 처리
      if (intersections.length > 0) {
        // 교차점들을 x 또는 y 좌표로 정렬
        intersections.sort((a, b) => {
          const dx1 = a.point.x - start.x;
          const dy1 = a.point.y - start.y;
          const dx2 = b.point.x - start.x;
          const dy2 = b.point.y - start.y;
          return Math.abs(dx1) > Math.abs(dy1) ? dx1 - dx2 : dy1 - dy2;
        });

        // 새로운 벽 생성
        let currentStart = { x: start.x, y: start.y };
        intersections.forEach(intersection => {
          // 교차점까지의 새 벽 생성
          const wallToIntersection = wallCreationMethods.createWall(
            currentStart,
            intersection.point,
            thickness
          );
          newWalls.push(wallToIntersection);
          
          currentStart = intersection.point;

          // 교차된 기존 벽 분할
          const splitWalls = splitWallAtPoint(intersection.wall, intersection.point);
          newWalls.push(...splitWalls);
        });

        // 마지막 구간 추가
        const finalWall = wallCreationMethods.createWall(
          currentStart,
          end,
          thickness
        );
        newWalls.push(finalWall);

        // 기존 벽 제거 및 새 벽 추가
        return {
          wallsToRemove,
          newWalls
        };
      }

      // 교차점이 없는 경우
      return {
        wallsToRemove: [],
        newWalls: [newWall]
      };
    },

    // 벽 변경 적용
    applyWallChanges: (changes) => {
      // 기존 벽 제거
      changes.wallsToRemove.forEach(id => {
        const wallElement = wallLayer.find(`[data-id='${id}']`)[0];
        if (wallElement) wallElement.remove();
        const index = walls.findIndex(w => w.id === id);
        if (index !== -1) walls.splice(index, 1);
      });

      // 새로운 벽 추가
      changes.newWalls.forEach(wall => {
        walls.push(wall);
        wallCreationMethods.renderWall(wall);
      });
    }
  };

  // == 유틸리티 함수들 == //

  // 그리드
  const addGrid = () => {
    const GRID_BOUNDARY = { min: -50000, max: 50000 };
    draw.find(".grid-line").forEach(line => line.remove());
    for (let i = GRID_BOUNDARY.min; i <= GRID_BOUNDARY.max; i += 100) {
      const color = i % 1000 === 0 ? "#111" : "#555";
      const width = i % 1000 === 0 ? 1 : 0.5;
      draw.line(GRID_BOUNDARY.min, i, GRID_BOUNDARY.max, i).stroke({ width, color }).addClass("grid-line");
      draw.line(i, GRID_BOUNDARY.min, i, GRID_BOUNDARY.max).stroke({ width, color }).addClass("grid-line");
    }
    draw.line(GRID_BOUNDARY.min, 0, GRID_BOUNDARY.max, 0).stroke({ width: 10, color: "#000" }).addClass("grid-line");
    draw.line(0, GRID_BOUNDARY.min, 0, GRID_BOUNDARY.max).stroke({ width: 10, color: "#000" }).addClass("grid-line");
    [GRID_BOUNDARY.min, GRID_BOUNDARY.max].forEach(pos => {
      draw.line(pos, GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max).stroke({ width: 50, color: "#f00" }).addClass("grid-line");
      draw.line(GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max, pos).stroke({ width: 50, color: "#f00" }).addClass("grid-line");
    });
  };

  // 캔버스 초기화
  const initializeCanvas = (canvasElement) => {
    draw = SVG().addTo(canvasElement).size("100%", "100%");
    addGrid();
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    wallLayer = draw.group().addClass("wall-layer");
  };
    
  // 마우스 좌표 -> SVG좌표 함수
  const getSVGCoordinates = (event) => {
    const point = draw.node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(draw.node.getScreenCTM().inverse());
  };

  // 단축키 처리 함수
  const handleKeyDown = (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    switch (event.key) {
      case "Escape": // ESC
        wallControls.cancel();
        break;
      case "Delete": // Delete
        break;
      case "1": toolState.currentTool = "select"; break; // 1 : 선택
      case "2": toolState.currentTool = "wall"; break; // 2 : 벽
      case "3": toolState.currentTool = "rect"; break; // 3 : 사각형
      case "4": toolState.currentTool = "cut"; break; // 4 : 자르기
      default:
        if (event.ctrlKey) { // Ctrl
          switch (event.key) {
            case "z": // Ctrl + z
              break;
            case "y": // Ctrl + y
              break;
          }
        }
        break;
    }
  };

  // === 도구 이벤트 설정 === //
  const tools = {
    select: {
      onClick: event => {
        const coords = getSVGCoordinates(event);
        selectWall(coords);
        updateWallSelectionVisuals();
      },
      onMouseDown: event => {
        const coords = getSVGCoordinates(event);
        const clickedWallId = getWallAtCoords(coords);
        if (clickedWallId) {
          if (selection.selectedWallId === clickedWallId) {
            moveWallControls.start(event);
          } else {
            selection.selectedWallId = clickedWallId;
            updateWallSelectionVisuals();
          }
        } else {
          selection.selectedWallId = null;
          isPanning = true;
          panControls.start(event);
        }
      },
      onMouseMove: event => {
        if (isMovingWall) {
          moveWallControls.move(event);
        } else {
          panControls.move(event);
        }
      },
      onMouseUp: event => {
        if (isMovingWall) {
          moveWallControls.stop();
        } else {
          panControls.stop();
        }
      }
    },
    wall: {
      onClick: event => {
        const coords = getSVGCoordinates(event);
        !wallStart ? wallControls.start(coords) : wallControls.finish(coords);
      },
      onMouseMove: event => wallControls.preview(getSVGCoordinates(event)),
    }
  };

  // 이벤트 처리기 실행 함수 (이벤트 이름, 이벤트 객체)
  const executeToolEvent = (eventName, event) => {
    const tool = tools[toolState.currentTool];
    if (tool && tool[eventName]) {
      tool[eventName](event);
    }
  };
  
  // 리턴
  return {
    toolState,
    executeToolEvent,
    initializeCanvas,
    zoomCanvas,
    handleKeyDown,
    
    setWallThickness,
    setSnapDistance,
    wallControls,

    selection,
    selectWall,
    selectedWallLength,
    selectedWallThickness,
    updateSelectedWallLength,
    updateSelectedWallThickness,
  };
    
});