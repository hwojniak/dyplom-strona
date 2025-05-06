// Interactive canvas website-tool project using p5.js

let shapes = []; // Shapes currently floating or grabbed
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged

// UI Element References (DOM elements need global vars if you create them this way)
let inputElement;
let savePNGButton; // Renamed saveButton for clarity (PNG specific)
let savePDFButton; // New button for PDF save
let refreshButton;
let clearButton;

// Layout constants
const HEADER_HEIGHT = 80;
const CANVAS_AREA_W = 500; // Fixed width of the artboard
let CANVAS_AREA_H; // Calculated in setup based on ratio
let CANVAS_AREA_X; // Calculated in setup based on window width
let CANVAS_AREA_Y; // Calculated in setup

// Appearance constants
const PALETTE = [
  '#0000FE', // Blue triangle
  '#FFDD00', // Yellow pentagon
  '#E70012', // Red hexagon
  '#FE4DD3', // Pink square
  '#41AD4A', // Green shape
  '#000000', // Black
  '#222222', // Dark Grey
  '#FFFFFF',  // White - more likely for text color?
  '#FFA500', // Orange
];

const TEXT_OPTIONS = [
  "TYPE SOMETHING...", // Placeholder/default
  "I LOVE MOM",
  "MUZYKA MNIE DOTYKA",
  "SOMETHING something 123",
  "Hi, I'm...",
  "TOOL",
  "ART PIECE",
  "WORK WORK WORK"
];

let baseFont = 'monospace';

let SNAP_INCREMENT_RADIANS;

// Define size categories for shapes
const sizeCategories = [
  { name: 'small', sizeRange: [50, 80], scaleRange: [0.8, 1.2], textScaleAdjust: 0.15 },
  { name: 'medium', sizeRange: [80, 150], scaleRange: [1.0, 1.8], textScaleAdjust: 0.2 },
  { name: 'large', sizeRange: [150, 250], scaleRange: [1.2, 2.5], textScaleAdjust: 0.25 }
];

// Small tolerance for click detection near shape edges in screen pixels
const CLICK_TOLERANCE = 5; // Pixels


// --- Utility functions for precise mouse collision and text bounds ---

// Transforms global coordinates to an object's local, unscaled, unrotated coordinates.
function transformPointToLocal(gx, gy, objX, objY, objRotation, objScale) {
  let tx = gx - objX;
  let ty = gy - objY;
  let cosAngle = cos(-objRotation); // Inverse rotation
  let sinAngle = sin(-objRotation);
  let rx = tx * cosAngle - ty * sinAngle;
  let ry = tx * sinAngle + ty * cosAngle;
  let localX = (objScale === 0) ? 0 : rx / objScale;
  let localY = (objScale === 0) ? 0 : ry / objScale;
  return { x: localX, y: localY };
}

// Checks if a point (px, py) is inside/near an axis-aligned rectangle (centered at 0,0) with tolerance.
function isPointInAxisAlignedRect(px, py, w, h, tolerance = 0) {
    let halfW = w / 2;
    let halfH = h / 2;
    return px >= -halfW - tolerance && px <= halfW + tolerance && py >= -halfH - tolerance && py <= halfH + tolerance;
}

// Calculates the shortest distance from a point (px, py) to a line segment from (x1, y1) to (x2, y2).
function distToSegment(px, py, x1, y1, x2, y2) {
  let l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 == 0) return dist(px, py, x1, y1);

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = max(0, min(1, t));

  let closestX = x1 + t * (x2 - x1);
  let closestY = y1 + t * (y2 - y1);

  return dist(px, py, closestX, closestY);
}

// Gets local vertices for unrotated polygon shapes centered at (0,0).
function getTriangleVertices(size) { // size acts as base ref, triangle drawn differently
    let heightBased = size * 0.8;
    let baseWidthBased = size * 0.8;
    let baseY = size * 0.4;
    return [{ x: 0, y: -heightBased }, { x: -baseWidthBased, y: baseY }, { x: baseWidthBased, y: baseY }];
}

function getSquareVertices(size) { // size acts as side length
    let halfSize = size / 2;
    return [{ x: -halfSize, y: -halfSize }, { x: halfSize, y: -halfSize }, { x: halfSize, y: halfSize }, { x: -halfSize, y: halfSize }];
}

function getPentagonVertices(size) { // size acts as radius ref * 0.7
    let sides = 5;
    let radius = size * 0.7;
    let vertices = [];
    for (let i = 0; i < sides; i++) { let angle = TWO_PI / sides * i; let sx = cos(angle - HALF_PI) * radius; let sy = sin(angle - HALF_PI) * radius; vertices.push({ x: sx, y: sy }); }
    return vertices;
}

function getHexagonVertices(size) { // size acts as radius
     let sides = 6;
     let radius = size;
    let vertices = [];
     for (let i = 0; i < sides; i++) { let angle = TWO_PI / sides * i; let sx = cos(angle) * radius; let sy = sin(angle) * radius; vertices.push({ x: sx, y: sy }); }
    return vertices;
}

// Checks if a point is strictly inside a convex polygon (local coords).
function isPointInConvexPolygon(px, py, vertices) {
  let numVertices = vertices.length;
  if (numVertices < 3) return false;
  let has_pos = false, has_neg = false;
  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i], v2 = vertices[(i + 1) % numVertices];
    let cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);
    if (cross_product > 0.000001) has_pos = true;
    if (cross_product < -0.000001) has_neg = true;
    if (has_pos && has_neg) return false;
  }
  return true;
}

// Checks if a point is near any edge of a polygon within a tolerance (local coords).
function isPointNearPolygonEdge(px, py, vertices, tolerance) {
    if (vertices.length < 2) return false;
     for (let i = 0; i < vertices.length; i++) {
         let v1 = vertices[i], v2 = vertices[(i + 1) % vertices.length];
         if (distToSegment(px, py, v1.x, v1.y, v2.x, v2.y) <= tolerance) { return true; }
     }
    return false;
}

// FIX: Calculates text bounding box using a temporary graphics buffer internally.
function getTextBounds(content, effectiveTextSize, baseFontRef) {
    // Create temporary graphics buffer
    let tempPG = createGraphics(1, 1); // Minimal size

    // Apply font properties to the temp buffer context
    tempPG.textSize(effectiveTextSize);
    if (baseFontRef) tempPG.textFont(baseFontRef); // Check needed if baseFont is loaded p5.Font object

    // Measure text dimensions using temp buffer
    let textW = tempPG.textWidth(content);
    let textH = tempPG.textAscent() + tempPG.textDescent(); // Full height from ascent/descent

    tempPG.remove(); // Clean up the temporary buffer

    // Return measured dimensions (width, height)
    return { w: textW, h: textH };
}


// --- FloatingShape Class ---
class FloatingShape {
  constructor() {
    this.reset();
    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;
  }

  reset() {
    let edge = floor(random(4));
    let posAlong = random(-0.5, 1.5);
    let categoryIndex = floor(random(sizeCategories.length));
    let category = sizeCategories[categoryIndex];
    this.size = random(category.sizeRange[0], category.sizeRange[1]);
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]);
    this.currentSize = this.size * this.scaleFactor;

    let minSpeed = 1.5, maxSpeed = 4;
     let offScreenOffset = max(this.currentSize * 1.5, 200); // Ensure a decent offset

    switch (edge) {
      case 0: this.x = width * posAlong; this.y = -offScreenOffset; this.speedX = random(-2, 2); this.speedY = random(minSpeed, maxSpeed); break;
      case 1: this.x = width + offScreenOffset; this.y = height * posAlong; this.speedX = random(-maxSpeed, -minSpeed); this.speedY = random(-2, 2); break;
      case 2: this.x = width * posAlong; this.y = height + offScreenOffset; this.speedX = random(-2, 2); this.speedY = random(-maxSpeed, -minSpeed); break;
      case 3: this.x = -offScreenOffset; this.y = height * posAlong; this.speedX = random(minSpeed, maxSpeed); this.speedY = random(-2, 2); break;
    }

    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.005, 0.005) * random(1, 4);

    let pickedColor;
    do { pickedColor = color(random(PALETTE)); } while (brightness(pickedColor) < 50 && PALETTE.length > 1); // Added check if palette has options
    this.color = pickedColor;

    this.type = random() < 0.8 ? 'shape' : 'text';

    if (this.type === 'shape') {
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']);
        this.content = null;
        this.textScaleAdjust = 0;
    } else {
         this.shapeType = 'none';
          // Pick initial text, retry if it's empty or placeholder-like
         let initialContent = random(TEXT_OPTIONS.slice(1));
         while(!initialContent || initialContent.trim() === "" || initialContent.trim() === TEXT_OPTIONS[0].trim()){
            initialContent = random(TEXT_OPTIONS.slice(1));
         }
         this.content = initialContent.trim(); // Use trimmed content
         this.textScaleAdjust = category.textScaleAdjust;
    }

    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;
  }

  update() {
     if (!this.isGrabbed && !this.isPlacing) {
       this.x += this.speedX;
       this.y += this.speedY;
       this.rotation += this.rotationSpeed;
     }
     this.currentSize = this.size * this.scaleFactor;
  }

   isReallyOffScreen() {
       let maxEffectiveDimension = 0;
       // Estimate maximum dimension including scale for accurate off-screen check bounds
        if (this.type === 'text' && this.content) {
             let effectiveTextSize = this.size * this.textScaleAdjust;
              // FIX: Call getTextBounds correctly - relies on getTextBounds using internal buffer
             let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont);
             maxEffectiveDimension = max(textBounds.w, textBounds.h) * this.scaleFactor;
        } else if (this.type === 'shape') {
             switch(this.shapeType) { // Longest dimension rough estimate for various shapes based on how size is used in drawing
                  case 'circle': maxEffectiveDimension = this.size * 2; break; // Diameter = 2 * radius
                  case 'square': maxEffectiveDimension = this.size * Math.SQRT2; break; // Diagonal
                  case 'triangle': maxEffectiveDimension = this.size * 1.6; break; // Longest dim (apex to base corner) approx
                  case 'pentagon': maxEffectiveDimension = this.size * 0.7 * 2; break; // Diameter based on radius calc
                  case 'hexagon': maxEffectiveDimension = this.size * 2; break; // Diameter (vertex-to-vertex)
                  default: maxEffectiveDimension = this.size * 2; // Default rough max size
             }
            maxEffectiveDimension *= this.scaleFactor; // Apply current scale
        } else { maxEffectiveDimension = (this.size || 50) * (this.scaleFactor || 1); } // Basic fallback

      let effectiveRadius = maxEffectiveDimension / 2;
      let safePadding = max(width, height) * 0.4; // Increased padding
      let checkDistance = effectiveRadius + safePadding;

      return this.x < -checkDistance || this.x > width + checkDistance ||
             this.y < -checkDistance || this.y > height + checkDistance;
  }


  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame;
        let duration = 30;
        if (elapsed <= duration) {
            let t = map(elapsed, 0, duration, 0, 1);
            let pulseScale = 1 + sin(t * PI) * 0.05;
            this.tempScaleEffect = pulseScale;
        } else {
            this.isPlacing = false;
            this.tempScaleEffect = 1;
        }
    } else if (!this.isPlacing) {
         this.tempScaleEffect = 1;
    }
  }

   // General display function used for drawing on main canvas or other contexts (PG, PDF)
   // graphics: The p5 graphics object target.
   // isGrabbed: Apply grabbed effect? (Only on main canvas).
   // offsetX, offsetY: Optional offset to translate the shape by before drawing (used for PG/PDF).
  display(graphics, isGrabbed = false, offsetX = 0, offsetY = 0) {
    graphics.push();
    // Translate to position relative to the graphics context's origin
    graphics.translate(this.x - offsetX, this.y - offsetY);
    graphics.rotate(this.rotation);
     // Apply landing scale if active and NOT grabbed
    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale);

     if (isGrabbed && graphics === this) { // Only draw grabbed effect on main canvas ('this')
         graphics.drawingContext.shadowBlur = 40;
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
         graphics.stroke(255, 255, 255, 200);
         graphics.strokeWeight(3);
         graphics.noFill();
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
         graphics.drawingContext.shadowBlur = 0;
         graphics.noStroke();
     }

    graphics.fill(this.color);
    graphics.noStroke();
    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
    graphics.pop();
  }

  // Draws the raw geometry/text centered at (px, py), base size psize.
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        if (isText) {
             // Prevent drawing empty or placeholder text
             if (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) return;

             graphics.textFont(baseFont);
             graphics.textAlign(CENTER, CENTER);
             let effectiveTextSize = psize * textScaleAdjust;
             graphics.textSize(effectiveTextSize);
             graphics.text(this.content, px, py);
         } else {
              graphics.rectMode(CENTER);
             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break;
               case 'square': graphics.rect(px, py, psize, psize); break;
               case 'triangle':
                 graphics.beginShape();
                 graphics.vertex(px, py - psize * 0.8); graphics.vertex(px - psize * 0.8, py + psize * 0.4); graphics.vertex(px + psize * 0.8, py + psize * 0.4);
                 graphics.endShape(CLOSE); break;
               case 'pentagon':
                  graphics.beginShape(); let sidesP = 5; let radiusP = psize * 0.7; for (let i = 0; i < sidesP; i++) { let angle = TWO_PI / sidesP * i; let sx = cos(angle - HALF_PI) * radiusP; let sy = sin(angle - HALF_PI) * radiusP; graphics.vertex(px + sx, py + sy); }
                  graphics.endShape(CLOSE); break;
               case 'hexagon':
                 graphics.beginShape(); let sidesH = 6; let radiusH = psize; for (let i = 0; i < sidesH; i++) { let angle = TWO_PI / sidesH * i; let sx = cos(angle) * radiusH; let sy = sin(angle) * radiusH; graphics.vertex(px + sx, py + sy); }
                 graphics.endShape(CLOSE); break;
               default: console.warn("Drawing unknown shape type:", pshapeType); /* graphics.rect(px, py, psize * 0.8, psize * 0.8); */ break;
             }
         }
   }

    // FIX: isMouseOver does NOT need a graphics parameter anymore due to fixed getTextBounds.
  isMouseOver(mx, my) {
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) || isNaN(this.scaleFactor) || isNaN(this.size)) {
            console.error("NaN detected in isMouseOver:", this, " Mouse:", mx, my);
            return false;
       }
        if (this.scaleFactor <= 0 || this.size <= 0) return false; // Cannot click zero/neg size

       let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, this.scaleFactor);
       let localMx = localMouse.x, localMy = localMouse.y;

        let localTolerance = CLICK_TOLERANCE / this.scaleFactor;
         localTolerance = max(localTolerance, 2); // Minimum local tolerance

       if (this.type === 'text') {
           // Text content must be present and not placeholder for clicking
           if (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) return false;
           let effectiveTextSize = this.size * this.textScaleAdjust;
            // FIX: Call getTextBounds without the graphics parameter
           let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont);
           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);

       } else { // type is 'shape'
           switch (this.shapeType) {
              case 'circle': return dist(localMx, localMy, 0, 0) <= this.size + localTolerance;
              case 'square': return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);
              case 'triangle':
                  let triVertices = getTriangleVertices(this.size);
                  if (isPointInConvexPolygon(localMx, localMy, triVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, triVertices, localTolerance);
              case 'pentagon':
                  let pentVertices = getPentagonVertices(this.size);
                  if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance);
              case 'hexagon':
                   let hexVertices = getHexagonVertices(this.size);
                  if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance);
              default:
                   console.warn("isMouseOver: Fallback check for unknown shape type:", this.shapeType);
                   return dist(localMx, localMy, 0, 0) <= (this.size * 0.5) + localTolerance;
           }
       }
    }

  solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}


function preload() {
  // Custom font loading example (commented out)
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  SNAP_INCREMENT_RADIANS = radians(15);

  CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4);
  CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
  CANVAS_AREA_Y = HEADER_HEIGHT + 20;
  if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0;

  let headerCenterY = HEADER_HEIGHT / 2;

  // Input element setup
  inputElement = createInput();
  inputElement.value('');
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
  inputElement.size(CANVAS_AREA_W);
  inputElement.style("padding", "5px 10px").style("border", "1px solid #ccc").style("border-radius", "15px").style("outline", "none").style("background-color", color(255, 255, 255, 200)).style("font-size", "14px").style("color", color(50));

  // Event listener for Enter key on input
  inputElement.elt.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      addNewTextShapeFromInput();
      event.preventDefault();
    }
  });


  // --- Button setup (positioned in windowResized) ---
  let buttonHeight = 30;
  let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2;

  // SAVE PNG Button (renamed from saveButton)
  savePNGButton = createButton("SAVE PNG"); // Renamed button text
  savePNGButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
  savePNGButton.mousePressed(saveCanvasAreaAsPNG); // Bind to PNG save function

  // SAVE PDF Button (NEW)
   savePDFButton = createButton("SAVE PDF"); // Create the new button
   savePDFButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   savePDFButton.mousePressed(saveCanvasAreaAsPDF); // Bind to PDF save function

  // CLEAR Button
  clearButton = createButton("CLEAR");
   clearButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   clearButton.mousePressed(restartAll);

  // REFRESH Button
  refreshButton = createButton("REFRESH");
   refreshButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   refreshButton.mousePressed(resetRandom);


   // Initial positioning of DOM elements after creation/styling
   windowResized();

  // Create initial floating shapes
  for (let i = 0; i < 30; i++) { shapes.push(new FloatingShape()); }

   // Create canvas graphics buffer
  canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
   canvasPG.background(255); // Initial white background
}

let canvasPG; // Global reference

function draw() {
  background(0);

  // Update and draw floating shapes
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing);
  while (shapes.length < 20) { shapes.push(new FloatingShape()); }
  for (let shape of shapes) {
     if (!shape.isGrabbed && !shape.isPlacing) { shape.update(); }
     shape.updateLanding();
     // Draw floating shapes on the main canvas (offsetX/Y = 0)
     shape.display(this, shape.isGrabbed, 0, 0);
  }

  // --- Central White Canvas Area ---
  canvasPG.clear();
  canvasPG.background(255);

  // Draw placed items onto canvasPG (drawing forwards for correct z-order)
  for (let i = 0; i < placedItems.length; i++) {
      let item = placedItems[i];
       item.updateLanding();
       // Use display with canvasPG context and canvas area offset
      item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
  }

  // Draw canvasPG buffer onto main canvas
  image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);

  // Draw border around canvas area on main canvas
  stroke(200); noFill(); rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);


  // Draw grabbed item on top of everything else (only on main canvas)
  if (grabbedItem) {
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.3);
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.3);
     if (grabbedItem.isPlacing) grabbedItem.isPlacing = false;
     grabbedItem.solidify();
     grabbedItem.display(this, true, 0, 0); // Draw on main canvas with grab effect
  }

  // --- DRAW HEADER / UI OVERLAY ---
  fill(220); noStroke(); rect(0, 0, width, HEADER_HEIGHT);
  fill(50); textSize(20); textAlign(LEFT, CENTER); textFont(baseFont);
  text("PLACEHOLDER\nLOGO", 20, HEADER_HEIGHT / 2);

  // Removed: PL label and circles
}

function mousePressed() {
  if (mouseY < HEADER_HEIGHT) return;

  // Grab PLACED items first (backwards loop)
   for (let i = placedItems.length - 1; i >= 0; i--) {
       // FIX: Use isMouseOver without graphics parameter
       if (placedItems[i].isMouseOver(mouseX, mouseY)) {
           grabbedItem = placedItems[i]; grabbedItem.isGrabbed = true; grabbedItem.isPlacing = false; grabbedItem.solidify();
           let temp = placedItems.splice(i, 1)[0]; shapes.push(temp);
           if (grabbedItem.type === 'text') { inputElement.value(grabbedItem.content); inputElement.attribute('placeholder', ''); } else { inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); }
           inputElement.elt.focus(); return;
       }
   }

  // Grab FLOATING shapes (backwards loop)
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (!shapes[i].isGrabbed) {
       // FIX: Use isMouseOver without graphics parameter
      if (shapes[i].isMouseOver(mouseX, mouseY)) {
        grabbedItem = shapes[i]; grabbedItem.isGrabbed = true; grabbedItem.isPlacing = false; grabbedItem.solidify();
        let temp = shapes.splice(i, 1)[0]; shapes.push(temp);
        if (grabbedItem.type === 'text') { inputElement.value(grabbedItem.content); inputElement.attribute('placeholder', ''); } else { inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); }
        inputElement.elt.focus(); break;
      }
    }
  }
}

function mouseReleased() {
  if (grabbedItem) {
    grabbedItem.isGrabbed = false;

    if (isMouseOverCanvasArea()) { // Dropped over canvas
      grabbedItem.solidify();
      if (grabbedItem.type === 'text') {
           let content = inputElement.value().trim();
           grabbedItem.content = content === "" || content === TEXT_OPTIONS[0].trim() ? "" : content;
           if(grabbedItem.content === "") { // Discard empty text on placing
               shapes = shapes.filter(s => s !== grabbedItem);
               grabbedItem = null; inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); return;
           }
      }
      if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      }
      shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes
      placedItems.push(grabbedItem); // Add to placedItems
      grabbedItem.isPlacing = true; grabbedItem.landFrame = frameCount;
    } else { // Dropped outside canvas - reverts to floating
         if (grabbedItem.type === 'text') {
             let content = inputElement.value().trim();
             grabbedItem.content = content === "" || content === TEXT_OPTIONS[0].trim() ? "" : content;
         }
          grabbedItem.speedX = random(-2, 2); grabbedItem.speedY = random(-2, 2); grabbedItem.rotationSpeed = random(-0.005, 0.005) * random(1, 4);
          grabbedItem.isPlacing = false;
          // Item remains in shapes array.
    }

    grabbedItem = null; inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
  }
}

function mouseWheel(event) {
   if (grabbedItem) { grabbedItem.rotation += event.delta * 0.002; return false; }
    return true;
}

function keyPressed() {
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        shapes = shapes.filter(s => s !== grabbedItem); placedItems = placedItems.filter(s => s !== grabbedItem);
        grabbedItem = null; inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); return false;
    }
    if (grabbedItem) {
      if (key === '+' || key === '=') { grabbedItem.scaleFactor *= 1.1; grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, 10.0); }
      if (key === '-') { grabbedItem.scaleFactor *= 0.9; grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, 0.1); }
      grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor;
      return false;
    }
    return true;
}

function addNewTextShapeFromInput() {
   let currentText = inputElement.value();
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
         console.log("Input empty/placeholder, not adding text.");
         inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); inputElement.elt.focus(); return;
    }
    let newTextShape = new FloatingShape();
    newTextShape.type = 'text'; newTextShape.content = currentText.trim(); newTextShape.shapeType = 'none';

    let mediumCategory = sizeCategories.find(cat => cat.name === 'medium');
     if (mediumCategory) {
         newTextShape.size = random(mediumCategory.sizeRange[0] * 0.8, mediumCategory.sizeRange[1] * 1.2); newTextShape.scaleFactor = 1.0; newTextShape.textScaleAdjust = mediumCategory.textScaleAdjust; newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     } else { newTextShape.size = 150; newTextShape.scaleFactor = 1.0; newTextShape.textScaleAdjust = 0.2; newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;}

     // Spawn location below header, somewhat centered horizontally
     newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W * 0.25, CANVAS_AREA_X + CANVAS_AREA_W * 0.75); newTextShape.y = HEADER_HEIGHT + 40;
     newTextShape.speedX = random(-0.5, 0.5); newTextShape.speedY = random(1, 2);
     newTextShape.rotation = random(-0.1, 0.1); newTextShape.rotationSpeed = random(-0.001, 0.001);

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

// Helper to generate timestamp string for filenames
function generateTimestampString() {
    let d = new Date();
    return year() + nf(month(), 2) + nf(day(), 2) + '_' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
}


// SAVE PNG function (renamed from saveCanvasArea)
function saveCanvasAreaAsPNG() {
    console.log("SAVE PNG button pressed");
    if (canvasPG) {
        // Optional border on the saved image
        canvasPG.push(); canvasPG.stroke(0); canvasPG.strokeWeight(1); canvasPG.noFill(); canvasPG.rect(0, 0, canvasPG.width - 1, canvasPG.height - 1); canvasPG.pop();
        save(canvasPG, 'myArtboard_png_' + generateTimestampString() + '.png');
    } else { console.warn("Cannot save PNG: canvasPG not created."); }
}

// NEW SAVE PDF function
function saveCanvasAreaAsPDF() {
    console.log("SAVE PDF button pressed");

     // Check if beginPDF is available (library must be loaded in HTML)
     if (typeof beginPDF !== 'function') {
         console.error("p5.js-pdf library not loaded. Cannot save as PDF.");
         alert("Error: p5.js-pdf library not loaded. Add <script src=\"https://cdn.jsdelivr.net/gh/freshfork/p5.js-pdf/libraries/p5.func.pdf.js\"></script> to your index.html after p5.js");
         return;
     }

     // Begin creating the PDF document, size matches canvas area
     beginPDF(CANVAS_AREA_W, CANVAS_AREA_H, 'myArtboard_pdf_' + generateTimestampString() + '.pdf');

    // Draw background and items onto the PDF context (which is 'this' inside this function block)
    background(255); // Draw white background
    noStroke(); noFill(); // Reset styles

     // Draw placed items onto the PDF context
     // Iterate forwards for correct z-order (last placed on top)
    for (let i = 0; i < placedItems.length; i++) {
        let item = placedItems[i];
         // Use the display method, targeting 'this' (the PDF context), no grab effect, with canvas area offsets
        item.display(this, false, CANVAS_AREA_X, CANVAS_AREA_Y);
    }

    // Optional border in the PDF
    stroke(0); strokeWeight(1); noFill(); rect(0, 0, CANVAS_AREA_W - 1, CANVAS_AREA_H - 1);

     // Finalize and end PDF creation
     endPDF();
     console.log("PDF save initiated.");
}


// REFRESH button action
function resetRandom() {
    console.log("REFRESH button pressed");
    let tempGrabbedFloatingItem = null;
    if (grabbedItem && shapes.includes(grabbedItem)) { tempGrabbedFloatingItem = grabbedItem; shapes = shapes.filter(s => s !== grabbedItem); }
    shapes = []; // Clear other floating shapes
    for (let i = 0; i < 30; i++) { shapes.push(new FloatingShape()); } // Add new shapes
    if (tempGrabbedFloatingItem) { shapes.push(tempGrabbedFloatingItem); } // Add grabbed item back
}

// CLEAR button action
function restartAll() {
    console.log("CLEAR button pressed");
    placedItems = []; shapes = []; grabbedItem = null;
    inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    for (let i = 0; i < 30; i++) { shapes.push(new FloatingShape()); }
     if (canvasPG) { canvasPG.clear(); canvasPG.background(255); }
}

// WINDOW RESIZED FUNCTION
function windowResized() {
    console.log("Window resized to:", windowWidth, windowHeight);
    resizeCanvas(windowWidth, windowHeight);

    CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4);
    CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
    CANVAS_AREA_Y = HEADER_HEIGHT + 20;
    if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0;

    let headerCenterY = HEADER_HEIGHT / 2;

    // Input Element Positioning & Sizing
    if (inputElement) {
        inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
        inputElement.size(CANVAS_AREA_W);
    }

    // Button positioning for the right-aligned group (Refresh, Clear, Save PNG, Save PDF)
    let buttonSpacing = 10;
    let buttonHeight = 30;
    let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2;
    let rightMargin = 20;

     // Calculate total width of all 4 buttons + spacing
    let totalButtonWidth = 0;
     let savePNGBtnW = savePNGButton ? savePNGButton.size().width : 0;
     let savePDFBtnW = savePDFButton ? savePDFButton.size().width : 0;
     let clearBtnW = clearButton ? clearButton.size().width : 0;
     let refreshBtnW = refreshButton ? refreshButton.size().width : 0;

    if (savePNGButton) totalButtonWidth += savePNGBtnW;
    if (savePDFButton) totalButtonWidth += savePDFBtnW;
    if (clearButton) totalButtonWidth += clearBtnW;
    if (refreshButton) totalButtonWidth += refreshBtnW;

    let numButtons = (savePNGButton ? 1 : 0) + (savePDFButton ? 1 : 0) + (clearButton ? 1 : 0) + (refreshButton ? 1 : 0);
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);

     let buttonBlockStartX = width - rightMargin - (totalButtonWidth + totalSpacing);

    let currentButtonX = buttonBlockStartX;

    // Position REFRESH (leftmost in the group)
    if (refreshButton) { refreshButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += refreshBtnW + buttonSpacing; }
    // Position CLEAR
    if (clearButton) { clearButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += clearBtnW + buttonSpacing; }
    // Position SAVE PNG
    if (savePNGButton) { savePNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += savePNGBtnW + buttonSpacing; }
    // Position SAVE PDF (rightmost)
    if (savePDFButton) { savePDFButton.position(currentButtonX, buttonPadY_buttons); /* last button */ }


     // Resize canvasPG if necessary or create if null
    if (canvasPG) {
        if (canvasPG.width !== CANVAS_AREA_W || canvasPG.height !== CANVAS_AREA_H) {
             console.log("Resizing canvasPG buffer.");
             canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H);
         }
     } else if (!canvasPG && CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
          console.log("Creating canvasPG buffer in windowResized.");
          canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
           canvasPG.background(255);
     } else if (canvasPG && (CANVAS_AREA_W <= 0 || CANVAS_AREA_H <= 0)) {
         console.warn("Invalid CANVAS_AREA dimensions after resize, canvasPG may be unusable.");
     }
}