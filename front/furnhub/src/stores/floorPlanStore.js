// store/floorPlanStore.js
import { defineStore } from "pinia";
import { off, SVG } from "@svgdotjs/svg.js";
import { reactive, computed, watch } from "vue";
import { v4 as uuidv4 } from "uuid";

export const useFloorPlanStore = defineStore("floorPlanStore", () => {
  
  // 객체 선언
  let draw = null; // SVG 객체

  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  let wallLayer = null;
  let wallStart = null, wallPreview = null;
  let wallPreviewGroup = null;

  const walls = reactive([]);

  const toolState = reactive({
    currentTool: "select",
    wallThickness: 100,
    snapDistance: 100,
    showLengthLabels: true,
  });

  let isMovingWall = false;
  let moveStartCoords = { x: 0, y: 0 };

  const selection = reactive({ selectedWallId: null });
  
  const selectedWall = computed(() => {
    return walls.find(wall => wall.id === selection.selectedWallId) || null;
  });

  const viewbox = reactive({ x: -2000, y: -2000, width: 4000, height: 4000 });
  
  const canUndo = computed(() => history.undoStack.length > 0);
  const canRedo = computed(() => history.redoStack.length > 0);

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
      if (!isInBoundary(coords)) return;
      const snappedStart = getSnapPoint(coords, wallLayer.children());
      wallStart = {
        x: snapToMillimeter(snappedStart.x),
        y: snapToMillimeter(snappedStart.y),
      };
      wallPreviewGroup = draw.group();
      wallPreview = wallPreviewGroup
        .line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: toolState.wallThickness, color: "#999", dasharray: "5,5" });
    },
    preview: (coords) => {
      if (!wallStart || !isInBoundary(coords)) return;
      const snappedEnd = getSnapPoint(coords, wallLayer.children());
      const end = getOrthogonalPoint(wallStart, snappedEnd);
      wallPreview?.plot(wallStart.x, wallStart.y, end.x, end.y);

      // 기존 미리보기 길이 표시 제거
      wallPreviewGroup.find('.preview-length').forEach(el => el.remove());
      
      // 길이 계산
      const length = Math.round(Math.hypot(end.x - wallStart.x, end.y - wallStart.y));
      
      if (length > 1) {
        const midX = (wallStart.x + end.x) / 2;
        const midY = (wallStart.y + end.y) / 2;
        const fontSize = viewbox.width * 0.025;
        
        // 길이 텍스트 표시
        wallPreviewGroup
          .text(`${length}mm`)
          .font({ size: fontSize, anchor: 'middle' })
          .center(midX, midY)
          .addClass('preview-length');
      }
    },
    onClick: (coords) => {
      if (!isInBoundary(coords)) return;
      if (!wallStart) {
        wallControls.start(coords);
      } else {
        const snappedEnd = getSnapPoint(coords, wallLayer.children());
        const end = getOrthogonalPoint(wallStart, snappedEnd);
        
        // 최소 길이 체크
        if (Math.hypot(end.x - wallStart.x, end.y - wallStart.y) > 1) {
          const changes = wallCreationMethods.createWallWithIntersections(
            wallStart,
            end,
            toolState.wallThickness
          );
          wallCreationMethods.applyWallChanges(changes);
          
          // 마지막 점을 새로운 시작점으로
          wallStart = { x: end.x, y: end.y };
          wallPreview?.plot(wallStart.x, wallStart.y, wallStart.x, wallStart.y);
          wallPreviewGroup.find('.preview-length').forEach(el => el.remove());
          updateVisualElements();
        }
      }
    },
    cancel: () => {
      wallPreviewGroup.find('.preview-length').forEach(el => el.remove());
      if (wallStart) {
        wallPreview?.remove();
        wallPreviewGroup = null;
        wallPreview = null;
        wallStart = null;
      }
    },
  };

  // 벽 이동 컨트롤
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
      saveState();
      isMovingWall = false;
      updateVisualElements();
    },
  };

  // 사각형 컨트롤
  const rectTool = {
    startPoint: null,
    preview: null,
  
    start: (coords) => {
      if (!isInBoundary(coords)) return;
      const snappedStart = getSnapPoint(coords, wallLayer.children());
      rectTool.startPoint = {
        x: snapToMillimeter(snappedStart.x),
        y: snapToMillimeter(snappedStart.y),
      };
      
      rectTool.preview = draw.group().addClass('rect-preview');
      rectTool.preview
        .rect(0, 0)
        .fill('none')
        .stroke({ width: 1, color: '#999', dasharray: '5,5' });
    },
    
    // 미리보기 업데이트
    move: (coords) => {
      if (!rectTool.startPoint || !rectTool.preview || !isInBoundary(coords)) return;
      
      const snappedEnd = getSnapPoint(coords, wallLayer.children());
      const currentPoint = {
        x: snapToMillimeter(snappedEnd.x),
        y: snapToMillimeter(snappedEnd.y),
      };
      
      const width = Math.abs(currentPoint.x - rectTool.startPoint.x);
      const height = Math.abs(currentPoint.y - rectTool.startPoint.y);
      const x = Math.min(rectTool.startPoint.x, currentPoint.x);
      const y = Math.min(rectTool.startPoint.y, currentPoint.y);
      
      // 기존 텍스트와 미리보기 제거
      rectTool.preview.children().forEach(child => child.remove());
      
      // 사각형 미리보기
      rectTool.preview
        .rect(width, height)
        .fill('none')
        .stroke({ width: 1, color: '#999', dasharray: '5,5' })
        .x(x)
        .y(y);
      
      // 네 개의 벽 미리보기
      [
        [x, y, x + width, y],
        [x + width, y, x + width, y + height],
        [x + width, y + height, x, y + height],
        [x, y + height, x, y]
      ].forEach(([x1, y1, x2, y2]) => {
        rectTool.preview
          .line(x1, y1, x2, y2)
          .stroke({ width: toolState.wallThickness, color: '#999', opacity: 0.5 });
      });
      
      // 가로/세로 길이 표시
      const fontSize = viewbox.width * 0.02;
      
      // 가로 길이
      if (width > 1) {
        rectTool.preview
          .text(`${Math.round(width)}mm`)
          .font({ size: fontSize, anchor: 'middle' })
          .center(x + width/2, y - fontSize);
      }
      
      // 세로 길이
      if (height > 1) {
        rectTool.preview
          .text(`${Math.round(height)}mm`)
          .font({ size: fontSize, anchor: 'middle' })
          .center(x - fontSize * 2, y + height/2)
          .rotate(-90);
      }
    },
    
    // 사각형 생성
    finish: (coords) => {
      if (!rectTool.startPoint || !isInBoundary(coords)) return;
      saveState();
      
      const snappedEnd = getSnapPoint(coords, wallLayer.children());
      const endPoint = {
        x: snapToMillimeter(snappedEnd.x),
        y: snapToMillimeter(snappedEnd.y),
      };
      
      // 좌상단, 우하단 좌표 계산
      const x1 = Math.min(rectTool.startPoint.x, endPoint.x);
      const y1 = Math.min(rectTool.startPoint.y, endPoint.y);
      const x2 = Math.max(rectTool.startPoint.x, endPoint.x);
      const y2 = Math.max(rectTool.startPoint.y, endPoint.y);
      
      // 각 벽 순서대로 생성
      const points = [
        { start: { x: x1, y: y1 }, end: { x: x2, y: y1 } }, // 상단
        { start: { x: x2, y: y1 }, end: { x: x2, y: y2 } }, // 우측
        { start: { x: x2, y: y2 }, end: { x: x1, y: y2 } }, // 하단
        { start: { x: x1, y: y2 }, end: { x: x1, y: y1 } }  // 좌측
      ];
      
      // 각 벽을 순차적으로 생성하여 교차점 처리
      points.forEach(({start, end}) => {
        const changes = wallCreationMethods.createWallWithIntersections(
          start,
          end,
          toolState.wallThickness
        );
        wallCreationMethods.applyWallChanges(changes);
      });
      
      // 프리뷰 제거
      rectTool.preview?.remove();
      rectTool.preview = null;
      rectTool.startPoint = null;
      updateVisualElements();
    },
    
    // 취소
    cancel: () => {
      if (rectTool.preview) {
        rectTool.preview.remove();
        rectTool.preview = null;
      }
      rectTool.startPoint = null;
    }
  };

  // walls 상태 변경을 추적하기 위한 history 스택 추가
  const history = reactive({
    undoStack: [],  // 실행 취소용 스택
    redoStack: [],  // 다시 실행용 스택
    isRecording: true  // 현재 history 기록 여부
  });

  // 현재 상태를 저장하는 함수
  const saveState = () => {
    if (!history.isRecording) return;
    history.undoStack.push(JSON.stringify(walls));
    history.redoStack = [];  // redo 스택 초기화
  };

  // 상태를 복원하는 함수
  const loadState = (state) => {
    // DOM에서 현재 벽들 제거
    wallLayer.children().forEach(wall => wall.remove());
    
    // walls 배열 초기화 및 새로운 상태로 교체
    walls.splice(0, walls.length, ...JSON.parse(state));
    
    // 벽 다시 그리기
    walls.forEach(wall => {
      wallCreationMethods.renderWall(wall);
    });
    
    // 시각요소 업데이트
    updateVisualElements();
    selection.selectedWallId = null;  // 선택 초기화
  };

  // Undo 함수
  const undo = () => {
    if (history.undoStack.length === 0) return;
    
    // 현재 상태를 redo 스택에 저장
    history.redoStack.push(JSON.stringify(walls));
    
    // 이전 상태 복원
    history.isRecording = false;  // 상태 복원 중 history 기록 방지
    loadState(history.undoStack.pop());
    history.isRecording = true;
  };

  // Redo 함수
  const redo = () => {
    if (history.redoStack.length === 0) return;
    
    // 현재 상태를 undo 스택에 저장
    history.undoStack.push(JSON.stringify(walls));
    
    // 다음 상태 복원
    history.isRecording = false;
    loadState(history.redoStack.pop());
    history.isRecording = true;
  };

  // 레이블 토글
  const toggleLengthLabels = () => {
    toolState.showLengthLabels = !toolState.showLengthLabels;
    updateVisualElements();
  };

  // == 유틸리티 함수들 == //

  // 화면갱신
  const updateVisualElements = () => {
    fillCornerSpaces();
    renderKeyPoints();
    renderLengthLabels();
  };

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

  // 키 렌더링 함수
  const renderKeyPoints = () => {
    draw.find('.key').forEach(key => key.remove());
    wallLayer.children().forEach(wall => {
      drawKeyPoint(parseFloat(wall.attr('x1')), parseFloat(wall.attr('y1')));
      drawKeyPoint(parseFloat(wall.attr('x2')), parseFloat(wall.attr('y2')));
    });
  };

  // 화살표 생성 함수
  const drawArrow = (x, y, angle, isStart) => {
    const arrowSize = viewbox.width * 0.0125;
    const arrowAngle = Math.PI * 0.4;
    const direction = isStart ? 1 : -1;
    
    const p1 = {
      x: x + direction * arrowSize * Math.cos(angle + arrowAngle),
      y: y + direction * arrowSize * Math.sin(angle + arrowAngle)
    };
    const p2 = { x, y };
    const p3 = {
      x: x + direction * arrowSize * Math.cos(angle - arrowAngle),
      y: y + direction * arrowSize * Math.sin(angle - arrowAngle)
    };
    
    return draw.polyline([[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]])
      .fill('none')
      .stroke({ width: viewbox.width * 0.00125, color: '#000' })
      .addClass('dimension');
  };

  // 연결선 생성 함수
  const drawDimensionLine = (start, end) => {
    return draw.line(start.x, start.y, end.x, end.y)
      .stroke({ width: viewbox.width * 0.00125, color: '#000' })
      .addClass('dimension');
  };

  // 직교벽 찾는 함수
  const findIntersectingWalls = (point, wallId, isCurrentWallVertical) => {
    return walls
      .filter(w =>
        w.id !== wallId &&
        ((w.x1 === point.x && w.y1 === point.y) || (w.x2 === point.x && w.y2 === point.y))
      )
      .map(w => {
        const isMeetingAtStart = w.x1 === point.x && w.y1 === point.y;
        const isVertical = Math.abs(w.y2 - w.y1) > Math.abs(w.x2 - w.x1);

        if (isCurrentWallVertical) {
          return {
            ...w,
            isVertical: isVertical,
            isLeftward: !isVertical ? (isMeetingAtStart ? w.x1 > w.x2 : w.x2 > w.x1) : false,
            isRightward: !isVertical ? (isMeetingAtStart ? w.x1 < w.x2 : w.x2 < w.x1) : false
          };
        } else {
          return {
            ...w,
            isVertical: isVertical,
            isLower: isVertical ? (isMeetingAtStart ? w.y1 < w.y2 : w.y2 < w.y1) : false,
            isUpper: isVertical ? (isMeetingAtStart ? w.y1 > w.y2 : w.y2 > w.y1) : false
          };
        }
      });
  };

  const createLengthLabel = (wallId) => {
    const wall = walls.find(w => w.id === wallId);
    if (!wall) return;
    
    const isVertical = Math.abs(wall.y2 - wall.y1) > Math.abs(wall.x2 - wall.x1);
    const isUpward = wall.y1 > wall.y2;
    const isRightward = wall.x1 < wall.x2;
    const offset = wall.thickness / 2 + viewbox.width * 0.0125;

    // 직교 보정용 오프셋
    let upperLeftOffset = 0, upperRightOffset = 0, lowerLeftOffset = 0, lowerRightOffset = 0;
    let leftUpperOffset = 0, leftLowerOffset = 0, rightUpperOffset = 0, rightLowerOffset = 0;
    
    // 수평
    if (!isVertical) {
      let leftPoint = isRightward ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };
      let rightPoint = isRightward ? { x: wall.x2, y: wall.y2 } : { x: wall.x1, y: wall.y1 };

      const leftIntersectingWalls = findIntersectingWalls(leftPoint, wallId, false);
      const rightIntersectingWalls = findIntersectingWalls(rightPoint, wallId, false);

      const leftUpperWalls = leftIntersectingWalls.filter(w => w.isUpper);
      const leftLowerWalls = leftIntersectingWalls.filter(w => w.isLower);
      const rightUpperWalls = rightIntersectingWalls.filter(w => w.isUpper);
      const rightLowerWalls = rightIntersectingWalls.filter(w => w.isLower);

      if (leftUpperWalls.length > 0 && leftLowerWalls.length > 0) {
        upperLeftOffset -= leftUpperWalls[0].thickness / 2;
        lowerLeftOffset -= leftLowerWalls[0].thickness / 2;
      } else if (leftUpperWalls.length > 0) {
        upperLeftOffset -= leftUpperWalls[0].thickness / 2;
        lowerLeftOffset += leftUpperWalls[0].thickness / 2;
      } else if (leftLowerWalls.length > 0) {
        upperLeftOffset += leftLowerWalls[0].thickness / 2;
        lowerLeftOffset -= leftLowerWalls[0].thickness / 2;
      }

      if (rightUpperWalls.length > 0 && rightLowerWalls.length > 0) {
        upperRightOffset -= rightUpperWalls[0].thickness / 2;
        lowerRightOffset -= rightLowerWalls[0].thickness / 2;
      } else if (rightUpperWalls.length > 0) {
        upperRightOffset -= rightUpperWalls[0].thickness / 2;
        lowerRightOffset += rightUpperWalls[0].thickness / 2;
      } else if (rightLowerWalls.length > 0) {
        upperRightOffset += rightLowerWalls[0].thickness / 2;
        lowerRightOffset -= rightLowerWalls[0].thickness / 2;
      }
    // 수직
    } else {
      let upperPoint = isUpward ? { x: wall.x2, y: wall.y2 } : { x: wall.x1, y: wall.y1 };
      let lowerPoint = isUpward ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };
      const upperIntersectingWalls = findIntersectingWalls(upperPoint, wallId, true);
      const lowerIntersectingWalls = findIntersectingWalls(lowerPoint, wallId, true);
    
      const upperLeftWalls = upperIntersectingWalls.filter(w => w.isLeftward);
      const upperRightWalls = upperIntersectingWalls.filter(w => w.isRightward);
      const lowerLeftWalls = lowerIntersectingWalls.filter(w => w.isLeftward);
      const lowerRightWalls = lowerIntersectingWalls.filter(w => w.isRightward);
    
      if (upperLeftWalls.length > 0 && upperRightWalls.length > 0) {
        leftUpperOffset -= upperLeftWalls[0].thickness / 2;
        rightUpperOffset -= upperRightWalls[0].thickness / 2;
      } else if (upperLeftWalls.length > 0) {
        leftUpperOffset -= upperLeftWalls[0].thickness / 2;
        rightUpperOffset += upperLeftWalls[0].thickness / 2;
      } else if (upperRightWalls.length > 0) {
        leftUpperOffset += upperRightWalls[0].thickness / 2;
        rightUpperOffset -= upperRightWalls[0].thickness / 2;
      }
    
      if (lowerLeftWalls.length > 0 && lowerRightWalls.length > 0) {
        leftLowerOffset -= lowerLeftWalls[0].thickness / 2;
        rightLowerOffset -= lowerRightWalls[0].thickness / 2;
      } else if (lowerLeftWalls.length > 0) {
        leftLowerOffset -= lowerLeftWalls[0].thickness / 2;
        rightLowerOffset += lowerLeftWalls[0].thickness / 2;
      } else if (lowerRightWalls.length > 0) {
        leftLowerOffset += lowerRightWalls[0].thickness / 2;
        rightLowerOffset -= lowerRightWalls[0].thickness / 2;
      }
    }
    
    // 기존 요소들 제거
    draw.find(`.length-label[data-id='${wall.id}']`).forEach(label => label.remove());
    draw.find(`.dimension[data-id='${wall.id}']`).forEach(dim => dim.remove());
    
    const midX = (wall.x1 + wall.x2) / 2;
    const midY = (wall.y1 + wall.y2) / 2;
    const length = Math.round(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1));
    const fontSize = Math.min(100, viewbox.width / 64);
    const maxOffset = length / 2;
    const dimensionLineOffset = Math.min(
      maxOffset, 
      fontSize * (0.5 + Math.log10(length) / 2)
    ) * (isVertical ? (wall.y2 < wall.y1 ? 1 : -1) : (wall.x2 > wall.x1 ? 1 : -1));

    // 벽의 방향 결정
    const angle = isVertical 
      ? (wall.y2 > wall.y1 ? Math.PI * 0.5 : -Math.PI * 0.5)
      : (wall.x2 > wall.x1 ? 0 : Math.PI);

    if (isVertical) {
      // 세로 벽 (좌/우 분리)
      const leftLabelGroup = draw.group().addClass('length-label').attr('data-id', `${wall.id}-left`);
      const rightLabelGroup = draw.group().addClass('length-label').attr('data-id', `${wall.id}-right`);
      
      const leftLength = length + (leftUpperOffset + leftLowerOffset);
      const rightLength = length + (rightUpperOffset + rightLowerOffset);

      const isUpward = wall.y2 < wall.y1;
      const arrowAngle = Math.PI * 0.5;

      let upperPoint = isUpward ? { x: wall.x2, y: wall.y2 } : { x: wall.x1, y: wall.y1 };
      let lowerPoint = isUpward ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };

      const leftDimensionLineOffset = Math.min(
        maxOffset, 
        fontSize * (0.5 + Math.log10(leftLength) / 2)
      );
      const rightDimensionLineOffset = Math.min(
        maxOffset, 
        fontSize * (0.5 + Math.log10(rightLength) / 2)
      );
      
      // 왼쪽 텍스트
      const leftLabel = leftLabelGroup.text(`${leftLength}mm`)
        .font({ size: fontSize, anchor: 'middle' })
        .center(midX - offset, midY)
        .rotate(90, midX - offset, midY);
      // 오른쪽 텍스트
      const rightLabel = rightLabelGroup.text(`${rightLength}mm`)
        .font({ size: fontSize, anchor: 'middle' })
        .center(midX + offset, midY)
        .rotate(90, midX + offset, midY);
      // 왼쪽 상단 연결선
      drawDimensionLine(
        { x: midX - offset, y: midY - leftDimensionLineOffset },
        { x: midX - offset, y: upperPoint.y - leftUpperOffset }
      );
      // // 왼쪽 하단 연결선
      drawDimensionLine(
        { x: midX - offset, y: midY + leftDimensionLineOffset },
        { x: midX - offset, y: lowerPoint.y + leftLowerOffset }
      );
      // 오른쪽 상단 연결선
      drawDimensionLine(
        { x: midX + offset, y: midY - rightDimensionLineOffset },
        { x: midX + offset, y: upperPoint.y - rightUpperOffset }
      );
      // 오른쪽 하단 연결선
      drawDimensionLine(
        { x: midX + offset, y: midY + rightDimensionLineOffset },
        { x: midX + offset, y: lowerPoint.y + rightLowerOffset }
      );
      // 왼쪽 상단 화살표
      drawArrow(midX - offset, upperPoint.y - leftUpperOffset, arrowAngle, true);
      // 왼쪽 하단 화살표
      drawArrow(midX - offset, lowerPoint.y + leftLowerOffset, arrowAngle, false);
      // 우측 상단 화살표
      drawArrow(midX + offset, upperPoint.y - rightUpperOffset, arrowAngle, true);
      // 우측 하단 화살표
      drawArrow(midX + offset, lowerPoint.y + rightLowerOffset, arrowAngle, false);
    } else {
      // 가로 벽 (상단/하단 분리)
      const topLabelGroup = draw.group().addClass('length-label').attr('data-id', `${wall.id}-top`);
      const bottomLabelGroup = draw.group().addClass('length-label').attr('data-id', `${wall.id}-bottom`);
      
      const upperLength = length + (upperLeftOffset + upperRightOffset);
      const lowerLength = length + (lowerLeftOffset + lowerRightOffset);

      const isRightward = wall.x1 < wall.x2;
      const arrowAngle = 0;

      let rightPoint = isRightward ? { x: wall.x2, y: wall.y2 } : { x: wall.x1, y: wall.y1 };
      let leftPoint = isRightward ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };

      const upperDimensionLineOffset = Math.min(
        maxOffset, 
        fontSize * (0.5 + Math.log10(upperLength) / 2)
      );
      const lowerDimensionLineOffset = Math.min(
        maxOffset, 
        fontSize * (0.5 + Math.log10(lowerLength) / 2)
      );

      // 상단 텍스트
      const topLabel = topLabelGroup.text(`${upperLength}mm`)
        .font({ size: fontSize, anchor: 'middle' })
        .center(midX, midY - offset);
      // 하단 텍스트
      const bottomLabel = bottomLabelGroup.text(`${lowerLength}mm`)
        .font({ size: fontSize, anchor: 'middle' })
        .center(midX, midY + offset);
      // 상단 좌측 연결선
      drawDimensionLine(
        { x: midX - upperDimensionLineOffset, y: midY - offset },
        { x: leftPoint.x - upperLeftOffset, y: midY - offset }
      );
      // 상단 우측 연결선
      drawDimensionLine(
        { x: midX + upperDimensionLineOffset, y: midY - offset },
        { x: rightPoint.x + upperRightOffset, y: midY - offset }
      );
      // 하단 좌측 연결선
      drawDimensionLine(
        { x: midX - lowerDimensionLineOffset, y: midY + offset },
        { x: leftPoint.x - lowerLeftOffset, y: midY + offset }
      );
      // 하단 우측 연결선
      drawDimensionLine(
        { x: midX + lowerDimensionLineOffset, y: midY + offset },
        { x: rightPoint.x + lowerRightOffset, y: midY + offset }
      );
      // 상단 좌측 화살표
      drawArrow(leftPoint.x - upperLeftOffset, midY - offset, arrowAngle, true);
      // 상단 우측 화살표
      drawArrow(rightPoint.x + upperRightOffset, midY - offset, arrowAngle, false);
      // 하단 좌측 화살표
      drawArrow(leftPoint.x - lowerLeftOffset, midY + offset, arrowAngle, true);
      // 하단 우측 화살표
      drawArrow(rightPoint.x + lowerRightOffset, midY + offset, arrowAngle, false);
    }
  };

  // 길이레이블 렌더링 함수
  const renderLengthLabels = () => {
    draw.find('.length-label').forEach(len => len.remove());
    draw.find('.dimension').forEach(dim => dim.remove());
    if (toolState.showLengthLabels) {
      wallLayer.children().forEach(wall => {
        const wallId = wall.attr('data-id');
        if (wallId) {
          createLengthLabel(wallId);
        }
      });
    }
  };

  // 이동용 스냅 함수
  const getSnapPointForMove = (currentPoint, walls, excludeId) => {
    currentPoint = roundPoint(currentPoint);
    const SNAP_THRESHOLD = toolState.snapDistance;
    let closestPoint = null;
    let minDistance = SNAP_THRESHOLD;
    for (const wall of walls) {
      if (wall.id === excludeId) continue;
      const start = { x: wall.x1, y: wall.y1 };
      const end = { x: wall.x2, y: wall.y2 };
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

  // 벽 생성용 스냅
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
  
  // 선택된 벽 강조 함수
  const updateWallSelectionVisuals = () => {
    wallLayer.children().forEach(wall => {
      const wallData = walls.find(w => w.id === wall.data('id'));
      if (wallData) {
        if (wall.data('id') === selection.selectedWallId) {
          wall.stroke({ 
            color: "#007bff", 
            width: wallData.thickness
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
    saveState();
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
    updateVisualElements();
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
    saveState();
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
    if (Math.abs(denominator) < 0.001) return null; // 평행선 처리
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
    if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  };

  // 벽 분할 함수
  const splitWallAtPoint = (wall, point) => {
    const part1 = {
      id: uuidv4(),
      x1: wall.x1,
      y1: wall.y1,
      x2: point.x,
      y2: point.y,
      thickness: wall.thickness
    };
    const part2 = {
      id: uuidv4(),
      x1: point.x,
      y1: point.y,
      x2: wall.x2,
      y2: wall.y2,
      thickness: wall.thickness
    };
    return [part1, part2].filter(part => 
      Math.hypot(part.x2 - part.x1, part.y2 - part.y1) > 1
    );
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
      // 1. 새 벽 생성
      const newWall = wallCreationMethods.createWall(start, end, thickness);
      
      // 교차점 확인
      const intersections = [];
      const wallsToRemove = [];
      const newWalls = [];

      // 2. 모든 기존 벽과의 교차점 찾기
      walls.forEach(existingWall => {
        const intersection = getIntersection(newWall, existingWall);
        if (intersection) {
          // 교차점에 정밀도 보정 적용
          intersection.x = Math.round(intersection.x);
          intersection.y = Math.round(intersection.y);
          
          // 교차점이 벽의 끝점과 너무 가까운 경우 처리
          const isNearStart = Math.hypot(intersection.x - existingWall.x1, intersection.y - existingWall.y1) < 1;
          const isNearEnd = Math.hypot(intersection.x - existingWall.x2, intersection.y - existingWall.y2) < 1;
          
          if (!isNearStart && !isNearEnd) {
            intersections.push({
              point: intersection,
              wall: existingWall
            });
            wallsToRemove.push(existingWall.id);
          }
        }
      });

      // 3. 교차점이 있는 경우 처리
      if (intersections.length > 0) {
        // 새 벽의 방향에 따라 교차점 정렬
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const isHorizontal = Math.abs(dx) > Math.abs(dy);
        
        intersections.sort((a, b) => {
          if (isHorizontal) {
            return (dx > 0) ? a.point.x - b.point.x : b.point.x - a.point.x;
          } else {
            return (dy > 0) ? a.point.y - b.point.y : b.point.y - a.point.y;
          }
        });

        // 4. 분할된 벽 생성
        let currentStart = { x: start.x, y: start.y };
        intersections.forEach(intersection => {
          // 교차점까지의 새 벽 생성
          if (Math.hypot(currentStart.x - intersection.point.x, currentStart.y - intersection.point.y) > 1) {
            const wallToIntersection = wallCreationMethods.createWall(
              currentStart,
              intersection.point,
              thickness
            );
            newWalls.push(wallToIntersection);
          }
          
          // 교차된 기존 벽 분할
          const splitWalls = splitWallAtPoint(intersection.wall, intersection.point);
          splitWalls.forEach(wall => {
            if (Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) > 1) {
              newWalls.push(wall);
            }
          });
          
          currentStart = intersection.point;
        });

        // 마지막 구간 추가
        if (Math.hypot(currentStart.x - end.x, currentStart.y - end.y) > 1) {
          const finalWall = wallCreationMethods.createWall(
            currentStart,
            end,
            thickness
          );
          newWalls.push(finalWall);
        }
      } else {
        // 교차점이 없는 경우
        newWalls.push(newWall);
      }

      // 중복 벽 제거
      const uniqueWalls = newWalls.filter((wall, index, self) => {
        return !self.slice(index + 1).some(otherWall => {
          return Math.abs(wall.x1 - otherWall.x1) < 1 &&
                Math.abs(wall.y1 - otherWall.y1) < 1 &&
                Math.abs(wall.x2 - otherWall.x2) < 1 &&
                Math.abs(wall.y2 - otherWall.y2) < 1;
        });
      });

      return {
        wallsToRemove,
        newWalls: uniqueWalls
      };
    },
    // 벽 변경 적용
    applyWallChanges: (changes) => {
      saveState();
      // 기존 벽 제거
      changes.wallsToRemove.forEach(id => {
        const wallElement = wallLayer.find(`[data-id='${id}']`)[0];
        if (wallElement) wallElement.remove();
        const index = walls.findIndex(w => w.id === id);
        if (index !== -1) walls.splice(index, 1);
      });

      // 새로운 벽 추가
      changes.newWalls.forEach(wall => {
        // 최소 길이 체크
        if (Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) > 1) {
          walls.push(wall);
          wallCreationMethods.renderWall(wall);
        }
      });
    }
  };

  // 선택된 벽 삭제
  const deleteSelectedWall = () => {
    if (!selection.selectedWallId) return;
    saveState();

    // DOM에서 벽 요소 제거
    const wallElement = wallLayer.find(`[data-id='${selection.selectedWallId}']`)[0];
    if (wallElement) {
      wallElement.remove();
    }
    
    // walls 배열에서 벽 제거
    const wallIndex = walls.findIndex(w => w.id === selection.selectedWallId);
    if (wallIndex !== -1) {
      walls.splice(wallIndex, 1);
    }
    
    // 선택 해제
    selection.selectedWallId = null;
    
    // 시각적 요소 업데이트
    updateVisualElements();
  };

  // 모서리 채우기 함수
  const fillCornerSpaces = () => {
    draw.find('.corner-space').forEach(space => space.remove());
    
    // 벽들의 끝점을 Map으로 관리 (좌표를 키로 사용)
    const cornerMap = new Map();
    
    wallLayer.children().forEach(wall => {
      const points = [
        [wall.attr('x1'), wall.attr('y1')],
        [wall.attr('x2'), wall.attr('y2')]
      ];
      
      points.forEach(([x, y]) => {
        const key = `${Math.round(x)},${Math.round(y)}`;
        if (!cornerMap.has(key)) {
          cornerMap.set(key, []);
        }
        cornerMap.get(key).push(wall);
      });
    });

    // 교차점에서 모서리 처리
    cornerMap.forEach((walls, key) => {
      if (walls.length === 2) {
        const [wallA, wallB] = walls;
        const [x, y] = key.split(',').map(Number);
        
        // 두 벽의 방향 확인 (수직/수평)
        const isWallAVertical = Math.abs(wallA.attr('x1') - wallA.attr('x2')) < 1;
        const isWallBVertical = Math.abs(wallB.attr('x1') - wallB.attr('x2')) < 1;
        
        if (isWallAVertical !== isWallBVertical) {
          const thicknessA = wallA.attr('stroke-width');
          const thicknessB = wallB.attr('stroke-width');
          
          const width = isWallAVertical ? thicknessA : thicknessB;
          const height = isWallAVertical ? thicknessB : thicknessA;
          
          draw.rect(width, height)
            .center(x, y)
            .fill("#999")
            .addClass('corner-space');
        }
      }
    });

    wallLayer.front();
  };

  // 좌표제한 체크 함수
  const isInBoundary = (coords) => {
    const BOUNDARY = { min: -50000, max: 50000 };
    return coords.x >= BOUNDARY.min && coords.x <= BOUNDARY.max && 
           coords.y >= BOUNDARY.min && coords.y <= BOUNDARY.max;
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
        if (toolState.currentTool === "wall") {
          wallControls.cancel();
        } else if (toolState.currentTool === "rect") {
          rectTool.cancel();
        }
        break;
      case "Delete": // Delete
        if (selection.selectedWallId) {
          deleteSelectedWall();
        }
        break;
      case "1": toolState.currentTool = "select"; break; // 1 : 선택
      case "2": toolState.currentTool = "wall"; break; // 2 : 벽
      case "3": toolState.currentTool = "rect"; break; // 3 : 사각형
      case "l": case "L": toggleLengthLabels(); break; // l : 레이블 토글
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
        wallControls.onClick(coords);
      },
      onMouseMove: event => wallControls.preview(getSVGCoordinates(event))
    },
    rect: {
      onClick: event => {
        const coords = getSVGCoordinates(event);
        !rectTool.startPoint ? rectTool.start(coords) : rectTool.finish(coords);
      },
      onMouseMove: event => rectTool.move(getSVGCoordinates(event)),
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
    rectTool, 
    canUndo,
    canRedo,
    undo,
    redo,
    toggleLengthLabels,

    selection,
    selectWall,
    selectedWallLength,
    selectedWallThickness,
    updateSelectedWallLength,
    updateSelectedWallThickness,
    deleteSelectedWall,
  };
    
});