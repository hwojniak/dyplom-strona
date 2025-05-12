// Interactive canvas website-tool project using p5.js

let shapes = []; // Shapes currently floating or grabbed (Includes temporarily grabbed placed items)
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged

// UI Element References (DOM elements need global vars if you create them this way)
let inputElement;
let savePNGButton;         // Existing button for standard PNG save
let saveHighResPNGButton;  // NEW button for high-resolution PNG save
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

// List to hold successfully loaded p5.Font objects - POPULATED IN CALLBACKS
let loadedFontsList = [];
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

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2; // Corrected dot product calculation
  t = max(0, min(1, t));

  let closestX = x1 + t * (x2 - x1);
  let closestY = y1 + t * (y2 - y1);

  return dist(px, py, closestX, closestY);
}

// Gets local vertices for unrotated polygon shapes centered at (0,0).
function getTriangleVertices(size) {
     if (isNaN(size) || size <= 0) return [];
    // For equilateral triangle, we'll use size as the height
    // The height of an equilateral triangle is (√3/2) * side_length
    // So side_length = (2/√3) * height
    const height = size;
    const sideLength = (2/Math.sqrt(3)) * height;
    // Calculate vertices for equilateral triangle
    return [
        { x: 0, y: -height/2 },  // Top vertex
        { x: -sideLength/2, y: height/2 },  // Bottom left
        { x: sideLength/2, y: height/2 }   // Bottom right
    ];
}

function getSquareVertices(size) {
     if (isNaN(size) || size <= 0) return [];
    let halfSize = size / 2;
    return [{ x: -halfSize, y: -halfSize }, { x: halfSize, y: -halfSize }, { x: halfSize, y: halfSize }, { x: -halfSize, y: halfSize }];
}

function getPentagonVertices(size) {
     if (isNaN(size) || size <= 0) return [];
    let sides = 5;
    let radius = size * 0.7; // Matching drawShapePrimitive
     if (isNaN(radius) || radius <= 0) return [];
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
     let radius = size; // Matching drawShapePrimitive
     if (isNaN(radius) || radius <= 0) return [];
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
         return false; // Invalid vertex data
     }
    // Check if point is on the line (cross product is zero)
    cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);

    // Use a small epsilon for floating point comparisons
    const epsilon = 1e-6;
    if (cross_product > epsilon) has_pos = true;
    if (cross_product < -epsilon) has_neg = true;

    // If signs differ, point is outside (or on an edge, handled by isPointNearPolygonEdge)
    if (has_pos && has_neg) return false;
  }

   // If we got here, all cross products have the same sign (or are zero).
   // This means the point is inside or on an edge.
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

// Calculates text bounding box using a *single, persistent* graphics buffer.
let textMeasurePG; // Declare the global variable here

function getTextBounds(content, effectiveTextSize, fontRef) { // Renamed baseFontRef to fontRef for clarity
     if (typeof content !== 'string' || isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
          return { w: 0, h: 0 }; // Return zero bounds for invalid input
     }

    // Ensure the measurement buffer exists and is configured
    if (!textMeasurePG) {
         // Fallback estimate if measurement buffer is not available
        return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
    }

    try {
        // Apply font properties to the measurement buffer context
        // Use the font reference provided, or a default if none/invalid
        // Check if fontRef is a truthy font object (and not the fallback string)
        if (fontRef && fontRef !== baseFont) {
             if (typeof textMeasurePG.textFont === 'function') textMeasurePG.textFont(fontRef);
        } else {
             // Fallback to baseFont string
             if (typeof textMeasurePG.textFont === 'function') textMeasurePG.textFont(baseFont);
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
        // Fallback estimate on error
        console.error("Error in getTextBounds:", e);
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
      let offScreenOffset = max(roughMaxDimension / 2 * this.scaleFactor, 100) + 50; // Ensure it spawns well off-screen

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
        this.speedX = random(-1, 1) * maxSpeed * 0.5; // Allow movement in both directions
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
    this.type = random() < 0.7 ? 'shape' : 'text'; // 70% chance of being a shape

    if (this.type === 'text') {
         let attempts = 0;
          do {
             pickedColor = color(random(PALETTE));
             attempts++;
             // Avoid very light colors for text on black background
         } while (attempts < 10 && brightness(pickedColor) > 230);

         this.shapeType = 'none'; // Text shapes don't have a polygon/circle shape
         let initialContent = random(TEXT_OPTIONS.slice(1)); // Pick from actual options, not placeholder
         // Ensure content is not empty or just the placeholder
         while(!initialContent || initialContent.trim() === "" || initialContent.trim() === TEXT_OPTIONS[0].trim()){
            initialContent = random(TEXT_OPTIONS.slice(1));
         }
         this.content = initialContent.trim();
         this.textScaleAdjust = category.textScaleAdjust;

         // Assign a random loaded font
         if (loadedFontsList.length > 0) {
             this.font = random(loadedFontsList); // Pick a random p5.Font object
             // console.log(`RESET: Assigned font:`, this.font ? this.font.font.names.postscriptName : 'Fallback'); // Debug font name
         } else {
             this.font = baseFont; // Fallback to the string 'monospace'
             // console.log(`RESET: Using fallback font:`, this.font); // Debug fallback
         }


    } else { // type is 'shape'
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']);
        pickedColor = color(random(PALETTE));
        this.content = null; // Shapes don't have text content
        this.textScaleAdjust = 0; // Not applicable to shapes
        this.font = null; // Shapes don't have a font
    }

    this.color = pickedColor;


    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;
  }

   calculateMaxEffectiveDimension() {
        let dimension = this.size || 50; // Default size if size is invalid
        if (this.type === 'text' && this.content && this.content.trim() !== "" && this.content.trim() !== TEXT_OPTIONS[0].trim()) {
             let effectiveTextSize = (this.size || 1) * (this.textScaleAdjust || 0.2);
              // Pass the specific font to getTextBounds
              let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont);
              dimension = sqrt(sq(textBounds.w) + sq(textBounds.h)); // Use diagonal as rough max dimension

        } else if (this.type === 'shape' && this.shapeType) {
             // Estimate max dimension based on shape type and size
             switch(this.shapeType) {
                  case 'circle': dimension = this.size * 2; break; // Diameter
                  case 'square': dimension = this.size * Math.SQRT2; break; // Diagonal
                  case 'triangle': dimension = this.size * 1.6; break; // Estimate based on height/width
                  case 'pentagon': dimension = this.size * 0.7 * 2; break; // Diameter of circumcircle
                  case 'hexagon': dimension = this.size * 2; break; // Diameter of circumcircle
                  default: dimension = this.size * 2; break; // Default to diameter estimate
             }
             // Ensure a minimum size even if calculations fail
             dimension = max(dimension, this.size * 1.5); // Ensure it's at least 1.5x base size
        } else {
            // Fallback if type is unknown or size is invalid
            dimension = this.size || 100;
        }

        dimension = max(dimension, 1); // Ensure dimension is positive

        return dimension;
  }


  update() {
     if (!this.isGrabbed && !this.isPlacing) {
         this.x += this.speedX;
         this.y += this.speedY;

         this.rotation += this.rotationSpeed;

         // Keep rotation within [0, TWO_PI)
         this.rotation = (this.rotation % TWO_PI + TWO_PI) % TWO_PI;
     }
  }

   isReallyOffScreen() {
        let maxEffectiveDimension = this.calculateMaxEffectiveDimension();
        if (isNaN(maxEffectiveDimension) || maxEffectiveDimension <= 0) {
             // If dimension calculation failed, use a large buffer to prevent premature removal
             return this.x < -width || this.x > width * 2 || this.y < -height || this.y > height * 2;
        }
      let effectiveRadius = maxEffectiveDimension / 2 * this.scaleFactor;
      // Use a buffer around the window edges
      let windowBuffer = max(width, height) * 0.5; // Buffer is 50% of the larger window dimension

      return this.x < -windowBuffer - effectiveRadius || this.x > width + windowBuffer + effectiveRadius ||
             this.y < -windowBuffer - effectiveRadius || this.y > height + windowBuffer + effectiveRadius;
  }


  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame;
        let duration = 25; // Reduced from 45 to 25 frames for quicker animation
        if (elapsed <= duration) {
            let t = map(elapsed, 0, duration, 0, 1);
            // Use a combination of ease-out and bounce effect
            let easedT = 1 - pow(1 - t, 2); // Quadratic ease-out
            let bounceT = sin(easedT * PI * 2) * 0.1; // Subtle bounce
            let pulseScale = 1 + easedT * 0.05 + bounceT; // Reduced base scale (5%) plus bounce
            this.tempScaleEffect = pulseScale;
        } else {
            // Animation finished
            this.isPlacing = false;
            this.tempScaleEffect = 1;
        }
    } else if (!this.isPlacing && this.tempScaleEffect !== 1) {
         // If no longer placing, reset scale effect immediately
         this.tempScaleEffect = 1;
    }
  }

   // Display method draws the shape onto a graphics context (main canvas or canvasPG)
   display(graphics, showGrabEffect = false, offsetX = 0, offsetY = 0) {
     // Basic checks for valid graphics context
     if (!graphics || typeof graphics.push !== 'function' || typeof graphics.translate !== 'function' || typeof graphics.rotate !== 'function' || typeof graphics.scale !== 'function') {
        return;
    }

    // Don't draw empty text shapes unless they are grabbed (so you can type in them)
    if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim())) {
         if (!this.isGrabbed || graphics !== this) { // Only draw if grabbed AND drawing on the main canvas (this)
             return;
         }
    }

    graphics.push();
    // Translate relative to the graphics context's origin, accounting for canvas area offset
    graphics.translate(this.x - offsetX, this.y - offsetY);
    graphics.rotate(this.rotation);

    // Apply scale, including the temporary landing effect scale
    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale);

     // Draw grab effect outline if requested and drawing on the main canvas
     if (showGrabEffect && graphics === this) {
         graphics.drawingContext.shadowBlur = 40;
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
         graphics.stroke(255, 255, 255, 200);
         graphics.strokeWeight(3);
         graphics.noFill();
         // Draw the shape primitive for the outline
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
         graphics.drawingContext.shadowBlur = 0; // Reset shadow
    }

    // Draw the main fill of the shape/text
    graphics.fill(this.color);
    graphics.noStroke();

    // Draw the core shape geometry or text
    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
    graphics.pop();
  }

  // Draws the shape's core geometry or text centered at (px, py), with base size psize.
  // Assumes transformations (translate, rotate, scale) are already applied to the 'graphics' context.
  // This function uses methods provided by the graphics context (e.g., graphics.rect, graphics.text).
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        if (!graphics || typeof graphics.rectMode !== 'function' || typeof graphics.text !== 'function') {
             return; // Invalid graphics context
         }

         // Basic validation for size, especially for shapes
         if (!isText && (isNaN(psize) || psize <= 0)) {
             return; // Cannot draw shape with invalid size
         }

        if (isText) {
             // Apply text properties to the provided graphics context
             // Use the shape's assigned font
             let currentFont = this.font;
             // Check if currentFont is a truthy font object (and not the fallback string)
             if (currentFont && currentFont !== baseFont) {
                 if (typeof graphics.textFont === 'function') graphics.textFont(currentFont);
             } else {
                  // Fallback to baseFont string
                  if (typeof graphics.textFont === 'function') graphics.textFont(baseFont);
             }


              if (typeof graphics.textAlign === 'function') {
                 graphics.textAlign(CENTER, CENTER);
              }

             let effectiveTextSize = psize * textScaleAdjust;
             effectiveTextSize = max(effectiveTextSize, 1); // Ensure minimum text size
              if (effectiveTextSize === Infinity || isNaN(effectiveTextSize)) effectiveTextSize = 16; // Fallback size


              if (typeof graphics.textSize === 'function') {
                 graphics.textSize(effectiveTextSize);
              }

             graphics.text(this.content, px, py); // Draw text centered at px, py

         } else { // It's a shape
              graphics.rectMode(CENTER);

             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break;
               case 'square': graphics.rect(px, py, psize, psize); break;
               case 'triangle':
                 graphics.beginShape();
                 // Use the same vertices as getTriangleVertices
                 const height = psize;
                 const sideLength = (2/Math.sqrt(3)) * height;
                 graphics.vertex(px, py - height/2);  // Top vertex
                 graphics.vertex(px - sideLength/2, py + height/2);  // Bottom left
                 graphics.vertex(px + sideLength/2, py + height/2);  // Bottom right
                 graphics.endShape(CLOSE);
                 break;
               case 'pentagon':
                  graphics.beginShape();
                  let sidesP = 5; let radiusP = psize * 0.7;
                  if (isNaN(radiusP) || radiusP <= 0) { break; } // Validate radius
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
                 if (isNaN(radiusH) || radiusH <= 0) { break; } // Validate radius
                 for (let i = 0; i < sidesH; i++) {
                    let angle = TWO_PI / sidesH * i;
                    let sx = cos(angle) * radiusH;
                    let sy = sin(angle) * radiusH;
                    graphics.vertex(px + sx, py + sy);
                 }
                 graphics.endShape(CLOSE);
                 break;
               default:
                 break; // Unknown shape type
             }
         }
   }

  isMouseOver(mx, my) {
       // Basic validation of shape properties
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) ||
           isNaN(this.scaleFactor) || isNaN(this.size) || this.scaleFactor <= 0 || this.size <= 0) {
            return false;
       }

        // Don't detect mouse over for empty text shapes unless grabbed (allows clicking to grab/edit)
        if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) && !this.isGrabbed) {
            return false;
        }

       let currentDisplayScale = this.scaleFactor * this.tempScaleEffect;
       if (currentDisplayScale <= 0) return false;

       // Transform mouse coordinates to the shape's local coordinate system
       let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, currentDisplayScale);
       let localMx = localMouse.x, localMy = localMouse.y;

       if (isNaN(localMx) || isNaN(localMy)) return false; // Transformation failed

        // Calculate local tolerance based on the display scale
        let localTolerance = CLICK_TOLERANCE / currentDisplayScale;
         localTolerance = max(localTolerance, 3); // Ensure a minimum local tolerance

       if (this.type === 'text') {
           let effectiveTextSize = this.size * this.textScaleAdjust;
           if (isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
                return false; // Cannot measure text bounds with invalid size
            }
           // Get text bounds using the shape's specific font
           let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont);
           if (textBounds.w <= 0 || textBounds.h <= 0) return false; // Cannot detect if bounds are invalid

           // Check if local mouse point is within the text bounds (with tolerance)
           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);

       } else { // type is 'shape'
             if (isNaN(this.size) || this.size <= 0) {
                   return false; // Cannot detect shape with invalid size
             }
           // Check collision based on shape type
           switch (this.shapeType) {
              case 'circle':
                 return dist(localMx, localMy, 0, 0) <= this.size + localTolerance;
              case 'square':
                 return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);
              case 'triangle':
                  let triVertices = getTriangleVertices(this.size);
                   if (!Array.isArray(triVertices) || triVertices.length < 3) { return false; }
                  // Check if inside OR near edge
                  if (isPointInConvexPolygon(localMx, localMy, triVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, triVertices, localTolerance);
              case 'pentagon':
                  let pentVertices = getPentagonVertices(this.size);
                  if (!Array.isArray(pentVertices) || pentVertices.length < 5) { return false; }
                   // Check if inside OR near edge
                  if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance);
              case 'hexagon':
                   let hexVertices = getHexagonVertices(this.size);
                   if (!Array.isArray(hexVertices) || hexVertices.length < 6) { return false; }
                   // Check if inside OR near edge
                  if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance);
              default:
                  // Fallback for unknown shape type (e.g., treat as circle)
                   return dist(localMx, localMy, 0, 0) <= this.size * 0.7 + localTolerance;
           }
       }
    }

  solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}


function preload() {
   baseFont = 'monospace'; // Default fallback font string

  // --- START: Load ALL specific fonts and logo ---
  // Providing empty function callbacks to prevent TypeError and handle async loading
  // ADDED: Push loaded font object to loadedFontsList in the success callback
  fontBangersRegular = loadFont('assets/Bangers-Regular.ttf', (font) => {console.log('Font loaded: Bangers-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: Bangers-Regular', err);});
  fontBoogalooRegular = loadFont('assets/Boogaloo-Regular.ttf', (font) => {console.log('Font loaded: Boogaloo-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: Boogaloo-Regular', err);});
  fontBreeSerifRegular = loadFont('assets/BreeSerif-Regular.ttf', (font) => {console.log('Font loaded: BreeSerif-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: BreeSerif-Regular', err);});
  fontCaveatBrushRegular = loadFont('assets/CaveatBrush-Regular.ttf', (font) => {console.log('Font loaded: CaveatBrush-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: CaveatBrush-Regular', err);});
  fontCherryBombOneRegular = loadFont('assets/CherryBombOne-Regular.ttf', (font) => {console.log('Font loaded: CherryBombOne-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: CherryBombOne-Regular', err);});
  fontCinzelDecorativeBlack = loadFont('assets/CinzelDecorative-Black.ttf', (font) => {console.log('Font loaded: CinzelDecorative-Black'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: CinzelDecorative-Black', err);});
  fontCinzelDecorativeBold = loadFont('assets/CinzelDecorative-Bold.ttf', (font) => {console.log('Font loaded: CinzelDecorative-Bold', ); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: CinzelDecorative-Bold', err);});
  fontCinzelDecorativeRegular = loadFont('assets/CinzelDecorative-Regular.ttf', (font) => {console.log('Font loaded: CinzelDecorative-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: CinzelDecorative-Regular', err);});
  fontDynaPuffBold = loadFont('assets/DynaPuff-Bold.ttf', (font) => {console.log('Font loaded: DynaPuff-Bold'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: DynaPuff-Bold', err);});
  fontDynaPuffMedium = loadFont('assets/DynaPuff-Medium.ttf', (font) => {console.log('Font loaded: DynaPuff-Medium'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: DynaPuff-Medium', err);});
  fontDynaPuffRegular = loadFont('assets/DynaPuff-Regular.ttf', (font) => {console.log('Font loaded: DynaPuff-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: DynaPuff-Regular', err);});
  fontInterBold = loadFont('assets/Inter-Bold.ttf', (font) => {console.log('Font loaded: Inter-Bold'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: Inter-Bold', err);});
  fontInterRegular = loadFont('assets/Inter-Regular.ttf', (font) => {console.log('Font loaded: Inter-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: Inter-Regular', err);});
  fontPixelifySansRegular = loadFont('assets/PixelifySans-Regular.ttf', (font) => {console.log('Font loaded: PixelifySans-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: PixelifySans-Regular', err);});
  fontSenBold = loadFont('assets/Sen-Bold.ttf', (font) => {console.log('Font loaded: Sen-Bold'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: Sen-Bold', err);});
  fontSenMedium = loadFont('assets/Sen-Medium.ttf', (font) => {console.log('Font loaded: Sen-Medium'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: Sen-Medium', err);});
  fontSenRegular = loadFont('assets/Sen-Regular.ttf', (font) => {console.log('Font loaded: Sen-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: Sen-Regular', err);});
  fontShareTechMonoRegular = loadFont('assets/ShareTechMono-Regular.ttf', (font) => {console.log('Font loaded: ShareTechMono-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: ShareTechMono-Regular', err);});
  fontVT323Regular = loadFont('assets/VT323-Regular.ttf', (font) => {console.log('Font loaded: VT323-Regular'); loadedFontsList.push(font);}, (err) => {console.error('Failed to load font: VT323-Regular', err);});

  // Provided empty function callbacks for loadImage as well
  logoImage = loadImage('assets/placeholder-logo.svg', () => {console.log('Logo loaded');}, (err) => {console.error('Failed to load logo', err);});

  // --- END: Variables for ALL Loaded Fonts ---
}
let canvasPG; // Graphics buffer for the central canvas area
let initialPositioningDone = false; // Flag to ensure UI positioning happens once

function setup() {
  createCanvas(windowWidth, windowHeight);
    if (width <= 0 || height <= 0) {
         console.warn("Canvas dimensions are zero or negative. Skipping setup.");
         return;
     }

  SNAP_INCREMENT_RADIANS = radians(15); // Snap rotation to 15 degrees

    // Initialize the central canvas graphics buffer
    canvasPG = createGraphics(10, 10); // Start small, will be resized in positionDOMElementsAndCanvasPG
    canvasPG.background(255);

    // Initialize the text measurement graphics buffer
    textMeasurePG = createGraphics(1, 1);
    // Set initial text properties for measurement buffer
    if (typeof textMeasurePG.textFont === 'function') textMeasurePG.textFont(baseFont); // Use baseFont string initially
    if (typeof textMeasurePG.textAlign === 'function') textMeasurePG.textAlign(CENTER, CENTER);
    if (typeof textMeasurePG.textSize === 'function') textMeasurePG.textSize(16); // Default size for measurement setup

    // REMOVED: The loop that tried to filter fonts here.
    // The loadedFontsList is now populated asynchronously in preload callbacks.
    console.log(`SETUP: Initial loadedFontsList size: ${loadedFontsList.length}. Will populate as fonts load.`);


  // Create DOM elements
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
                .style("box-sizing", "border-box"); // Include padding/border in element's total width/height

  // Add event listener for Enter key on the input field
  inputElement.elt.addEventListener('keypress', function(event) {
    // Check if the key pressed was Enter and the event originated from this input element
    if (event.key === 'Enter' && event.target === this) {
      addNewTextShapeFromInput();
      event.preventDefault(); // Prevent default form submission or newline
    }
  });

  savePNGButton = createButton("SAVE PNG");
  saveHighResPNGButton = createButton("SAVE HI-RES PNG");
  clearButton = createButton("CLEAR");
  refreshButton = createButton("RELOAD FLOATING"); // Changed text for clarity

   // Apply consistent styles to buttons
   const baseButtonStyle = {
       padding: "5px 10px",
       border: "1px solid #888",
       "border-radius": "15px",
       "background-color": "rgba(200, 200, 200, 0.7)",
       color: "rgb(50, 50, 50)",
       outline: "none",
       cursor: "pointer",
       "font-size": "14px", // Added font size for consistency
       "box-sizing": "border-box" // Include padding/border
   };

   [savePNGButton, saveHighResPNGButton, clearButton, refreshButton].forEach(btn => {
       if (btn) { // Check if button was successfully created
           Object.keys(baseButtonStyle).forEach(styleKey => {
                btn.style(styleKey, baseButtonStyle[styleKey]);
           });
             // Add hover effects
             btn.elt.addEventListener('mouseover', function() { this.style.backgroundColor = 'rgba(220, 220, 220, 0.9)'; });
             btn.elt.addEventListener('mouseout', function() { this.style.backgroundColor = baseButtonStyle["background-color"]; });
       }
   });

   // Assign click handlers
   if(savePNGButton) savePNGButton.elt.addEventListener('click', saveCanvasAreaAsPNG);
   if(saveHighResPNGButton) saveHighResPNGButton.elt.addEventListener('click', saveCanvasAreaAsHighResPNG);
   if(clearButton) clearButton.elt.addEventListener('click', restartAll);
   if(refreshButton) refreshButton.elt.addEventListener('click', resetFloatingShapes); // Changed function name for clarity


   initialPositioningDone = false; // Will be set true after first positioning

  // Create initial floating shapes
  // These shapes might initially use the fallback font if loadFont callbacks haven't run yet.
  // New shapes created later will use loaded fonts as they become available.
  while (shapes.length < 30) { shapes.push(new FloatingShape()); }
}


function draw() {
    // Position UI elements and resize canvasPG only once or on resize
    if (!initialPositioningDone) {
        positionDOMElementsAndCanvasPG();
        initialPositioningDone = true;
    }

  background(0); // Draw black background for the whole window

  // --- Update shapes ---
  for (let i = shapes.length - 1; i >= 0; i--) {
      let shape = shapes[i];
     if (!shape.isGrabbed && !shape.isPlacing) { shape.update(); } // Update position/rotation if not grabbed/placing
     shape.updateLanding(); // Update landing animation scale
     // Remove shapes that are far off-screen and not grabbed/placing
     if (!shape.isGrabbed && !shape.isPlacing && shape.isReallyOffScreen()) {
          shapes.splice(i, 1);
      }
  }

  // Add new shapes if the count drops below a threshold
  // These new shapes will pick from the loadedFontsList which is now populated asynchronously
  while (shapes.length < 20) { shapes.push(new FloatingShape()); }


  // --- Update placed items ---
  for (let item of placedItems) {
      item.updateLanding(); // Update landing animation for placed items
  }

  // --- Draw floating shapes on main canvas (behind artboard) ---
  // Draw shapes that are not currently grabbed
  for (let i = 0; i < shapes.length; i++) {
      let shape = shapes[i];
      if (shape !== grabbedItem) {
          shape.display(this, false, 0, 0); // Draw on main canvas (this), no grab effect, no offset
      }
  }


  // --- Central White Canvas Area Drawing (Rendered to canvasPG) ---
  if(canvasPG){
     canvasPG.clear(); // Clear the buffer
     canvasPG.background(255); // Draw white background for the artboard

    // Draw placed items onto canvasPG
    for (let i = 0; i < placedItems.length; i++) {
        let item = placedItems[i];
        // Draw on canvasPG, no grab effect, with offset (canvas area position relative to window)
        item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
    }

    // Draw the canvasPG buffer onto the main canvas at the calculated position
    image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
  } else {
       // Display error message if canvasPG is not available
       fill(255, 100, 100, 100);
       rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
       fill(0); textAlign(CENTER, CENTER); text("Error: Canvas area buffer missing.", CANVAS_AREA_X + CANVAS_AREA_W/2, CANVAS_AREA_Y + CANVAS_AREA_H/2);
  }

  // Draw border around canvas area on the main canvas
  stroke(200);
  strokeWeight(1);
  noFill();
   rect(CANVAS_AREA_X + 0.5, CANVAS_AREA_Y + 0.5, CANVAS_AREA_W - 1, CANVAS_AREA_H - 1);


  // Draw grabbed item on top of everything else on the main canvas
  if (grabbedItem) {
     // Smoothly move grabbed item towards mouse position
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.4);
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.4);
     grabbedItem.solidify(); // Stop its own movement
     grabbedItem.isPlacing = false; // Cancel landing animation if it was placing
      // Update text content from input field if it's a text item
      if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value();
      }
     // Draw on main canvas (this), with grab effect, no offset
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

    // Check if logoImage is loaded and valid
    if (logoImage && typeof logoImage.width === 'number' && logoImage.width > 0) {
         let logoAspectRatio = logoImage.height / logoImage.width;
         let logoTargetHeight = logoTargetWidth * logoAspectRatio;

         let logoDrawX = logoX;
         let logoDrawY = logoCenterY - logoTargetHeight / 2;

         imageMode(CORNER); // Draw image from its top-left corner
         image(logoImage, logoDrawX, logoDrawY, logoTargetWidth, logoTargetHeight);

    } else {
         // Draw fallback text if logo failed to load
         fill(50);
         textSize(20);
         textAlign(LEFT, CENTER);
          // Use textFont directly in the main drawing context
          // Use Sen-Regular if loaded, otherwise fallback string
          if (fontSenRegular && fontSenRegular !== baseFont) { // Check if it's a truthy font object
              textFont(fontSenRegular);
          } else {
              textFont(baseFont); // Use monospace string
          }
         text("COMPOSTER", logoX, logoCenterY); // Use "COMPOSTER" as fallback text
    }
    // --- END: Draw the Header Logo ---
}

// Positions the central canvas area and UI elements based on window size
function positionDOMElementsAndCanvasPG() {

     const minCanvasW = 300; // Minimum width for the canvas area
     // Calculate target width, keeping it within limits and responsive to window width
     const adjustedCanvasW = min(CANVAS_AREA_W_BASE, max(minCanvasW, windowWidth * 0.95));

    let targetCANVAS_AREA_W = adjustedCanvasW;
    let targetCANVAS_AREA_H = adjustedCanvasW * (5 / 4); // Maintain 4:5 aspect ratio

    let minSideMargin = 15; // Minimum margin on the sides
    // Calculate X position to center the canvas area horizontally, respecting min margin
    let targetCANVAS_AREA_X = max(minSideMargin, (width / 2 - targetCANVAS_AREA_W / 2));

    let padY = 20; // Padding below the header
    let targetCANVAS_AREA_Y = HEADER_HEIGHT + padY;

     // Check if the calculated height fits within the available vertical space
     const availableH = height - HEADER_HEIGHT - padY - 15; // Space below header minus padding/margin
     const requiredH_forW = targetCANVAS_AREA_W * (5/4);

     if (requiredH_forW > availableH && availableH > 100) {
        // If height is too large, scale down based on available height
        targetCANVAS_AREA_H = availableH;
        targetCANVAS_AREA_W = targetCANVAS_AREA_H * (4/5); // Recalculate width based on available height

        // Re-validate width constraints after scaling by height
        targetCANVAS_AREA_W = max(minCanvasW, min(targetCANVAS_AREA_W, windowWidth * 0.95));
         // Re-center horizontally based on the new width
        targetCANVAS_AREA_X = max(minSideMargin, (width / 2 - targetCANVAS_AREA_W / 2));
     }

     // Assign final calculated dimensions and position
     CANVAS_AREA_W = targetCANVAS_AREA_W;
     CANVAS_AREA_H = targetCANVAS_AREA_H;
     CANVAS_AREA_X = targetCANVAS_AREA_X;
     CANVAS_AREA_Y = targetCANVAS_AREA_Y;


    if (canvasPG && (canvasPG.width !== CANVAS_AREA_W || canvasPG.height !== CANVAS_AREA_H)) {
         if (CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
              canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H);
               canvasPG.background(255); // Clear with white after resize
         } else {
               // If dimensions are invalid, remove canvasPG to prevent errors
               if (canvasPG) { try { canvasPG.remove(); } catch(e) {} } canvasPG = null;
         }
     } else if (!canvasPG && CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
          // If canvasPG didn't exist but dimensions are valid, create it
          canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
          canvasPG.background(255);
     }


     // --- Ensure textMeasurePG is initialized or re-initialized defensively ---
     // This buffer is crucial for getTextBounds
     if (!textMeasurePG || typeof textMeasurePG.textWidth !== 'function') {
          if (textMeasurePG) { try { textMeasurePG.remove(); } catch(e) {} }
          try {
               textMeasurePG = createGraphics(10, 10); // Small size is fine for measurement
               // Re-apply essential text properties
               if (typeof textMeasurePG.textFont === 'function') textMeasurePG.textFont(baseFont);
               if (typeof textMeasurePG.textAlign === 'function') textMeasurePG.textAlign(CENTER, CENTER);
               if (typeof textMeasurePG.textSize === 'function') textMeasurePG.textSize(16);
          } catch(e) {
               textMeasurePG = null; // Set to null if creation fails
               console.error("Failed to create textMeasurePG graphics buffer.");
          }
     }


     // Position Input Element
     let headerCenterY = HEADER_HEIGHT / 2;
     if (inputElement) {
          // Get actual rendered height of the input element
          let inputHeight = inputElement.elt.offsetHeight || 30; // Use 30 as a fallback
          inputElement.position(CANVAS_AREA_X, headerCenterY - inputHeight / 2);
         inputElement.size(CANVAS_AREA_W); // Make input width match canvas width
     }

     // Position Buttons
     // Helper to get button's rendered width (including padding/border)
     const btnOuterWidth = (btn) => { if (!btn || !btn.elt) return 0; return btn.elt.offsetWidth || 80; };

    const buttonSpacing = 8; // Space between buttons
    const rightMargin = 15; // Margin from the right edge

    // Get widths of all buttons
    let savePNGBtnW = btnOuterWidth(savePNGButton);
    let saveHighResPNGBtnW = btnOuterWidth(saveHighResPNGButton);
    let clearBtnW = btnOuterWidth(clearButton);
    let refreshBtnW = btnOuterWidth(refreshButton);

    // Create a list of buttons to position, in order from left to right
    let allButtons = [refreshButton, clearButton, savePNGButton, saveHighResPNGButton].filter(btn => btn !== null);
    let totalButtonWidths = allButtons.reduce((sum, btn) => sum + btnOuterWidth(btn), 0);
    let numButtons = allButtons.length;
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0); // Total space between buttons

     // Calculate the starting X position for the block of buttons (right-aligned)
     let buttonBlockStartX = width - rightMargin - (totalButtonWidths + totalSpacing);

     // Ensure buttons don't overlap with the input element
     let inputRightEdge = inputElement ? inputElement.position().x + inputElement.size().width : 0;
     let minButtonStartX = inputRightEdge + 30; // Minimum space between input and buttons

     buttonBlockStartX = max(buttonBlockStartX, minButtonStartX); // Use the larger of the calculated start or minimum start

     // Calculate the vertical position for the buttons (centered in header)
     let buttonHeight = (savePNGButton ? savePNGButton.elt.offsetHeight || 30 : HEADER_HEIGHT / 4); // Get actual height or fallback
     let buttonPadY_buttons = headerCenterY - buttonHeight / 2;

    let currentButtonX = buttonBlockStartX; // Start positioning from the calculated block start

    // Position each button sequentially
    if (refreshButton) { refreshButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(refreshButton) + buttonSpacing; }
    if (clearButton) { clearButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(clearButton) + buttonSpacing; }
    if (savePNGButton) { savePNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(savePNGButton) + buttonSpacing; }
    if (saveHighResPNGButton) { saveHighResPNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += btnOuterWidth(saveHighResPNGButton) + buttonSpacing; }
}

// Handles window resizing
function windowResized() {
     // Only resize if window dimensions are positive and have actually changed
     if (windowWidth > 0 && windowHeight > 0 && (windowWidth !== width || windowHeight !== height)) {
        resizeCanvas(windowWidth, windowHeight);
         positionDOMElementsAndCanvasPG(); // Reposition elements and canvasPG
     } else {
         return; // No effective resize
     }
}

function mousePressed() {
    // Ignore clicks in the header area
    if (mouseY < HEADER_HEIGHT) {
        // Check if click was on a DOM element in the header (e.g. button)
        // If so, allow default behavior. Otherwise, if on empty header space, do nothing.
        let clickedOnHeaderDOM = false;
        if (event && event.target) {
            if(event.target === inputElement.elt ||
               (savePNGButton && event.target === savePNGButton.elt) ||
               (saveHighResPNGButton && event.target === saveHighResPNGButton.elt) ||
               (clearButton && event.target === clearButton.elt) ||
               (refreshButton && event.target === refreshButton.elt)) {
                clickedOnHeaderDOM = true;
                // Add this: Focus canvas after button click
                if (canvas && canvas.elt && typeof canvas.elt.focus === 'function') {
                    setTimeout(() => canvas.elt.focus(), 0);
                }
            }
        }
        return clickedOnHeaderDOM; // Allow default if on a UI element, else consume blah blah blah
    }
 
     if (grabbedItem) {
        if (grabbedItem.isMouseOver(mouseX, mouseY)) {
             // Item already grabbed, click on it again.
             // Try to focus canvas for keyboard control
             // --- CORRECTED CHECK ---
             if (canvas && canvas.elt && typeof canvas.elt.focus === 'function') {
                canvas.elt.focus();
             }
             // --- END CORRECTED CHECK ---
             return false;
        } else {
        // ...
        }
    }
 
    // Attempt to focus the canvas element whenever a mouse press occurs outside the header
    // that might lead to an item grab. This prepares for keyboard interaction.
   // Attempt to focus the canvas element whenever a mouse press occurs outside the header
   // that might lead to an item grab. This prepares for keyboard interaction.
   // --- CORRECTED CHECK ---
   if (canvas && canvas.elt && typeof canvas.elt.focus === 'function') {
    canvas.elt.focus();
}
// --- END CORRECTED CHECK ---
 
    // Check for clicks on placed items
    if (isMouseOverCanvasArea(mouseX, mouseY)) {
        for (let i = placedItems.length - 1; i >= 0; i--) {
             if (placedItems[i].isMouseOver(mouseX, mouseY)) {
                 grabbedItem = placedItems[i];
                 grabbedItem.isGrabbed = true;
                 grabbedItem.isPlacing = false;
                 grabbedItem.solidify();
 
                 let temp = placedItems.splice(i, 1)[0];
                 shapes.push(temp); // Move to shapes to be drawn on top
 
                 if (grabbedItem.type === 'text') {
                     inputElement.value(grabbedItem.content || '');
                     inputElement.attribute('placeholder', '');
                     // DO NOT FOCUS inputElement.elt.focus();
                 } else {
                     inputElement.value('');
                     inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                     if (document.activeElement === inputElement.elt) inputElement.elt.blur();
                 }
                 // Canvas focus should already be attempted above.
                 return false;
            }
        }
    }
 
   // Check for clicks on floating shapes
   for (let i = shapes.length - 1; i >= 0; i--) {
       if (!shapes[i].isGrabbed) {
           if (shapes[i].isMouseOver(mouseX, mouseY)) {
               grabbedItem = shapes[i];
               grabbedItem.isGrabbed = true;
               grabbedItem.isPlacing = false;
               grabbedItem.solidify();
 
               let temp = shapes.splice(i, 1)[0];
               shapes.push(temp); // Move to end of shapes for draw order
 
               if (grabbedItem.type === 'text') {
                  inputElement.value(grabbedItem.content || '');
                  inputElement.attribute('placeholder', '');
                  // DO NOT FOCUS inputElement.elt.focus();
               } else {
                  inputElement.value('');
                  inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                  if (document.activeElement === inputElement.elt) inputElement.elt.blur();
               }
               // Canvas focus should already be attempted above.
               return false;
           }
       }
   }
    // If click was not on header UI, not on an item, and no item grabbed:
    // Consider deselecting any focused input.
    if (document.activeElement === inputElement.elt) {
         inputElement.elt.blur();
    }
    return true; // Allow default if no interaction
 }

// Handles mouse release events
function mouseReleased() {
  if (grabbedItem) {
    let wasTextItem = grabbedItem.type === 'text';
    grabbedItem.isGrabbed = false; // Release the grab

    // Check if the item was released over the central canvas area
    if (isMouseOverCanvasArea(grabbedItem.x, grabbedItem.y)) {
      // Item was dropped onto the canvas area, solidify and place it

      // If it's a text item, update its content from the input field
      if (wasTextItem) {
           let content = inputElement.value().trim();
           // If text is empty or placeholder, remove the item instead of placing
           if(content === "" || content === TEXT_OPTIONS[0].trim()) {
               // Remove from shapes array
               shapes = shapes.filter(s => s !== grabbedItem);
               grabbedItem = null; // Clear grabbed item reference
                // Reset input field
                inputElement.value('');
                inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                inputElement.elt.blur();
               return; // Exit the function
           } else {
              grabbedItem.content = content; // Update content
           }
      }

      grabbedItem.solidify(); // Ensure it stops moving

      // Snap rotation if SNAP_INCREMENT_RADIANS is set
      if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      }

      // Remove from shapes array (it's now placed)
      shapes = shapes.filter(s => s !== grabbedItem);
      // Add to placedItems array
      placedItems.push(grabbedItem);

      // Start the landing animation
      grabbedItem.isPlacing = true;
      grabbedItem.landFrame = frameCount;


    } else {
         // Item was dropped outside the canvas area, let it float away

         // If it's a text item, update its content from the input field
         if (wasTextItem) {
             let content = inputElement.value().trim();
             // If text is empty or placeholder, remove the item
             if (content === "" || content === TEXT_OPTIONS[0].trim()) {
                  shapes = shapes.filter(s => s !== grabbedItem);
                  grabbedItem = null;
                   inputElement.value('');
                   inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                   inputElement.elt.blur();
                 return;
             } else {
                  grabbedItem.content = content; // Update content
             }
         }

          // Give it random speeds to float away
          grabbedItem.speedX = random(-1.5, 1.5);
          grabbedItem.speedY = random(-1.5, 1.5);
          grabbedItem.rotationSpeed = random(-0.003, 0.003);
          grabbedItem.isPlacing = false; // Ensure no landing animation outside canvas
    }

    // Clear the grabbed item reference and reset input field after handling
    if (grabbedItem !== null) { // Check if it wasn't removed (empty text dropped on canvas)
         grabbedItem = null;
         inputElement.value('');
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
         inputElement.elt.blur();
     }
  }
}

// Handles double-click events
function doubleClicked() {
    // Only process double clicks within the canvas area
    if (!isMouseOverCanvasArea(mouseX, mouseY)) return true;

    // Check placed items from top-most down
    for (let i = placedItems.length - 1; i >= 0; i--) {
        let item = placedItems[i];
        // If the double click is over a placed item
        if (item.isMouseOver(mouseX, mouseY)) {
            // Move the item to the bottom of the placedItems list (send to back)
            let itemToSendToBack = placedItems.splice(i, 1)[0];
            placedItems.unshift(itemToSendToBack);
            itemToSendToBack.solidify(); // Ensure it stays placed
            return false; // Prevent default behavior
        }
    }
     return true; // Allow default behavior if no item was double-clicked
}

// Handles mouse wheel events for rotation
function mouseWheel(event) {
   let isOverCanvasArea = isMouseOverCanvasArea(mouseX, mouseY);

    // If an item is grabbed OR the mouse is over the canvas area (to rotate placed items)
    if (grabbedItem || isOverCanvasArea) {
         let itemToRotate = grabbedItem;
         // If no item is grabbed but mouse is over canvas, find the top-most placed item
         if (!itemToRotate && isOverCanvasArea) {
             for (let i = placedItems.length - 1; i >= 0; i--) {
                  if (placedItems[i].isMouseOver(mouseX, mouseY)) {
                       itemToRotate = placedItems[i];
                       break; // Found the top-most, stop searching
                  }
             }
         }

         // If an item was found (grabbed or placed under mouse)
         if (itemToRotate) {
            // Rotate based on mouse wheel delta
            itemToRotate.rotation += event.delta * 0.002;
            // If rotating a placed item, snap the angle immediately
            if (!grabbedItem && SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
                 itemToRotate.rotation = snapAngle(itemToRotate.rotation, SNAP_INCREMENT_RADIANS);
            }
             return false; // Prevent default scrolling
         }
    }
    return true; // Allow default scrolling if not interacting with items
}

// Handles key press events
function keyPressed(event) {
    // If the input element is focused, let it handle typing (including Ctrl+A, Ctrl+C etc. in the input)
    if (document.activeElement === inputElement.elt) {
        // If Enter is pressed in the input, your existing listener on inputElement handles it.
        // Browser default for Ctrl + =/- in an input field is NOT zoom, so this path is likely okay.
        return true;
    }

    // If focus is on some other interactive element (not body, not canvas, not our input), let it be.
    if (document.activeElement !== document.body && document.activeElement !== canvas.elt) {
        return true;
    }

    if (grabbedItem) {
        const scaleIncrement = 1.08;
        const scaleDecrement = 1 / scaleIncrement;
        const minScale = 0.05;
        const maxScale = 10.0;

        if (keyIsDown(CONTROL)) {
            // --- START: Attempt to prevent default for ANY Ctrl combo if item is grabbed ---
            let processedCtrlKey = false; // Flag to see if we specifically handled a combo
            // --- END ---

            // Check for Ctrl + Equals Key OR Ctrl + Numpad Plus for scale up
            if (key === '=' || keyCode === 107) { // 107 Numpad Add
                grabbedItem.scaleFactor *= scaleIncrement;
                grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, maxScale);
                processedCtrlKey = true;
            }
            // Check for Ctrl + Hyphen Key OR Ctrl + Numpad Minus for scale down
            else if (key === '-' || keyCode === 109) { // 109 Numpad Subtract
                grabbedItem.scaleFactor *= scaleDecrement;
                grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, minScale);
                processedCtrlKey = true;
            }
            // Example: Could add Ctrl+D for duplicate here
            // else if ((key === 'd' || key === 'D') && !processedCtrlKey) { /* duplicate logic */ processedCtrlKey = true; }


            // --- If any Ctrl+key was specifically processed OR even if not, but Ctrl is down while grabbed ---
            // We want to prevent default browser actions.
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault(); // PREVENT BROWSER DEFAULTS FOR CTRL KEYS (zoom, print, find etc.)
            }
            return false; // Consume the event as we are in a "grabbed item + Ctrl" context
        }
        // ... (rest of the code for NO CONTROL KEY)
        else { // CONTROL key is NOT pressed
            if (keyCode === DELETE) {
                shapes = shapes.filter(s => s !== grabbedItem);
                placedItems = placedItems.filter(s => s !== grabbedItem);
                let wasTextInput = grabbedItem.type === 'text';
                grabbedItem = null;
                inputElement.value('');
                inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                if (wasTextInput || document.activeElement === inputElement.elt) { // Blur if it was text or if input had focus
                    inputElement.elt.blur();
                }
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault(); // Prevent back navigation on some browsers for DELETE
                }
                return false;
            }

            if (grabbedItem.type === 'text') {
                if (keyCode === BACKSPACE) {
                    if (grabbedItem.content.length > 0) {
                        grabbedItem.content = grabbedItem.content.slice(0, -1);
                        inputElement.value(grabbedItem.content); // Sync input
                    }
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault(); // Prevent browser back navigation
                    }
                    return false;
                } else if (key.length === 1 && !keyIsDown(ALT) && !keyIsDown(META)) { // Printable characters, ignore Alt+key or Cmd+key
                    grabbedItem.content += key;
                    inputElement.value(grabbedItem.content); // Sync input
                    // No preventDefault usually, as we want the char. Returning false consumes for p5.
                    return false;
                }
                // For other non-Ctrl, non-Delete, non-Backspace, non-printable keys on TEXT item
                // (e.g., Arrow keys, Home, End, PageUp/Down, Enter, Tab if not handled by input focus)
                // Consume to prevent default browser actions like scrolling or changing focus.
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                return false;
            }

            // If it's a SHAPE (not text) and a non-Ctrl key is pressed, consume
            // (e.g. to prevent typing 'a' from doing something if a shape is held).
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault();
            }
            return false;
        }
    }

    // If no item is grabbed and the key wasn't handled above, allow default.
    return true;
}

// Creates a new text shape from the input field content and adds it to floating shapes
function addNewTextShapeFromInput() {
    let currentText = inputElement.value();
    // Validate input text
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
         // Flash border red to indicate invalid input
         inputElement.style("border-color", "red");
         setTimeout(() => inputElement.style("border-color", "#ccc"), 500);
         inputElement.value(''); // Clear input
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore placeholder
         inputElement.elt.focus(); // Keep focus on input
         return; // Stop here if input is invalid
    }

    let newTextShape = new FloatingShape();

    // Override properties set by reset() for a text shape created from input
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim();
    newTextShape.shapeType = 'none'; // No polygon shape for text

    // Assign size and scale based on a category (e.g., medium)
    let category = sizeCategories.find(cat => cat.name === 'medium') || { sizeRange: [100, 200], scaleRange: [1.0, 1.5], textScaleAdjust: 0.2 };
    newTextShape.size = random(category.sizeRange[0] * 0.8, category.sizeRange[1] * 1.2); // Slightly wider size range
    newTextShape.scaleFactor = 1.0; // Start with scale 1
    newTextShape.textScaleAdjust = category.textScaleAdjust;

     // Pick a color, trying to avoid very light colors on the black background
     let pickedColor;
     let attempts = 0;
     do {
         pickedColor = color(random(PALETTE));
         let b = brightness(pickedColor);
         // Retry if brightness is too high, unless many attempts have been made
         if (b > 200 && attempts < 5) continue;
         break; // Accept color if not too bright or after several attempts
     } while (attempts < 10);

      // Final fallback if the loop somehow picked a bright color
      if (brightness(pickedColor) > 200) {
           pickedColor = color(random(['#0000FE', '#E70012', '#41AD4A', '#000000', '#222222'])); // Pick a guaranteed dark color
      }
     newTextShape.color = pickedColor;


    // Assign a random loaded font from the list
    if (loadedFontsList.length > 0) {
        newTextShape.font = random(loadedFontsList); // Pick a random p5.Font object
         // console.log(`addNewTextShapeFromInput: Assigned font:`, newTextShape.font ? newTextShape.font.font.names.postscriptName : 'Fallback'); // Debug font name
    } else {
        newTextShape.font = baseFont; // Fallback to the string 'monospace'
         // console.log(`addNewTextShapeFromInput: Using fallback font:`, newTextShape.font); // Debug fallback
    }


     // --- Apply Custom SPAWN LOCATION for new text (near artboard sides), OVERRIDING reset() position/speed ---
     // This makes text added from input appear near the artboard for easy placement
     let spawnMargin = 40; // Margin around the canvas area
     let spawnedCustom = false; // Flag to track if custom positioning was applied

     // Calculate available space left and right of the canvas area
     let leftSpace = CANVAS_AREA_X;
     let rightSpace = width - (CANVAS_AREA_X + CANVAS_AREA_W);

     let spawnSide;
     // Prefer spawning on the side with more space
     if (leftSpace > rightSpace * 1.5) {
         spawnSide = 'left';
     } else if (rightSpace > leftSpace * 1.5) {
         spawnSide = 'right';
     } else {
         spawnSide = random() > 0.5 ? 'right' : 'left'; // Random if space is similar
     }

     // Position the shape on the chosen side if there's enough space
     if (spawnSide === 'left' && leftSpace > spawnMargin * 2) {
         newTextShape.x = random(spawnMargin, CANVAS_AREA_X - spawnMargin);
         newTextShape.speedX = random(0.5, 1.5); // Move towards the canvas area
         spawnedCustom = true;
     } else if (rightSpace > spawnMargin * 2) {
         newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W + spawnMargin, width - spawnMargin);
         newTextShape.speedX = random(-1.5, -0.5); // Move towards the canvas area
         spawnedCustom = true;
     }

     // If a custom horizontal position was set, set a vertical position and speeds
     if (spawnedCustom) {
          // Position vertically within or near the canvas area height
          newTextShape.y = random(CANVAS_AREA_Y - spawnMargin, CANVAS_AREA_Y + CANVAS_AREA_H + spawnMargin);
          // Ensure it's not in the header area
          newTextShape.y = max(newTextShape.y, HEADER_HEIGHT + spawnMargin);
          // Ensure it's within window bounds vertically
          newTextShape.y = max(spawnMargin, min(newTextShape.y, height - spawnMargin));

          newTextShape.speedY = random(-0.5, 0.5); // Slow vertical movement
          newTextShape.rotation = random(TWO_PI); // Random initial rotation
          newTextShape.rotationSpeed = random(-0.001, 0.001); // Slow rotation speed

     }
    // --- End Custom SPAWN LOCATION ---

    newTextShape.isGrabbed = false;
    newTextShape.isPlacing = false; // Not placing immediately

    shapes.push(newTextShape); // Add the new shape to the floating shapes list

    // Clear input field and restore placeholder
    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    inputElement.elt.focus(); // Keep focus on input for next text
}

// Helper function to check if a point is within the central canvas area
function isMouseOverCanvasArea(pX, pY) {
     // Use mouseX/mouseY if pX/pY are not provided
     const checkX = pX === undefined ? mouseX : pX;
     const checkY = pY === undefined ? mouseY : pY;

    // Check if the point is within the bounds of the canvas area rectangle
    return checkX >= CANVAS_AREA_X && checkX <= CANVAS_AREA_X + CANVAS_AREA_W &&
           checkY >= CANVAS_AREA_Y && checkY <= CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Snaps an angle (in radians) to the nearest increment
function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0 || isNaN(incrementRadians)) return angleRadians;
    // Normalize angle to be within [0, TWO_PI)
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI;
    // Calculate the number of increments
    let numIncrements = round(angleRadians / incrementRadians);
    // Calculate the snapped angle
    let snapped = numIncrements * incrementRadians;
    // Normalize the snapped angle again
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI;
    return snapped;
}

// Generates a timestamp string for filenames
function generateTimestampString() {
    let d = new Date();
    return d.getFullYear() + nf(d.getMonth() + 1, 2) + nf(d.getDate(), 2) + '_' + nf(d.getHours(), 2) + nf(d.getMinutes(), 2) + nf(d.getSeconds(), 2);
}

// Saves the central canvas area as a standard resolution PNG
function saveCanvasAreaAsPNG() {
    // Check if canvasPG is available and valid
    if (!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) {
        alert("Error: Cannot save standard PNG. Canvas area buffer is not available or invalid.");
        console.error("saveCanvasAreaAsPNG: canvasPG is invalid or has zero dimensions.");
        return;
    }

    // Create a temporary graphics buffer to draw the canvas area onto
    // This allows adding a border without affecting the live canvasPG
    let saveBuffer = createGraphics(canvasPG.width, canvasPG.height);
    saveBuffer.image(canvasPG, 0, 0); // Copy the canvas area content

    // Draw a border onto the save buffer
    saveBuffer.push();
    saveBuffer.stroke(0);
    saveBuffer.strokeWeight(1);
    saveBuffer.noFill();
    // Draw rectangle slightly inset to keep border within bounds
    saveBuffer.rect(0.5, 0.5, saveBuffer.width - 1, saveBuffer.height - 1);
    saveBuffer.pop();

    // Save the temporary buffer
    saveCanvas(saveBuffer, 'myArtboard_stdres_' + generateTimestampString() + '.png');

    // Remove the temporary buffer
    if (saveBuffer) { saveBuffer.remove(); }
}

// Saves the central canvas area as a high-resolution PNG
function saveCanvasAreaAsHighResPNG() {

     // Check if canvasPG is available and valid (needed for base dimensions)
     if (!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) {
        alert("Error: Cannot save high-resolution PNG. Canvas area buffer is not available or invalid.");
        console.error("saveCanvasAreaAsHighResPNG: canvasPG is invalid or has zero dimensions.");
        return;
     }

    // Define the base dimensions (from the fixed ratio source)
    const sourceWidthBase = CANVAS_AREA_W_BASE;
    const sourceHeightBase = CANVAS_AREA_W_BASE * (5/4); // Assuming 4:5 ratio is based on this width

    // Define target print resolution and paper size (B2)
    const TARGET_DPI = 300; // Dots per inch
    const B2_WIDTH_INCHES = 500 / 25.4; // B2 width in mm converted to inches
    const B2_HEIGHT_INCHES = 707 / 25.4; // B2 height in mm converted to inches

    // Calculate target pixel dimensions based on DPI
    const targetWidthPixels = round(B2_WIDTH_INCHES * TARGET_DPI);
    const targetHeightPixels = round(B2_HEIGHT_INCHES * TARGET_DPI);

     // Calculate the scaling factor needed to map the source base width to the target pixel width
     const scaleFactor = targetWidthPixels / sourceWidthBase;
     // Calculate the scaled height of the original 4:5 content within the target dimensions
     const scaledSourceHeight = sourceHeightBase * scaleFactor;
     // Calculate vertical offset to center the 4:5 content vertically
     const verticalOffset = (targetHeightPixels - scaledSourceHeight) / 2;

    let highResPG = null; // Variable for the high-resolution graphics buffer
     try {
         // Validate target dimensions
         if (targetWidthPixels <= 0 || targetHeightPixels <= 0 || isNaN(targetWidthPixels) || isNaN(targetHeightPixels)) {
             alert("Error calculating high-res save size. Target dimensions are invalid.");
              console.error("saveHighResPNG: Calculated target dimensions are invalid:", targetWidthPixels, targetHeightPixels);
             return;
         }

        // Create the high-resolution graphics buffer
        highResPG = createGraphics(targetWidthPixels, targetHeightPixels);
        highResPG.background(255); // White background

        // Draw each placed item onto the high-resolution buffer
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             // Skip empty text items
             if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                 continue;
             }
             // Skip items with invalid scale or size
             if (item.scaleFactor <= 0 || item.size <= 0) continue;

            highResPG.push(); // Save graphics state

             // Calculate item's position in the high-res buffer coordinates
             // Item's position (item.x, item.y) is relative to the main window.
             // Subtract CANVAS_AREA_X/Y to get position relative to the canvas area's top-left.
             // Multiply by scaleFactor to get position in high-res pixels.
             // Add verticalOffset to center the content vertically.
             let hrItemX = (item.x - CANVAS_AREA_X) * scaleFactor;
             let hrItemY = (item.y - CANVAS_AREA_Y) * scaleFactor + verticalOffset;

             // Validate calculated position
             if (isNaN(hrItemX) || isNaN(hrItemY)) {
                 console.warn("saveHighResPNG: Calculated item position is NaN. Skipping item.", item);
                 highResPG.pop(); continue; // Restore graphics state and skip this item
             }

            highResPG.translate(hrItemX, hrItemY); // Move origin to item's position
            highResPG.rotate(item.rotation); // Apply item's rotation

             // Calculate the combined scale for the high-res buffer
             let combinedScale = item.scaleFactor * scaleFactor;
              combinedScale = max(combinedScale, 1e-6); // Ensure scale is not zero

            highResPG.scale(combinedScale); // Apply the combined scale

            highResPG.fill(item.color); // Apply item's color
            highResPG.noStroke(); // No stroke for the fill

             // Get the item's font and text scale adjustment
             let itemFont = item.font;
             let itemTextScale = isNaN(item.textScaleAdjust) ? 0.2 : item.textScaleAdjust;
             itemTextScale = max(itemTextScale, 1e-3); // Ensure text scale adjust is positive

             // Check if itemFont is a truthy font object (and not the fallback string)
             if (itemFont && itemFont !== baseFont) {
                 if (typeof highResPG.textFont === 'function') highResPG.textFont(itemFont);
             } else {
                  // Fallback on highResPG
                  console.warn("saveHighResPNG: Item font invalid or not loaded. Using fallback font for item:", item);
                  if (typeof highResPG.textFont === 'function') highResPG.textFont(baseFont); // Fallback to string
             }


             item.drawShapePrimitive(highResPG, 0, 0, item.size, item.shapeType, item.type === 'text', itemTextScale);

            highResPG.pop(); // Restore graphics state
        }

        // Draw a border around the scaled canvas area within the high-res buffer
        highResPG.push();
         highResPG.stroke(0); // Black border
         // Scale the border weight based on the overall scale factor
         let borderWeight = 1 * scaleFactor;
         borderWeight = max(borderWeight, 0.5); // Ensure minimum border weight
         highResPG.strokeWeight(borderWeight);
         highResPG.noFill();
         // Calculate border rectangle position and size in high-res pixels
         let borderRectX = 0;
         let borderRectY = verticalOffset;
         let borderRectW = targetWidthPixels;
         let borderRectH = scaledSourceHeight;

         // Draw rectangle slightly inset to keep border within bounds
         highResPG.rect(borderRectX + borderWeight / 2, borderRectY + borderWeight / 2,
                        borderRectW - borderWeight, borderRectH - borderWeight);

        highResPG.pop();

        // Save the high-resolution buffer as a PNG file
        if (targetWidthPixels > 0 && targetHeightPixels > 0) {
             saveCanvas(highResPG, `myArtboard_HIRES_${targetWidthPixels}x${targetHeightPixels}_` + generateTimestampString() + '.png');
         } else {
              alert("Error: High-resolution dimensions are invalid after final check.");
               console.error("saveHighResPNG: Final target dimensions are invalid:", targetWidthPixels, targetHeightPixels);
         }

     } catch(e) {
        alert("An error occurred while saving high-resolution PNG.");
        console.error("Error saving high-resolution PNG:", e);
     } finally {
        // Always remove the high-resolution buffer after use
        if (highResPG) {
             // Ensure recording is stopped if it was started (for libraries like p5.js-svg)
             if (typeof highResPG.isRecording === 'boolean' && highResPG.isRecording && typeof highResPG.endRecord === 'function') {
                 try{ highResPG.endRecord(); } catch(endErr) { console.error("Error ending highResPG record:", endErr); }
             }
             // Remove the graphics buffer
             if (typeof highResPG.remove === 'function') { try { highResPG.remove(); } catch(remErr) { console.error("Error removing highResPG:", remErr); } }
         }
     }
}

// Resets only the floating shapes, keeping placed items
function resetFloatingShapes() {
    // Temporarily store the grabbed item if any
    let tempGrabbedItem = grabbedItem;
    // Check if the grabbed item was a floating shape (not a placed one that was picked up)
    let wasFloating = tempGrabbedItem && shapes.includes(tempGrabbedItem);

    // If the grabbed item was floating, remove it from the shapes list before clearing
    if (wasFloating) {
        shapes = shapes.filter(s => s !== tempGrabbedItem);
    }

    shapes = []; // Clear the current floating shapes list

    // Create a new set of floating shapes
    while (shapes.length < 30) {
        let newShape = new FloatingShape();
        shapes.push(newShape);
    }

    // Add the grabbed item back to the shapes list if it was floating originally
    if (wasFloating && tempGrabbedItem) {
        shapes.push(tempGrabbedItem);
    }
    // Note: If a placed item was grabbed, it stays grabbed and is not affected by this reset
}

// Resets everything (floating shapes and placed items)
function restartAll() {
    placedItems = []; // Clear placed items
    shapes = []; // Clear floating shapes
    grabbedItem = null; // Clear grabbed item

    // Reset input field
    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    inputElement.elt.blur(); // Remove focus

     // Clear the canvas area buffer
     if (canvasPG) {
         canvasPG.clear();
         canvasPG.background(255); // Reset to white background
     }

    // Create a new set of initial floating shapes
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }
}

// --- Touch Event Handlers ---
// Variables to track touch state
let touchGrabbed = false; // Is a touch currently being used to drag an item?

function touchStarted(event) {
    if (touches.length === 0) return true;
    let touchX = touches[0].x;
    let touchY = touches[0].y;

    if (touchY < HEADER_HEIGHT) {
         // Check if touch was on a DOM element in the header
         let touchedHeaderDOM = false;
         if (event && event.target) {
           if(event.target === inputElement.elt ||
              (savePNGButton && event.target === savePNGButton.elt) ||
              (saveHighResPNGButton && event.target === saveHighResPNGButton.elt) ||
              (clearButton && event.target === clearButton.elt) ||
              (refreshButton && event.target === refreshButton.elt)) {
               touchedHeaderDOM = true;
           }
         }
         if (touchedHeaderDOM) {
             // Allow default for UI elements, which might include focus or click.
             // For touch, often need to prevent default for other canvas interactions.
             // But for buttons, might want default. This is tricky. For now, if header UI, allow default.
             return true;
         } else {
             // Touched empty header space
             if (event.cancelable) event.preventDefault(); // Prevent scroll/zoom
             return false; // Consume
         }
    }

    if (grabbedItem) {
        if (grabbedItem.isMouseOver(touchX, touchY)) {
            touchGrabbed = true;
            if (canvas && typeof canvas.elt.focus === 'function') { // Keep canvas focus
                canvas.elt.focus();
            }
            if (event.cancelable) event.preventDefault();
            return false;
        } else {
            if (event.cancelable) event.preventDefault(); // Ignored touch
            return false;
        }
    }

    // Attempt to focus canvas for upcoming interactions
    // --- CORRECTED CHECK ---
    if (canvas && canvas.elt && typeof canvas.elt.focus === 'function') {
        canvas.elt.focus();
    }
    // --- END CORRECTED CHECK ---

    // Check placed items
    if (isMouseOverCanvasArea(touchX, touchY)) {
        for (let i = placedItems.length - 1; i >= 0; i--) {
            if (placedItems[i].isMouseOver(touchX, touchY)) {
                grabbedItem = placedItems[i];
                grabbedItem.isGrabbed = true; // etc.
                // ... (same logic as mousePressed for setting grabbedItem properties) ...
                grabbedItem.isPlacing = false;
                grabbedItem.solidify();
                let temp = placedItems.splice(i, 1)[0]; shapes.push(temp);

                if (grabbedItem.type === 'text') {
                    inputElement.value(grabbedItem.content || '');
                    inputElement.attribute('placeholder', '');
                    // DO NOT FOCUS inputElement on touch either for consistency
                } else {
                    inputElement.value('');
                    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                    if (document.activeElement === inputElement.elt) inputElement.elt.blur();
                }
                touchGrabbed = true;
                if (event.cancelable) event.preventDefault();
                return false;
            }
        }
    }

    // Check floating shapes
    for (let i = shapes.length - 1; i >= 0; i--) {
        if (!shapes[i].isGrabbed && shapes[i].isMouseOver(touchX, touchY)) {
            grabbedItem = shapes[i];
             // ... (same logic as mousePressed for setting grabbedItem properties) ...
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
                if (document.activeElement === inputElement.elt) inputElement.elt.blur();
            }
            touchGrabbed = true;
            if (event.cancelable) event.preventDefault();
            return false;
        }
    }

    // If touch was not on header UI, not on an item, and no item grabbed:
    if (document.activeElement === inputElement.elt) {
         inputElement.elt.blur(); // Deselect input
    }
    if (event.cancelable) event.preventDefault(); // Prevent general page scroll/zoom if touch unhandled
    return false; // Consume unhandled touches outside header UI.
}

function touchMoved(event) {
    // Ignore if no touches or if not currently dragging an item by touch
    if (touches.length === 0 || !grabbedItem || !touchGrabbed) return true;

    // Get the position of the first touch
    let touchX = touches[0].x;
    let touchY = touches[0].y;

     // Prevent default touch behavior (like scrolling)
     if (event.cancelable) event.preventDefault();

    // Smoothly move the grabbed item towards the touch position
    grabbedItem.x = lerp(grabbedItem.x, touchX, 0.4);
    grabbedItem.y = lerp(grabbedItem.y, touchY, 0.4);

     return false; // Indicate that the event was handled
}


function touchEnded(event) {
     // If an item was grabbed by touch
     if (grabbedItem && touchGrabbed) {
         // Simulate mouse release logic to handle placing/releasing the item
         mouseReleased();
         touchGrabbed = false; // Reset touch grab state
         if (event.cancelable) event.preventDefault(); // Prevent default behavior
         return false; // Indicate that the event was handled
     }
    return true; // Allow default behavior if no item was grabbed by touch
}

// Helper function to check if a point is within the central canvas area
function isMouseOverCanvasArea(pX, pY) {
    const checkX = pX === undefined ? mouseX : pX;
    const checkY = pY === undefined ? mouseY : pY;

    return checkX >= CANVAS_AREA_X && checkX <= CANVAS_AREA_X + CANVAS_AREA_W &&
           checkY >= CANVAS_AREA_Y && checkY <= CANVAS_AREA_Y + CANVAS_AREA_H;
}