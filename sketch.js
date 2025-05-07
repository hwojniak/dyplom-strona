// Interactive canvas website-tool project using p5.js

let shapes = []; // Shapes currently floating or grabbed
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged

// UI Element References (DOM elements)
let inputElement;
let savePNGButton;         // Existing button for standard PNG save (saves canvasPG content)
let saveHighResPNGButton;  // NEW button for high-resolution PNG save (draws to temporary large canvas)
let savePDFButton;         // Existing button for PDF save (vector attempt via p5.pdf)
let refreshButton;
let clearButton;

// Layout constants
const HEADER_HEIGHT = 80;
const CANVAS_AREA_W = 500; // Base width of the artboard (can be adjusted if needed)
let CANVAS_AREA_H; // Calculated in setup based on 1:√2 ratio
let CANVAS_AREA_X; // Calculated in setup based on window width
let CANVAS_AREA_Y; // Calculated in setup

// High-Res PNG target constants (B2 size @ 300 DPI)
const TARGET_HIRES_WIDTH = 5906;
const TARGET_HIRES_HEIGHT = 8351; // B2 approx dimensions at 300 DPI

// Appearance constants
const PALETTE = [
  '#0000FE', '#FFDD00', '#E70012', '#FE4DD3', '#41AD4A',
  '#000000', '#222222', '#FFFFFF',  '#FFA500',
];

const TEXT_OPTIONS = [
  "TYPE SOMETHING...",
  "I LOVE MOM", "MUZYKA MNIE DOTYKA", "SOMETHING something 123",
  "Hi, I'm...", "TOOL", "ART PIECE", "WORK WORK WORK"
];

let baseFont = 'monospace'; // Could be p5.Font object after preload

let SNAP_INCREMENT_RADIANS; // For snap rotation

// Define size categories for shapes (for floating spawn)
const sizeCategories = [
  { name: 'small', sizeRange: [50, 80], scaleRange: [0.8, 1.2], textScaleAdjust: 0.15 },
  { name: 'medium', sizeRange: [80, 150], scaleRange: [1.0, 1.8], textScaleAdjust: 0.2 },
  { name: 'large', sizeRange: [150, 250], scaleRange: [1.2, 2.5], textScaleAdjust: 0.25 }
];

// Small tolerance for click detection
const CLICK_TOLERANCE = 5; // Pixels

let canvasPG; // Global reference to the p5.Graphics buffer for the central canvas area
let isCanvasDirty = false; // Flag to indicate if canvasPG needs redrawing

// --- Utility functions for precise mouse collision and text bounds (Same as before) ---
function transformPointToLocal(gx, gy, objX, objY, objRotation, objScale) {
  let tx = gx - objX; let ty = gy - objY;
  let cosAngle = cos(-objRotation); let sinAngle = sin(-objRotation);
  let rx = tx * cosAngle - ty * sinAngle; let ry = tx * sinAngle + ty * cosAngle;
  let localX = (objScale === 0) ? 0 : rx / objScale; let localY = (objScale === 0) ? 0 : ry / objScale;
  return { x: localX, y: localY };
}
function isPointInAxisAlignedRect(px, py, w, h, tolerance = 0) {
    let halfW = w / 2; let halfH = h / 2;
    return px >= -halfW - tolerance && px <= halfW + tolerance && py >= -halfH - tolerance && py <= halfH + tolerance;
}
function distToSegment(px, py, x1, y1, x2, y2) {
  let l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return dist(px, py, x1, y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = max(0, min(1, t));
  let closestX = x1 + t * (x2 - x1); let closestY = y1 + t * (y2 - y1);
  return dist(px, py, closestX, closestY);
}
function getTriangleVertices(size) {
    let heightBased = size * 0.8; let baseWidthBased = size * 0.8; let baseY = size * 0.4;
    return [{ x: 0, y: -heightBased }, { x: -baseWidthBased, y: baseY }, { x: baseWidthBased, y: baseY }];
}
function getSquareVertices(size) {
    let halfSize = size / 2;
    return [{ x: -halfSize, y: -halfSize }, { x: halfSize, y: -halfSize }, { x: halfSize, y: halfSize }, { x: -halfSize, y: halfSize }];
}
function getPentagonVertices(size) {
    let sides = 5; let radius = size * 0.7; let vertices = [];
    for (let i = 0; i < sides; i++) { let angle = TWO_PI / sides * i; let sx = cos(angle - HALF_PI) * radius; let sy = sin(angle - HALF_PI) * radius; vertices.push({ x: sx, y: sy }); } return vertices;
}
function getHexagonVertices(size) {
     let sides = 6; let radius = size; let vertices = [];
     for (let i = 0; i < sides; i++) { let angle = TWO_PI / sides * i; let sx = cos(angle) * radius; let sy = sin(angle) * radius; vertices.push({ x: sx, y: sy }); } return vertices;
}
function isPointInConvexPolygon(px, py, vertices) {
  let numVertices = vertices.length; if (numVertices < 3) return false; let has_pos = false, has_neg = false;
  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i], v2 = vertices[(i + 1) % numVertices]; let cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);
    if (cross_product > 1e-6) has_pos = true; if (cross_product < -1e-6) has_neg = true; if (has_pos && has_neg) return false;
  } return !(has_pos && has_neg);
}
function isPointNearPolygonEdge(px, py, vertices, tolerance) {
    if (vertices.length < 2) return false; for (let i = 0; i < vertices.length; i++) {
        let v1 = vertices[i], v2 = vertices[(i + 1) % vertices.length]; if (distToSegment(px, py, v1.x, v1.y, v2.x, v2.y) <= tolerance) { return true; }
    } return false;
}
function getTextBounds(content, effectiveTextSize, baseFontRef) {
    try {
         let tempPG = createGraphics(10, 10);
         tempPG.textSize(effectiveTextSize); tempPG.textFont(baseFontRef); tempPG.textAlign(CENTER, CENTER);
         let textW = tempPG.textWidth(content); let textAsc = tempPG.textAscent(); let textDesc = tempPG.textDescent(); let textH = textAsc + textDesc;
         if (tempPG && tempPG.elt) { tempPG.elt.remove(); } return { w: textW, h: textH };
    } catch (e) {
        console.error("Error in getTextBounds:", e); return { w: effectiveTextSize * content.length * 0.6, h: effectiveTextSize * 1.2 };
    }
}
// --- End Utility functions ---

// --- FloatingShape Class (Same as before) ---
class FloatingShape {
  constructor() { this.reset(); this.isGrabbed = false; this.isPlacing = false; this.landFrame = -1; this.tempScaleEffect = 1; }
  reset() {
    let edge = floor(random(4)); let posAlong = random(0.2, 0.8);
    let category = sizeCategories[floor(random(sizeCategories.length))];
    this.size = random(category.sizeRange[0], category.sizeRange[1]);
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]);
    this.currentSize = this.size * this.scaleFactor;
    let minSpeed = 1.5, maxSpeed = 3.5; let roughMaxDimension = this.calculateMaxEffectiveDimension();
    let offScreenOffset = max(roughMaxDimension * this.scaleFactor * 0.8, 200);
    switch (edge) {
      case 0: this.x = width * posAlong; this.y = -offScreenOffset; this.speedX = random(-1, 1); this.speedY = random(minSpeed, maxSpeed); break;
      case 1: this.x = width + offScreenOffset; this.y = height * posAlong; this.speedX = random(-maxSpeed, -minSpeed); this.speedY = random(-1, 1); break;
      case 2: this.x = width * posAlong; this.y = height + offScreenOffset; this.speedX = random(-1, 1); this.speedY = random(-maxSpeed, -minSpeed); break;
      case 3: this.x = -offScreenOffset; this.y = height * posAlong; this.speedX = random(minSpeed, maxSpeed); this.speedY = random(-1, 1); break;
    }
    this.rotation = random(TWO_PI); this.rotationSpeed = random(-0.003, 0.003) * random(1, 3);
    let pickedColor; do { pickedColor = color(random(PALETTE)); } while (PALETTE.length > 1 && brightness(pickedColor) < 30); this.color = pickedColor;
    this.type = random() < 0.7 ? 'shape' : 'text';
    if (this.type === 'shape') { this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']); this.content = null; this.textScaleAdjust = 0;
    } else {
         this.shapeType = 'none'; let initialContent = random(TEXT_OPTIONS.slice(1));
         while(!initialContent || initialContent.trim() === "" || initialContent.trim() === TEXT_OPTIONS[0].trim()){ initialContent = random(TEXT_OPTIONS.slice(1)); }
         this.content = initialContent.trim(); this.textScaleAdjust = category.textScaleAdjust;
         let textBgBrightness = 255; // Assuming white background
         if(brightness(pickedColor) > textBgBrightness * 0.6 && brightness(pickedColor) < textBgBrightness * 0.9){ let attempts = 0; let darkColor;
         do { darkColor = color(random(PALETTE)); attempts++; } while(attempts < 10 && brightness(darkColor) > textBgBrightness * 0.6);
         if (brightness(darkColor) <= textBgBrightness * 0.6) { this.color = darkColor; } else { this.color = color(random(PALETTE)); }} else { this.color = pickedColor; }
    }
    this.isGrabbed = false; this.isPlacing = false; this.landFrame = -1; this.tempScaleEffect = 1;
  }
  calculateMaxEffectiveDimension() {
       if (this.type === 'text' && this.content) { let effectiveTextSize = this.size * this.textScaleAdjust; let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont); return max(textBounds.w, textBounds.h);
        } else if (this.type === 'shape') {
             switch(this.shapeType) { case 'circle': return this.size; case 'square': return this.size * Math.SQRT2 / 2; case 'triangle': return this.size * 0.8 * 0.8; case 'pentagon': return this.size * 0.7; case 'hexagon': return this.size; default: return this.size; }
        } else { return this.size || 50; }
  }
  update() { if (!this.isGrabbed && !this.isPlacing) { this.x += this.speedX; this.y += this.speedY; this.rotation += this.rotationSpeed; } this.currentSize = this.size * this.scaleFactor; }
   isReallyOffScreen() { let maxEffectiveDimension = this.calculateMaxEffectiveDimension() * this.scaleFactor; let effectiveRadius = maxEffectiveDimension / 2; let buffer = max(width, height) * 0.3;
      return this.x < -buffer - effectiveRadius || this.x > width + buffer + effectiveRadius || this.y < -buffer - effectiveRadius || this.y > height + buffer + effectiveRadius;}
  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame; let duration = 45;
        if (elapsed <= duration) { let t = map(elapsed, 0, duration, 0, 1); this.tempScaleEffect = 1 + sin(t * PI) * 0.05;
        } else { this.isPlacing = false; this.tempScaleEffect = 1; }
        // Mark canvas dirty if landing finishes
         if (!this.isPlacing && elapsed > duration) {
            isCanvasDirty = true; // Mark dirty when landing animation completes
            // console.log("Item finished landing, marking canvas dirty.");
         }
    } else if (!this.isPlacing && this.tempScaleEffect !== 1) { this.tempScaleEffect = 1; } // Ensure scale effect is reset
  }
   // graphics: The p5 graphics object target (e.g., 'this' for main, 'canvasPG' for PG buffer)
   // showGrabEffect: Apply grabbed visual style? (Only applies if graphics === this)
   // offsetX, offsetY: Optional offset to translate the shape by before drawing relative to graphics origin.
  display(graphics, showGrabEffect = false, offsetX = 0, offsetY = 0) {
     if (!graphics || typeof graphics.push !== 'function') return;
    graphics.push(); graphics.translate(this.x - offsetX, this.y - offsetY); graphics.rotate(this.rotation);
    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale);
     if (showGrabEffect && graphics === this) {
         graphics.drawingContext.shadowBlur = 40; graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
         graphics.stroke(255, 255, 255, 200); graphics.strokeWeight(3); graphics.noFill();
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
         graphics.drawingContext.shadowBlur = 0; graphics.noStroke();
     }
    graphics.fill(this.color); graphics.noStroke();
    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
    graphics.pop();
  }
  // Draws the shape's core geometry or text on the provided graphics context.
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        if (!graphics || typeof graphics.rectMode !== 'function' || typeof graphics.text !== 'function') { return; }
        if (isText) {
             if (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) return;
             graphics.textFont(baseFont); graphics.textAlign(CENTER, CENTER);
             let effectiveTextSize = psize * textScaleAdjust; graphics.textSize(effectiveTextSize);
             graphics.text(this.content, px, py);
         } else {
              graphics.rectMode(CENTER);
             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break;
               case 'square': graphics.rect(px, py, psize, psize); break;
               case 'triangle': graphics.beginShape(); graphics.vertex(px, py - psize * 0.8); graphics.vertex(px - psize * 0.8, py + psize * 0.4); graphics.vertex(px + psize * 0.8, py + psize * 0.4); graphics.endShape(CLOSE); break;
               case 'pentagon': graphics.beginShape(); let sidesP = 5; let radiusP = psize * 0.7; for (let i = 0; i < sidesP; i++) { let angle = TWO_PI / sidesP * i; let sx = cos(angle - HALF_PI) * radiusP; let sy = sin(angle - HALF_PI) * radiusP; graphics.vertex(px + sx, py + sy); } graphics.endShape(CLOSE); break;
               case 'hexagon': graphics.beginShape(); let sidesH = 6; let radiusH = psize; for (let i = 0; i < sidesH; i++) { let angle = TWO_PI / sidesH * i; let sx = cos(angle) * radiusH; let sy = sin(angle) * radiusH; graphics.vertex(px + sx, py + sy); } graphics.endShape(CLOSE); break;
               default: break;
             }
         }
   }
  isMouseOver(mx, my) {
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) || isNaN(this.scaleFactor) || isNaN(this.size) || this.scaleFactor <= 0 || this.size <= 0) { return false; }
       let currentDisplayScale = this.scaleFactor * this.tempScaleEffect;
       let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, currentDisplayScale);
       let localMx = localMouse.x, localMy = localMouse.y;
       let localTolerance = max(CLICK_TOLERANCE / currentDisplayScale, 2);
       if (this.type === 'text') {
           if (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) return false;
           let effectiveTextSize = this.size * this.textScaleAdjust;
           let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont);
           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);
       } else {
           switch (this.shapeType) {
              case 'circle': return dist(localMx, localMy, 0, 0) <= this.size + localTolerance;
              case 'square': return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);
              case 'triangle': let triVertices = getTriangleVertices(this.size); if (isPointInConvexPolygon(localMx, localMy, triVertices)) return true; return isPointNearPolygonEdge(localMx, localMy, triVertices, localTolerance);
              case 'pentagon': let pentVertices = getPentagonVertices(this.size); if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true; return isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance);
              case 'hexagon': let hexVertices = getHexagonVertices(this.size); if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true; return isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance);
              default: return dist(localMx, localMy, 0, 0) <= (this.size * 0.5) + localTolerance;
           }
       }
    }
  solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}
// --- End FloatingShape Class ---


function preload() {
  // baseFont = loadFont('path/to/your/font.otf'); // Load your font here
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  SNAP_INCREMENT_RADIANS = radians(15);

   // Calculate canvas area dimensions and position based on 1:√2 aspect ratio
   const adjustedCanvasW = min(CANVAS_AREA_W, windowWidth * 0.95); // Ensure artboard fits width
  CANVAS_AREA_H = adjustedCanvasW * Math.sqrt(2); // **NEW: Use Math.sqrt(2) for B-series ratio**
  CANVAS_AREA_X = width / 2 - adjustedCanvasW / 2;
  CANVAS_AREA_Y = HEADER_HEIGHT + 20;
  if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0;

  // Create/Recreate canvas graphics buffer
    if (canvasPG) { canvasPG.remove(); }
    // Use round() just in case dimensions aren't perfect integers, although P5 handles floats
    canvasPG = createGraphics(round(adjustedCanvasW), round(CANVAS_AREA_H));
    canvasPG.background(255);
    isCanvasDirty = true; // Mark dirty initially

  let headerCenterY = HEADER_HEIGHT / 2;

  // Input element setup
  inputElement = createInput();
  inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
  inputElement.size(adjustedCanvasW);
  inputElement.style("padding", "5px 10px").style("border", "1px solid #ccc").style("border-radius", "15px").style("outline", "none").style("background-color", color(255, 255, 255, 200)).style("font-size", "14px").style("color", color(50)).style("box-sizing", "border-box");

  inputElement.elt.addEventListener('keypress', function(event) { if (event.key === 'Enter' && event.target === this) { addNewTextShapeFromInput(); event.preventDefault(); } });

  // --- Button setup (positioned in windowResized) ---
  savePNGButton = createButton("SAVE PNG");
  savePNGButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
  savePNGButton.mousePressed(saveCanvasAreaAsPNG);

   // SAVE HIGH-RES PNG Button
   saveHighResPNGButton = createButton("SAVE HI-RES PNG");
   saveHighResPNGButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   saveHighResPNGButton.mousePressed(saveCanvasAreaAsHighResPNG); // Bind to high-res save

  // SAVE PDF Button (Kept as an option, causes click lag due to library behavior)
   savePDFButton = createButton("SAVE PDF");
   savePDFButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   savePDFButton.mousePressed(saveCanvasAreaAsPDF); // Bind to PDF save

  clearButton = createButton("CLEAR");
   clearButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   clearButton.mousePressed(restartAll);

  refreshButton = createButton("REFRESH");
   refreshButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   refreshButton.mousePressed(resetRandom);

   // Initial positioning
   windowResized();

  // Create initial floating shapes
  while (shapes.length < 30) { shapes.push(new FloatingShape()); }
}


function draw() {
  background(0); // Draw background for areas outside the artboard

  // Update and draw floating shapes in the background
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing);
  while (shapes.length < 20) { shapes.push(new FloatingShape()); }
  for (let shape of shapes) {
     if (!shape.isGrabbed && !shape.isPlacing) { shape.update(); }
     shape.updateLanding(); // Update landing animation state (might set isCanvasDirty)
     shape.display(this, shape.isGrabbed && shapes.includes(shape), 0, 0);
  }


  // --- Central White Canvas Area Drawing (Rendered to canvasPG) ---
  if(canvasPG){
     // Redraw canvasPG ONLY when marked as dirty or when landing animations are active
     // This optimizes drawing by avoiding redrawing static content every frame
     let anyPlacedItemIsLanding = placedItems.some(item => item.isPlacing);

     if(isCanvasDirty || anyPlacedItemIsLanding) { // Check dirty flag or landing state
        // console.log("Redrawing canvasPG buffer. Dirty:", isCanvasDirty, " Landing:", anyPlacedItemIsLanding);
        canvasPG.clear();
        canvasPG.background(255);

       // Draw all placed items onto canvasPG
       for (let i = 0; i < placedItems.length; i++) {
           let item = placedItems[i];
           // UpdateLanding for placed items needed even if not redrawing buffer constantly,
           // to check state and set isCanvasDirty *when animation finishes*.
           // But since we now redraw while ANY item is landing, maybe skip calling updateLanding here.
           // No, let's keep updateLanding in the main loop to transition state correctly.

            // Draw item onto canvasPG, correctly offsetting by its display area's position
           item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
       }
       isCanvasDirty = false; // Reset flag after redrawing
     }


    // Always draw the canvasPG buffer onto the main canvas
    image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
  } else {
      console.warn("canvasPG is null in draw().");
       fill(255, 100, 100); rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
       fill(0); textAlign(CENTER, CENTER); text("Error: Canvas buffer not loaded.", CANVAS_AREA_X + CANVAS_AREA_W/2, CANVAS_AREA_Y + CANVAS_AREA_H/2);
  }


  // Draw border around canvas area on main canvas (on top)
  stroke(200); strokeWeight(1); noFill();
  rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);


  // Draw grabbed item on top of everything else on the main canvas
  if (grabbedItem) {
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.4);
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.4);
      grabbedItem.solidify();
      if (grabbedItem.isPlacing) grabbedItem.isPlacing = false; // Ensure it stops pulsing when grabbed

     grabbedItem.display(this, true, 0, 0); // Draw on main canvas with grab effect
  }


  // --- DRAW HEADER / UI OVERLAY ---
  fill(220); noStroke(); rect(0, 0, width, HEADER_HEIGHT);
  fill(50); textSize(20); textAlign(LEFT, CENTER); textFont(baseFont);
  text("PLACEHOLDER\nLOGO", 20, HEADER_HEIGHT / 2);
}


function mousePressed() {
  // Check if mouse is over header/UI, ignore interaction
   if (mouseY < HEADER_HEIGHT) return;
   if (grabbedItem) { return; } // Don't grab if something is already grabbed

  // Attempt to grab placed items (backwards for Z-order)
   for (let i = placedItems.length - 1; i >= 0; i--) {
       if (placedItems[i].isMouseOver(mouseX, mouseY)) {
           grabbedItem = placedItems[i];
           grabbedItem.isGrabbed = true; grabbedItem.isPlacing = false; grabbedItem.solidify();
           let temp = placedItems.splice(i, 1)[0]; // Remove from placed, get reference
           shapes.push(temp); // Add to shapes temporarily
           isCanvasDirty = true; // Canvas area needs redrawing because an item was removed

           // Populate input and focus
           if (grabbedItem.type === 'text') { inputElement.value(grabbedItem.content); inputElement.attribute('placeholder', ''); } else { inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); }
           inputElement.elt.focus();
           return; // Grabbed a placed item, done.
       }
   }

  // If no placed item grabbed, check floating shapes (backwards for Z-order)
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (!shapes[i].isGrabbed) {
      if (shapes[i].isMouseOver(mouseX, mouseY)) {
        grabbedItem = shapes[i];
        grabbedItem.isGrabbed = true; grabbedItem.isPlacing = false; grabbedItem.solidify();
         // Keep in shapes list, reorder to end (draws last)
        let temp = shapes.splice(i, 1)[0];
        shapes.push(temp);

        // Populate input and focus
        if (grabbedItem.type === 'text') { inputElement.value(grabbedItem.content); inputElement.attribute('placeholder', ''); } else { inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); }
        inputElement.elt.focus();
        break; // Grabbed floating, done.
      }
    }
  }
}

function mouseReleased() {
  if (grabbedItem) {
    grabbedItem.isGrabbed = false; // Unmark grabbed

    if (isMouseOverCanvasArea()) { // Dropped over canvas area
      grabbedItem.solidify();

      if (grabbedItem.type === 'text') {
           let content = inputElement.value().trim();
           if(content === "" || content === TEXT_OPTIONS[0].trim()) {
               console.log("Discarding empty text item on placement.");
               shapes = shapes.filter(s => s !== grabbedItem); grabbedItem = null;
           } else { grabbedItem.content = content; }
      }

      if(grabbedItem !== null) { // Check if not discarded
          // Apply rotation snapping
          if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
            grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
          }
          // Move from shapes to placedItems
          shapes = shapes.filter(s => s !== grabbedItem);
          placedItems.push(grabbedItem);
          // Start landing animation
          grabbedItem.isPlacing = true;
          grabbedItem.landFrame = frameCount;
          isCanvasDirty = true; // Canvas area needs redraw with new item

      } // If discarded, item was already removed from shapes.

    } else { // Dropped outside canvas area -> Floating state
         if (grabbedItem.type === 'text') {
             let content = inputElement.value().trim();
             grabbedItem.content = (content === "" || content === TEXT_OPTIONS[0].trim()) ? "" : content;
             if (grabbedItem.content === "") {
                  console.log("Discarding empty text item dropped outside canvas.");
                  shapes = shapes.filter(s => s !== grabbedItem); grabbedItem = null;
             }
         }
          if(grabbedItem !== null) { // Check if not discarded
             // Reset movement speeds
             grabbedItem.speedX = random(-1.5, 1.5); grabbedItem.speedY = random(-1.5, 1.5); grabbedItem.rotationSpeed = random(-0.003, 0.003);
             grabbedItem.isPlacing = false; // Cancel landing animation
             // Item remains in shapes
              console.log("Item dropped outside canvas area, returned to floating.");
          }
    }

    // Common cleanup
    if (grabbedItem === null || !grabbedItem.isGrabbed) { // Clear if null or successfully ungrabbed
       grabbedItem = null;
       inputElement.value('');
       inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    }
  }
}


function mouseWheel(event) {
   let isOverInteractiveArea = mouseX >= 0 && mouseX <= width && mouseY >= HEADER_HEIGHT && mouseY <= height;
    if (grabbedItem && isOverInteractiveArea) {
        grabbedItem.rotation += event.delta * 0.002;
        return false;
    }
    return true;
}

function keyPressed() {
    // Delete grabbed item
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        console.log("Deleting grabbed item.");
        shapes = shapes.filter(s => s !== grabbedItem);
        // If item was placed, mark canvas dirty
        if (placedItems.includes(grabbedItem)) {
            placedItems = placedItems.filter(s => s !== grabbedItem);
            isCanvasDirty = true; // Canvas area needs redraw
        }
        grabbedItem = null;
        inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); inputElement.elt.focus();
        return false;
    }
    // Scale grabbed item
    if (grabbedItem) {
      if (key === '+' || key === '=') { grabbedItem.scaleFactor *= 1.08; grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, 6.0); }
      if (key === '-') { grabbedItem.scaleFactor *= 0.92; grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, 0.1); }
      grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor;
       // If item is placed, its scale change needs redraw
      if (placedItems.includes(grabbedItem)) { isCanvasDirty = true; }
      return false;
    }
    return true;
}


function addNewTextShapeFromInput() {
    let currentText = inputElement.value();
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
         console.log("Input empty/placeholder, not adding text.");
         inputElement.style("border-color", "red");
         setTimeout(() => inputElement.style("border-color", "#ccc"), 500);
         inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); inputElement.elt.focus();
         return;
    }
    console.log("Adding new text shape:", currentText);
    let newTextShape = new FloatingShape(); newTextShape.type = 'text'; newTextShape.content = currentText.trim(); newTextShape.shapeType = 'none';
    let category = sizeCategories.find(cat => cat.name === 'medium') || { sizeRange: [100, 200], scaleRange: [1.0, 1.5], textScaleAdjust: 0.2 };
    newTextShape.size = random(category.sizeRange[0] * 0.8, category.sizeRange[1] * 1.2); newTextShape.scaleFactor = 1.0; newTextShape.textScaleAdjust = category.textScaleAdjust; newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     let pickedColor; do { pickedColor = color(random(PALETTE)); } while (brightness(pickedColor) > 255 * 0.6); newTextShape.color = pickedColor;
     newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W * 0.3, CANVAS_AREA_X + CANVAS_AREA_W * 0.7); newTextShape.y = HEADER_HEIGHT + 50;
     newTextShape.speedX = random(-0.5, 0.5); newTextShape.speedY = random(1, 1.5); newTextShape.rotation = random(-0.05, 0.05); newTextShape.rotationSpeed = random(-0.0005, 0.0005);
    shapes.push(newTextShape);
    inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); inputElement.elt.focus();
}

function isMouseOverCanvasArea() { return mouseX > CANVAS_AREA_X && mouseX < CANVAS_AREA_X + CANVAS_AREA_W && mouseY > CANVAS_AREA_Y && mouseY < CANVAS_AREA_Y + CANVAS_AREA_H; }

function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0) return angleRadians;
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI;
    let snapped = round(angleRadians / incrementRadians) * incrementRadians;
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI;
    return snapped;
}

function generateTimestampString() {
    let d = new Date();
    return year() + nf(month(), 2) + nf(day(), 2) + '_' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
}


// SAVE PNG function (Standard Resolution)
function saveCanvasAreaAsPNG() {
    console.log("SAVE PNG button pressed (Standard Resolution)");
     // This will cause momentary lag depending on complexity and items
    if (canvasPG) {
        canvasPG.push();
        canvasPG.stroke(0); canvasPG.strokeWeight(1); canvasPG.noFill(); canvasPG.rect(0, 0, canvasPG.width - 1, canvasPG.height - 1);
        saveCanvas(canvasPG, 'myArtboard_stdres_' + generateTimestampString() + '.png');
        canvasPG.pop(); // Restore canvasPG state (removes the border)
         // Redraw canvasPG to remove the border if push/pop didn't fully revert the visible buffer state immediately
         // If isCanvasDirty logic covers redraw, just mark dirty
         // isCanvasDirty = true; // relies on draw loop
         // Explicit immediate redraw:
         canvasPG.clear(); canvasPG.background(255); // Clear
          // Redraw all placed items manually
          for (let item of placedItems) { item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y); } // Redraw

    } else { console.warn("Cannot save Standard PNG: canvasPG not created."); alert("Error: Canvas area buffer is not available."); }
}


// SAVE HIGH-RESOLUTION PNG function (Draws to a temporary large canvas)
function saveCanvasAreaAsHighResPNG() {
    console.log("SAVE HIGH-RES PNG button pressed (Target: B2 @ 300 DPI)");
     // NOTE: This is a heavy task and will block the browser thread briefly.
    const targetWidth = TARGET_HIRES_WIDTH; // B2 width in pixels at 300 DPI
    const targetHeight = TARGET_HIRES_HEIGHT; // B2 height in pixels at 300 DPI

    const sourceWidth = CANVAS_AREA_W;
    const sourceHeight = CANVAS_AREA_H; // Use the actual calculated artboard height (now 1:sqrt(2) ratio)

    // Calculate scale factor based on width
    const scaleFactor = targetWidth / sourceWidth;

    // Calculate scaled content dimensions and vertical offset for centering on the B2 canvas
    const scaledSourceHeight = sourceHeight * scaleFactor;
    const verticalOffset = (targetHeight - scaledSourceHeight) / 2;

    let highResPG = null; // Declare buffer outside try block

    try {
         if (targetWidth <= 0 || targetHeight <= 0) { console.error("Invalid target high-res dimensions."); alert("Error calculating high-res save size."); return; }

        // Create temporary buffer with integer dimensions
        highResPG = createGraphics(round(targetWidth), round(targetHeight));
        highResPG.background(255); // White background

        console.log("Drawing placed items onto high-res buffer...");
        // Draw placed items onto the high-res buffer with scaling
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];
             if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) { continue; } // Skip empty text

            highResPG.push();

             // Calculate item's center position on HIGH-RES canvas
             let hrItemX = (item.x - CANVAS_AREA_X) * scaleFactor; // Horizontal relative position * scale
             let hrItemY = (item.y - CANVAS_AREA_Y) * scaleFactor + verticalOffset; // Vertical relative position * scale + centering offset

            highResPG.translate(hrItemX, hrItemY); // Translate context to item center
            highResPG.rotate(item.rotation); // Apply item rotation
             // Apply combined scale: item's scale * overall high-res scale
             let combinedScale = item.scaleFactor * scaleFactor;
            highResPG.scale(combinedScale);


            // Apply drawing styles to highResPG context
            highResPG.fill(item.color); highResPG.noStroke();

            // Draw primitive using item's base size at (0,0) in transformed context
             item.drawShapePrimitive(highResPG, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust);

            highResPG.pop(); // Restore highResPG state
        } // End item drawing loop

         // Optional: Draw a border around the scaled artboard area on the high-res canvas
         highResPG.push();
         highResPG.stroke(0);
         let borderWeight = 1 * scaleFactor; // Scale border thickness
         highResPG.strokeWeight(borderWeight);
         highResPG.noFill();
         // Border rectangle position and size scaled + offset
         let borderRectX = 0; // Starts at left edge of the target canvas
         let borderRectY = verticalOffset; // Starts at calculated vertical offset
         let borderRectW = targetWidth; // Spans full width
         let borderRectH = scaledSourceHeight; // Spans scaled height
         // Account for stroke weight on the edge if desired:
         highResPG.rect(borderRectX + borderWeight / 2, borderRectY + borderWeight / 2,
                        borderRectW - borderWeight, borderRectH - borderWeight);
         highResPG.pop();


        console.log("Saving high-res PNG...");
        // Save the temporary high-resolution buffer
        saveCanvas(highResPG, `myArtboard_HIRES_${round(targetWidth)}x${round(targetHeight)}_` + generateTimestampString() + '.png');
         console.log("High-res PNG save initiated.");

     } catch(e) {
        console.error("Error generating high-res PNG:", e);
        alert("Error saving high-resolution PNG. Check browser console.");
     } finally {
        // Always dispose temporary buffer to free memory
        if (highResPG) {
             highResPG.remove();
             console.log("High-res buffer disposed.");
         }
     }
}


// SAVE PDF function using zenoZeng's p5.pdf library (May cause click lag)
function saveCanvasAreaAsPDF() {
    console.log("SAVE PDF button pressed (using zenoZeng's p5.pdf)");
     // NOTE: This will block the browser thread briefly. The final output fidelity depends on browser/print driver.

    if (typeof p5 === 'undefined' || typeof p5.prototype.createPDF !== 'function') {
         console.error("p5 or p5.pdf library not loaded correctly. Check index.html scripts and order: p5.js, p5.svg.js, p5.pdf.js, sketch.js. Clear browser cache!");
         alert("Error: PDF library not loaded. Check browser console."); return;
     }

    let pdf = null;
     try {
         // Get PDF instance
         if (this.createPDF && typeof this.createPDF === 'function') { pdf = this.createPDF(); }
         else if (window.createPDF && typeof window.createPDF === 'function') { pdf = window.createPDF(this); }

        if (!pdf) { console.error("createPDF returned null/undefined."); alert("Error creating PDF instance."); return; }
        console.log("p5.PDF instance created. Starting record.");

        pdf.beginRecord(); // Begin recording commands on the main canvas

        // --- Drawing Artboard Content for PDF ---
        background(255); // Set background of the 'page' (main canvas) to white

        push(); // Save global transform state
        translate(-CANVAS_AREA_X, -CANVAS_AREA_Y); // Shift origin so artboard top-left is (0,0)

        // Draw placed items using global drawing commands (which p5.pdf records)
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];
              if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) { continue; } // Skip empty text

            push(); // Save state before item transform
            translate(item.x, item.y); rotate(item.rotation);
            let currentDisplayScale = item.scaleFactor * item.tempScaleEffect;
            scale(currentDisplayScale);
            fill(item.color); noStroke();

            item.drawShapePrimitive(this, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust); // Draw using global context primitives

            pop(); // Restore state after item transform
        }

        // Optional Border in PDF
         push(); stroke(0); strokeWeight(1); noFill(); rect(0, 0, CANVAS_AREA_W, CANVAS_AREA_H); pop();

        pop(); // Restore global transform state

        // --- End Drawing ---

        console.log("Finished recording. Saving PDF.");
        pdf.endRecord(); // Capture main canvas state

        // Save the captured state to a PDF matching artboard dimensions
        pdf.save({
            filename: 'myArtboard_pdf_' + generateTimestampString(),
            width: round(CANVAS_AREA_W), height: round(CANVAS_AREA_H), // Use calculated artboard dimensions
            margin: {top:0, right:0, bottom:0, left:0}
        });
        console.log("PDF save initiated.");

     } catch(e) {
         console.error("An error occurred during PDF generation:", e);
         alert("Error generating PDF. Check browser console.");
         if (pdf && typeof pdf.endRecord === 'function' && pdf.isRecording) { console.warn("Attempting endRecord after error."); try{ pdf.endRecord(); } catch(endErr) { console.error("EndRecord error:", endErr); } }
     }
}


// REFRESH button action - Replace floating shapes
function resetRandom() {
    console.log("REFRESH button pressed");
    let tempGrabbedFloatingItem = null;
    if (grabbedItem && shapes.includes(grabbedItem)) { tempGrabbedFloatingItem = grabbedItem; shapes = shapes.filter(s => s !== grabbedItem); }
    shapes = [];
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }
    if (tempGrabbedFloatingItem) { shapes.push(tempGrabbedFloatingItem); }
     // No placed items affected, no need to mark canvas dirty.
    console.log("Refreshed floating shapes. Total shapes:", shapes.length);
}

// CLEAR button action - Resets everything
function restartAll() {
    console.log("CLEAR button pressed. Restarting state.");
    placedItems = []; shapes = []; grabbedItem = null;
    inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
     if (canvasPG) { canvasPG.clear(); canvasPG.background(255); }
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }
    isCanvasDirty = true; // Canvas area needs redraw (it's empty now)
    console.log("State cleared and repopulated.");
}

// WINDOW RESIZED FUNCTION - Handles responsive layout and canvasPG resizing
function windowResized() {
    console.log("Window resized to:", windowWidth, windowHeight);
    resizeCanvas(windowWidth, windowHeight); // Resize the main canvas

     // Recalculate canvas area dimensions (maintaining ratio) and position
     const adjustedCanvasW = min(CANVAS_AREA_W, windowWidth * 0.95);
     // **NEW: Use Math.sqrt(2) for H calculation based on W**
    CANVAS_AREA_H = adjustedCanvasW * Math.sqrt(2);
    CANVAS_AREA_X = width / 2 - adjustedCanvasW / 2;
    CANVAS_AREA_Y = HEADER_HEIGHT + 20;
    if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0;

    let headerCenterY = HEADER_HEIGHT / 2;

    // Input Element Positioning & Sizing
    if (inputElement) { inputElement.position(CANVAS_AREA_X, headerCenterY - 15); inputElement.size(adjustedCanvasW); }

    // Button positioning for right-aligned group
    let buttonSpacing = 8; let buttonHeight = 30; let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2; let rightMargin = 15;
     const btnWidth = (btn) => btn ? btn.size().width : 0;
    let savePNGBtnW = btnWidth(savePNGButton);
    let saveHighResPNGBtnW = btnWidth(saveHighResPNGButton); // Include high-res button
    let savePDFBtnW = btnWidth(savePDFButton);
    let clearBtnW = btnWidth(clearButton);
    let refreshBtnW = btnWidth(refreshButton);

    let totalButtonWidth = savePNGBtnW + saveHighResPNGBtnW + savePDFBtnW + clearBtnW + refreshBtnW;
    let numButtons = (savePNGButton?1:0) + (saveHighResPNGButton?1:0) + (savePDFButton?1:0) + (clearButton?1:0) + (refreshButton?1:0);
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);

     let minButtonStartX = (inputElement ? inputElement.position().x + inputElement.size().width + 20 : 20);
     let buttonBlockStartX = max(width - rightMargin - (totalButtonWidth + totalSpacing), minButtonStartX);

    let currentButtonX = buttonBlockStartX;

    // Position buttons: REFRESH, CLEAR, SAVE PNG, SAVE HI-RES PNG, SAVE PDF
    if (refreshButton) { refreshButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += refreshBtnW + buttonSpacing; }
    if (clearButton) { clearButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += clearBtnW + buttonSpacing; }
    if (savePNGButton) { savePNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += savePNGBtnW + buttonSpacing; }
    if (saveHighResPNGButton) { saveHighResPNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += saveHighResPNGBtnW + buttonSpacing; }
    if (savePDFButton) { savePDFButton.position(currentButtonX, buttonPadY_buttons); /* Last button */ }


     // --- Resize or Recreate canvasPG buffer ---
     // Dimensions must match new CANVAS_AREA_W/H
    if (canvasPG) {
        // Use round() for canvas dimensions
        if (canvasPG.width !== round(adjustedCanvasW) || canvasPG.height !== round(CANVAS_AREA_H)) {
             console.log("Resizing canvasPG buffer to:", round(adjustedCanvasW), round(CANVAS_AREA_H));
             canvasPG.resizeCanvas(round(adjustedCanvasW), round(CANVAS_AREA_H));
             canvasPG.background(255);
             isCanvasDirty = true; // Needs redraw after resize
         }
     } else if (adjustedCanvasW > 0 && CANVAS_AREA_H > 0) {
          console.log("Creating canvasPG buffer in windowResized.");
          canvasPG = createGraphics(round(adjustedCanvasW), round(CANVAS_AREA_H));
           canvasPG.background(255);
           isCanvasDirty = true; // Needs redraw after creation
     } else {
         console.warn("Invalid CANVAS_AREA dimensions after resize, canvasPG may be unusable.");
         if(canvasPG) { canvasPG.remove(); canvasPG = null; }
     }

     console.log("Finished windowResized.");
}