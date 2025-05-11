// Interactive canvas website-tool project using p5.js

let shapes = []; // Shapes currently floating or grabbed (Includes temporarily grabbed placed items)
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged

// UI Element References (DOM elements need global vars if you create them this way)
let inputElement;
let savePNGButton;         // Existing button for standard PNG save
let saveHighResPNGButton;  // NEW button for high-resolution PNG save
let savePDFButton;
let refreshButton;
let clearButton;

// Layout constants
const HEADER_HEIGHT = 80;
const CANVAS_AREA_W_BASE = 500; // Fixed width base for ratio (Source for high-res scaling)
let CANVAS_AREA_W; // Actual width calculated in setup/resize
let CANVAS_AREA_H; // Calculated in setup based on ratio
let CANVAS_AREA_X; // Calculated in setup based on window width
let CANVAS_AREA_Y; // Calculated in setup

// Appearance constants
const PALETTE = [
  '#0000FE', // Blue
  '#FFDD00', // Yellow
  '#E70012', // Red
  '#FE4DD3', // Pink
  '#41AD4A', // Green
  '#000000', // Black
  '#222222', // Grey
  '#FFFFFF', // White
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

let baseFont = 'monospace'; // Default fallback font (CSS string)

// --- START: Variables for ALL Loaded Fonts ---
let fontBangersRegular;
let fontBoogalooRegular;
let fontBreeSerifRegular;
let fontCaveatBrushRegular;
let fontCherryBombOneRegular;
let fontCinzelDecorativeBlack;
let fontCinzelDecorativeBold;
let fontCinzelDecorativeRegular;
let fontDynaPuffBold;
let fontDynaPuffMedium;
let fontDynaPuffRegular;
let fontInterBold;
let fontInterRegular;
let fontPixelifySansRegular;
let fontSenBold;
let fontSenMedium;
let fontSenRegular;
let fontShareTechMonoRegular;
let fontVT323Regular;

// Array of potential font variables for random selection
const potentialFontVariables = [
    'fontBangersRegular',
    'fontBoogalooRegular',
    'fontBreeSerifRegular',
    'fontCaveatBrushRegular',
    'fontCherryBombOneRegular',
    'fontCinzelDecorativeBlack',
    'fontCinzelDecorativeBold',
    'fontCinzelDecorativeRegular',
    'fontDynaPuffBold',
    'fontDynaPuffMedium',
    'fontDynaPuffRegular',
    'fontInterBold',
    'fontInterRegular',
    'fontPixelifySansRegular',
    'fontSenBold',
    'fontSenMedium',
    'fontSenRegular',
    'fontShareTechMonoRegular',
    'fontVT323Regular'
];
let usableFonts = []; // Array to hold successfully loaded font objects
// --- END: Variables for ALL Loaded Fonts ---

let logoImage;        // Variable to hold the loaded SVG logo


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
  // Add check for zero scale to prevent division by zero or infinity
  if (objScale === 0) {
      return { x: NaN, y: NaN }; // Indicate invalid transformation
  }
  let tx = gx - objX;
  let ty = gy - objY;
  let cosAngle = cos(-objRotation); // Inverse rotation
  let sinAngle = sin(-objRotation);
  let rx = tx * cosAngle - ty * sinAngle;
  let ry = tx * sinAngle + ty * cosAngle;
  let localX = rx / objScale;
  let localY = ry / objScale;
  return { x: localX, y: localY };
}

// Checks if a point (px, py) is inside/near an axis-aligned rectangle (centered at 0,0) with tolerance.
function isPointInAxisAlignedRect(px, py, w, h, tolerance = 0) {
     if (isNaN(px) || isNaN(py) || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
         return false;
    }
    let halfW = w / 2;
    let halfH = h / 2;
    return px >= -halfW - tolerance && px <= halfW + tolerance && py >= -halfH - tolerance && py <= halfH + tolerance;
}

// Calculates the shortest distance from a point (px, py) to a line segment from (x1, y1) to (x2, y2).
// Used for checking proximity to polygon edges in local coordinates.
function distToSegment(px, py, x1, y1, x2, y2) {
    if (isNaN(px) || isNaN(py) || isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
         return Infinity; // Indicate unable to calculate distance
    }
  let l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return dist(px, py, x1, y1);

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = max(0, min(1, t));

  let closestX = x1 + t * (x2 - x1);
  let closestY = y1 + t * (y2 - y1);

  return dist(px, py, closestX, closestY);
}

// Gets local vertices for unrotated polygon shapes centered at (0,0).
function getTriangleVertices(size) {
     if (isNaN(size) || size <= 0) return [];
    let h = size * 0.8;
    return [{ x: 0, y: -size * 0.8 }, { x: -size * 0.8, y: size * 0.4 }, { x: size * 0.8, y: size * 0.4 }];
}

function getSquareVertices(size) {
     if (isNaN(size) || size <= 0) return [];
    let halfSize = size / 2;
    return [{ x: -halfSize, y: -halfSize }, { x: halfSize, y: -halfSize }, { x: halfSize, y: halfSize }, { x: -halfSize, y: halfSize }];
}

function getPentagonVertices(size) {
     if (isNaN(size) || size <= 0) return [];
    let sides = 5;
    let radius = size * 0.7;
    let vertices = [];
    for (let i = 0; i < sides; i++) {
        let angle = TWO_PI / sides * i;
        let sx = cos(angle - HALF_PI) * radius;
        let sy = sin(angle - HALF_PI) * radius;
        vertices.push({ x: sx, y: sy });
    }
    return vertices;
}

function getHexagonVertices(size) {
     if (isNaN(size) || size <= 0) return [];
     let sides = 6;
     let radius = size;
     let vertices = [];
     for (let i = 0; i < sides; i++) {
         let angle = TWO_PI / sides * i;
         let sx = cos(angle) * radius;
         let sy = sin(angle) * radius;
         vertices.push({ x: sx, y: sy });
     }
     return vertices;
}


// Checks if a point is strictly inside a convex polygon (local coords).
function isPointInConvexPolygon(px, py, vertices) {
    if (isNaN(px) || isNaN(py) || !Array.isArray(vertices) || vertices.length < 3) return false;
  let numVertices = vertices.length;
  let has_pos = false, has_neg = false;

  let cross_product;

  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i], v2 = vertices[(i + 1) % numVertices];
     if (isNaN(v1.x) || isNaN(v1.y) || isNaN(v2.x) || isNaN(v2.y)) {
         return false;
     }
    cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);

    if (cross_product > 1e-6) has_pos = true;
    if (cross_product < -1e-6) has_neg = true;

    if (has_pos && has_neg) return false;
  }

   return true;
}


// Checks if a point is near any edge of a polygon within a tolerance (local coords).
function isPointNearPolygonEdge(px, py, vertices, tolerance) {
     if (isNaN(px) || isNaN(py) || !Array.isArray(vertices) || vertices.length < 2 || isNaN(tolerance) || tolerance < 0) {
          return false;
     }
     for (let i = 0; i < vertices.length; i++) {
         let v1 = vertices[i], v2 = vertices[(i + 1) % vertices.length];
         if (isNaN(v1.x) || isNaN(v1.y) || isNaN(v2.x) || isNaN(v2.y)) continue;

         if (distToSegment(px, py, v1.x, v1.y, v2.x, v2.y) <= tolerance) { return true; }
     }
    return false;
}

// FIX: Calculates text bounding box using a *single, persistent* graphics buffer.
let textMeasurePG; // Declare the global variable here

function getTextBounds(content, effectiveTextSize, baseFontRef) {
     if (typeof content !== 'string' || isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
          return { w: 0, h: 0 }; // Return zero bounds for invalid input
     }

    // Ensure the measurement buffer exists and is configured
    if (!textMeasurePG) {
        return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
    }

    try {
        // Apply font properties to the measurement buffer context
        // Use the font reference provided, or a default if none/invalid
        if (baseFontRef && typeof textMeasurePG.textFont === 'function') {
             textMeasurePG.textFont(baseFontRef);
        } else if (typeof textMeasurePG.textFont === 'function'){
             textMeasurePG.textFont('monospace');
        } else {
              return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
        }

        if (textMeasurePG.textSize) textMeasurePG.textSize(effectiveTextSize); else return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
        if (textMeasurePG.textAlign) textMeasurePG.textAlign(CENTER, CENTER); else return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };

        // Perform measurement using the persistent buffer
        let textW = 0, textAsc = 0, textDesc = 0;

        if (textMeasurePG.textWidth) textW = textMeasurePG.textWidth(content); else return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
         if (textMeasurePG.textAscent) textAsc = textMeasurePG.textAscent(); else return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
         if (textMeasurePG.textDescent) textDesc = textMeasurePG.textDescent(); else return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };

        let textH = textAsc + textDesc; // Total height

        // Basic sanity check for calculated dimensions
         if (isNaN(textW) || isNaN(textH) || textW < 0 || textH < 0) {
              textW = effectiveTextSize * (content ? content.length : 0.5) * 0.6;
              textH = effectiveTextSize * 1.2;
         }

        return { w: textW, h: textH };

    } catch (e) {
        return { w: effectiveTextSize * (content ? content.length : 0.5) * 0.6, h: effectiveTextSize * 1.2 };
    }
}


// --- FloatingShape Class ---
class FloatingShape {
  constructor() {
    this.reset(); // Set initial properties via reset
    // isGrabbed, isPlacing, etc. are set in reset
  }

  reset() {
    // Randomly pick one of the 4 window edges for spawning off-screen
    let edge = floor(random(4));
    // Spawn point along that edge (use more of the edge length)
    let posAlong = random(0.1, 0.9);

    let categoryIndex = floor(random(sizeCategories.length));
    let category = sizeCategories[categoryIndex];
    this.size = random(category.sizeRange[0], category.sizeRange[1]);
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]);

     let roughMaxDimension = this.calculateMaxEffectiveDimension();
      let offScreenOffset = max(roughMaxDimension / 2 * this.scaleFactor, 100) + 50;

    let minSpeed = 1, maxSpeed = 2;

    switch (edge) {
      case 0: // Top
        this.x = width * posAlong;
        this.y = -offScreenOffset;
        this.speedX = random(-1, 1) * maxSpeed * 0.5;
        this.speedY = random(minSpeed, maxSpeed);
        break;
      case 1: // Right
        this.x = width + offScreenOffset;
        this.y = height * posAlong;
        this.speedX = random(-maxSpeed, -minSpeed);
        this.speedY = random(-1, 1) * maxSpeed * 0.5;
        break;
      case 2: // Bottom
        this.x = width * posAlong;
        this.y = height + offScreenOffset;
        this.speedX = random(-1, -0.5) * maxSpeed * 0.5; // Slight bias left
        this.speedY = random(-maxSpeed, -minSpeed);
        break;
      case 3: // Left
        this.x = -offScreenOffset;
        this.y = height * posAlong;
        this.speedX = random(minSpeed, maxSpeed);
        this.speedY = random(-1, 1) * maxSpeed * 0.5;
        break;
    }

    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.002, 0.002);

    let pickedColor;
    this.type = random() < 0.7 ? 'shape' : 'text';

    if (this.type === 'text') {
         let attempts = 0;
          do {
             pickedColor = color(random(PALETTE));
             attempts++;
         } while (attempts < 10 && brightness(pickedColor) > 230);

         this.shapeType = 'none';
         let initialContent = random(TEXT_OPTIONS.slice(1));
         while(!initialContent || initialContent.trim() === "" || initialContent.trim() === TEXT_OPTIONS[0].trim()){
            initialContent = random(TEXT_OPTIONS.slice(1));
         }
         this.content = initialContent.trim();
         this.textScaleAdjust = category.textScaleAdjust;

         // --- Assign a random loaded font from the usableFonts array ---
         if (usableFonts.length > 0) {
              this.font = random(usableFonts);
         } else {
              this.font = baseFont; // Fallback
         }
         // --- End font assignment ---


    } else { // type is 'shape'
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']);
        pickedColor = color(random(PALETTE));
        this.content = null;
        this.textScaleAdjust = 0;
        this.font = null;
    }

    this.color = pickedColor;


    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;
  }

   calculateMaxEffectiveDimension() {
        let dimension = this.size || 50;
        if (this.type === 'text' && this.content && this.content.trim() !== "" && this.content.trim() !== TEXT_OPTIONS[0].trim()) {
             let effectiveTextSize = (this.size || 1) * (this.textScaleAdjust || 0.2);
              let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont);
              dimension = sqrt(sq(textBounds.w) + sq(textBounds.h));

        } else if (this.type === 'shape' && this.shapeType) {
             switch(this.shapeType) {
                  case 'circle': dimension = this.size * 2; break;
                  case 'square': dimension = this.size * Math.SQRT2; break;
                  case 'triangle': dimension = this.size * 1.2; break;
                  case 'pentagon': dimension = this.size * 0.7 * 2; break;
                  case 'hexagon': dimension = this.size * 2; break;
                  default: dimension = this.size; break;
             }
             dimension = max(dimension, this.size * 1.5);
        } else {
            dimension = this.size || 100;
        }

        dimension = max(dimension, 1);

        return dimension;
  }


  update() {
     if (!this.isGrabbed && !this.isPlacing) {
         this.x += this.speedX;
         this.y += this.speedY;

         this.rotation += this.rotationSpeed;

         this.rotation = (this.rotation % TWO_PI + TWO_PI) % TWO_PI;
     }
  }

   isReallyOffScreen() {
        let maxEffectiveDimension = this.calculateMaxEffectiveDimension();
        if (isNaN(maxEffectiveDimension) || maxEffectiveDimension <= 0) {
             return false;
        }
      let effectiveRadius = maxEffectiveDimension / 2 * this.scaleFactor;
      let windowBuffer = max(width, height) * 0.5;

      return this.x < -windowBuffer - effectiveRadius || this.x > width + windowBuffer + effectiveRadius ||
             this.y < -windowBuffer - effectiveRadius || this.y > height + windowBuffer + effectiveRadius;
  }


  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame;
        let duration = 45;
        if (elapsed <= duration) {
            let t = map(elapsed, 0, duration, 0, 1);
            let easedT = t * t * (3 - 2 * t);
            let pulseScale = 1 + easedT * 0.07;
            this.tempScaleEffect = pulseScale;
        } else {
            this.isPlacing = false;
            this.tempScaleEffect = 1;
        }
    } else if (!this.isPlacing && this.tempScaleEffect !== 1) {
         this.tempScaleEffect = 1;
    }
  }

   display(graphics, showGrabEffect = false, offsetX = 0, offsetY = 0) {
     if (!graphics || typeof graphics.push !== 'function' || typeof graphics.translate !== 'function' || typeof graphics.rotate !== 'function' || typeof graphics.scale !== 'function') {
        return;
    }

    if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim())) {
         if (!this.isGrabbed || graphics !== this) {
             return;
         }
    }

    graphics.push();
    graphics.translate(this.x - offsetX, this.y - offsetY);
    graphics.rotate(this.rotation);

    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale);

     if (showGrabEffect && graphics === this) {
         graphics.drawingContext.shadowBlur = 40;
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
         graphics.stroke(255, 255, 255, 200);
         graphics.strokeWeight(3);
         graphics.noFill();
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
         graphics.drawingContext.shadowBlur = 0;
    }

    graphics.fill(this.color);
    graphics.noStroke();

    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
    graphics.pop();
  }

  // Draws the shape's core geometry or text centered at (px, py), with base size psize.
  // Assumes transformations (translate, rotate, scale) are already applied to the 'graphics' context.
  // This function uses methods provided by the graphics context (e.g., graphics.rect, graphics.text).
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        if (!graphics || typeof graphics.rectMode !== 'function' || typeof graphics.text !== 'function') {
             return;
         }

         if (isNaN(px) || isNaN(py) || isNaN(psize) || psize <= 0) {
             if(!isText) return;
         }

        if (isText) {
             // Apply text properties to the provided graphics context
             // Ensure textFont method exists on the graphics context
             if (typeof graphics.textFont === 'function') {
                 graphics.textFont(this.font || baseFont);
             }

              if (typeof graphics.textAlign === 'function') {
                 graphics.textAlign(CENTER, CENTER);
              }

             let effectiveTextSize = psize * textScaleAdjust;
             effectiveTextSize = max(effectiveTextSize, 1);
              if (effectiveTextSize === Infinity || isNaN(effectiveTextSize)) effectiveTextSize = 16;

              if (typeof graphics.textSize === 'function') {
                 graphics.textSize(effectiveTextSize);
              }

             graphics.text(this.content, px, py); // Draw text centered at px, py

         } else { // It's a shape
              if (isNaN(psize) || psize <= 0) {
                   return;
               }
              graphics.rectMode(CENTER);

             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break;
               case 'square': graphics.rect(px, py, psize, psize); break;
               case 'triangle':
                 graphics.beginShape();
                 graphics.vertex(px, py - psize * 0.8);
                 graphics.vertex(px - psize * 0.8, py + psize * 0.4);
                 graphics.vertex(px + psize * 0.8, py + psize * 0.4);
                 graphics.endShape(CLOSE);
                 break;
               case 'pentagon':
                  graphics.beginShape();
                  let sidesP = 5; let radiusP = psize * 0.7;
                  if (isNaN(radiusP) || radiusP <= 0) { break; }
                  for (let i = 0; i < sidesP; i++) {
                     let angle = TWO_PI / sidesP * i;
                     let sx = cos(angle - HALF_PI) * radiusP;
                     let sy = sin(angle - HALF_PI) * radiusP;
                     graphics.vertex(px + sx, py + sy);
                  }
                  graphics.endShape(CLOSE);
                  break;
               case 'hexagon':
                 graphics.beginShape();
                 let sidesH = 6; let radiusH = psize;
                 if (isNaN(radiusH) || radiusH <= 0) { break; }
                 for (let i = 0; i < sidesH; i++) {
                    let angle = TWO_PI / sidesH * i;
                    let sx = cos(angle) * radiusH;
                    let sy = sin(angle) * radiusH;
                    graphics.vertex(px + sx, py + sy);
                 }
                 graphics.endShape(CLOSE);
                 break;
               default:
                 break;
             }
         }
   }

  isMouseOver(mx, my) {
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) ||
           isNaN(this.scaleFactor) || isNaN(this.size) || this.scaleFactor <= 0 || this.size <= 0) {
            return false;
       }

        if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) && !this.isGrabbed) {
            return false;
        }

       let currentDisplayScale = this.scaleFactor * this.tempScaleEffect;
       if (currentDisplayScale <= 0) return false;

       let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, currentDisplayScale);
       let localMx = localMouse.x, localMy = localMouse.y;

       if (isNaN(localMx) || isNaN(localMy)) return false;

        let localTolerance = CLICK_TOLERANCE / currentDisplayScale;
         localTolerance = max(localTolerance, 3);

       if (this.type === 'text') {
           let effectiveTextSize = this.size * this.textScaleAdjust;
           if (isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
                return false;
            }
           let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont);
           if (textBounds.w <= 0 || textBounds.h <= 0) return false;

           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);

       } else { // type is 'shape'
             if (isNaN(this.size) || this.size <= 0) {
                   return false;
             }
           switch (this.shapeType) {
              case 'circle':
                 return dist(localMx, localMy, 0, 0) <= this.size + localTolerance;
              case 'square':
                 return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);
              case 'triangle':
                  let triVertices = getTriangleVertices(this.size);
                   if (!Array.isArray(triVertices) || triVertices.length < 3) { return false; }
                  if (isPointInConvexPolygon(localMx, localMy, triVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, triVertices, localTolerance);
              case 'pentagon':
                  let pentVertices = getPentagonVertices(this.size);
                  if (!Array.isArray(pentVertices) || pentVertices.length < 5) { return false; }
                  if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance);
              case 'hexagon':
                   let hexVertices = getHexagonVertices(this.size);
                   if (!Array.isArray(hexVertices) || hexVertices.length < 6) { return false; }
                  if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance);
              default:
                   return dist(localMx, localMy, 0, 0) <= this.size * 0.7 + localTolerance;
           }
       }
    }

  solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}


function preload() {
   baseFont = 'monospace';

  // --- START: Load ALL specific fonts and logo ---
  // Providing empty function callbacks to prevent TypeError
  fontBangersRegular = loadFont('assets/Bangers-Regular.ttf', () => {}, (err) => {});
  fontBoogalooRegular = loadFont('assets/Boogaloo-Regular.ttf', () => {}, (err) => {});
  fontBreeSerifRegular = loadFont('assets/BreeSerif-Regular.ttf', () => {}, (err) => {});
  fontCaveatBrushRegular = loadFont('assets/CaveatBrush-Regular.ttf', () => {}, (err) => {});
  fontCherryBombOneRegular = loadFont('assets/CherryBombOne-Regular.ttf', () => {}, (err) => {});
  fontCinzelDecorativeBlack = loadFont('assets/CinzelDecorative-Black.ttf', () => {}, (err) => {});
  fontCinzelDecorativeBold = loadFont('assets/CinzelDecorative-Bold.ttf', () => {}, (err) => {});
  fontCinzelDecorativeRegular = loadFont('assets/CinzelDecorative-Regular.ttf', () => {}, (err) => {});
  fontDynaPuffBold = loadFont('assets/DynaPuff-Bold.ttf', () => {}, (err) => {});
  fontDynaPuffMedium = loadFont('assets/DynaPuff-Medium.ttf', () => {}, (err) => {});
  fontDynaPuffRegular = loadFont('assets/DynaPuff-Regular.ttf', () => {}, (err) => {});
  fontInterBold = loadFont('assets/Inter-Bold.ttf', () => {}, (err) => {});
  fontInterRegular = loadFont('assets/Inter-Regular.ttf', () => {}, (err) => {});
  fontPixelifySansRegular = loadFont('assets/PixelifySans-Regular.ttf', () => {}, (err) => {});
  fontSenBold = loadFont('assets/Sen-Bold.ttf', () => {}, (err) => {});
  fontSenMedium = loadFont('assets/Sen-Medium.ttf', () => {}, (err) => {});
  fontSenRegular = loadFont('assets/Sen-Regular.ttf', () => {}, (err) => {});
  fontShareTechMonoRegular = loadFont('assets/ShareTechMono-Regular.ttf', () => {}, (err) => {});
  fontVT323Regular = loadFont('assets/VT323-Regular.ttf', () => {}, (err) => {});

  // Provided empty function callbacks for loadImage as well
  logoImage = loadImage('assets/placeholder-logo.svg', () => {}, (err) => {});

  // --- END: Variables for ALL Loaded Fonts ---
}
let canvasPG;
let initialPositioningDone = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
    if (width <= 0 || height <= 0) {
         return;
     }

  SNAP_INCREMENT_RADIANS = radians(15);

    canvasPG = createGraphics(10, 10);
    canvasPG.background(255);

    textMeasurePG = createGraphics(1, 1);

    // --- Filter usable fonts after they are loaded in preload ---
    // This array will be used by both reset() and addNewTextShapeFromInput()
    usableFonts = potentialFontVariables
        .map(varName => window[varName]) // Get the actual font object from the global scope
        .filter(f => f); // Filter for truthy values (successfully loaded fonts)
    // --- End filter usable fonts ---


    // --- Set initial textMeasurePG font ---
    // Use the first usable font for measurement if available, otherwise fallback
    if (usableFonts.length > 0 && typeof usableFonts[0].text === 'function') {
        textMeasurePG.textFont(usableFonts[0]);
    } else if (fontSenRegular && typeof fontSenRegular.text === 'function') { // Fallback to Sen-Regular if it specifically loaded
        textMeasurePG.textFont(fontSenRegular);
    }
    else if (baseFont && typeof textMeasurePG.textFont === 'function') {
        textMeasurePG.textFont(baseFont); // Fallback to monospace string
    }
    // --- End Set initial textMeasurePG font ---


  inputElement = createInput();
  inputElement.value('');
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
  inputElement.style("padding", "5px 10px")
               .style("border", "1px solid #ccc")
               .style("border-radius", "15px")
               .style("outline", "none")
               .style("background-color", color(255, 255, 255, 200))
               .style("font-size", "14px")
               .style("color", color(50))
                .style("box-sizing", "border-box");

  inputElement.elt.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && event.target === this) {
      addNewTextShapeFromInput();
      event.preventDefault();
    }
  });

  savePNGButton = createButton("SAVE PNG");
  saveHighResPNGButton = createButton("SAVE HI-RES PNG");
  savePDFButton = createButton("SAVE PDF");
  clearButton = createButton("CLEAR");
  refreshButton = createButton("REFRESH");

   const baseButtonStyle = {
       padding: "5px 10px",
       border: "1px solid #888",
       "border-radius": "15px",
       "background-color": "rgba(200, 200, 200, 0.7)",
       color: "rgb(50, 50, 50)",
       outline: "none",
       cursor: "pointer"
   };

   [savePNGButton, saveHighResPNGButton, savePDFButton, clearButton, refreshButton].forEach(btn => {
       if (btn) {
           Object.keys(baseButtonStyle).forEach(styleKey => {
                btn.style(styleKey, baseButtonStyle[styleKey]);
           });
             btn.elt.addEventListener('mouseover', function() { this.style.backgroundColor = 'rgba(220, 220, 220, 0.9)'; });
             btn.elt.addEventListener('mouseout', function() { this.style.backgroundColor = baseButtonStyle["background-color"]; });
       }
   });

   if(savePNGButton) savePNGButton.elt.addEventListener('click', saveCanvasAreaAsPNG);
   if(saveHighResPNGButton) saveHighResPNGButton.elt.addEventListener('click', saveCanvasAreaAsHighResPNG);
   if(savePDFButton) savePDFButton.elt.addEventListener('click', saveCanvasAreaAsPDF);
   if(clearButton) clearButton.elt.addEventListener('click', restartAll);
   if(refreshButton) refreshButton.elt.addEventListener('click', resetRandom);

   initialPositioningDone = false;

  while (shapes.length < 30) { shapes.push(new FloatingShape()); }
}


function draw() {
    if (!initialPositioningDone) {
        positionDOMElementsAndCanvasPG();
        initialPositioningDone = true;
    }

  background(0);

  // --- Update shapes ---
  for (let i = shapes.length - 1; i >= 0; i--) {
      let shape = shapes[i];
     if (!shape.isGrabbed && !shape.isPlacing) { shape.update(); }
     shape.updateLanding();
     if (!shape.isGrabbed && !shape.isPlacing && shape.isReallyOffScreen()) {
          shapes.splice(i, 1);
      }
  }

  while (shapes.length < 20) { shapes.push(new FloatingShape()); }


  // --- Update placed items ---
  for (let item of placedItems) {
      item.updateLanding();
  }

  // --- Draw floating shapes on main canvas (behind artboard) ---
  for (let i = 0; i < shapes.length; i++) {
      let shape = shapes[i];
      if (shape !== grabbedItem) {
          shape.display(this, false, 0, 0);
      }
  }


  // --- Central White Canvas Area Drawing (Rendered to canvasPG) ---
  if(canvasPG){
     canvasPG.clear();
     canvasPG.background(255);

    // Draw placed items onto canvasPG
    for (let i = 0; i < placedItems.length; i++) {
        let item = placedItems[i];
        item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
    }

    image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
  } else {
       fill(255, 100, 100, 100);
       rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
       fill(0); textAlign(CENTER, CENTER); text("Error: Canvas area buffer missing.", CANVAS_AREA_X + CANVAS_AREA_W/2, CANVAS_AREA_Y + CANVAS_AREA_H/2);
  }

  // Draw border around canvas area
  stroke(200);
  strokeWeight(1);
  noFill();
   rect(CANVAS_AREA_X + 0.5, CANVAS_AREA_Y + 0.5, CANVAS_AREA_W - 1, CANVAS_AREA_H - 1);


  // Draw grabbed item on top of everything else on the main canvas
  if (grabbedItem) {
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.4);
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.4);
     grabbedItem.solidify();
     grabbedItem.isPlacing = false;
      if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value();
      }
     grabbedItem.display(this, true, 0, 0);
  }

  // --- DRAW HEADER / UI OVERLAY ---
  fill(220);
  noStroke();
  rect(0, 0, width, HEADER_HEIGHT);

    // --- START: Draw the Header Logo (SVG or Fallback Text) ---
    let logoX = 20;
    let logoCenterY = HEADER_HEIGHT / 2;
    let logoTargetWidth = 150;

    if (logoImage && typeof logoImage.width === 'number' && logoImage.width > 0) {
         let logoAspectRatio = logoImage.height / logoImage.width;
         let logoTargetHeight = logoTargetWidth * logoAspectRatio;

         let logoDrawX = logoX;
         let logoDrawY = logoCenterY - logoTargetHeight / 2;

         imageMode(CORNER);
         image(logoImage, logoDrawX, logoDrawY, logoTargetWidth, logoTargetHeight);

    } else {
         fill(50);
         textSize(20);
         textAlign(LEFT, CENTER);
          // Use textFont directly in the main drawing context
          if (fontSenRegular && typeof fontSenRegular.text === 'function') {
              textFont(fontSenRegular);
          } else {
              textFont(baseFont);
          }
         text("PLACEHOLDER\nLOGO", logoX, logoCenterY);
    }
    // --- END: Draw the Header Logo ---
}

function positionDOMElementsAndCanvasPG() {

     const minCanvasW = 300;
     const adjustedCanvasW = min(CANVAS_AREA_W_BASE, max(minCanvasW, windowWidth * 0.95));

    let targetCANVAS_AREA_W = adjustedCanvasW;
    let targetCANVAS_AREA_H = adjustedCanvasW * (5 / 4);

    let minSideMargin = 15;
    let targetCANVAS_AREA_X = max(minSideMargin, (width / 2 - targetCANVAS_AREA_W / 2));

    let padY = 20;
    let targetCANVAS_AREA_Y = HEADER_HEIGHT + padY;

     const availableH = height - HEADER_HEIGHT - padY - 15;
     const requiredH_forW = targetCANVAS_AREA_W * (5/4);

     if (requiredH_forW > availableH && availableH > 100) {
        targetCANVAS_AREA_H = availableH;
        targetCANVAS_AREA_W = targetCANVAS_AREA_H * (4/5);
        targetCANVAS_AREA_W = max(minCanvasW, min(targetCANVAS_AREA_W, windowWidth * 0.95));
        targetCANVAS_AREA_X = max(minSideMargin, (width / 2 - targetCANVAS_AREA_W / 2));
     }

     CANVAS_AREA_W = targetCANVAS_AREA_W;
     CANVAS_AREA_H = targetCANVAS_AREA_H;
     CANVAS_AREA_X = targetCANVAS_AREA_X;
     CANVAS_AREA_Y = targetCANVAS_AREA_Y;


    if (canvasPG && (canvasPG.width !== CANVAS_AREA_W || canvasPG.height !== CANVAS_AREA_H)) {
         if (CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
              canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H);
               canvasPG.background(255);
         } else {
               if (canvasPG) { try { canvasPG.remove(); } catch(e) {} } canvasPG = null;
         }
     } else if (!canvasPG && CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
          canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
          canvasPG.background(255);
     }


     // --- Ensure textMeasurePG is initialized or re-initialized defensively ---
     if (!textMeasurePG || typeof textMeasurePG.textWidth !== 'function') {
          if (textMeasurePG) { try { textMeasurePG.remove(); } catch(e) {} }
          try {
               textMeasurePG = createGraphics(10, 10);
               // Re-apply essential text properties
                // Use the first usable font for measurement if available, otherwise fallback
               if (usableFonts.length > 0) {
                   textMeasurePG.textFont(usableFonts[0]);
               } else {
                    textMeasurePG.textFont(baseFont); // Fallback
               }
               if (typeof textMeasurePG.textAlign === 'function') textMeasurePG.textAlign(CENTER, CENTER);
          } catch(e) {
               textMeasurePG = null;
          }
     }


     let headerCenterY = HEADER_HEIGHT / 2;
     if (inputElement) {
          let inputHeight = inputElement.elt.offsetHeight || 30;
          inputElement.position(CANVAS_AREA_X, headerCenterY - inputHeight / 2);
         inputElement.size(CANVAS_AREA_W);
     }

     const btnOuterWidth = (btn) => { if (!btn || !btn.elt) return 0; return btn.elt.offsetWidth || 80; };

    const buttonSpacing = 8;
    const rightMargin = 15;

    let savePNGBtnW = btnOuterWidth(savePNGButton);
    let saveHighResPNGBtnW = btnOuterWidth(saveHighResPNGButton);
    let savePDFBtnW = btnOuterWidth(savePDFButton);
    let clearBtnW = btnOuterWidth(clearButton);
    let refreshBtnW = btnOuterWidth(refreshButton);

    let allButtons = [refreshButton, clearButton, savePNGButton, saveHighResPNGButton, savePDFButton].filter(btn => btn !== null);
    let totalButtonWidths = allButtons.reduce((sum, btn) => sum + btnOuterWidth(btn), 0);
    let numButtons = allButtons.length;
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);

     let buttonBlockStartX = width - rightMargin - (totalButtonWidths + totalSpacing);

     let inputRightEdge = inputElement ? inputElement.position().x + inputElement.size().width : 0;
     let minButtonStartX = inputRightEdge + 30;

     buttonBlockStartX = max(buttonBlockStartX, minButtonStartX);

     let buttonHeight = (savePNGButton ? savePNGButton.elt.offsetHeight || 30 : HEADER_HEIGHT / 4);
     let buttonPadY_buttons = headerCenterY - buttonHeight / 2;

    let currentButtonX = buttonBlockStartX;

    if (refreshButton) { refreshButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(refreshButton) + buttonSpacing; }
    if (clearButton) { clearButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(clearButton) + buttonSpacing; }
    if (savePNGButton) { savePNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(savePNGButton) + buttonSpacing; }
    if (saveHighResPNGButton) { saveHighResPNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(saveHighResPNGButton) + buttonSpacing; }
    if (savePDFButton) { savePDFButton.position(currentButtonX, buttonPadY_buttons); /* Last button */ }
}

function windowResized() {
     if (windowWidth > 0 && windowHeight > 0 && (windowWidth !== width || windowHeight !== height)) {
        resizeCanvas(windowWidth, windowHeight);
         positionDOMElementsAndCanvasPG();
     } else {
         return;
     }
}

function mousePressed() {
   if (mouseY < HEADER_HEIGHT) {
       return true;
    }

   if (grabbedItem && grabbedItem.isMouseOver(mouseX, mouseY)) {
        if (grabbedItem.type === 'text') inputElement.elt.focus();
        return false;
   } else if (grabbedItem) {
        return false;
   }

   if (isMouseOverCanvasArea(mouseX, mouseY)) {
       for (let i = placedItems.length - 1; i >= 0; i--) {
            if (placedItems[i].isMouseOver(mouseX, mouseY)) {
                grabbedItem = placedItems[i];
                grabbedItem.isGrabbed = true;
                grabbedItem.isPlacing = false;
                grabbedItem.solidify();
                let temp = placedItems.splice(i, 1)[0];
                shapes.push(temp);

                if (grabbedItem.type === 'text') {
                    inputElement.value(grabbedItem.content || '');
                    inputElement.attribute('placeholder', '');
                 } else {
                    inputElement.value('');
                    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                    inputElement.elt.blur();
                 }
                return false;
           }
       }
   }

  for (let i = shapes.length - 1; i >= 0; i--) {
      if (!shapes[i].isGrabbed) {
          if (shapes[i].isMouseOver(mouseX, mouseY)) {
              grabbedItem = shapes[i];
              grabbedItem.isGrabbed = true;
              grabbedItem.isPlacing = false;
              grabbedItem.solidify();
              let temp = shapes.splice(i, 1)[0];
              shapes.push(temp);

              if (grabbedItem.type === 'text') {
                 inputElement.value(grabbedItem.content || '');
                 inputElement.attribute('placeholder', '');
                 inputElement.elt.focus();
              } else {
                 inputElement.value('');
                 inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                  inputElement.elt.blur();
              }
              return false;
          }
      }
  }
   return true;
}

function mouseReleased() {
  if (grabbedItem) {
    let wasTextItem = grabbedItem.type === 'text';
    grabbedItem.isGrabbed = false;

    if (isMouseOverCanvasArea(grabbedItem.x, grabbedItem.y)) {
      if (wasTextItem) {
           let content = inputElement.value().trim();
           if(content === "" || content === TEXT_OPTIONS[0].trim()) {
               shapes = shapes.filter(s => s !== grabbedItem);
               grabbedItem = null;
                inputElement.value('');
                inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                inputElement.elt.blur();
               return;
           } else {
              grabbedItem.content = content;
           }
      }

      grabbedItem.solidify();

      if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      }

      shapes = shapes.filter(s => s !== grabbedItem);
      placedItems.push(grabbedItem);

      grabbedItem.isPlacing = true;
      grabbedItem.landFrame = frameCount;


    } else {
         if (wasTextItem) {
             let content = inputElement.value().trim();
             if (content === "" || content === TEXT_OPTIONS[0].trim()) {
                  shapes = shapes.filter(s => s !== grabbedItem);
                  grabbedItem = null;
                   inputElement.value('');
                   inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                   inputElement.elt.blur();
                 return;
             } else {
                  grabbedItem.content = content;
             }
         }

          grabbedItem.speedX = random(-1.5, 1.5);
          grabbedItem.speedY = random(-1.5, 1.5);
          grabbedItem.rotationSpeed = random(-0.003, 0.003);
          grabbedItem.isPlacing = false;
    }

    if (grabbedItem !== null) {
         grabbedItem = null;
         inputElement.value('');
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
         inputElement.elt.blur();
     }
  }
}

function doubleClicked() {
    if (!isMouseOverCanvasArea(mouseX, mouseY)) return true;

    for (let i = placedItems.length - 1; i >= 0; i--) {
        let item = placedItems[i];
        if (item.isMouseOver(mouseX, mouseY)) {
            let itemToSendToBack = placedItems.splice(i, 1)[0];
            placedItems.unshift(itemToSendToBack);
            itemToSendToBack.solidify();
            return false;
        }
    }
     return true;
}

function mouseWheel(event) {
   let isOverCanvasArea = isMouseOverCanvasArea(mouseX, mouseY);

    if (grabbedItem || isOverCanvasArea) {
         if (grabbedItem) {
            grabbedItem.rotation += event.delta * 0.002;
         }
        return false;
    }
    return true;
}

function keyPressed() {
    if (document.activeElement === inputElement.elt) {
        return true;
    }

     if (document.activeElement !== document.body && document.activeElement !== canvas.elt) {
        return true;
    }

    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        shapes = shapes.filter(s => s !== grabbedItem);
        placedItems = placedItems.filter(s => s !== grabbedItem);
        grabbedItem = null;
        inputElement.value('');
        inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
        return false;
    }

     if (grabbedItem) {
          const scaleIncrement = 1.08;
          const scaleDecrement = 1 / scaleIncrement;
          const minScale = 0.05;
          const maxScale = 10.0;

         if (key === '+' || key === '=') {
             grabbedItem.scaleFactor *= scaleIncrement;
             grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, maxScale);
         }
         if (key === '-') {
             grabbedItem.scaleFactor *= scaleDecrement;
             grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, minScale);
         }
        return false;
    }
    return true;
}

// Corrected addNewTextShapeFromInput function
function addNewTextShapeFromInput() {
    let currentText = inputElement.value();
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
         inputElement.style("border-color", "red");
         setTimeout(() => inputElement.style("border-color", "#ccc"), 500);
         inputElement.value('');
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
         inputElement.elt.focus();
         return;
    }

    let newTextShape = new FloatingShape();

    newTextShape.reset(); // Start with initial floating properties

    newTextShape.type = 'text';
    newTextShape.content = currentText.trim();
    newTextShape.shapeType = 'none';

    let category = sizeCategories.find(cat => cat.name === 'medium') || { sizeRange: [100, 200], scaleRange: [1.0, 1.5], textScaleAdjust: 0.2 };
    newTextShape.size = random(category.sizeRange[0] * 0.8, category.sizeRange[1] * 1.2);
    newTextShape.scaleFactor = 1.0;
    newTextShape.textScaleAdjust = category.textScaleAdjust;

     let pickedColor;
     let attempts = 0;
     do {
         pickedColor = color(random(PALETTE));
         let b = brightness(pickedColor);
         if (b < 50 && attempts < 5) continue;
         if (b > 200 && attempts < 5) continue;
         break;
     } while (attempts < 10);

      if (brightness(pickedColor) > 200) {
           pickedColor = color(random(['#0000FE', '#E70012', '#41AD4A', '#000000', '#222222']));
      }
     newTextShape.color = pickedColor;


    // --- Assign a random loaded font ---
    // usableFonts array is filtered once in setup()
    if (usableFonts.length > 0) {
        newTextShape.font = random(usableFonts);
    } else {
        newTextShape.font = baseFont;
    }
    // --- End font assignment ---


     // --- Apply Custom SPAWN LOCATION for new text (near artboard sides), OVERRIDING reset() position/speed ---
     let spawnMargin = 40;
     let spawnedCustom = false;

     let leftSpace = CANVAS_AREA_X;
     let rightSpace = width - (CANVAS_AREA_X + CANVAS_AREA_W);

     let spawnSide;
     if (leftSpace > rightSpace * 1.5) {
         spawnSide = 'left';
     } else if (rightSpace > leftSpace * 1.5) {
         spawnSide = 'right';
     } else {
         spawnSide = random() > 0.5 ? 'right' : 'left';
     }

     if (spawnSide === 'left' && leftSpace > spawnMargin * 2) {
         newTextShape.x = random(spawnMargin, CANVAS_AREA_X - spawnMargin);
         newTextShape.speedX = random(0.5, 1.5);
         spawnedCustom = true;
     } else if (rightSpace > spawnMargin * 2) {
         newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W + spawnMargin, width - spawnMargin);
         newTextShape.speedX = random(-1.5, -0.5);
         spawnedCustom = true;
     }

     if (spawnedCustom) {
          newTextShape.y = random(CANVAS_AREA_Y - spawnMargin, CANVAS_AREA_Y + CANVAS_AREA_H + spawnMargin);
          newTextShape.y = max(newTextShape.y, HEADER_HEIGHT + spawnMargin);
          newTextShape.y = max(spawnMargin, min(newTextShape.y, height - spawnMargin));

          newTextShape.speedY = random(-0.5, 0.5);
          newTextShape.rotation = random(TWO_PI);
          newTextShape.rotationSpeed = random(-0.001, 0.001);

     }
    // --- End Custom SPAWN LOCATION ---

    newTextShape.isGrabbed = false;
    newTextShape.isPlacing = false;

    shapes.push(newTextShape);

    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    inputElement.elt.focus();
}

function isMouseOverCanvasArea(pX, pY) {
     const checkX = pX === undefined ? mouseX : pX;
     const checkY = pY === undefined ? mouseY : pY;

    return checkX >= CANVAS_AREA_X && checkX <= CANVAS_AREA_X + CANVAS_AREA_W &&
           checkY >= CANVAS_AREA_Y && checkY <= CANVAS_AREA_Y + CANVAS_AREA_H;
}

function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0 || isNaN(incrementRadians)) return angleRadians;
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI;
    let numIncrements = round(angleRadians / incrementRadians);
    let snapped = numIncrements * incrementRadians;
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI;
    return snapped;
}

function generateTimestampString() {
    let d = new Date();
    return d.getFullYear() + nf(d.getMonth() + 1, 2) + nf(d.getDate(), 2) + '_' + nf(d.getHours(), 2) + nf(d.getMinutes(), 2) + nf(d.getSeconds(), 2);
}


function saveCanvasAreaAsPNG() {
    if (!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) {
        alert("Error: Cannot save standard PNG. Canvas area buffer is not available or invalid.");
        return;
    }

    let saveBuffer = createGraphics(canvasPG.width, canvasPG.height);
    saveBuffer.image(canvasPG, 0, 0);

    saveBuffer.push();
    saveBuffer.stroke(0);
    saveBuffer.strokeWeight(1);
    saveBuffer.noFill();
    saveBuffer.rect(0.5, 0.5, saveBuffer.width - 1, saveBuffer.height - 1);
    saveBuffer.pop();

    saveCanvas(saveBuffer, 'myArtboard_stdres_' + generateTimestampString() + '.png');
    if (saveBuffer) { saveBuffer.remove(); }
}


function saveCanvasAreaAsHighResPNG() {

     if (!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) {
        alert("Error: Cannot save high-resolution PNG. Canvas area buffer is not available or invalid.");
        return;
     }

    const sourceWidthBase = CANVAS_AREA_W_BASE;
    const sourceHeightBase = CANVAS_AREA_W_BASE * (5/4);

    const TARGET_DPI = 300;
    const B2_WIDTH_INCHES = 500 / 25.4;
    const B2_HEIGHT_INCHES = 707 / 25.4;

    const targetWidthPixels = round(B2_WIDTH_INCHES * TARGET_DPI);
    const targetHeightPixels = round(B2_HEIGHT_INCHES * TARGET_DPI);

     const scaleFactor = targetWidthPixels / sourceWidthBase;
     const scaledSourceHeight = sourceHeightBase * scaleFactor;
     const verticalOffset = (targetHeightPixels - scaledSourceHeight) / 2;

    let highResPG = null;
     try {
         if (targetWidthPixels <= 0 || targetHeightPixels <= 0 || isNaN(targetWidthPixels) || isNaN(targetHeightPixels)) {
             alert("Error calculating high-res save size.");
             return;
         }

        highResPG = createGraphics(targetWidthPixels, targetHeightPixels);
        highResPG.background(255);

        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                 continue;
             }
             if (item.scaleFactor <= 0 || item.size <= 0) continue;

            highResPG.push();

             let hrItemX = (item.x - CANVAS_AREA_X) * scaleFactor;
             let hrItemY = (item.y - CANVAS_AREA_Y) * scaleFactor + verticalOffset;

             if (isNaN(hrItemX) || isNaN(hrItemY)) {
                 highResPG.pop(); continue;
             }
            highResPG.translate(hrItemX, hrItemY);
            highResPG.rotate(item.rotation);

             let combinedScale = item.scaleFactor * scaleFactor;
              combinedScale = max(combinedScale, 1e-6);

            highResPG.scale(combinedScale);

            highResPG.fill(item.color);
            highResPG.noStroke();

             // Use the font object itself
             let itemFont = item.font;
             let itemTextScale = isNaN(item.textScaleAdjust) ? 0.2 : item.textScaleAdjust;
             itemTextScale = max(itemTextScale, 1e-3);

             // Check if itemFont is a valid p5.Font object before using it
             if (itemFont) { // Check for truthiness is enough here
                 highResPG.textFont(itemFont);
             } else {
                  // Fallback on highResPG if the specific item font is bad
                   if (usableFonts.length > 0) highResPG.textFont(usableFonts[0]); // Use first usable if available
                  else highResPG.textFont(baseFont); // Fallback string
             }


             item.drawShapePrimitive(highResPG, 0, 0, item.size, item.shapeType, item.type === 'text', itemTextScale);

            highResPG.pop();
        }

        highResPG.push();
         highResPG.stroke(0);
         let borderWeight = 1 * scaleFactor;
         borderWeight = max(borderWeight, 0.5);
         highResPG.strokeWeight(borderWeight);
         highResPG.noFill();
         let borderRectX = 0;
         let borderRectY = verticalOffset;
         let borderRectW = targetWidthPixels;
         let borderRectH = scaledSourceHeight;

         highResPG.rect(borderRectX + borderWeight / 2, borderRectY + borderWeight / 2,
                        borderRectW - borderWeight, borderRectH - borderWeight);

        highResPG.pop();

        if (targetWidthPixels > 0 && targetHeightPixels > 0) {
             saveCanvas(highResPG, `myArtboard_HIRES_${targetWidthPixels}x${targetHeightPixels}_` + generateTimestampString() + '.png');
         } else {
              alert("Error: High-resolution dimensions are invalid.");
         }

     } catch(e) {
        alert("Error saving high-resolution PNG. Check browser console for technical details.");
        if (highResPG) {
             if (typeof highResPG.isRecording === 'boolean' && highResPG.isRecording && typeof highResPG.endRecord === 'function') {
                 try{ highResPG.endRecord(); } catch(endErr) {}
             }
             if (typeof highResPG.remove === 'function') { try { highResPG.remove(); } catch(remErr) {} }
         }
     } finally {
        if (highResPG) {
             highResPG.remove();
         }
     }
}


function saveCanvasAreaAsPDF() {

    if (typeof p5 === 'undefined' || !p5.prototype.createPDF || typeof p5.prototype.createPDF !== 'function') {
         alert("Error: PDF library not loaded or initialized correctly. Please ensure 'p5.pdf.js' is included AFTER 'p5.js'.");
         return;
     }

    let pdf = null;

     try {
         // Use this context for PDF creation
         pdf = p5.prototype.createPDF(this);

        if (!pdf || typeof pdf.beginRecord !== 'function' || typeof pdf.endRecord !== 'function' || typeof pdf.save !== 'function') {
             if (pdf && typeof pdf.remove === 'function') { try { pdf.remove(); } catch(e) {} }
             pdf = null;
             alert("Error creating PDF instance. PDF library might be corrupted or incompatible.");
            return;
        }

        pdf.beginRecord();

        // Set PDF graphics properties
        pdf.fill(255);
        pdf.noStroke();
        pdf.rect(0, 0, CANVAS_AREA_W, CANVAS_AREA_H);


        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

              if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                 continue;
             }
             if (item.scaleFactor <= 0 || item.size <= 0) continue;

            pdf.push();
            // Draw relative to the PDF context origin (0,0)
            pdf.translate(item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y);
            pdf.rotate(item.rotation);

            pdf.scale(item.scaleFactor);

            pdf.fill(item.color);
            pdf.noStroke();

             // Use the font object itself for PDF
             let itemFont = item.font;
             let itemTextScale = isNaN(item.textScaleAdjust) ? 0.2 : item.textScaleAdjust;
             itemTextScale = max(itemTextScale, 1e-3);

             // Check if itemFont is a valid p5.Font object before using it on PDF
             if (itemFont) { // Check for truthiness is enough here
                 pdf.textFont(itemFont);
             } else {
                  // Fallback on PDF if the specific item font is bad
                   if (usableFonts.length > 0) pdf.textFont(usableFonts[0]); // Use first usable if available
                  else pdf.textFont(baseFont); // Fallback string
             }


            item.drawShapePrimitive(pdf, 0, 0, item.size, item.shapeType, item.type === 'text', itemTextScale);

            pdf.pop();
        }

         pdf.push();
         pdf.stroke(0);
         pdf.strokeWeight(1);
         pdf.noFill();
         pdf.rect(0, 0, CANVAS_AREA_W, CANVAS_AREA_H);
         pdf.pop();


        pdf.endRecord();

        pdf.save({
            filename: 'myArtboard_pdf_' + generateTimestampString(),
            width: CANVAS_AREA_W,
            height: CANVAS_AREA_H,
            margin: {top:0, right:0, bottom:0, left:0}
        });


     } catch(e) {
         alert("Error generating PDF. Check browser console for technical details.");
         if (pdf && typeof pdf.isRecording === 'boolean' && pdf.isRecording && typeof pdf.endRecord === 'function') {
             try{ pdf.endRecord(); } catch(endErr) {}
         }
         if (pdf && typeof pdf.remove === 'function') { try { pdf.remove(); } catch(remErr) {} }
     }
}

function resetRandom() {
    let tempGrabbedItem = grabbedItem;
    let wasFloating = tempGrabbedItem && shapes.includes(tempGrabbedItem);

    if (wasFloating) {
        shapes = shapes.filter(s => s !== tempGrabbedItem);
    }

    shapes = [];

    while (shapes.length < 30) {
        let newShape = new FloatingShape();
        shapes.push(newShape);
    }

    if (wasFloating && tempGrabbedItem) {
        shapes.push(tempGrabbedItem);
    }
}

function restartAll() {
    placedItems = [];
    shapes = [];
    grabbedItem = null;

    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    inputElement.elt.blur();

     if (canvasPG) {
         canvasPG.clear();
     }

    while (shapes.length < 30) { shapes.push(new FloatingShape()); }
}

let touchGrabbed = false;

function touchStarted(event) {
    if (touches.length === 0) return true;

    let touchX = touches[0].x;
    let touchY = touches[0].y;

    if (touchY < HEADER_HEIGHT) {
         if (event.cancelable) event.preventDefault();
         return true;
    }

     if (grabbedItem) {
          if (grabbedItem.isMouseOver(touchX, touchY)) {
              touchGrabbed = true;
               if (event.cancelable) event.preventDefault();
             return false;
          } else {
               if (event.cancelable) event.preventDefault();
               return false;
          }
     }

     if (isMouseOverCanvasArea(touchX, touchY)) {
         for (let i = placedItems.length - 1; i >= 0; i--) {
             if (placedItems[i].isMouseOver(touchX, touchY)) {
                  grabbedItem = placedItems[i];
                  grabbedItem.isGrabbed = true;
                  grabbedItem.isPlacing = false;
                  grabbedItem.solidify();
                  let temp = placedItems.splice(i, 1)[0]; shapes.push(temp);

                 if (grabbedItem.type === 'text') {
                     inputElement.value(grabbedItem.content || '');
                     inputElement.attribute('placeholder', '');
                  } else {
                      inputElement.value('');
                     inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                  }

                 touchGrabbed = true;
                  if (event.cancelable) event.preventDefault();
                 return false;
             }
         }
     }

     for (let i = shapes.length - 1; i >= 0; i--) {
        if (!shapes[i].isGrabbed) {
          if (shapes[i].isMouseOver(touchX, touchY)) {
            grabbedItem = shapes[i];
            grabbedItem.isGrabbed = true;
            grabbedItem.isPlacing = false;
            grabbedItem.solidify();
            let temp = shapes.splice(i, 1)[0]; shapes.push(temp);

             if (grabbedItem.type === 'text') {
                 inputElement.value(grabbedItem.content || '');
                 inputElement.attribute('placeholder', '');
              } else {
                  inputElement.value('');
                 inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
              }

            touchGrabbed = true;
             if (event.cancelable) event.preventDefault();
            return false;
          }
        }
      }
    return true;
}

function touchMoved(event) {
    if (touches.length === 0) return true;

    let touchX = touches[0].x;
    let touchY = touches[0].y;

     if (grabbedItem && touchGrabbed) {
          if (event.cancelable) event.preventDefault();

        grabbedItem.x = lerp(grabbedItem.x, touchX, 0.4);
        grabbedItem.y = lerp(grabbedItem.y, touchY, 0.4);

         return false;
    }
    return true;
}


function touchEnded(event) {
     if (grabbedItem && touchGrabbed) {
         mouseReleased();
         touchGrabbed = false;
         if (event.cancelable) event.preventDefault();
         return false;
     }
    return true;
}

function isMouseOverCanvasArea(pX, pY) {
    const checkX = pX === undefined ? mouseX : pX;
    const checkY = pY === undefined ? mouseY : pY;

    return checkX >= CANVAS_AREA_X && checkX <= CANVAS_AREA_X + CANVAS_AREA_W &&
           checkY >= CANVAS_AREA_Y && checkY <= CANVAS_AREA_Y + CANVAS_AREA_H;
}