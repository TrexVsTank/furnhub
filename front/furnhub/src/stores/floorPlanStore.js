import { defineStore } from "pinia";
import { SVG } from "@svgdotjs/svg.js";
import { reactive } from "vue";

export const useFloorPlanStore = defineStore("floorPlanStore", () => {
  // === 기본 상태 관리 ===
  let draw = null;                
  let wallLayer = null;          
  let labelLayer = null;         
  
  const toolState = reactive({    
    currentTool: "select",        
    wallThickness: 100,          
  });
  
  const viewbox = reactive({
    x: -3000,          
    y: -3000,          
    width: 6000,       
    height: 6000       
  });

  let wallStart = null;           
  let wallPreview = null;         
  let lengthLabel = null;         

  // === 히스토리 관리 ===
  const history = reactive({
    undoStack: [],    
    redoStack: [],    
    current: null     
  });

  // === 상태 저장/복원 ===
  const saveState = () => {
    const state = {
      walls: wallLayer.children().map(wall => ({
        x1: wall.attr('x1'),
        y1: wall.attr('y1'),
        x2: wall.attr('x2'),
        y2: wall.attr('y2'),
        thickness: wall.attr('stroke-width')
      })),
      labels: labelLayer.find('.length-label').map(label => ({
        text: label.text(),
        x: label.attr('x'),
        y: label.attr('y')
      })),
      keyPoints: labelLayer.find('.key').map(key => ({
        x: key.cx(),
        y: key.cy(),
        size: key.attr('r') * 2
      }))
    };
    
    history.undoStack.push(JSON.stringify(state));
    history.redoStack = [];  
    history.current = state;
  };

  const restoreState = (state) => {
    wallLayer.children().forEach(child => child.remove());
    labelLayer.children().forEach(child => child.remove());

    state.walls.forEach(wall => {
      wallLayer.line(wall.x1, wall.y1, wall.x2, wall.y2)
        .stroke({ width: wall.thickness, color: "#999" });
    });

    state.labels.forEach(label => {
      createLabel(label.text.replace('m', ''), label.x, label.y);
    });

    state.keyPoints.forEach(point => {
      drawKeyPoint(point.x, point.y);
    });

    labelLayer.front();
  };

  // === 실행 취소/다시 실행 ===
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

  const redo = () => {
    if (history.redoStack.length > 0) {
      const nextState = history.redoStack.pop();
      history.undoStack.push(nextState);
      restoreState(JSON.parse(nextState));
    }
  };

  // === 캔버스 초기화 ===
  const initializeCanvas = (canvasElement) => {
    draw = SVG().addTo(canvasElement).size("100%", "100%");
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    
    addGrid();
    wallLayer = draw.group().addClass("wall-layer");
    labelLayer = draw.group().addClass("label-layer");
    labelLayer.front();
  };

  // === 그리드 시스템 ===
  const addGrid = () => {
    const GRID_BOUNDARY = { min: -50000, max: 50000 };
    draw.find(".grid-line").forEach(line => line.remove());

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

    draw.line(GRID_BOUNDARY.min, 0, GRID_BOUNDARY.max, 0)
      .stroke({ width: 10, color: '#000' })
      .addClass("grid-line");
    draw.line(0, GRID_BOUNDARY.min, 0, GRID_BOUNDARY.max)
      .stroke({ width: 10, color: '#000' })
      .addClass("grid-line");

    [GRID_BOUNDARY.min, GRID_BOUNDARY.max].forEach(pos => {
      draw.line(pos, GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max)
        .stroke({ width: 50, color: '#f00' })
        .addClass("grid-line");
      draw.line(GRID_BOUNDARY.min, pos, GRID_BOUNDARY.max, pos)
        .stroke({ width: 50, color: '#f00' })
        .addClass("grid-line");
    });
  };

  // === 확대/축소 기능 ===
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

    Object.assign(viewbox, {
      x: viewbox.x - dx,
      y: viewbox.y - dy,
      width: newWidth,
      height: newHeight
    });
    
    draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
    updateVisualElements();
  };

  // === 화면 이동 기능 ===
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  const panControls = {
    start: (event) => {
      isPanning = true;
      panStart = { x: event.clientX, y: event.clientY };
    },
    move: (event) => {
      if (!isPanning) return;
      const dx = (event.clientX - panStart.x) * viewbox.width / draw.node.clientWidth;
      const dy = (event.clientY - panStart.y) * viewbox.height / draw.node.clientHeight;
      
      Object.assign(viewbox, {
        x: viewbox.x - dx,
        y: viewbox.y - dy
      });
      
      draw.viewbox(viewbox.x, viewbox.y, viewbox.width, viewbox.height);
      panStart = { x: event.clientX, y: event.clientY };
    },
    stop: () => isPanning = false
  };

  // === 벽 그리기 기능 ===
  const wallControls = {
    start: (coords) => {
      if (!isWithinBoundary(coords)) return;
      
      wallStart = coords;
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
      lengthLabel = createLabel("0.00", wallStart.x, wallStart.y);
    },

    preview: (coords) => {
      if (!wallStart || !coords) return;
      
      const orthogonalEnd = getOrthogonalPoint(wallStart, coords);
      wallPreview?.plot(
        wallStart.x, wallStart.y,
        orthogonalEnd.x, orthogonalEnd.y
      );

      const distance = calculateDistance(wallStart, orthogonalEnd);
      updateLabel(lengthLabel, distance, wallStart, orthogonalEnd);
    },

    finish: (coords) => {
      if (!wallStart) return;

      const orthogonalEnd = getOrthogonalPoint(wallStart, coords);
      
      wallLayer.line(wallStart.x, wallStart.y, orthogonalEnd.x, orthogonalEnd.y)
        .stroke({ width: toolState.wallThickness, color: "#999" });
      
      drawKeyPoint(wallStart.x, wallStart.y);
      drawKeyPoint(orthogonalEnd.x, orthogonalEnd.y);

      const distance = calculateDistance(wallStart, orthogonalEnd);
      const midPoint = {
        x: (wallStart.x + orthogonalEnd.x) / 2,
        y: (wallStart.y + orthogonalEnd.y) / 2
      };
      createLabel(distance, midPoint.x, midPoint.y - 20);

      wallPreview?.remove();
      lengthLabel?.remove();

      wallStart = orthogonalEnd;
      
      wallPreview = draw.line(wallStart.x, wallStart.y, wallStart.x, wallStart.y)
        .stroke({ width: viewbox.width * 0.01, color: "#999", dasharray: "5,5" });
      lengthLabel = createLabel("0.00", wallStart.x, wallStart.y);
      
      labelLayer.front();
      saveState();
    }
  };

  // === 유틸리티 함수 ===
  const getOrthogonalPoint = (start, end) => ({
    x: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? end.x : start.x,
    y: Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? start.y : end.y
  });

  const isWithinBoundary = (point) => 
    Math.abs(point.x) <= 50000 && Math.abs(point.y) <= 50000;

  const calculateDistance = (start, end) =>
    (Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 1000).toFixed(2);

  const getSVGCoordinates = (event) => {
    const point = draw.node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(draw.node.getScreenCTM().inverse());
  };

  // === 시각적 요소 관리 ===
  const updateVisualElements = () => {
    const fontSize = viewbox.width * 0.025;
    const keySize = viewbox.width * 0.02;

    draw.find(".length-label").forEach(label => {
      label.font({ size: fontSize });
      label.front();
    });

    draw.find(".key").forEach(key => {
      const { cx, cy } = key.attr();
      key.size(keySize, keySize)
        .stroke({ width: keySize * 0.1 })
        .center(cx, cy);
    });
  };

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

  const createLabel = (text, x, y) => {
    const label = draw.text(`${text}m`)
      .font({ size: viewbox.width * 0.025, anchor: "middle" })
      .fill("#000")
      .center(x, y)
      .addClass("length-label");
    labelLayer.add(label);
    label.front();
    return label;
  };

  const updateLabel = (label, distance, start, end) => {
    if (!label) return;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    label.text(`${distance}m`).center(midX, midY - 20);
  };

  const cleanupPreview = () => {
    wallPreview?.remove();
    lengthLabel?.remove();
    wallPreview = null;
    lengthLabel = null;
    labelLayer.front();
  };

  // === 도구 이벤트 시스템 ===
  const tools = {
    select: {
      onMouseDown: panControls.start,
      onMouseMove: panControls.move,
      onMouseUp: panControls.stop
    },
    wall: {
      onClick: event => {
        const coords = getSVGCoordinates(event);
        !wallStart ? wallControls.start(coords) : wallControls.finish(coords);
      },
      onMouseMove: event => wallControls.preview(getSVGCoordinates(event))
    }
  };

  const executeToolEvent = (eventName, event) => {
    const tool = tools[toolState.currentTool];
    if (tool?.[eventName]) {
      tool[eventName](event);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      wallStart = null;
      cleanupPreview();
      labelLayer.front();
    } else if (event.ctrlKey && event.key === "z") {
      event.preventDefault();
      undo();
    } else if (event.ctrlKey && event.key === "y") {
      event.preventDefault();
      redo();
    }
  };

  return {
    toolState,
    initializeCanvas,
    executeToolEvent,
    zoomCanvas,
    handleKeyDown,
    setWallThickness: (thickness) => {
      toolState.wallThickness = Number(thickness);
    },
    undo,
    redo
  };
});