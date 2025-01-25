import { defineStore } from "pinia";
import { SVG } from "@svgdotjs/svg.js";
import { reactive } from "vue";

export const useFloorPlanStore = defineStore("floorPlanStore", () => {
  // === 기본 상태 관리 ===
  let draw = null;                // SVG 그리기를 위한 메인 객체
  let wallLayer = null;          // 벽을 그리기 위한 레이어
  let labelLayer = null;         // 텍스트와 점을 표시하기 위한 레이어
  
  // 현재 도구의 상태를 관리하는 반응형 객체
  const toolState = reactive({    
    currentTool: "select",        // 현재 선택된 도구 (기본값: 선택 도구)
    wallThickness: 100,          // 벽 두께 (단위: mm)
    snapDistance: 150,          // 스냅 범위 (단위: mm)
  });
  
  // 화면 보기 설정을 위한 반응형 객체
  const viewbox = reactive({
    x: -3000,          // 화면 왼쪽 끝 좌표
    y: -3000,          // 화면 위쪽 끝 좌표
    width: 6000,       // 화면 너비
    height: 6000       // 화면 높이
  });

  // 벽 그리기 관련 변수들
  let wallStart = null;           // 벽 시작점의 좌표
  let wallPreview = null;         // 벽 그리기 중 미리보기 선
  let lengthLabel = null;         // 길이를 표시하는 텍스트

  // === 작업 기록(히스토리) 관리 ===
  const history = reactive({
    undoStack: [],    // 실행 취소를 위한 이전 상태들을 저장하는 배열
    redoStack: [],    // 다시 실행을 위한 상태들을 저장하는 배열
    current: null     // 현재 상태
  });

  // === 상태 저장/복원 함수들 ===
  /**
   * 현재 캔버스의 상태를 저장하는 함수
   * - 모든 벽, 레이블, 키포인트의 정보를 저장
   */
  const saveState = () => {
    const state = {
      // 모든 벽의 정보 저장 (시작점, 끝점, 두께)
      walls: wallLayer.children().map(wall => {
        const x1 = parseFloat(wall.attr('x1'));
        const y1 = parseFloat(wall.attr('y1'));
        const x2 = parseFloat(wall.attr('x2'));
        const y2 = parseFloat(wall.attr('y2'));

        
        // 시작점과 끝점이 같은 벽은 저장하지 않음
        if (x1 === x2 && y1 === y2) {
          return null;
        }
        
        return {
          x1, y1, x2, y2,
          thickness: toolState.wallThickness
        };
      }).filter(wall => wall !== null), // null 제거

      // 모든 레이블(텍스트)의 정보 저장
      labels: labelLayer.find('.length-label').map(label => {
        const text = label.text().replace('mm', '');
        // 빈 텍스트나 0인 레이블은 저장하지 않음
        if (!text || text === '0') return null;
        return {
          text: text,
          x: label.attr('x'),
          y: label.attr('y')
        };
      }).filter(label => label !== null),

      // 모든 키포인트(점)의 정보 저장
      keyPoints: labelLayer.find('.key').map(key => ({
        x: key.cx(),
        y: key.cy(),
        size: key.attr('r') * 2
      }))
    };
    
    // 상태를 저장하고 다시 실행 스택 초기화
    history.undoStack.push(JSON.stringify(state));
    history.redoStack = [];  
    history.current = state;
  };

  /**
   * 저장된 상태로 캔버스를 복원하는 함수
   * @param {Object} state - 복원할 상태 정보
   */
  const restoreState = (state) => {
    // 기존 요소들 모두 제거
    wallLayer.children().forEach(child => child.remove());
    labelLayer.children().forEach(child => child.remove());

    // 미리보기 상태 초기화
    cleanupPreview();

    // 벽 다시 그리기
    state.walls.forEach(wall => {
      wallLayer.line(wall.x1, wall.y1, wall.x2, wall.y2)
        .stroke({ width: wall.thickness, color: "#999" });
    });

    // 레이블 다시 그리기
    state.labels.forEach(label => {
      createLabel(label.text.replace('m', ''), label.x, label.y);
    });

    // 키포인트 다시 그리기
    state.keyPoints.forEach(point => {
      drawKeyPoint(point.x, point.y);
    });

    // 레이블 레이어를 최상단으로
    labelLayer.front();
  };

  // === 실행 취소/다시 실행 기능 ===
  /**
   * 실행 취소 함수
   * - 이전 상태로 되돌림
   */
  const undo = () => {
    if (history.undoStack.length > 0) {
      // 현재 상태를 다시 실행 스택으로 이동
      const currentState = history.undoStack.pop();
      history.redoStack.push(currentState);
      
      // 이전 상태로 복원
      const previousState = history.undoStack[history.undoStack.length - 1];
      if (previousState) {
        restoreState(JSON.parse(previousState));
      }
    }
  };

  /**
   * 다시 실행 함수
   * - 실행 취소했던 작업을 다시 실행
   */
  const redo = () => {
    if (history.redoStack.length > 0) {
      // 다음 상태를 가져와서 복원
      const nextState = history.redoStack.pop();
      history.undoStack.push(nextState);
      restoreState(JSON.parse(nextState));
    }
  };

  // === 캔버스 초기화 ===
  /**
   * SVG 캔버스를 초기화하는 함수
   * @param {HTMLElement} canvasElement - 캔버스를 추가할 HTML 요소
   */
  const initializeCanvas = (canvasElement) => {
    // SVG 캔버스 생성
    draw = SVG().addTo(canvasElement).size("100%", "100%");
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    
    // 레이어 순서대로 추가: 그리드 -> 벽 -> 레이블
    addGrid();
    wallLayer = draw.group().addClass("wall-layer");
    labelLayer = draw.group().addClass("label-layer");
    labelLayer.front();
  };

  // === 그리드 생성 ===
  /**
   * 그리드(모눈종이) 그리기 함수
   * - 작은 격자: 100mm 간격, 얇은 선
   * - 큰 격자: 1000mm 간격, 굵은 선
   * - 중심선: 십자선
   * - 경계선: 빨간색 선
   */
  const addGrid = () => {
    const GRID_BOUNDARY = { min: -50000, max: 50000 };  // 그리드 경계 (단위: mm)
    draw.find(".grid-line").forEach(line => line.remove());  // 기존 그리드 제거

    // 격자 선 그리기 (가로, 세로)
    for (let i = GRID_BOUNDARY.min; i <= GRID_BOUNDARY.max; i += 100) {
      // 가로 선
      draw.line(GRID_BOUNDARY.min, i, GRID_BOUNDARY.max, i)
        .stroke({
          width: i % 1000 === 0 ? 1 : 0.5,  // 1m 간격일 때 더 굵게
          color: i % 1000 === 0 ? "#111" : "#555"  // 1m 간격일 때 더 진하게
        })
        .addClass("grid-line");

      // 세로 선
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
      // 세로 경계선
      draw.line(pos, GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max)
        .stroke({ width: 50, color: '#f00' })
        .addClass("grid-line");
      // 가로 경계선
      draw.line(GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max, pos)
        .stroke({ width: 50, color: '#f00' })
        .addClass("grid-line");
    });
  };

  // === 확대/축소 기능 ===
  /**
   * 마우스 휠로 확대/축소하는 함수
   * @param {WheelEvent} event - 마우스 휠 이벤트
   */
  const zoomCanvas = (event) => {
    // 휠 방향에 따라 확대/축소 비율 결정
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    
    // 마우스 커서 위치를 SVG 좌표로 변환
    const point = draw.node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(draw.node.getScreenCTM().inverse());
    
    // 새로운 뷰박스 크기 계산
    const newWidth = viewbox.width * zoomFactor;
    const newHeight = viewbox.height * zoomFactor;
    const dx = (svgPoint.x - viewbox.x) * (newWidth / viewbox.width - 1);
    const dy = (svgPoint.y - viewbox.y) * (newHeight / viewbox.height - 1);

    // 뷰박스 업데이트
    Object.assign(viewbox, {
      x: viewbox.x - dx,
      y: viewbox.y - dy,
      width: newWidth,
      height: newHeight
    });
    
    // 화면 갱신
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    updateVisualElements();
  };

  // === 화면 이동 기능 ===
  let isPanning = false;  // 화면 이동 중인지 여부
  let panStart = { x: 0, y: 0 };  // 화면 이동 시작 좌표

  // 화면 이동 관련 함수들
  const panControls = {
    // 화면 이동 시작
    start: (event) => {
      isPanning = true;
      panStart = { x: event.clientX, y: event.clientY };
    },
    // 화면 이동 중
    move: (event) => {
      if (!isPanning) return;
      // 이동 거리 계산
      const dx = (event.clientX - panStart.x) * viewbox.width / draw.node.clientWidth;
      const dy = (event.clientY - panStart.y) * viewbox.height / draw.node.clientHeight;
      
      // 뷰박스 위치 업데이트
      Object.assign(viewbox, {
        x: viewbox.x - dx,
        y: viewbox.y - dy
      });
      
      // 화면 갱신
      draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
      panStart = { x: event.clientX, y: event.clientY };
    },
    // 화면 이동 종료
    stop: () => isPanning = false
  };

  // === 벽 그리기 기능 ===
  const wallControls = {
    // 벽 그리기 시작
    start: (coords) => {
      if (!isWithinBoundary(coords)) return;  // 경계 밖이면 그리기 중단
      
      // 시작점 스냅
      const walls = wallLayer.children();
      const snappedStart = getSnapPoint(coords, walls, true);

      // 시작점 설정 및 미리보기 요소 생성
      wallStart = snappedStart;
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
      lengthLabel = createLabel("0.00", wallStart.x, wallStart.y);
    },

    // 벽 그리기 미리보기
    preview: (coords) => {
      if (!wallStart || !coords) return;
      
      // 직각이 되도록 보정된 끝점 계산
      const orthogonalEnd = getOrthogonalPoint(wallStart, coords);

      // 스냅된 점 계산 (직각 제한 이후)
      const walls = wallLayer.children();
      const snappedEnd = getSnapPoint(orthogonalEnd, walls);

      // 가로/세로 중 더 가까운 쪽으로 강제
      const finalEnd = {
        x: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? snappedEnd.x : wallStart.x,
        y: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? wallStart.y : snappedEnd.y
      };

      // 미리보기 선 업데이트
      wallPreview?.plot(
        wallStart.x, wallStart.y,
        finalEnd.x, finalEnd.y
      );

      // 길이 레이블 업데이트
      const distance = calculateDistance(wallStart, finalEnd);
      updateLabel(lengthLabel, distance, wallStart, finalEnd);
    },

    // 벽 그리기 완료
    finish: (coords) => {
      if (!wallStart || !coords) return;
      
      // 직각이 되도록 보정된 끝점 계산
      const orthogonalEnd = getOrthogonalPoint(wallStart, coords);
      const walls = wallLayer.children();
      const snappedEnd = getSnapPoint(orthogonalEnd, walls);
      
      const finalEnd = {
        x: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? snappedEnd.x : wallStart.x,
        y: Math.abs(snappedEnd.x - wallStart.x) > Math.abs(snappedEnd.y - wallStart.y) 
          ? wallStart.y : snappedEnd.y
      };

      const distance = calculateDistance(wallStart, finalEnd);
      
      // // 거리가 0이면 벽 생성하지 않음
      // if (distance === 0) {
      //   cleanupPreview();
      //   wallStart = null;
      //   return;
      // }
      
      // 교차점 찾기
      const intersections = findIntersections(wallStart, finalEnd, walls);
      
      // 교차점이 있으면 기존 벽을 분할
      if (intersections.length > 0) {
        intersections.forEach(splitWallAtIntersection);
        createWallWithIntersections(wallStart, finalEnd, intersections);
      } else {
        // 교차점이 없을 때만 새 벽과 레이블 추가
        wallLayer.line(wallStart.x, wallStart.y, finalEnd.x, finalEnd.y)
          .stroke({ width: toolState.wallThickness, color: "#999" });
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
      
      // 다음 벽을 위한 설정
      wallStart = finalEnd;
      
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
      lengthLabel = createLabel("0", wallStart.x, wallStart.y);
      
      labelLayer.front();
      saveState();
    }
  };

  // === 유틸리티 함수 === 
  
  /**
   * 좌표값을 1mm 단위로 반올림
   * @param {number} value - 보정할 값
   * @returns {number} 1mm 단위로 반올림된 값
   */
  const snapToMillimeter = (value) => Math.round(value / 1) * 1; // 1mm 단위로 보정

  /**
   * 점의 좌표를 1mm 단위로 보정
   * @param {Object} point - 점 객체 {x, y}
   * @returns {Object} 보정된 점 객체 {x, y}
   */
  const roundPoint = (point) => ({
    x: snapToMillimeter(point.x),
    y: snapToMillimeter(point.y),
  });

  /**
   * 직각 도구: 두 점이 이루는 선이 수직/수평이 되도록 보정
   * - 가로/세로 거리 중 더 긴 쪽만 움직이고, 짧은 쪽은 고정
   * @param {Object} start - 시작점 {x, y}
   * @param {Object} end - 끝점 {x, y}
   * @returns {Object} 보정된 끝점 {x, y}
   */
  const getOrthogonalPoint = (start, end) => roundPoint({
    x: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? end.x : start.x,
    y: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? start.y : end.y
  });

  /**
   * 두 선분의 교차점을 계산
   * @param {Object} line1Start - 첫 번째 선분 시작점 {x, y}
   * @param {Object} line1End - 첫 번째 선분 끝점 {x, y}
   * @param {Object} line2Start - 두 번째 선분 시작점 {x, y}
   * @param {Object} line2End - 두 번째 선분 끝점 {x, y}
   * @returns {Object|null} 교차점 {x, y} 또는 교차하지 않으면 null
   */
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


  /**
   * 기존 벽과의 교차점들을 찾아서 정렬
   * @param {Object} newStart - 새 벽 시작점 {x, y}
   * @param {Object} newEnd - 새 벽 끝점 {x, y}
   * @param {Array} existingWalls - 기존 벽 배열
   * @returns {Array} 정렬된 교차점 배열 [{x, y}]
   */
  const findIntersections = (newStart, newEnd, existingWalls) => {
    const intersections = [];
  
    existingWalls.forEach(wall => {
      const wallStart = { x: wall.attr('x1'), y: wall.attr('y1') };
      const wallEnd = { x: wall.attr('x2'), y: wall.attr('y2') };
  
      const intersection = getIntersectionPoint(newStart, newEnd, wallStart, wallEnd);
      if (intersection) {
        // 해당 벽의 레이블 제거
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

  /**
   * 교차점에서 기존 벽을 분할
   * @param {Object} intersection - 교차점 정보 {point, wall}
   */
  const splitWallAtIntersection = (intersection) => {
    const { point, wall } = intersection;
    const wallStart = { x: wall.attr('x1'), y: wall.attr('y1') };
    const wallEnd = { x: wall.attr('x2'), y: wall.attr('y2') };
  
    // // 해당 벽과 관련된 레이블 제거
    // const labels = labelLayer.find('.length-label');
    // labels.forEach(label => {
    //   const labelX = parseFloat(label.attr('x'));
    //   const labelY = parseFloat(label.attr('y'));
  
    //   if (isPointNearLine(labelX, labelY, wallStart, wallEnd)) {
    //     label.remove();
    //   }
    // });
  
    wall.remove();
  
    // 새 벽 생성 및 레이블 추가
    if (calculateDistance(wallStart, point) > 0) {
      wallLayer.line(wallStart.x, wallStart.y, point.x, point.y)
        .stroke({ width: toolState.wallThickness, color: "#999" });
      const distance1 = calculateDistance(wallStart, point);
      createLabel(distance1, (wallStart.x + point.x) / 2, (wallStart.y + point.y) / 2);
    }
  
    if (calculateDistance(point, wallEnd) > 0) {
      wallLayer.line(point.x, point.y, wallEnd.x, wallEnd.y)
        .stroke({ width: toolState.wallThickness, color: "#999" });
      const distance2 = calculateDistance(point, wallEnd);
      createLabel(distance2, (point.x + wallEnd.x) / 2, (point.y + wallEnd.y) / 2);
    }
  
    drawKeyPoint(point.x, point.y);
  };

  /**
   * 점이 선분 근처에 있는지 확인
   * @param {number} px - 점의 x좌표
   * @param {number} py - 점의 y좌표
   * @param {Object} lineStart - 선분 시작점 {x, y}
   * @param {Object} lineEnd - 선분 끝점 {x, y}
   * @returns {boolean} 점이 선분 근처면 true
   */
  const isPointNearLine = (px, py, lineStart, lineEnd) => {
    const buffer = toolState.wallThickness;
    
    // 선분의 길이 계산
    const lineLength = Math.sqrt(
      Math.pow(lineEnd.x - lineStart.x, 2) + 
      Math.pow(lineEnd.y - lineStart.y, 2)
    );
    
    // 점과 선분 양 끝점 사이의 거리 합
    const d1 = Math.sqrt(Math.pow(px - lineStart.x, 2) + Math.pow(py - lineStart.y, 2));
    const d2 = Math.sqrt(Math.pow(px - lineEnd.x, 2) + Math.pow(py - lineEnd.y, 2));
    
    // 점이 선분 위에 있는지 확인 (거리 합이 선분 길이와 거의 같으면)
    const tolerance = buffer;
    return Math.abs(d1 + d2 - lineLength) <= tolerance;
  };


  /**
   * 교차점들을 고려하여 새 벽 생성
   * @param {Object} start - 시작점 {x, y}
   * @param {Object} end - 끝점 {x, y}
   * @param {Array} intersections - 교차점 배열
   */
  const createWallWithIntersections = (start, end, intersections) => {
    // 새 벽 경로 상의 기존 레이블 제거
    const existingLabels = labelLayer.find('.length-label');
    // existingLabels.forEach(label => {
    //   const labelX = parseFloat(label.attr('x'));
    //   const labelY = parseFloat(label.attr('y'));
    //   if (isPointNearLine(labelX, labelY, start, end)) {
    //     label.remove();
    //   }
    // });
  
    let currentStart = start;
    [...intersections, { point: end }].forEach(({ point }) => {
      if (calculateDistance(currentStart, point) > 1) {
        wallLayer.line(currentStart.x, currentStart.y, point.x, point.y)
          .stroke({ width: toolState.wallThickness, color: "#999" });
        const distance = calculateDistance(currentStart, point);
        createLabel(distance, (currentStart.x + point.x) / 2, (currentStart.y + point.y) / 2);
      }
      currentStart = point;
    });
  };

  /**
   * 현재 점에서 가장 가까운 스냅 포인트를 찾음
   * - 벽의 시작점, 끝점, 중간점 중 현재 점과 가장 가까운 점 반환
   * - 설정된 스냅 범위보다 멀면 현재 점 그대로 반환
   * @param {Object} currentPoint - 현재 점 {x, y}
   * @param {Array} walls - 벽 객체들의 배열
   * @param {boolean} isStart - 시작점 여부
   * @returns {Object} 스냅된 점 {x, y}
   */
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

  /**
   * 점이 허용된 그리기 영역(-50m ~ 50m) 안에 있는지 검사
   * @param {Object} point - 검사할 점 {x, y}
   * @returns {boolean} 영역 내부면 true, 외부면 false
   */
  const isWithinBoundary = (point) => 
    Math.abs(point.x) <= 50000 && Math.abs(point.y) <= 50000;

  /**
   * 피타고라스 정리로 두 점 사이의 거리를 계산
   * @param {Object} start - 시작점 {x, y}
   * @param {Object} end - 끝점 {x, y}
   * @returns {string} 거리(m) - 소수점 2자리까지
   */
  const calculateDistance = (start, end) => {
    start = roundPoint(start);
    end = roundPoint(end);
    return Math.round(Math.sqrt(
      Math.pow(end.x - start.x, 2) + 
      Math.pow(end.y - start.y, 2)
    )).toString();
  }

  /**
   * 브라우저 마우스 좌표를 SVG 내부 좌표로 변환
   * @param {MouseEvent} event - 마우스 이벤트
   * @returns {SVGPoint} SVG 좌표계의 점
   */
  const getSVGCoordinates = (event) => {
    const point = draw.node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(draw.node.getScreenCTM().inverse());
  };

  // === 시각적 요소 관리 ===
  /**
   * 확대/축소 시 모든 요소(글자, 점)의 크기를 화면에 맞게 조정
   * - 화면이 확대되면 요소는 작게, 축소되면 요소는 크게
   */
  const updateVisualElements = () => {
    const fontSize = viewbox.width * 0.025;  // 글자 크기는 화면 너비의 2.5%
    const keySize = viewbox.width * 0.02;   // 점 크기는 화면 너비의 2%

    // 모든 길이 표시 글자 크기 조정
    draw.find(".length-label").forEach(label => {
      label.font({ size: fontSize });
      label.front();
    });

    // 모든 키포인트(점) 크기 조정
    draw.find(".key").forEach(key => {
      const { cx, cy } = key.attr();  // 현재 중심점 좌표 저장
      key.size(keySize, keySize)      // 크기 변경
        .stroke({ width: keySize * 0.1 })  // 테두리 두께도 비례해서 변경
        .center(cx, cy);  // 중심점 유지
    });
  };

  /**
   * 벽의 끝점을 표시하는 하얀 원을 그림
   * @param {number} x - x좌표
   * @param {number} y - y좌표
   * @returns {SVG.Circle} 생성된 키포인트(원)
   */
  const drawKeyPoint = (x, y) => {
    const keySize = viewbox.width * 0.02;  // 점 크기는 화면 너비의 2%
    const key = draw.circle(keySize)
      .fill("#fff")  // 흰색 채우기
      .stroke({ color: "#000", width: keySize * 0.1 })  // 검은색 테두리
      .center(x, y)  // 중심점 설정
      .addClass("key");  // 크기 조절을 위한 클래스 추가
    labelLayer.add(key);  // 레이블 레이어에 추가
    key.front();  // 최상단에 표시
    return key;
  };

  /**
   * 벽의 길이를 표시하는 텍스트를 생성
   * @param {string|number} text - 표시할 길이 값
   * @param {number} x - x좌표 (중앙 정렬 기준)
   * @param {number} y - y좌표
   * @returns {SVG.Text} 생성된 텍스트 레이블
   */
  const createLabel = (text, x, y) => {
    const label = draw.text(`${text}mm`)
      .font({ size: viewbox.width * 0.025, anchor: "middle" })  // 크기와 중앙 정렬
      .fill("#000")  // 검은색 글자
      .center(x, y)  // 위치 설정
      .addClass("length-label")  // 크기 조절을 위한 클래스
      .css({ "pointer-events": "none" });
    labelLayer.add(label);  // 레이블 레이어에 추가
    labelLayer.front();  // 최상단에 표시
    console.log(`Creating label: ${text} at (${x}, ${y})`);
    return label;
  };

  /**
   * 벽 그리기 중 길이 표시 업데이트
   * @param {SVG.Text} label - 업데이트할 텍스트 레이블
   * @param {string|number} distance - 새로운 길이 값
   * @param {Object} start - 시작점 {x, y}
   * @param {Object} end - 끝점 {x, y}
   */
  const updateLabel = (label, distance, start, end) => {
    if (!label) return;
    const midX = (start.x + end.x) / 2;  // 벽의 중간 x좌표
    const midY = (start.y + end.y) / 2;  // 벽의 중간 y좌표
    label.text(`${distance}mm`).center(midX, midY);  // 위치와 텍스트 갱신
  };

  /**
   * 벽 그리기 취소 시 임시 요소들 제거
   * - 미리보기 선과 길이 표시 제거
   */
  const cleanupPreview = () => {
    wallPreview?.remove();  // 미리보기 선 제거
    lengthLabel?.remove();  // 길이 레이블 제거
    wallPreview = null;  
    lengthLabel = null;
    labelLayer.front();  // 레이블 레이어 최상단으로
  };

  // === 도구 이벤트 시스템 ===
  /**
   * 각 도구별 마우스 이벤트 처리 함수 정의
   * - select: 화면 이동 도구
   * - wall: 벽 그리기 도구
   */
  const tools = {
    select: {  // 화면 이동 도구
      onMouseDown: panControls.start,  // 드래그 시작
      onMouseMove: panControls.move,   // 드래그 중
      onMouseUp: panControls.stop      // 드래그 끝
    },
    wall: {    // 벽 그리기 도구
      onClick: event => {  // 클릭 시
        const coords = getSVGCoordinates(event);
        !wallStart ? wallControls.start(coords) : wallControls.finish(coords);
      },
      onMouseMove: event => wallControls.preview(getSVGCoordinates(event))  // 미리보기
    }
  };

  /**
   * 현재 선택된 도구의 이벤트 처리기를 실행
   * @param {string} eventName - 이벤트 이름 (onClick, onMouseMove 등)
   * @param {Event} event - 발생한 이벤트 객체
   */
  const executeToolEvent = (eventName, event) => {
    const tool = tools[toolState.currentTool];  // 현재 도구 가져오기
    if (tool?.[eventName]) {  // 해당 이벤트 처리기가 있으면 실행
      tool[eventName](event);
    }
  };

  /**
   * 키보드 단축키 처리
   * - ESC: 벽 그리기 취소
   * - Ctrl+Z: 실행 취소
   * - Ctrl+Y: 다시 실행
   * @param {KeyboardEvent} event - 키보드 이벤트
   */
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {  // ESC 키
      wallStart = null;  // 벽 그리기 취소
      cleanupPreview();  // 미리보기 제거
      labelLayer.front();
    } else if (event.ctrlKey && event.key === "z") {  // Ctrl+Z
      event.preventDefault();
      undo();  // 실행 취소
    } else if (event.ctrlKey && event.key === "y") {  // Ctrl+Y
      event.preventDefault();
      redo();  // 다시 실행
    }
  };

  // === 외부로 노출할 함수들 ===
  return {
    toolState,                // 도구 상태
    initializeCanvas,         // 캔버스 초기화
    executeToolEvent,         // 도구 이벤트 실행
    zoomCanvas,              // 확대/축소
    handleKeyDown,           // 키 입력 처리
    setWallThickness: (thickness) => {  // 벽 두께 설정
      const newThickness = Number(thickness);
      if (newThickness > 0) {
        toolState.wallThickness = newThickness;
      }
    },
    setSnapDistance: (distance) => {    // 스냅 거리 설정
      const newDistance = Number(distance);
      if (newDistance > 0) {
        toolState.snapDistance = newDistance;
      }
    },
    undo,                    // 실행 취소
    redo                     // 다시 실행
  };
});