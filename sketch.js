// Interactive canvas website-tool project using p5.js

let shapes = []; // Shapes currently floating or grabbed
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
const CANVAS_AREA_W = 500; // Fixed width of the artboard (Source for high-res scaling)
let CANVAS_AREA_H; // Calculated in setup based on ratio
let CANVAS_AREA_X; // Calculated in setup based on window width
let CANVAS_AREA_Y; // Calculated in setup

// Appearance constants
const PALETTE = [
  '#0000FE', // Blue triangle (This color might still be picked even if the old triangle shape is gone)
  '#FFDD00', // Yellow pentagon
  '#E70012', // Red hexagon
  '#FE4DD3', // Pink square
  '#41AD4A', // Green shape
  '#000000', // Black
  '#222222', // Dark Grey
  '#FFFFFF',  // White
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

// This remains 'monospace' as per original code, fonts are loaded via HTML only.
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
// Used for checking proximity to polygon edges in local coordinates.
function distToSegment(px, py, x1, y1, x2, y2) {
  let l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return dist(px, py, x1, y1);

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = max(0, min(1, t));

  let closestX = x1 + t * (x2 - x1);
  let closestY = y1 + t * (y2 - y1);

  return dist(px, py, closestX, closestY);
}

// --- START: NEW Triangle Vertex Definitions ---

// Gets local vertices for an equilateral triangle centered at (0,0).
// 'size' acts as a reference, roughly corresponding to the circumradius or height.
function getEquilateralTriangleVertices(size) {
    // Apex up orientation
    let h = size; // Using size roughly as height reference
    let side = h / (sqrt(3)/2); // Calculate side length from height
    let halfSide = side / 2;
    let distToBase = h / 3; // Distance from centroid (0,0) to base
    let distToApex = h * 2 / 3; // Distance from centroid (0,0) to apex

    return [
        { x: 0, y: -distToApex },         // Apex
        { x: -halfSide, y: distToBase }, // Bottom-left base corner
        { x: halfSide, y: distToBase }   // Bottom-right base corner
    ];
}

// Gets local vertices for a Pythagorean triangle (right triangle with sides 3, 4, 5 ratio) centered at (0,0).
// 'size' acts as a reference, roughly corresponding to the hypotenuse length.
function getPythagoreanTriangleVertices(size) {
    // Assuming 'size' maps to the hypotenuse (5 units).
    // Scale factors for sides: 3/5 = 0.6, 4/5 = 0.8, 5/5 = 1.0
    let base = size * (4/5); // Side 4 (horizontal)
    let height = size * (3/5); // Side 3 (vertical)

    // Center the triangle by finding its centroid.
    // Vertices if placed at (0,0) with legs along axes: (0,0), (base, 0), (0, height)
    // Centroid: ((0 + base + 0)/3, (0 + 0 + height)/3) = (base/3, height/3)
    // To center it at (0,0), subtract the centroid from each vertex.
    let centroidX = base / 3;
    let centroidY = height / 3;

    return [
        { x: 0 - centroidX, y: 0 - centroidY },           // Right angle vertex (original 0,0)
        { x: base - centroidX, y: 0 - centroidY },        // Vertex along horizontal leg (original base, 0)
        { x: 0 - centroidX, y: height - centroidY }       // Vertex along vertical leg (original 0, height)
    ];
}


// Gets local vertices for unrotated shapes centered at (0,0), including the new triangles.
function getLocalShapeVertices(shapeType, size) {
    switch(shapeType) {
        case 'equilateralTriangle': return getEquilateralTriangleVertices(size);
        case 'pythagoreanTriangle': return getPythagoreanTriangleVertices(size);
        case 'square': return getSquareVertices(size);
        case 'pentagon': return getPentagonVertices(size);
        case 'hexagon': return getHexagonVertices(size);
        // Circle and old triangle don't have vertices for edge check
        default: return []; // Return empty array for other types
    }
}
// --- END: NEW Triangle Vertex Definitions ---


// Checks if a point is strictly inside a convex polygon (local coords).
function isPointInConvexPolygon(px, py, vertices) {
  let numVertices = vertices.length;
  if (numVertices < 3) return false;
  let has_pos = false, has_neg = false;
  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i], v2 = vertices[(i + 1) % numVertices];
    // Cross product check (point on one side of edge vector)
    let cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);
    // Use a small epsilon for floating point comparisons
    if (cross_product > 1e-6) has_pos = true;
    if (cross_product < -1e-6) has_neg = true;
    if (has_pos && has_neg) return false; // Point is not strictly inside if it's on both sides of different edges
  }
   // If not straddling the polygon (always on one side or on an edge), it's inside or on boundary
   return !(has_pos && has_neg); // Equivalent check
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
// Uses baseFont globally.
function getTextBounds(content, effectiveTextSize, baseFontRef) {
    // console.log("getTextBounds called with:", content, effectiveTextSize, baseFontRef); // Debugging line

    // Handle potential issues with temp graphics creation/usage
    try {
         let tempPG = createGraphics(10, 10); // Give it a minimal starting size

        // Apply font properties to the temp buffer context
        tempPG.textSize(effectiveTextSize);
        tempPG.textFont(baseFontRef); // Use the font reference provided (which is 'monospace' globally)
        tempPG.textAlign(CENTER, CENTER); // Set textAlign as it's used in drawShapePrimitive

        // Perform measurement
        let textW = tempPG.textWidth(content);
        let textAsc = tempPG.textAscent();
        let textDesc = tempPG.textDescent();
        let textH = textAsc + textDesc; // Total height

        // Clean up the temporary buffer by removing its DOM element
        if (tempPG && tempPG.elt) {
            tempPG.elt.remove();
        }

        return { w: textW, h: textH };

    } catch (e) {
        console.error("Error in getTextBounds:", e);
         // Return a default safe size in case of error
        return { w: effectiveTextSize * content.length * 0.6, h: effectiveTextSize * 1.2 };
    }
}


// --- FloatingShape Class ---
class FloatingShape {
  constructor() {
    this.reset();
    this.isGrabbed = false; // Indicates if the item is currently held by the mouse
    this.isPlacing = false; // Indicates if the item is currently landing on the artboard
    this.landFrame = -1;    // Frame count when landing started for animation
    this.tempScaleEffect = 1; // Temporary scale for landing animation
  }

  reset() {
    let edge = floor(random(4));
    let posAlong = random(0.2, 0.8); // Changed to 0.2-0.8 for safer spawning zone initially
    let categoryIndex = floor(random(sizeCategories.length));
    let category = sizeCategories[categoryIndex];
    this.size = random(category.sizeRange[0], category.sizeRange[1]);
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]);
    this.currentSize = this.size * this.scaleFactor; // Represents scaled 'size' value, not visual width/height

    let minSpeed = 1.5, maxSpeed = 3.5; // Slightly reduced speed range
     // offScreenOffset: Use a size-dependent offset but with a minimum to prevent early deletion
     let baseOffScreenOffset = 200;
     // Calculate rough maximal extent considering text length etc.
     let roughMaxDimension = this.calculateMaxEffectiveDimension();
     let offScreenOffset = max(roughMaxDimension * this.scaleFactor * 0.8, baseOffScreenOffset); // Apply scale before check


    switch (edge) {
      case 0: this.x = width * posAlong; this.y = -offScreenOffset; this.speedX = random(-1, 1); this.speedY = random(minSpeed, maxSpeed); break; // Top
      case 1: this.x = width + offScreenOffset; this.y = height * posAlong; this.speedX = random(-maxSpeed, -minSpeed); this.speedY = random(-1, 1); break; // Right
      case 2: this.x = width * posAlong; this.y = height + offScreenOffset; this.speedX = random(-1, 1); this.speedY = random(-maxSpeed, -minSpeed); break; // Bottom
      case 3: this.x = -offScreenOffset; this.y = height * posAlong; this.speedX = random(minSpeed, maxSpeed); this.speedY = random(-1, 1); break; // Left
    }

    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.003, 0.003) * random(1, 3); // Slightly reduced rotation speed

    let pickedColor;
    do { pickedColor = color(random(PALETTE)); } while (PALETTE.length > 1 && brightness(pickedColor) < 30 && this.type !== 'text');
    this.color = pickedColor;

    this.type = random() < 0.7 ? 'shape' : 'text'; // Slightly favor shapes

    if (this.type === 'shape') {
        // --- START: Update shape types to include new triangles ---
        this.shapeType = random(['equilateralTriangle', 'pythagoreanTriangle', 'square', 'pentagon', 'hexagon', 'circle']);
        // --- END: Update shape types ---
        this.content = null;
        this.textScaleAdjust = 0;
    } else { // type is 'text'
         this.shapeType = 'none';
          // Pick initial text, retry if it's empty or placeholder-like
         let initialContent = random(TEXT_OPTIONS.slice(1));
         while(!initialContent || initialContent.trim() === "" || initialContent.trim() === TEXT_OPTIONS[0].trim()){
            initialContent = random(TEXT_OPTIONS.slice(1)); // Keep picking from actual options
         }
         this.content = initialContent.trim(); // Use trimmed content
         this.textScaleAdjust = category.textScaleAdjust;
         // For text on white background, maybe ensure sufficient contrast
          let textBgBrightness = 255; // Assuming white background on artboard
         if(brightness(pickedColor) > textBgBrightness * 0.6 && brightness(pickedColor) < textBgBrightness * 0.9){
              // If color is too close to white, pick a darker color
              let attempts = 0;
              let darkColor;
              do { darkColor = color(random(PALETTE)); attempts++; }
              while(attempts < 10 && brightness(darkColor) > textBgBrightness * 0.6);
              if (brightness(darkColor) <= textBgBrightness * 0.6) {
                this.color = darkColor; // Use the darker color
             } else {
                 // If failed to find dark color, try picking a very bright/saturated one that stands out
                  let fallbackColor = color(random(PALETTE));
                  // Example: Check for saturation, but just picking is fine too
                  this.color = fallbackColor;
             }
         } else {
              this.color = pickedColor; // Use the original picked color if it seems okay
         }

    }

    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;
  }

  // Helper to estimate max dimension (radius equivalent) for off-screen check
  calculateMaxEffectiveDimension() {
       if (this.type === 'text' && this.content) {
             let effectiveTextSize = this.size * this.textScaleAdjust;
              let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont);
             return max(textBounds.w, textBounds.h);
        } else if (this.type === 'shape') {
             switch(this.shapeType) {
                  case 'circle': return this.size; // size is radius
                  case 'square': return this.size * Math.SQRT2 / 2; // half diagonal for effective radius
                  // --- START: Update calculateMaxEffectiveDimension for new triangles ---
                  case 'equilateralTriangle':
                      let eqTriVerts = getEquilateralTriangleVertices(this.size);
                      let maxEqTriDistSq = 0;
                      for(let v of eqTriVerts) maxEqTriDistSq = max(maxEqTriDistSq, v.x*v.x + v.y*v.y);
                      return sqrt(maxEqTriDistSq);
                  case 'pythagoreanTriangle':
                       let pyTriVerts = getPythagoreanTriangleVertices(this.size);
                      let maxPyTriDistSq = 0;
                      for(let v of pyTriVerts) maxPyTriDistSq = max(maxPyTriDistSq, v.x*v.x + v.y*v.y);
                      return sqrt(maxPyTriDistSq);
                  // --- END: Update calculateMaxEffectiveDimension for new triangles ---
                  case 'pentagon': return this.size * 0.7; // radius used in drawing
                  case 'hexagon': return this.size; // radius used in drawing (vertex-to-center)
                  default: return this.size; // Fallback
             }
        } else { return this.size || 50; } // Default basic size
  }


  update() {
     if (!this.isGrabbed && !this.isPlacing) {
       this.x += this.speedX;
       this.y += this.speedY;
       this.rotation += this.rotationSpeed;
     }
     this.currentSize = this.size * this.scaleFactor;
  }

   // Checks if the object is significantly off-screen
   isReallyOffScreen() {
        let maxEffectiveDimension = this.calculateMaxEffectiveDimension() * this.scaleFactor;
      let effectiveRadius = maxEffectiveDimension / 2; // Treat it roughly like a circle for bounds check
      // Increased buffer
      let buffer = max(width, height) * 0.3;
      return this.x < -buffer - effectiveRadius || this.x > width + buffer + effectiveRadius ||
             this.y < -buffer - effectiveRadius || this.y > height + buffer + effectiveRadius;
  }


  // Updates the scaling effect for the landing animation
  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame;
        let duration = 45; // Landing animation duration (frames)
        if (elapsed <= duration) {
            let t = map(elapsed, 0, duration, 0, 1);
            let pulseScale = 1 + sin(t * PI) * 0.05; // Subtle pulse
            this.tempScaleEffect = pulseScale;
        } else {
            this.isPlacing = false;
            this.tempScaleEffect = 1;
        }
    } else if (!this.isPlacing && this.tempScaleEffect !== 1) {
         this.tempScaleEffect = 1; // Reset scale effect if somehow left non-1
    }
  }

   // General display function used for drawing on main canvas or other contexts (PG)
   // graphics: The p5 graphics object target (e.g., 'this' for main, 'canvasPG' for PG buffer)
   // showGrabEffect: Apply grabbed visual style? (Only applies if graphics === this)
   // offsetX, offsetY: Optional offset to translate the shape by before drawing relative to graphics origin.
  display(graphics, showGrabEffect = false, offsetX = 0, offsetY = 0) {
    // Check if graphics context is valid before drawing
     if (!graphics || typeof graphics.push !== 'function') {
        // console.warn("Invalid graphics context passed to display for item:", this);
        return; // Skip drawing if context is invalid
    }

    graphics.push();
    // Translate to position relative to the graphics context's origin and passed offset
    graphics.translate(this.x - offsetX, this.y - offsetY);
    graphics.rotate(this.rotation);
     // Apply landing scale if active and NOT grabbed
    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale);

     if (showGrabEffect && graphics === this) { // Only draw grabbed effect on main canvas ('this')
         graphics.drawingContext.shadowBlur = 40;
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
         graphics.stroke(255, 255, 255, 200);
         graphics.strokeWeight(3);
         graphics.noFill();
         // drawShapePrimitive needs graphics context methods like graphics.beginShape
         // Passing baseFont to drawShapePrimitive as it uses it for text
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
         graphics.drawingContext.shadowBlur = 0; // Reset shadow blur
    }

    graphics.fill(this.color);
    graphics.noStroke(); // No stroke for the main fill/text

    // Draw the core geometry or text centered at (0,0) in the object's local space.
    // graphics: The target context (canvasPG, main canvas).
    // px, py: Always 0, 0 because we've already translated to the item's location.
    // psize: The item's base size ('this.size'). Scaling applied externally via graphics.scale().
    // Passing baseFont to drawShapePrimitive as it uses it for text
    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
    graphics.pop();
  }

  // Draws the shape's core geometry or text centered at (px, py), with base size psize.
  // Assumes transformations (translate, rotate, scale) are already applied to the 'graphics' context.
  // This function uses methods provided by the graphics context (e.g., graphics.rect, graphics.text).
  // It uses the global baseFont for text drawing.
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        // Check if graphics context is valid before attempting to draw primitives
        if (!graphics || typeof graphics.rectMode !== 'function' || typeof graphics.text !== 'function') {
             console.warn("Invalid graphics context in drawShapePrimitive for item:", this);
             return; // Skip drawing if context is invalid
         }


        if (isText) {
             if (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) {
                 return;
             }

             // Apply text properties to the provided graphics context
             graphics.textFont(baseFont); // Use the global baseFont ('monospace')
             graphics.textAlign(CENTER, CENTER);
             let effectiveTextSize = psize * textScaleAdjust; // Calculate effective size relative to base psize
             graphics.textSize(effectiveTextSize); // Set text size

             graphics.text(this.content, px, py); // Draw text centered at px, py
         } else { // It's a shape
              graphics.rectMode(CENTER); // Set rect drawing mode on this context

             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break;
               case 'square': graphics.rect(px, py, psize, psize); break;
               // --- START: Remove old triangle and Add new triangle drawing ---
               case 'equilateralTriangle':
                   let eqTriVertices = getEquilateralTriangleVertices(psize);
                    graphics.beginShape();
                    for(let v of eqTriVertices) graphics.vertex(px + v.x, py + v.y);
                    graphics.endShape(CLOSE);
                   break;
               case 'pythagoreanTriangle':
                   let pyTriVertices = getPythagoreanTriangleVertices(psize);
                    graphics.beginShape();
                    for(let v of pyTriVertices) graphics.vertex(px + v.x, py + v.y);
                    graphics.endShape(CLOSE);
                   break;
               // --- END: Remove old triangle and Add new triangle drawing ---
               case 'pentagon':
                  graphics.beginShape();
                  let sidesP = 5; let radiusP = psize * 0.7;
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
                 for (let i = 0; i < sidesH; i++) {
                    let angle = TWO_PI / sidesH * i;
                    let sx = cos(angle) * radiusH;
                    let sy = sin(angle) * radiusH;
                    graphics.vertex(px + sx, py + sy);
                 }
                 graphics.endShape(CLOSE);
                 break;
               default:
                  // console.warn("drawShapePrimitive: Unknown shape type:", pshapeType);
                 break; // Draw nothing for unknown types
             }
         }
   }

  // Checks if mouse coordinates (mx, my) are over this shape or text item.
  isMouseOver(mx, my) {
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) || isNaN(this.scaleFactor) || isNaN(this.size) || this.scaleFactor <= 0 || this.size <= 0) {
            // console.warn("isMouseOver: Invalid object state or zero size/scale:", this);
            return false; // Cannot click on an invalid or zero-sized item
       }

       // Convert mouse coordinates from global (sketch window) to object's local space.
       // Uses the item's current display scale (which might include the landing pulse).
       let currentDisplayScale = this.scaleFactor * this.tempScaleEffect; // Use display scale here
       let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, currentDisplayScale); // Use display scale here
       let localMx = localMouse.x, localMy = localMouse.y;

        // Calculate tolerance in local object pixels. Clamped to a minimum.
        let localTolerance = CLICK_TOLERANCE / currentDisplayScale;
         localTolerance = max(localTolerance, 2);

       if (this.type === 'text') {
           if (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) {
               return false; // Cannot click empty text
           }
           let effectiveTextSize = this.size * this.textScaleAdjust;
            // Get text bounds (width/height) in local coordinate space (centered at 0,0)
           let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont);
           // Check if local mouse point is within or near the text bounding box.
           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);

       } else { // type is 'shape'
            // Size property refers to the base size used before scaleFactor
           switch (this.shapeType) {
              case 'circle':
                 return dist(localMx, localMy, 0, 0) <= this.size + localTolerance;
              case 'square':
                 return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);
              // --- START: Update isMouseOver for new triangles ---
              case 'equilateralTriangle':
                  let eqTriVertices = getLocalShapeVertices(this.shapeType, this.size);
                  if (isPointInConvexPolygon(localMx, localMy, eqTriVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, eqTriVertices, localTolerance);
              case 'pythagoreanTriangle':
                   let pyTriVertices = getLocalShapeVertices(this.shapeType, this.size);
                  if (isPointInConvexPolygon(localMx, localMy, pyTriVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, pyTriVertices, localTolerance);
              // --- END: Update isMouseOver for new triangles ---
              case 'pentagon':
                  let pentVertices = getPentagonVertices(this.size);
                  if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance);
              case 'hexagon':
                   let hexVertices = getHexagonVertices(this.size);
                  if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance);
              default:
                   // Fallback check
                   console.warn("isMouseOver: Fallback check for unknown shape type:", this.shapeType);
                   return dist(localMx, localMy, 0, 0) <= (this.size * 0.5) + localTolerance;
           }
       }
    }

  // Sets the shape's speeds/rotation speed to zero
  solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}


function preload() {
  // Custom font loading example - original code left commented
  // baseFont = loadFont('path/to/your/font.otf'); // Load your font here
}

function setup() {
  // Use standard canvas for live rendering (PNG, browser view)
  createCanvas(windowWidth, windowHeight);

  SNAP_INCREMENT_RADIANS = radians(15);

  // Calculate initial canvas area dimensions and position
   // Ensure CANVAS_AREA_W is reasonable if windowWidth is very small
  const adjustedCanvasW = min(CANVAS_AREA_W, windowWidth * 0.9);

  // !!! Change height ratio to sqrt(2) !!!
  CANVAS_AREA_H = adjustedCanvasW * Math.sqrt(2); // Maintain 1:sqrt(2) aspect ratio (B paper format)
  // !!! END OF REQUEST 1 !!!

  CANVAS_AREA_X = width / 2 - adjustedCanvasW / 2; // Center horizontally
  CANVAS_AREA_Y = HEADER_HEIGHT + 20; // Position below header
  if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0; // Ensure valid minimum position

  // Create/Recreate canvas graphics buffer for the visible artboard area
    if (canvasPG) { canvasPG.remove(); } // Remove existing if any
    canvasPG = createGraphics(adjustedCanvasW, CANVAS_AREA_H);
    canvasPG.background(255); // Initial white background


  let headerCenterY = HEADER_HEIGHT / 2;

  // Input element setup
  inputElement = createInput();
  inputElement.value('');
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
   // Position relative to the calculated CANVAS_AREA_X/Y
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15); // Position vertically in header
  inputElement.size(adjustedCanvasW); // Match input width to adjusted artboard width
  inputElement.style("padding", "5px 10px")
               .style("border", "1px solid #ccc")
               .style("border-radius", "15px")
               .style("outline", "none")
               .style("background-color", color(255, 255, 255, 200))
               .style("font-size", "14px")
               .style("color", color(50))
                .style("box-sizing", "border-box"); // Include padding in size calculation

  // Event listener for Enter key on input using vanilla JS elt
  inputElement.elt.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && event.target === this) {
      addNewTextShapeFromInput();
      event.preventDefault(); // Prevent default browser action
    }
  });


  // --- Button setup (positioned in windowResized) ---
  // Note: Button creation MUST happen after createCanvas, positioning in windowResized
  // SAVE PNG Button (existing low-res)
  savePNGButton = createButton("SAVE PNG");
  savePNGButton.style("padding", "5px 10px")
               .style("border", "1px solid #888")
               .style("border-radius", "15px")
               .style("background-color", color(200))
               .style("color", color(50));
  savePNGButton.mousePressed(saveCanvasAreaAsPNG); // Binds to original PNG save

   // SAVE HIGH-RES PNG Button (NEW)
   saveHighResPNGButton = createButton("SAVE HI-RES PNG"); // New button
   saveHighResPNGButton.style("padding", "5px 10px")
                        .style("border", "1px solid #888")
                        .style("border-radius", "15px")
                        .style("background-color", color(200))
                         .style("color", color(50));
   saveHighResPNGButton.mousePressed(saveCanvasAreaAsHighResPNG); // Binds to NEW high-res PNG save

  // SAVE PDF Button
   savePDFButton = createButton("SAVE PDF");
   savePDFButton.style("padding", "5px 10px")
                .style("border", "1px solid #888")
                .style("border-radius", "15px")
                .style("background-color", color(200))
                .style("color", color(50));
   savePDFButton.mousePressed(saveCanvasAreaAsPDF);

  // CLEAR Button
  clearButton = createButton("CLEAR");
   clearButton.style("padding", "5px 10px")
               .style("border", "1px solid #888")
               .style("border-radius", "15px")
               .style("background-color", color(200))
               .style("color", color(50));
   clearButton.mousePressed(restartAll);

  // REFRESH Button
  refreshButton = createButton("REFRESH");
   refreshButton.style("padding", "5px 10px")
                .style("border", "1px solid #888")
                .style("border-radius", "15px")
                .style("background-color", color(200))
                .style("color", color(50));
   refreshButton.mousePressed(resetRandom);


   // Initial positioning of DOM elements after creation/styling
   // Call windowResized initially to place elements and resize canvasPG
   windowResized();

  // Create initial floating shapes
  while (shapes.length < 30) { shapes.push(new FloatingShape()); }

}

let canvasPG; // Global reference to the graphics buffer for the central canvas area

function draw() {
  // Set background for the main sketch window
  background(0);

  // Update and draw floating shapes
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing);
  while (shapes.length < 20) { shapes.push(new FloatingShape()); } // Maintain min floating shapes
  for (let shape of shapes) {
     if (!shape.isGrabbed && !shape.isPlacing) { shape.update(); } // Update if free-floating
     shape.updateLanding(); // Update landing animation state
     // Draw floating shapes on the main canvas ('this'). No offset needed.
     // Passing baseFont to display as it uses it for text in drawShapePrimitive
     shape.display(this, shape.isGrabbed && shapes.includes(shape), 0, 0);
  }


  // --- Central White Canvas Area Drawing (Rendered to canvasPG) ---
  // This PG buffer represents the artboard content that gets saved/displayed
  if(canvasPG){
     canvasPG.clear(); // Clear buffer
     canvasPG.background(255); // Draw white background on buffer

    // Draw placed items onto canvasPG (fixed on the artboard)
    for (let i = 0; i < placedItems.length; i++) {
        let item = placedItems[i];
        item.updateLanding(); // Update landing state
         // Draw item onto canvasPG, positioned relative to its top-left (0,0) by offsetting drawing commands
        // Passing baseFont to display as it uses it for text in drawShapePrimitive
        item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
    }

    // Draw the canvasPG buffer onto the main canvas at the calculated position
    image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
  } else {
      console.warn("canvasPG is null, cannot draw central canvas area.");
      // Optionally draw a visual indicator of the error
       fill(255, 100, 100); rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
       fill(0); textAlign(CENTER, CENTER); text("Error: Canvas area buffer not loaded.", CANVAS_AREA_X + CANVAS_AREA_W/2, CANVAS_AREA_Y + CANVAS_AREA_H/2);
  }


  // Draw border around canvas area on main canvas (on top of the canvasPG image)
  stroke(200);
  strokeWeight(1);
  noFill();
  rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);


  // Draw grabbed item on top of everything else on the main canvas
  if (grabbedItem) {
      // Interpolate grabbed item position for smoother dragging
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.4);
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.4);

      // Ensure grabbed item is solidified and its placing animation stops
     if (grabbedItem.speedX !== 0 || grabbedItem.speedY !== 0 || grabbedItem.rotationSpeed !== 0) grabbedItem.solidify();
     if (grabbedItem.isPlacing) grabbedItem.isPlacing = false;

     // Draw the grabbed item on the main canvas with the grabbed visual effect
     // Passing baseFont to display as it uses it for text in drawShapePrimitive
     grabbedItem.display(this, true, 0, 0);
  }


  // --- DRAW HEADER / UI OVERLAY ---
  fill(220);
  noStroke();
  rect(0, 0, width, HEADER_HEIGHT);

  fill(50);
  textSize(20);
  textAlign(LEFT, CENTER);
  textFont(baseFont); // Uses the global baseFont ('monospace')
  text("PLACEHOLDER\nLOGO", 20, HEADER_HEIGHT / 2);
}

function mousePressed() {
  // Check if mouse is over the header or UI elements, ignore interaction
  // MouseY < HEADER_HEIGHT covers the general header area including buttons and input
   if (mouseY < HEADER_HEIGHT) return;

  // If something is already grabbed, clicking again might be for a different action
  // but based on current design, a new click starts the grab process only if nothing is grabbed.
   if (grabbedItem) { return; }


  // Attempt to grab items. Start with PLACED items as they should be on top visually
   for (let i = placedItems.length - 1; i >= 0; i--) {
       if (placedItems[i].isMouseOver(mouseX, mouseY)) {
           grabbedItem = placedItems[i];
           grabbedItem.isGrabbed = true;
           grabbedItem.isPlacing = false; // Stop landing animation
           grabbedItem.solidify(); // Stop any residual movement

           // Move from placedItems array to shapes array (temp while grabbed)
           let temp = placedItems.splice(i, 1)[0];
           shapes.push(temp);

           // Populate input and focus
           if (grabbedItem.type === 'text') { inputElement.value(grabbedItem.content); inputElement.attribute('placeholder', ''); } else { inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); }
           inputElement.elt.focus();
           return; // Grabbed a placed item, done.
       }
   }

  // If no placed item was grabbed, check for grabbing a FLOATING shape
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (!shapes[i].isGrabbed) { // Should be false due to grabbedItem check, but safe
      if (shapes[i].isMouseOver(mouseX, mouseY)) {
        grabbedItem = shapes[i];
        grabbedItem.isGrabbed = true;
        grabbedItem.isPlacing = false; // Stop landing
        grabbedItem.solidify(); // Stop floating movement

         // Keep in shapes list, but reorder to end (makes it draw last, on top)
        let temp = shapes.splice(i, 1)[0];
        shapes.push(temp);

        // Populate input and focus
        if (grabbedItem.type === 'text') { inputElement.value(grabbedItem.content); inputElement.attribute('placeholder', ''); } else { inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); }
        inputElement.elt.focus();
        break; // Grabbed a floating item, done.
      }
    }
  }
}

function mouseReleased() {
  if (grabbedItem) {
    grabbedItem.isGrabbed = false; // Unmark as grabbed

    if (isMouseOverCanvasArea()) { // Dropped over canvas area
      grabbedItem.solidify();

      if (grabbedItem.type === 'text') {
           let content = inputElement.value().trim();
           if(content === "" || content === TEXT_OPTIONS[0].trim()) {
               // Discard empty text item if dropped on canvas with empty input
               console.log("Discarding empty text item on placement.");
               shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes list
               grabbedItem = null; // Clear grabbed item reference
               // Clear input field and reset placeholder handled below regardless
               inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
               return; // Exit early
           } else {
              grabbedItem.content = content; // Update content from input
           }
      }

      // Apply rotation snapping if dropped on canvas
      if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      }

      // Move item from shapes list to placedItems list
      shapes = shapes.filter(s => s !== grabbedItem); // Ensure it's not in shapes anymore
      placedItems.push(grabbedItem); // Add to placed items

      // Start landing animation
      grabbedItem.isPlacing = true;
      grabbedItem.landFrame = frameCount;

    } else { // Dropped outside canvas area -> Reverts to floating
         // If text, update content from input field regardless
         if (grabbedItem.type === 'text') {
             let content = inputElement.value().trim();
             grabbedItem.content = (content === "" || content === TEXT_OPTIONS[0].trim()) ? "" : content;
             // If empty text is dropped outside, it becomes an empty item, eventually collected
             if (grabbedItem.content === "") {
                  console.log("Discarding empty text item dropped outside canvas.");
                  shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes list
                  grabbedItem = null; // Clear grabbed item reference
                   // Clear input field and reset placeholder handled below regardless
                 inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                 return; // Exit early
             }
         }

          // Reset movement speeds to float again
          grabbedItem.speedX = random(-1.5, 1.5);
          grabbedItem.speedY = random(-1.5, 1.5);
          grabbedItem.rotationSpeed = random(-0.003, 0.003);
          grabbedItem.isPlacing = false; // Cancel landing animation
          // Item remains in shapes array

          console.log("Item dropped outside canvas area, returned to floating.");
    }

    // Actions common to both drop locations
    grabbedItem = null; // Clear grabbed item reference
    inputElement.value(''); // Clear input field
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
  }
}

function mouseWheel(event) {
   // Prevent page scroll when interacting over relevant sketch area
   let isOverInteractiveArea = mouseX >= 0 && mouseX <= width && mouseY >= HEADER_HEIGHT && mouseY <= height;

    if (grabbedItem && isOverInteractiveArea) {
        grabbedItem.rotation += event.delta * 0.002;
        return false; // Prevent default browser scroll
    }
    return true; // Allow default browser scroll elsewhere
}

function keyPressed() {
    // Delete grabbed item with DELETE or BACKSPACE
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        console.log("Deleting grabbed item.");
        // Remove from both lists (should only be in one)
        shapes = shapes.filter(s => s !== grabbedItem);
        placedItems = placedItems.filter(s => s !== grabbedItem);
        grabbedItem = null;
        inputElement.value('');
        inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
        inputElement.elt.focus(); // Keep focus
        return false; // Prevent default key action
    }

    // Scale grabbed item with + / = or -
    if (grabbedItem) {
      if (key === '+' || key === '=') { grabbedItem.scaleFactor *= 1.08; grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, 6.0); }
      if (key === '-') { grabbedItem.scaleFactor *= 0.92; grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, 0.1); }
       // Update the calculated currentSize after scaling
      grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor;
      return false; // Prevent default key action
    }
    // Allow other keys for input field typing etc.
    return true;
}


// Function tied to adding text from input (now triggered by Enter key)
function addNewTextShapeFromInput() {
    let currentText = inputElement.value();
    // Use the placeholder text constant for comparison with trim()
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
         // Don't add if empty or just the placeholder text
         console.log("Input is empty or placeholder, not adding text.");
         inputElement.style("border-color", "red"); // Visual feedback
         setTimeout(() => inputElement.style("border-color", "#ccc"), 500);
         inputElement.elt.focus(); // Keep focus on the input field
         return; // Stop here if input is empty/placeholder
    }

    console.log("Adding new text shape from input:", currentText.trim());

    // Create a new FloatingShape object. Its constructor already sets up default properties including motion.
    let newTextShape = new FloatingShape(); // This starts with a random off-screen pos/speed from its reset()

    // --- Start: Revert to the *desired* spawning and initial speed logic from your previous code ---
    // Override the position and speed assigned in the constructor's reset()
    let spawnEdge = floor(random(4)); // Pick a random edge (0=top, 1=right, 2=bottom, 3=left)
    let posAlongEdge = random(0.4, 0.6); // Spawn near the middle 40%-60% of that edge
    let initialOffset = 50; // Spawn point is 50 pixels OUTSIDE the screen from the chosen edge

     switch (spawnEdge) {
        case 0: // Top edge
             newTextShape.x = width * posAlongEdge;
             newTextShape.y = -initialOffset; // Spawn 50px *above* the top edge
             break;
        case 1: // Right edge
             newTextShape.x = width + initialOffset; // Spawn 50px *right* of the right edge
             newTextShape.y = height * posAlongEdge;
             break;
        case 2: // Bottom edge
             newTextShape.x = width * posAlongEdge;
             newTextShape.y = height + initialOffset; // Spawn 50px *below* the bottom edge
             break;
        case 3: // Left edge
             newTextShape.x = -initialOffset; // Spawn 50px *left* of the left edge
             newTextShape.y = height * posAlongEdge;
             break;
     }

     // Give it a gentle push towards the center of the window slightly more predictably
     // Lerp from a random initial direction slightly towards the vector pointing from the item to the window center (width/2, height/2).
      newTextShape.speedX = lerp(random(-1, 1), (width/2 - newTextShape.x) / 400, 0.8); // Push towards center X
      newTextShape.speedY = lerp(random(-1, 1), (height/2 - newTextShape.y) / 400, 0.8); // Push towards center Y
    // --- End: Revert to desired spawning logic ---


    // --- Keep the customizations for text type ---
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim(); // Use the input text content
    newTextShape.shapeType = 'none'; // Explicitly not a shape primitive

    // Assign properties based on a 'medium' size category feel - Keep this part
    let mediumCategory = sizeCategories.find(cat => cat.name === 'medium');
     if (mediumCategory) {
         newTextShape.size = random(mediumCategory.sizeRange[0], mediumCategory.sizeRange[1]); // Pick base size from medium range
         newTextShape.scaleFactor = 1.0; // Start with base scale 1.0
         newTextShape.textScaleAdjust = mediumCategory.textScaleAdjust;
     } else { // Fallback (use the original fallback values)
        newTextShape.size = 150;
        newTextShape.scaleFactor = 1.0;
         newTextShape.textScaleAdjust = 0.2;
     }
     newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor; // Calculate current size

    // Use a distinct color from palette, avoid very dark - Keep this color picking logic
    let pickedColor;
    do {
        pickedColor = color(random(PALETTE));
    } while (brightness(pickedColor) < 50); // Brightness < 50 check from original
     newTextShape.color = pickedColor;

     // Keep the existing random rotation and rotation speed logic for the floating effect
     newTextShape.rotation = random(TWO_PI);
     newTextShape.rotationSpeed = random(-0.003, 0.003) * random(1, 3);


    shapes.push(newTextShape); // Add to the floating shapes array

    // Reset input field to placeholder and clear value AFTER adding text - Keep this part
    inputElement.value(''); // Clear the text value
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Re-set placeholder attribute
    inputElement.elt.focus(); // Keep focus on the input field after adding
     console.log("New text shape added to floating shapes from input.");
}

// Checks if the mouse is within the boundaries of the central canvas artboard area
function isMouseOverCanvasArea() {
    return mouseX > CANVAS_AREA_X && mouseX < CANVAS_AREA_X + CANVAS_AREA_W &&
           mouseY > CANVAS_AREA_Y && mouseY < CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Snaps a given angle (radians) to the nearest increment
function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0) return angleRadians;
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI; // Normalize 0 to TWO_PI
    let snapped = round(angleRadians / incrementRadians) * incrementRadians;
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI; // Re-normalize
    return snapped;
}

// Helper to generate timestamp string for filenames
function generateTimestampString() {
    let d = new Date();
    return year() + nf(month(), 2) + nf(day(), 2) + '_' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
}


// SAVE PNG function (standard resolution - saves canvasPG directly)
function saveCanvasAreaAsPNG() {
    console.log("SAVE PNG button pressed (Standard Resolution)");
    if (canvasPG) {
        // Draw border onto the buffer before saving (temporary)
        canvasPG.push();
        canvasPG.stroke(0); canvasPG.strokeWeight(1); canvasPG.noFill();
        canvasPG.rect(0, 0, canvasPG.width - 1, canvasPG.height - 1); // Border rect slightly smaller

        saveCanvas(canvasPG, 'myArtboard_stdres_' + generateTimestampString() + '.png');

         // After saving, immediately redraw placed items to remove the border from canvasPG
        // Clearing and redrawing all content is safest
        canvasPG.clear(); canvasPG.background(255);
        for (let item of placedItems) {
             // Redraw items correctly onto canvasPG using its offset
            item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
         }


    } else {
        console.warn("Cannot save Standard PNG: canvasPG not created.");
        alert("Error: Cannot save PNG. Canvas area buffer is not available.");
    }
}


// SAVE HIGH-RESOLUTION PNG function (New function for print output)
function saveCanvasAreaAsHighResPNG() {
    console.log("SAVE HIGH-RES PNG button pressed (B2 @ 300 DPI target)");

    const TARGET_DPI = 300; // Standard print resolution
    const B2_WIDTH_MM = 500; // B2 paper dimensions in mm
    const B2_HEIGHT_MM = 707; // Standard B2 is approx 1:sqrt(2)

    const MM_PER_INCH = 25.4;

    // Calculate target pixel dimensions based on B2 and DPI
    // Use integer pixel values
    const targetWidthPixels = round((B2_WIDTH_MM / MM_PER_INCH) * TARGET_DPI);
    const targetHeightPixels = round((B2_HEIGHT_MM / MM_PER_INCH) * TARGET_DPI);

    // Use slightly adjusted precise target sizes that maintain the aspect ratio better
    const actualTargetWidth = targetWidthPixels; // Use calculated width
    // Calculate height based on width and sqrt(2) ratio, rounded
    const recalculatedTargetHeight = round(actualTargetWidth * Math.sqrt(2));
    // Note: Using fixed 8350 before. Let's recalculate based on target width now for better fidelity if width changes
    // targetWidthPixels = 5906. 5906 * sqrt(2) = ~8352.46. Round to 8352.


    // Source dimensions are your displayed artboard dimensions (CANVAS_AREA_W/H).
    const sourceWidth = CANVAS_AREA_W;
    const sourceHeight = CANVAS_AREA_H; // This already uses W * sqrt(2)

    // Calculate the overall scaling factor needed. Based on width match.
    // Since both source and target (ideally) share the 1:sqrt(2) ratio,
    // scaling by width scales height proportionally correct.
    const overallScaleFactor = actualTargetWidth / sourceWidth;

    // Calculate the actual height of the scaled source content on the target buffer
    const scaledSourceHeight = sourceHeight * overallScaleFactor;

    // Calculate vertical offset needed to center the scaled content (should be minimal/zero)
    const verticalOffset = (recalculatedTargetHeight - scaledSourceHeight) / 2;


    console.log(`Source Artboard: ${sourceWidth}x${sourceHeight.toFixed(2)}`); // Log original floating point height
    console.log(`Target B2 @ ${TARGET_DPI} DPI (recalculated): ${actualTargetWidth}x${recalculatedTargetHeight}`);
    console.log(`Overall Scale Factor (Width-based): ${overallScaleFactor.toFixed(4)}`);
    console.log(`Scaled Content Dimensions: ${round(sourceWidth * overallScaleFactor)}x${round(scaledSourceHeight)}`);
     console.log(`Vertical Centering Offset (should be near 0 for sqrt(2) ratio): ${verticalOffset.toFixed(2)}`);


    // Create a new temporary graphics buffer for high-resolution drawing
    let highResPG = null;
     try {
        // Check if target dimensions are valid before creating graphics
         if (actualTargetWidth <= 0 || recalculatedTargetHeight <= 0) {
            console.error("Invalid target high-res dimensions:", actualTargetWidth, recalculatedTargetHeight);
            alert("Error calculating high-res save size.");
            return;
         }

        highResPG = createGraphics(actualTargetWidth, recalculatedTargetHeight); // Use recalculated height
        highResPG.background(255); // White background

        console.log("Drawing placed items onto high-res buffer...");
        // Draw placed items onto the high-res buffer with scaling
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             // Ensure item is not empty text when drawing for save
             if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                 continue; // Skip drawing empty text items
             }


            highResPG.push(); // Save highResPG's transformation state

             // Calculate the item's center position on the HIGH-RES canvas.
             // Item's original position relative to the *artboard top-left* (CANVAS_AREA_X, CANVAS_AREA_Y) is (item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y).
             // Scale this relative position by `overallScaleFactor` and add the `verticalOffset`.
             let hrItemX = (item.x - CANVAS_AREA_X) * overallScaleFactor;
             let hrItemY = (item.y - CANVAS_AREA_Y) * overallScaleFactor + verticalOffset; // Use verticalOffset

            highResPG.translate(hrItemX, hrItemY); // Move drawing origin to the item's center location

            highResPG.rotate(item.rotation); // Apply item's rotation around its center

            // Apply the combined scale.
             let combinedScale = item.scaleFactor * overallScaleFactor;
            highResPG.scale(combinedScale); // Apply the combined scale to the context


            // Set drawing styles for the item using highResPG context
            highResPG.fill(item.color);
            highResPG.noStroke(); // Assume no stroke for main fill

             // Set font for text BEFORE drawing it (using global baseFont as per original code)
             if(item.type === 'text'){
                 highResPG.textFont(baseFont); // Uses global baseFont ('monospace')
             }


            // Draw the primitive shape or text using the item's *base size*.
            // Arguments: graphics context, position (0,0), base size, shape type, isText, textScaleAdjust
             item.drawShapePrimitive(highResPG, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust);

            highResPG.pop(); // Restore highResPG's transformation state for the next item


        } // End item drawing loop


         // Optional: Draw a border on the high-res canvas around the scaled content area
        highResPG.push();
         highResPG.stroke(0); // Black border
         // Scale border weight relative to the overall scaling
         let borderWeight = 1 * overallScaleFactor; // If original border was 1px
         highResPG.strokeWeight(borderWeight);
         highResPG.noFill();
         // Draw rectangle outline around the scaled content area.
         let borderRectX = 0; // Scaled content starts at X=0 on highResPG
         let borderRectY = verticalOffset; // Scaled content starts at Y=verticalOffset
         let borderRectW = actualTargetWidth; // Scaled content width equals highResPG width
         let borderRectH = scaledSourceHeight; // Scaled content height
          // Need to adjust position/size slightly for stroke drawn on edge
         let adjustedBorderX = borderRectX + borderWeight / 2;
         let adjustedBorderY = borderRectY + borderWeight / 2;
         let adjustedBorderW = borderRectW - borderWeight;
         let adjustedBorderH = borderRectH - borderWeight;

         highResPG.rect(adjustedBorderX, adjustedBorderY, adjustedBorderW, adjustedBorderH);

        highResPG.pop(); // Restore highResPG state


        console.log("Saving high-res PNG...");
         // Save the high-resolution buffer as a PNG file
         saveCanvas(highResPG, `myArtboard_HIRES_${actualTargetWidth}x${recalculatedTargetHeight}_` + generateTimestampString() + '.png'); // Use recalculated height in filename
         console.log("High-res PNG save initiated.");

     } catch(e) {
        console.error("Error generating high-res PNG:", e);
        alert("Error saving high-resolution PNG. Check browser console.");
     } finally {
        // Always dispose of the temporary graphics buffer element to free up memory
        if (highResPG) {
             highResPG.elt.remove(); // Correct way to remove the graphics element
             console.log("High-res buffer disposed.");
         }
     }
}


// SAVE PDF function using zenoZeng's p5.pdf library (vector for simple shapes/text)
// Uses the global baseFont for text.
function saveCanvasAreaAsPDF() {
    console.log("SAVE PDF button pressed (using zenoZeng's p5.pdf)");

    // Check if the p5.pdf library is available
    if (typeof p5 === 'undefined' || typeof p5.prototype.createPDF !== 'function') {
         console.error("p5 or p5.pdf library (zenozeng version) not loaded correctly. Check index.html scripts and order: p5.js, p5.svg.js, p5.pdf.js, sketch.js. Clear browser cache!");
         alert("Error: PDF library not loaded. Check browser console.");
         return;
     }

    let pdf;
     try {
         // Create a p5.PDF instance, passing the current sketch instance 'this'
         if (this.createPDF && typeof this.createPDF === 'function') {
             pdf = this.createPDF();
         } else if (window.createPDF && typeof window.createPDF === 'function') {
              pdf = window.createPDF(this); // Fallback global call
         } else {
             console.error("createPDF function found, but not usable.");
             alert("Error creating PDF instance.");
             return;
         }

        if (!pdf) {
            console.error("createPDF returned null or undefined.");
            alert("Error creating PDF instance.");
            return;
        }
        console.log("p5.PDF instance created. Starting record.");

        // Begin recording drawing commands on the main canvas context
        pdf.beginRecord();

        // --- Drawing the Artboard Content for PDF Capture ---
        // This content will be mapped to a PDF page sized to CANVAS_AREA_W x CANVAS_AREA_H.

        // Set the background of the recorded area (corresponds to the PDF page) to white
        background(255); // Uses global background, drawing on main canvas temporarily

        // Translate the main canvas's coordinate system
        // This makes CANVAS_AREA_X, CANVAS_AREA_Y the new (0,0) for subsequent drawing commands
        push(); // Save global transform state
        translate(-CANVAS_AREA_X, -CANVAS_AREA_Y); // Shift origin


        // Draw placed items using global drawing commands.
        // Item coords are relative to the original screen. With the translate, they draw
        // at (item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y) which is relative to the artboard's (0,0).
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             // Skip empty text items in PDF output
              if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                 continue; // Skip drawing empty text items for PDF
             }

            // Apply item transformations using global p5 functions
            push(); // Save current state before item transforms
            translate(item.x, item.y); // Translate to item center
            rotate(item.rotation); // Rotate around center

            // Apply item's scale. The combined effect with shape size happens in drawShapePrimitive due to scale()
            let currentDisplayScale = item.scaleFactor * item.tempScaleEffect; // Including landing scale, though likely 1
            scale(currentDisplayScale); // Apply item's scale

             // Set text font for this item BEFORE drawing if it's text (using global baseFont)
            if (item.type === 'text') {
                 textFont(baseFont); // Use global baseFont ('monospace')
            }


            // Set drawing styles for the item using global p5 commands
            fill(item.color);
            noStroke(); // Assume no stroke

            // Draw the primitive shape or text centered at (0,0)
            // This calls methods on 'this' (the main canvas), which p5.pdf records
            // Passing font name here as well, though drawShapePrimitive uses global baseFont currently
             item.drawShapePrimitive(this, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust);

            pop(); // Restore state after item transforms
        }

        // Optional: Draw border around artboard area in PDF using global commands
        // Needs to be drawn in the translated context where artboard starts at (0,0)
         push();
         stroke(0); strokeWeight(1); noFill();
         rect(0, 0, CANVAS_AREA_W, CANVAS_AREA_H); // Draw border matching artboard size
         pop();


        // Restore main canvas transform state
        pop();

        // --- End Drawing commands for PDF context ---

        console.log("Finished recording. Saving PDF.");
        // Finish recording. Captures the state of the main canvas after drawing commands.
        pdf.endRecord();

        // Save the captured state as a PDF.
        // Specify the desired PDF page dimensions (matching artboard).
        pdf.save({
            filename: 'myArtboard_pdf_' + generateTimestampString(),
            width: CANVAS_AREA_W, // PDF page width matches displayed artboard width
            height: CANVAS_AREA_H, // PDF page height matches displayed artboard height
            margin: {top:0, right:0, bottom:0, left:0} // No margins for exact fit
        });

        console.log("PDF save initiated via window.print.");

     } catch(e) {
         console.error("An error occurred during PDF generation:", e);
         alert("Error generating PDF. Check browser console.");
         // Attempt to safely end recording
         if (pdf && typeof pdf.endRecord === 'function' && pdf.isRecording) {
             console.warn("Attempting to call pdf.endRecord() after caught error.");
             try{ pdf.endRecord(); } catch(endErr) { console.error("Error calling pdf.endRecord() during error handling:", endErr); }
         }
     }
}

// REFRESH button action - Replace floating shapes
function resetRandom() {
    console.log("REFRESH button pressed");
    let tempGrabbedFloatingItem = null;
    if (grabbedItem && shapes.includes(grabbedItem)) {
        tempGrabbedFloatingItem = grabbedItem;
        shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes list temp
        console.log("Keeping grabbed item while refreshing floating shapes.");
     }

    shapes = []; // Clear existing floating shapes

    // Add new random floating shapes
    for (let i = 0; i < 30; i++) {
        let newShape = new FloatingShape();
         shapes.push(newShape);
    }

    // Add the grabbed item back if held
    if (tempGrabbedFloatingItem) {
        shapes.push(tempGrabbedFloatingItem);
    }

    console.log("Refreshed floating shapes. Total shapes:", shapes.length);
}

// CLEAR button action - Resets everything
function restartAll() {
    console.log("CLEAR button pressed. Restarting state.");
    placedItems = []; // Clear items on canvas
    shapes = []; // Clear all floating shapes
    grabbedItem = null; // Ensure no item is grabbed

    inputElement.value(''); // Clear input
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder

     if (canvasPG) { // Clear canvasPG buffer visually
         canvasPG.clear();
         canvasPG.background(255);
          console.log("canvasPG buffer cleared.");
     }

    // Generate a new set of initial floating shapes
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }

    console.log("State cleared and repopulated with new floating shapes. Total shapes:", shapes.length);
}

// WINDOW RESIZED FUNCTION - Handles responsive layout and canvasPG resizing
function windowResized() {
    console.log("Window resized to:", windowWidth, windowHeight);
    resizeCanvas(windowWidth, windowHeight); // Resize the main p5 canvas

     // Recalculate canvas area dimensions and position
     // Ensure CANVAS_AREA_W is reasonable relative to window width
     const adjustedCanvasW = min(CANVAS_AREA_W, windowWidth * 0.95); // Max width 95% of window or original 500

     // !!! Change height ratio to sqrt(2) !!!
    CANVAS_AREA_H = adjustedCanvasW * Math.sqrt(2); // Maintain 1:sqrt(2) aspect ratio (B paper format)
    // !!! END OF REQUEST 1 !!!

    CANVAS_AREA_X = width / 2 - adjustedCanvasW / 2; // Center horizontally
    CANVAS_AREA_Y = HEADER_HEIGHT + 20; // Position below header
    if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0; // Clamp X

    let headerCenterY = HEADER_HEIGHT / 2; // Vertical center for header elements

    // Input Element Positioning & Sizing - Relative to updated CANVAS_AREA
    if (inputElement) {
        inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
        inputElement.size(adjustedCanvasW);
    }

    // Helper function to get button width safely
     const btnWidth = (btn) => btn ? btn.size().width : 0;

    // Button positioning for the right-aligned group
    let buttonSpacing = 8;
    let buttonHeight = 30;
    let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2;
    let rightMargin = 15;

    // Get widths of all buttons
    let savePNGBtnW = btnWidth(savePNGButton);
    let saveHighResPNGBtnW = btnWidth(saveHighResPNGButton); // New button width
    let savePDFBtnW = btnWidth(savePDFButton);
    let clearBtnW = btnWidth(clearButton);
    let refreshBtnW = btnWidth(refreshButton);

    // Calculate total width including all buttons and spacing
    let totalButtonWidth = savePNGBtnW + saveHighResPNGBtnW + savePDFBtnW + clearBtnW + refreshBtnW;
    let numButtons = (savePNGButton?1:0) + (saveHighResPNGButton?1:0) + (savePDFButton?1:0) + (clearButton?1:0) + (refreshButton?1:0);
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);

     // Calculate starting X for the button block from the right edge
     let buttonBlockStartX = width - rightMargin - (totalButtonWidth + totalSpacing);
    // Prevent buttons from overlapping input field area significantly
    let minButtonStartX = (inputElement ? inputElement.position().x + inputElement.size().width + 20 : 20); // Right of input + margin, or from left if no input
    buttonBlockStartX = max(buttonBlockStartX, minButtonStartX); // Use the greater of calculated position or minimum allowed


    let currentButtonX = buttonBlockStartX;

    // Position buttons in desired order: REFRESH, CLEAR, SAVE PNG, SAVE HI-RES PNG, SAVE PDF
    if (refreshButton) { refreshButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += refreshBtnW + buttonSpacing; }
    if (clearButton) { clearButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += clearBtnW + buttonSpacing; }
    if (savePNGButton) { savePNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += savePNGBtnW + buttonSpacing; }
     if (saveHighResPNGButton) { saveHighResPNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += saveHighResPNGBtnW + buttonSpacing; } // Position new button
    if (savePDFButton) { savePDFButton.position(currentButtonX, buttonPadY_buttons); /* Last button */ }


     // --- Resize or Recreate canvasPG buffer ---
     // This buffer represents the artboard view and must match the new calculated dimensions
    if (canvasPG) {
        // If exists, resize if necessary
        if (canvasPG.width !== adjustedCanvasW || canvasPG.height !== CANVAS_AREA_H) {
             console.log("Resizing canvasPG buffer to:", adjustedCanvasW, CANVAS_AREA_H);
             // resizeCanvas method clears the buffer, will be redrawn by draw()
             canvasPG.resizeCanvas(adjustedCanvasW, CANVAS_AREA_H);
             canvasPG.background(255); // Set background after resize
         }
     } else if (adjustedCanvasW > 0 && CANVAS_AREA_H > 0) {
          // If buffer doesn't exist, create it (should only happen initially if setup order was off)
          console.log("Creating canvasPG buffer in windowResized as it was null.");
          canvasPG = createGraphics(adjustedCanvasW, CANVAS_AREA_H);
           canvasPG.background(255);
     } else {
         console.warn("Invalid CANVAS_AREA dimensions (" + adjustedCanvasW + "x" + CANVAS_AREA_H + ") after resize. Cannot create or resize canvasPG buffer.");
         if(canvasPG) { canvasPG.remove(); canvasPG = null; } // Nuke invalid buffer
     }

     console.log("Finished windowResized.");
}