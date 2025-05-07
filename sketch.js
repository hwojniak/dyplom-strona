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
  '#0000FE', // Blue triangle
  '#FFDD00', // Yellow pentagon
  '#E70012', // Red hexagon
  '#FE4DD3', // Pink square
  '#41AD4A', // Green shape (general term, not specified type)
  '#000000', // Black
  '#222222', // Dark Grey
  '#FFFFFF',  // White
  '#FFA500', // Orange
];

// Updated and expanded list of text options (some are placeholders or defaults)
const TEXT_OPTIONS = [
  "TYPE SOMETHING...", // Placeholder/default
  "I LOVE MOM",
  "MUZYKA MNIE DOTYKA",
  "SOMETHING something 123",
  "Hi, I'm...",
  "TOOL",
  "ART PIECE",
  "WORK WORK WORK",
  "GENERATIVE",
  "VECTOR",
  "RASTER",
  "CANVAS",
  "INTERFACE"
];

// List of Google Font NAMES loaded in index.html
// Inter will be the base font used by default for input and header.
let availableFontNames = [];
let baseFont = 'Inter'; // The desired default font name


let SNAP_INCREMENT_RADIANS;

// Define size categories for shapes
const sizeCategories = [
  { name: 'small', sizeRange: [50, 80], scaleRange: [0.8, 1.2], textScaleAdjust: 0.25 }, // Slightly increased textScaleAdjust for smaller fonts
  { name: 'medium', sizeRange: [80, 150], scaleRange: [1.0, 1.8], textScaleAdjust: 0.3 }, // Increased textScaleAdjust
  { name: 'large', sizeRange: [150, 250], scaleRange: [1.2, 2.5], textScaleAdjust: 0.35 } // Increased textScaleAdjust
];

// Small tolerance for click detection near shape edges in screen pixels
const CLICK_TOLERANCE = 5; // Pixels

// Variable for the canvas graphics buffer for the central artboard area
let canvasPG;

// --- Utility functions for precise mouse collision and text bounds ---

// Transforms global coordinates to an object's local, unscaled, unrotated coordinates.
function transformPointToLocal(gx, gy, objX, objY, objRotation, objScale) {
  let tx = gx - objX;
  let ty = gy - objY;
  // Ensure objRotation and objScale are valid numbers and scale is not zero
  if (isNaN(objRotation)) objRotation = 0;
  if (isNaN(objScale) || objScale === 0) objScale = 1; // Use default scale if invalid

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
    let halfW = w / 2;
    let halfH = h / 2;
    return px >= -halfW - tolerance && px <= halfW + tolerance && py >= -halfW - tolerance && py <= halfW + tolerance; // FIX: Was checking h against W. Corrected: check px against halfW, py against halfH
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

// Gets local vertices for unrotated polygon shapes centered at (0,0).
function getTriangleVertices(size) { // size acts as base ref, triangle drawn differently
    let heightBased = size * 0.8; // These proportions match your drawing code
    let baseWidthBased = size * 0.8; // Base half-width
    let baseY = size * 0.4; // Vertical offset of the base from center
     // Correct vertex order for winding and potentially add offset from 0,0 origin in drawing primitive
    return [{ x: 0, y: -heightBased }, { x: -baseWidthBased, y: baseY }, { x: baseWidthBased, y: baseY }]; // Correct vertex positions relative to object center (0,0)
}

function getSquareVertices(size) { // size acts as side length
    let halfSize = size / 2;
    return [{ x: -halfSize, y: -halfSize }, { x: halfSize, y: -halfSize }, { x: halfSize, y: halfSize }, { x: -halfSize, y: halfSize }];
}

function getPentagonVertices(size) { // size acts as radius ref * 0.7, centered for polygon drawing
    let sides = 5;
    let radius = size * 0.7; // Matches drawShapePrimitive
    let vertices = [];
    for (let i = 0; i < sides; i++) {
        let angle = TWO_PI / sides * i;
        let sx = cos(angle - HALF_PI) * radius; // Added the - HALF_PI adjustment to orient the pentagon vertex upwards, matching primitive
        let sy = sin(angle - HALF_PI) * radius;
        vertices.push({ x: sx, y: sy });
    }
    return vertices;
}

function getHexagonVertices(size) { // size acts as radius, centered for polygon drawing
     let sides = 6;
     let radius = size; // Matches drawShapePrimitive
     let vertices = [];
     for (let i = 0; i < sides; i++) {
         let angle = TWO_PI / sides * i;
         let sx = cos(angle) * radius; // Hexagon usually drawn point-up if starting at angle 0 (right) with sin 0 = 0, cos 0 = 1. Angle - HALF_PI rotates to vertex-up.
         // BUT, your existing draw primitive for hexagon does NOT have - HALF_PI, drawing it flat-side up. Let's match the draw primitive here.
         let hx = cos(angle) * radius;
         let hy = sin(angle) * radius;
         vertices.push({ x: hx, y: hy });
     }
    return vertices;
}

// Gets local vertices for unrotated shapes, accounting for their primitive drawing implementation details.
function getLocalShapeVertices(shapeType, size) {
    switch(shapeType) {
        case 'triangle': return getTriangleVertices(size);
        case 'square': return getSquareVertices(size);
        case 'pentagon': return getPentagonVertices(size);
        case 'hexagon': return getHexagonVertices(size);
        // Circle doesn't have vertices for edge check
        default: return []; // Return empty array for types like circle or 'none'
    }
}


// Checks if a point is strictly inside a convex polygon (local coords).
function isPointInConvexPolygon(px, py, vertices) {
  let numVertices = vertices.length;
  if (numVertices < 3) return false;
  let has_pos = false, has_neg = false;
  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i], v2 = vertices[(i + 1) % numVertices];
    // Calculate vector from v1 to v2 and from v1 to point (px, py)
    let edgeX = v2.x - v1.x;
    let edgeY = v2.y - v1.y;
    let pointVecX = px - v1.x;
    let pointVecY = py - v1.y;

    // Cross product (or perpendicular dot product) to find which side the point is on
    let cross_product = edgeX * pointVecY - edgeY * pointVecX;

    // Check the sign with a small epsilon for floating point comparisons
    if (cross_product > 1e-6) has_pos = true;
    if (cross_product < -1e-6) has_neg = true;

    // If the point is on different sides of different edges, it's outside a convex polygon
    if (has_pos && has_neg) return false;
  }
   // If we looped through all edges and the point was always on the same side (or exactly on an edge),
   // then it's inside or on the boundary.
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
// Pass font name string.
function getTextBounds(content, effectiveTextSize, fontNameRef) {
    // console.log("getTextBounds called with:", content, effectiveTextSize, fontNameRef); // Debugging line

    // Handle potential issues with temp graphics creation/usage or invalid parameters
    if (!content || content.trim() === "" || effectiveTextSize <= 0) return { w: 0, h: 0 };
     if (!fontNameRef || typeof fontNameRef !== 'string') fontNameRef = baseFont; // Fallback to baseFont name

    let tempPG = null;
    let textW = 0;
    let textH = 0;

    try {
         // Create a temporary graphics buffer. Give it a size large enough initially to avoid immediate issues.
         tempPG = createGraphics(max(100, effectiveTextSize * content.length), max(50, effectiveTextSize * 2));

        // Apply font properties to the temp buffer context
        tempPG.textSize(effectiveTextSize);
        tempPG.textFont(fontNameRef); // Use the font name reference provided
        tempPG.textAlign(CENTER, CENTER); // Set textAlign as it's used in drawShapePrimitive (determines text origin for measurement)

        // p5.js textWidth/textAscent/textDescent methods need to be called ON the PG object for measurement.
        textW = tempPG.textWidth(content);
        let textAsc = tempPG.textAscent();
        let textDesc = tempPG.textDescent();
        textH = textAsc + textDesc; // Total height

    } catch (e) {
        console.error("Error in getTextBounds for content '" + content + "' and size " + effectiveTextSize + ":", e);
         // Return an estimated size based on font size and rough average char width/height
        // Monaco average width/height is about 0.6/1.2 of size.
         textW = effectiveTextSize * content.length * 0.6;
         textH = effectiveTextSize * 1.2;
    } finally {
         // Always dispose of the temporary buffer's DOM element if it was created
        if (tempPG && tempPG.elt) {
             tempPG.elt.remove(); // Properly remove the DOM element
         }
    }

    return { w: textW, h: textH };
}


// --- FloatingShape Class ---
class FloatingShape {
  constructor() {
    this.reset();
    this.isGrabbed = false; // Indicates if the item is currently held by the mouse
    this.isPlacing = false; // Indicates if the item is currently landing on the artboard
    this.landFrame = -1;    // Frame count when landing started for animation
    this.tempScaleEffect = 1; // Temporary scale for landing animation
    this.fontName = baseFont; // Default font name for this shape instance (if text)
  }

  reset() {
    let edge = floor(random(4));
    let posAlong = random(0.2, 0.8); // Safer spawning zone initially
    let categoryIndex = floor(random(sizeCategories.length));
    let category = sizeCategories[categoryIndex];
    this.size = random(category.sizeRange[0], category.sizeRange[1]);
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]);
    this.currentSize = this.size * this.scaleFactor; // Represents scaled 'size' value, not visual width/height

    let minSpeed = 1.5, maxSpeed = 3.5; // Floating speeds
     // offScreenOffset: Use a size-dependent offset but with a minimum
     // Calculate rough maximal extent considering scaled dimension for offscreen check
     let roughMaxDimension = this.calculateMaxEffectiveDimension();
     let offScreenOffset = max(roughMaxDimension * this.scaleFactor, 200); // Use scaled dimension plus a buffer


    switch (edge) {
      case 0: this.x = width * posAlong; this.y = -offScreenOffset; this.speedX = random(-1, 1); this.speedY = random(minSpeed, maxSpeed); break; // Top
      case 1: this.x = width + offScreenOffset; this.y = height * posAlong; this.speedX = random(-maxSpeed, -minSpeed); this.speedY = random(-1, 1); break; // Right
      case 2: this.x = width * posAlong; this.y = height + offScreenOffset; this.speedX = random(-1, 1); this.speedY = random(-maxSpeed, -minSpeed); break; // Bottom
      case 3: this.x = -offScreenOffset; this.y = height * posAlong; this.speedX = random(minSpeed, maxSpeed); this.speedY = random(-1, 1); break; // Left
    }

    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.003, 0.003) * random(1, 3);

    // Picking color based on PALETTE (includes Black and Dark Grey)
    let pickedColor = color(random(PALETTE));
     this.color = pickedColor; // Default color pick

    this.type = random() < 0.7 ? 'shape' : 'text'; // Slightly favor shapes

    if (this.type === 'shape') {
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']);
        this.content = null;
        this.textScaleAdjust = 0;
        this.fontName = null; // Shapes don't have font names
    } else { // type is 'text'
         this.shapeType = 'none';
          // Pick initial text, retry if it's empty or placeholder-like
         let initialContent = random(TEXT_OPTIONS.slice(1)); // Avoid initial placeholder
         while(!initialContent || initialContent.trim() === ""){
            initialContent = random(TEXT_OPTIONS.slice(1)); // Keep picking from actual options
         }
         this.content = initialContent.trim(); // Use trimmed content

         let category = sizeCategories[categoryIndex]; // Use same category picked for size/scale
         this.textScaleAdjust = category.textScaleAdjust;

         // Pick a random font name from the available list
         this.fontName = random(availableFontNames);

         // Ensure text color has enough contrast against a WHITE background (assumed for artboard)
          // Brightness check: White is 100, Black is 0. If text color is close to white (e.g., > ~75-80 brightness), might be hard to see.
          let textBgBrightness = 100; // White background has brightness 100
         let chosenColorBrightness = brightness(pickedColor);

         // If the picked color's brightness is high OR if it's very desaturated while being moderately bright (e.g. light gray), pick a different one.
         // A more robust check might consider hue/saturation, but checking high brightness is a good start for readability on white.
         let attempts = 0;
         while (attempts < 10) {
            // Check if color is too bright or too gray and relatively bright
            if (chosenColorBrightness > 85 || (chosenColorBrightness > 60 && saturation(pickedColor) < 20)) { // Example thresholds: Brightness > 85 OR Brightness > 60 and low saturation (< 20)
                 pickedColor = color(random(PALETTE)); // Try again from full palette
                 chosenColorBrightness = brightness(pickedColor);
                 attempts++;
            } else {
                break; // Color seems okay for text on white
            }
         }
         this.color = pickedColor; // Assign the selected (or fallback) color
    }

    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;
  }

  // Helper to estimate max dimension (radius equivalent) for off-screen check
  calculateMaxEffectiveDimension() {
       if (this.type === 'text' && this.content && this.fontName) {
             let effectiveTextSize = this.size * this.textScaleAdjust;
              let textBounds = getTextBounds(this.content, effectiveTextSize, this.fontName);
             return max(textBounds.w, textBounds.h) * 0.6; // rough estimate of half-diagonal/radius
        } else if (this.type === 'shape') {
             switch(this.shapeType) {
                  case 'circle': return this.size; // size is radius
                  case 'square': return this.size * Math.SQRT2 / 2; // half diagonal
                  case 'triangle': // Calculate max distance from origin (0,0) to any vertex
                    let triVertices = getTriangleVertices(this.size);
                     let maxTriDistSq = 0;
                     for(let v of triVertices) maxTriDistSq = max(maxTriDistSq, v.x*v.x + v.y*v.y);
                     return sqrt(maxTriDistSq);
                  case 'pentagon': return this.size * 0.7; // radius used in drawing
                  case 'hexagon': return this.size; // radius used in drawing (vertex-to-center)
                  default: return this.size || 50; // Fallback radius
             }
        } else { return this.size || 50; } // Default basic size estimate (radius)
  }


  update() {
     if (!this.isGrabbed && !this.isPlacing) {
       this.x += this.speedX;
       this.y += this.speedY;
       this.rotation += this.rotationSpeed;
     }
     this.currentSize = this.size * this.scaleFactor;
      // Add bounds check to keep position somewhat valid in case of physics glitches
      this.x = constrain(this.x, -width*2, width*2);
      this.y = constrain(this.y, -height*2, height*2);
  }

   // Checks if the object is significantly off-screen
   isReallyOffScreen() {
        let maxEffectiveRadius = this.calculateMaxEffectiveDimension() * this.scaleFactor; // Use scaled dimension as radius
      // Increased buffer zone
      let buffer = max(width, height) * 0.5; // Buffer is 50% of the largest screen dimension
      return this.x < -buffer - maxEffectiveRadius || this.x > width + buffer + maxEffectiveRadius ||
             this.y < -buffer - maxEffectiveRadius || this.y > height + buffer + maxEffectiveRadius;
  }


  // Updates the scaling effect for the landing animation
  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame;
        let duration = 45; // Landing animation duration (frames)
        if (elapsed <= duration) {
            let t = map(elapsed, 0, duration, 0, 1);
            let pulseScale = 1 + sin(t * PI) * 0.05; // Subtle pulse (scales between 1 and 1.05)
            this.tempScaleEffect = pulseScale;
        } else {
            this.isPlacing = false;
            this.tempScaleEffect = 1; // Ensure scale resets exactly to 1
            this.landFrame = -1;
        }
    } else if (!this.isPlacing && this.tempScaleEffect !== 1 && this.landFrame !== -1) {
         // Reset scale effect if somehow placing got interrupted
         this.tempScaleEffect = 1;
         this.landFrame = -1;
    }
  }

   // General display function used for drawing on main canvas or other contexts (PG)
   // graphics: The p5 graphics object target (e.g., 'this' for main, 'canvasPG' for PG buffer)
   // showGrabEffect: Apply grabbed visual style? (Only applies if graphics === this and shape is grabbed)
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
     // Apply landing scale if active and NOT grabbed. Use 1 if graphics is not main canvas
    let currentDisplayScale = this.scaleFactor * (graphics === this && !this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale);

    // Only draw grabbed effect on main canvas ('this') IF the flag is true
     if (showGrabEffect && graphics === this && this.isGrabbed) {
         // Temporarily apply styles to the graphics context
         graphics.push(); // Save the state of the graphics context
         graphics.drawingContext.shadowBlur = 40;
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
         graphics.stroke(255, 255, 255, 200);
         graphics.strokeWeight(3 / currentDisplayScale); // Adjust stroke weight inverse to scale
         graphics.noFill();
         // draw the shape outline without fill using the primitive renderer
         // graphics context, position (0,0), base size, shape type, isText, textScaleAdjust, fontName
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust, this.fontName);
         graphics.drawingContext.shadowBlur = 0; // Reset shadow blur immediately after drawing the outline
         graphics.pop(); // Restore state after drawing effect (resets stroke/fill/shadow)
    }

    graphics.fill(this.color);
    graphics.noStroke(); // No stroke for the main fill/text

    // Draw the core geometry or text centered at (0,0) in the object's local space.
    // Uses methods provided by the graphics context (e.g., graphics.rect, graphics.text).
    // parameters: graphics context, position (always 0,0 here), base size, shape type, isText, textScaleAdjust, fontName
    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust, this.fontName);
    graphics.pop(); // Restore state after drawing item
  }

  // Draws the shape's core geometry or text centered at (px, py), with base size psize.
  // Assumes transformations (translate, rotate, scale) are already applied to the 'graphics' context.
  // This function uses methods provided by the graphics context (e.g., graphics.rect, graphics.text).
  // It also requires the fontName string for text drawing.
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2, fontNameRef) {
        // Check if graphics context is valid
        if (!graphics || typeof graphics.rectMode !== 'function' || typeof graphics.text !== 'function' || typeof graphics.beginShape !== 'function') {
             console.warn("Invalid graphics context in drawShapePrimitive for item:", this);
             return; // Skip drawing if context is invalid
         }

        if (isText) {
             if (!this.content || this.content.trim() === "") { // Allow empty text to exist but not draw
                 return;
             }
              if (!fontNameRef || typeof fontNameRef !== 'string') fontNameRef = baseFont; // Fallback font name

             // Apply text properties to the provided graphics context
             graphics.textFont(fontNameRef); // Use the specific font name
             graphics.textAlign(CENTER, CENTER);
             let effectiveTextSize = psize * textScaleAdjust; // Calculate effective size relative to base psize
              effectiveTextSize = max(effectiveTextSize, 1); // Ensure min text size
             graphics.textSize(effectiveTextSize); // Set text size

             graphics.text(this.content, px, py); // Draw text centered at px, py
         } else { // It's a shape
              // Set rect drawing mode on this context before potentially drawing rects
              // Needs to be called on the specific graphics object
              if (typeof graphics.rectMode === 'function') graphics.rectMode(CENTER);
              else { /* console.warn("graphics.rectMode not available on context:", graphics); */ }

             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break; // psize is radius ref, draw needs diameter
               case 'square': graphics.rect(px, py, psize, psize); break; // psize is side length ref
               case 'triangle':
                 graphics.beginShape();
                 graphics.vertex(px, py - psize * 0.8); // Apex
                 graphics.vertex(px - psize * 0.8, py + psize * 0.4); // Left base corner
                 graphics.vertex(px + psize * 0.8, py + psize * 0.4); // Right base corner
                 graphics.endShape(CLOSE);
                 break;
               case 'pentagon':
                  graphics.beginShape();
                  let sidesP = 5; let radiusP = psize * 0.7;
                  for (let i = 0; i < sidesP; i++) {
                     let angle = TWO_PI / sidesP * i;
                     let sx = cos(angle - HALF_PI) * radiusP; // Matches getPentagonVertices logic
                     let sy = sin(angle - HALF_PI) * radiusP;
                     graphics.vertex(px + sx, py + sy);
                  }
                  graphics.endShape(CLOSE);
                  break;
               case 'hexagon':
                 graphics.beginShape();
                 let sidesH = 6; let radiusH = psize;
                 for (let i = 0; i < sidesH; i++) {
                    // Your original hexagon drawing doesn't add - HALF_PI, draws a point on the right
                    // This makes it flat-side up. Let's match that behavior here and in getHexagonVertices
                    let angle = TWO_PI / sidesH * i;
                    let hx = cos(angle) * radiusH;
                    let hy = sin(angle) * radiusH;
                    graphics.vertex(px + hx, py + hy);
                 }
                 graphics.endShape(CLOSE);
                 break;
               default:
                  // console.warn("drawShapePrimitive: Unknown shape type or 'none':", pshapeType);
                 break; // Draw nothing for unknown types or 'none'
             }
         }
   }

  // Checks if mouse coordinates (mx, my) are over this shape or text item.
  isMouseOver(mx, my) {
       // Basic validation of object state
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) || isNaN(this.scaleFactor) || isNaN(this.size) || this.scaleFactor <= 0 || this.size <= 0) {
            // console.warn("isMouseOver: Invalid object state or zero size/scale:", this);
            return false; // Cannot click on an invalid or zero-sized item
       }
      // Ignore interaction while landing animation is finishing (prevents accidental grabs right after dropping)
      if(this.isPlacing && frameCount - this.landFrame < 60) { // Add a small grace period after animation finishes
          // console.log("Ignoring mouse over during landing animation.");
          return false;
      }


       // Convert mouse coordinates from global (sketch window) to object's local space.
       // Uses the item's current display scale (which might include the landing pulse effect tempScaleEffect).
       let currentDisplayScale = this.scaleFactor * this.tempScaleEffect; // Use display scale for hit area
       // console.log("Mouse", mx, my, "Item:", this.x, this.y, "Scale:", currentDisplayScale, "Rotation:", this.rotation); // Debug
       let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, currentDisplayScale);
       let localMx = localMouse.x, localMy = localMouse.y;
       // console.log("Local mouse:", localMx, localMy); // Debug


        // Calculate tolerance in local object pixels. Scale inverse to object scale, minimum pixel tolerance.
        let localTolerance = CLICK_TOLERANCE / currentDisplayScale;
         localTolerance = max(localTolerance, 2); // Ensure minimum local tolerance
         // console.log("Local Tolerance:", localTolerance); // Debug

       if (this.type === 'text') {
           if (!this.content || this.content.trim() === "" || this.fontName === null) { // Check fontName existence
               return false; // Cannot click empty text
           }
           let effectiveTextSize = this.size * this.textScaleAdjust;
            // Get text bounds (width/height) in local coordinate space (centered at 0,0)
           let textBounds = getTextBounds(this.content, effectiveTextSize, this.fontName); // Use item's font name
           // Check if local mouse point is within or near the text bounding box.
           // Use textBounds.w and textBounds.h as the dimensions of the centered rectangle.
           let isOver = isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);
           // console.log("Mouse over Text bounds check:", textBounds, "Local mouse:", localMx, localMy, "Tolerance:", localTolerance, "Result:", isOver); // Debug
           return isOver;

       } else { // type is 'shape'
            // Size property refers to the base size used before scaleFactor
            // For polygon shapes, check strict interior first, then edge proximity
           switch (this.shapeType) {
              case 'circle':
                 let distToCenter = dist(localMx, localMy, 0, 0);
                 let isOverCircle = distToCenter <= this.size + localTolerance; // size is radius for circle
                 // console.log("Mouse over Circle check:", "Dist:", distToCenter, "Radius+Tol:", this.size + localTolerance, "Result:", isOverCircle); // Debug
                 return isOverCircle;
              case 'square':
                 // isPointInAxisAlignedRect checks for square shape where size is width/height
                 let isOverSquare = isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);
                  // console.log("Mouse over Square bounds check:", "Size:", this.size, "Local mouse:", localMx, localMy, "Tolerance:", localTolerance, "Result:", isOverSquare); // Debug
                 return isOverSquare;
              case 'triangle':
                  let triVertices = getLocalShapeVertices(this.shapeType, this.size);
                   if (isPointInConvexPolygon(localMx, localMy, triVertices)) return true; // Inside check
                  let isNearTriEdge = isPointNearPolygonEdge(localMx, localMy, triVertices, localTolerance); // Edge check
                  // console.log("Mouse over Triangle check:", "Local mouse:", localMx, localMy, "Tol:", localTolerance, "Vertices:", triVertices, "Near Edge:", isNearTriEdge); // Debug
                  return isNearTriEdge; // Return result of edge check if not strictly inside
              case 'pentagon':
                  let pentVertices = getLocalShapeVertices(this.shapeType, this.size);
                  if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true; // Inside check
                  let isNearPentEdge = isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance); // Edge check
                   // console.log("Mouse over Pentagon check:", "Local mouse:", localMx, localMy, "Tol:", localTolerance, "Vertices:", pentVertices, "Near Edge:", isNearPentEdge); // Debug
                  return isNearPentEdge; // Return result of edge check
              case 'hexagon':
                   let hexVertices = getLocalShapeVertices(this.shapeType, this.size);
                  if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true; // Inside check
                   let isNearHexEdge = isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance); // Edge check
                    // console.log("Mouse over Hexagon check:", "Local mouse:", localMx, localMy, "Tol:", localTolerance, "Vertices:", hexVertices, "Near Edge:", isNearHexEdge); // Debug
                  return isNearHexEdge; // Return result of edge check
              default:
                   // Fallback check for unknown shapes (shouldn't happen if shapes array populated correctly)
                   console.warn("isMouseOver: Fallback check for unknown shape type:", this.shapeType);
                   return dist(localMx, localMy, 0, 0) <= (this.size * this.scaleFactor * 0.5) + localTolerance; // Roughly check radius based on scaled size
           }
       }
    }

  // Sets the shape's speeds/rotation speed to zero
  solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}


function preload() {
  // Custom font loading is typically not needed for Google Fonts linked via HTML.
  // p5 should be able to reference them by name strings provided they are loaded.
  // If font display is inconsistent, using loadFont here would be necessary.
  // baseFont = loadFont('path/to/your/inter.otf'); // Example if using loadFont
}

function setup() {
  // Use standard canvas for live rendering (PNG, browser view)
  createCanvas(windowWidth, windowHeight);
  // Enable p5.RendererGL if using P2D for potentially better font rendering consistency across browsers
  // createGraphics(w, h, P2D); // Use this mode for canvasPG if desired, not createGraphics(w, h) default which might be different

  SNAP_INCREMENT_RADIANS = radians(15);

  // Populate the list of font names available for random text shapes
  availableFontNames = ["Inter", "Cherry Bomb One", "Cinzel Decorative", "Bangers", "DynaPuff", "Bree Serif", "VT323", "Share Tech Mono", "Permanent Marker", "Caveat Brush"];

  // Calculate initial canvas area dimensions and position
   // Ensure CANVAS_AREA_W is reasonable if windowWidth is very small
  const adjustedCanvasW = min(CANVAS_AREA_W, windowWidth * 0.95); // Adjusted to use 95% max

  // NEW: B Paper format aspect ratio is 1 : sqrt(2)
  CANVAS_AREA_H = adjustedCanvasW * Math.sqrt(2); // Height = Width * sqrt(2)

  CANVAS_AREA_X = width / 2 - adjustedCanvasW / 2; // Center horizontally
  CANVAS_AREA_Y = HEADER_HEIGHT + 20; // Position below header
  if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0; // Ensure valid minimum position
  if(CANVAS_AREA_Y < HEADER_HEIGHT + 10) CANVAS_AREA_Y = HEADER_HEIGHT + 10; // Ensure minimum Y position


  // Create canvas graphics buffer for the visible artboard area.
  // Use P2D renderer for potentially better font handling if necessary, requires p5.min.js/p5.js + p5.sound.js/p5.dom.js bundle or specific imports.
  // For simpler Google Fonts + basic P5, the default WEBGL/2D renderer (depends on environment) is often fine.
   if (canvasPG) { canvasPG.remove(); } // Remove existing if any
    // Ensure positive dimensions before creating buffer
   if(adjustedCanvasW > 0 && CANVAS_AREA_H > 0) {
       canvasPG = createGraphics(adjustedCanvasW, CANVAS_AREA_H);
       canvasPG.background(255); // Initial white background
       console.log("Created canvasPG buffer:", canvasPG.width, canvasPG.height);
   } else {
       console.warn("Failed to create canvasPG buffer due to invalid dimensions:", adjustedCanvasW, CANVAS_AREA_H);
   }


  let headerCenterY = HEADER_HEIGHT / 2;

  // Input element setup
  inputElement = createInput();
  inputElement.value('');
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
   // Position relative to the calculated CANVAS_AREA_X/Y
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15); // Position vertically centered in header, offset up by half input height roughly
  inputElement.size(adjustedCanvasW); // Match input width to adjusted artboard width
  inputElement.style("padding", "5px 10px")
               .style("border", "1px solid #ccc")
               .style("border-radius", "15px")
               .style("outline", "none")
               .style("background-color", color(255, 255, 255, 200))
               .style("font-size", "14px")
               .style("color", color(50))
               .style("box-sizing", "border-box") // Include padding in size calculation
               .style("font-family", baseFont + ', sans-serif'); // Use base font for input


  // --- Button setup (positioned dynamically in windowResized) ---
  // Note: Button creation MUST happen after createCanvas, positioning happens later
  // Standard p5.dom buttons. Use .style() to customize.

  savePNGButton = createButton("SAVE PNG (Web)");
  savePNGButton.mousePressed(saveCanvasAreaAsPNG);

   saveHighResPNGButton = createButton("SAVE HI-RES PNG (Print)");
   saveHighResPNGButton.mousePressed(saveCanvasAreaAsHighResPNG);

   savePDFButton = createButton("SAVE PDF (Vector)");
   savePDFButton.mousePressed(saveCanvasAreaAsPDF);

  clearButton = createButton("CLEAR ALL");
   clearButton.mousePressed(restartAll);

  refreshButton = createButton("NEW SHAPES");
   refreshButton.mousePressed(resetRandom);

  // Apply standard styles to buttons (can be improved with CSS class)
  const applyButtonStyle = (btn) => {
       btn.style("padding", "5px 10px")
           .style("border", "1px solid #888")
           .style("border-radius", "15px")
           .style("background-color", color(200, 200)) // Slightly transparent background
           .style("color", color(50))
           .style("cursor", "pointer") // Indicate clickable
           .style("font-family", baseFont + ', sans-serif') // Use base font for buttons
           .style("font-size", "14px");
         // Hover effects etc. can be added with vanilla JS mouseover/out listeners or CSS classes
  };

  applyButtonStyle(savePNGButton);
  applyButtonStyle(saveHighResPNGButton);
  applyButtonStyle(savePDFButton);
  applyButtonStyle(clearButton);
  applyButtonStyle(refreshButton);


   // Initial positioning of DOM elements after creation/styling
   // Call windowResized initially to place elements and resize canvasPG
   windowResized();

  // Create initial floating shapes
  while (shapes.length < 30) { shapes.push(new FloatingShape()); }

   console.log("Setup complete.");
}


function draw() {
  // Set background for the main sketch window (the area around the artboard)
  background(0); // Black background as requested


  // --- Update and Draw Floating Shapes ---
  // Filter out shapes that are far off-screen, unless they are grabbed or landing
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing || shape.landFrame !== -1);
  while (shapes.length < 20) { shapes.push(new FloatingShape()); } // Maintain minimum floating shapes count

  for (let shape of shapes) {
     // Only update position/rotation if free-floating
     if (!shape.isGrabbed && !shape.isPlacing && shape.landFrame === -1) { shape.update(); }
     shape.updateLanding(); // Always update landing state/animation if applicable

     // Draw floating shapes on the main canvas ('this'). No offset needed, draw at shape.x, shape.y directly.
     // Pass true for showGrabEffect if the item is currently the one being grabbed.
     shape.display(this, grabbedItem === shape, 0, 0);
  }


  // --- Central White Canvas Area Drawing (Rendered to canvasPG buffer) ---
  // This buffer (`canvasPG`) represents the fixed artboard content that gets saved.
  if(canvasPG){
     canvasPG.clear(); // Clear buffer content from previous frame
     canvasPG.background(255); // Draw white background on buffer

    // Draw placed items onto canvasPG (fixed on the artboard)
    // Item coordinates are relative to the overall sketch window (this.x, this.y)
    // We draw them onto canvasPG at (item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y)
    // which correctly positions them relative to the canvasPG's top-left (0,0).
    for (let item of placedItems) {
        item.updateLanding(); // Update landing animation state
         // Draw item onto canvasPG, using offsets to translate item.x/y relative to canvasPG's origin.
        item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
    }

    // Draw the canvasPG buffer onto the main canvas at the calculated position (CANVAS_AREA_X, CANVAS_AREA_Y)
    image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
  } else {
      // Error state: Draw a visual indicator if canvasPG buffer failed to create
       fill(255, 100, 100); rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
       fill(0); textAlign(CENTER, CENTER); textFont(baseFont); textSize(16);
       text("Error: Canvas area buffer failed to load.\nCheck console.", CANVAS_AREA_X + CANVAS_AREA_W/2, CANVAS_AREA_Y + CANVAS_AREA_H/2);
  }


  // Draw border around canvas area on main canvas (on top of the canvasPG image)
  stroke(200);
  strokeWeight(1);
  noFill();
  rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);


  // Draw grabbed item on top of everything else on the main canvas
  // Update grabbed item's position to follow mouse with smoothing (lerp)
  if (grabbedItem) {
     // Apply lerp outside of display call as it affects this.x/y
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.3); // Reduced smoothing factor slightly
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.3);

      // Ensure grabbed item is solidified and its placing animation stops
     if (grabbedItem.speedX !== 0 || grabbedItem.speedY !== 0 || grabbedItem.rotationSpeed !== 0) grabbedItem.solidify();
     if (grabbedItem.isPlacing) grabbedItem.isPlacing = false; // Cancel any landing animation state

     // Draw the grabbed item on the main canvas with the grabbed visual effect
     // Draw at item.x, item.y with no offset relative to the main canvas origin.
     grabbedItem.display(this, true, 0, 0); // showGrabEffect is true
  }


  // --- DRAW HEADER / UI OVERLAY ---
  fill(220, 230); // Semi-transparent light grey background for header
  noStroke();
  rect(0, 0, width, HEADER_HEIGHT);

  fill(50); // Dark grey text color
  textSize(20);
  textAlign(LEFT, CENTER);
  textFont(baseFont); // Use base font for header text
  text("YOUR BRAND / LOGO", 20, HEADER_HEIGHT / 2); // Adjusted header text

   // Indicate grabbed item type next to logo if exists (optional debug)
   if (grabbedItem) {
        let debugText = "";
        if (grabbedItem.type === 'text') debugText = `[TXT: "${grabbedItem.content.substring(0,15)}..."]`;
        else debugText = `[SHP: ${grabbedItem.shapeType}]`;
        textSize(12); fill(100);
        text(debugText, 220, HEADER_HEIGHT/2);
   }


} // End draw function

// Function to get DOM button widths safely, handling null
const getButtonWidth = (btn) => btn ? btn.size().width : 0;


function mousePressed() {
  // Check if mouse is over the header area, ignore sketch interactions if over UI
  // Get bounds of UI elements for exclusion
  let inputBounds = inputElement ? inputElement.elt.getBoundingClientRect() : null;

  // Check if mouse is within the rectangular area of the input field or any button
  let isOverUIElement = false;
  if (inputBounds && mouseX >= inputBounds.left && mouseX <= inputBounds.right && mouseY >= inputBounds.top && mouseY <= inputBounds.bottom) {
     isOverUIElement = true;
  }
  // Could similarly check each button's getBoundingClientRect() if more precise UI blocking is needed.
  // For now, HEADER_HEIGHT check is usually sufficient if buttons/input are primarily in header.
  if (mouseY < HEADER_HEIGHT || isOverUIElement) return;


  // Prevent grabbing if something is already grabbed
   if (grabbedItem) { return; }

    let grabbedCandidate = null;

  // Attempt to grab items. Start with PLACED items (they are visually on top on artboard)
  // Iterate backward so we check the top-most item first
   for (let i = placedItems.length - 1; i >= 0; i--) {
       if (placedItems[i].isMouseOver(mouseX, mouseY)) {
            grabbedCandidate = placedItems[i];
           // Remove from placedItems temporarily
            let temp = placedItems.splice(i, 1)[0];
            // Add to shapes list, moving it for drawing order purposes (drawn with other floating shapes on top)
            shapes.push(temp);
           console.log("Grabbed item from canvas area:", grabbedCandidate.type);
           break; // Found an item, stop checking placedItems
       }
   }

  // If no placed item was grabbed, check floating shapes
  if (!grabbedCandidate) {
       for (let i = shapes.length - 1; i >= 0; i--) {
           // Don't try to grab an item that's already grabbed (shouldn't happen with logic)
           if (!shapes[i].isGrabbed) {
               if (shapes[i].isMouseOver(mouseX, mouseY)) {
                    grabbedCandidate = shapes[i];
                   // Item remains in the shapes list, but display order might place grabbed last.
                   // Can reorder: let temp = shapes.splice(i, 1)[0]; shapes.push(temp);
                    console.log("Grabbed floating item:", grabbedCandidate.type);
                   break; // Found a floating item, stop checking shapes
               }
           }
       }
   }


  // If an item was successfully selected for grabbing
  if (grabbedCandidate) {
       grabbedItem = grabbedCandidate; // Assign to grabbedItem global variable
       grabbedItem.isGrabbed = true; // Mark as grabbed within the object instance
       grabbedItem.isPlacing = false; // Stop landing animation
       grabbedItem.landFrame = -1; // Reset landing frame counter
       grabbedItem.solidify(); // Stop any floating or residual movement

       // Populate input field with text content or clear for shapes
       if (grabbedItem.type === 'text') { inputElement.value(grabbedItem.content); inputElement.attribute('placeholder', grabbedItem.content); }
       else { inputElement.value(''); inputElement.attribute('placeholder', TEXT_OPTIONS[0]); }

        inputElement.elt.focus(); // Focus the input element

        // Prevent default if we've grabbed an item to avoid cursor changes etc.
        return false;
   }
    // If nothing was grabbed, allow default mouse behavior
   return true;
}

function mouseReleased() {
  if (grabbedItem) {
    grabbedItem.isGrabbed = false; // Unmark as grabbed

    if (isMouseOverCanvasArea()) { // Dropped over canvas area
      console.log("Item dropped on canvas area.");
      grabbedItem.solidify(); // Ensure movement is stopped permanently

      // --- Handle Text Input Content on Placement ---
      if (grabbedItem.type === 'text') {
           let content = inputElement.value(); // Get content from input field
           if(content.trim() === "" || content.trim() === TEXT_OPTIONS[0].trim()) {
               // Discard empty text item if dropped on canvas area with empty/default input
               console.log("Discarding empty text item on placement.");
               // Remove from shapes list (it's currently there because it was grabbed)
               shapes = shapes.filter(s => s !== grabbedItem);
               grabbedItem = null; // Clear reference
               // Clear input field and reset placeholder - handled below common actions
           } else {
              grabbedItem.content = content.trim(); // Update content from input
              grabbedItem.fontName = baseFont; // Assign baseFont to text explicitly placed from input? Or keep random?
                                                // Let's stick to baseFont for text created/edited via input.
              // If this was originally a shape changed to text via some UI (not implemented), would need shapeType='none'
               console.log("Placed text item updated content:", grabbedItem.content);
               // Item stays in shapes list for now, moved to placedItems next
                shapes = shapes.filter(s => s !== grabbedItem); // Ensure it's not in shapes anymore
                placedItems.push(grabbedItem); // Add to placed items
                // Start landing animation only after successful placement
                grabbedItem.isPlacing = true;
                grabbedItem.landFrame = frameCount;

                // Apply rotation snapping if dropped on canvas
                if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
                  grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
                }
                grabbedItem = null; // Clear reference only after pushing to placedItems
           }
      } else { // It's a shape being dropped
            // Check if input element has text that should turn this shape into text
            let potentialTextContent = inputElement.value().trim();
             if (potentialTextContent !== "" && potentialTextContent !== TEXT_OPTIONS[0].trim()) {
                 console.log("Converting shape to text on placement:", potentialTextContent);
                 grabbedItem.type = 'text';
                 grabbedItem.content = potentialTextContent;
                 grabbedItem.shapeType = 'none'; // No longer a shape
                 grabbedItem.fontName = baseFont; // Font from input is base font
                 // Adjust size properties to behave more like text (could inherit category from shape origin?)
                 // For now, let's apply default text scaling values
                 let tempSize = grabbedItem.size; // Keep original size magnitude
                 let category = sizeCategories.find(cat => cat.name === 'medium') || { textScaleAdjust: 0.2 }; // Default adjust
                  grabbedItem.size = max(tempSize, 80); // Ensure min text 'size' is reasonable
                 grabbedItem.textScaleAdjust = category.textScaleAdjust;
                  // Need to pick a color contrasting white again? Or keep shape color? Keep shape color.

                 // Item stays in shapes list, moved to placedItems next
                 shapes = shapes.filter(s => s !== grabbedItem);
                 placedItems.push(grabbedItem);
                 grabbedItem.isPlacing = true;
                 grabbedItem.landFrame = frameCount;
                  // Apply rotation snapping
                  if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
                    grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
                  }
                  grabbedItem = null; // Clear reference

             } else {
                 // Shape dropped normally
                 console.log("Shape dropped on canvas area.");
                  // Item stays in shapes list, moved to placedItems next
                 shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes
                 placedItems.push(grabbedItem); // Add to placed items
                  // Apply rotation snapping
                  if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
                    grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
                  }
                 // Start landing animation
                 grabbedItem.isPlacing = true;
                 grabbedItem.landFrame = frameCount;
                 grabbedItem = null; // Clear reference
             }
      }

    } else { // Dropped outside canvas area -> Reverts to floating
         console.log("Item dropped outside canvas area, returned to floating.");
         // --- Handle Text Input Content on Drop Outside ---
         if (grabbedItem.type === 'text') {
             let content = inputElement.value(); // Get content from input
              // If text is empty/placeholder, treat as discarded, regardless of item type originally
             if (content.trim() === "" || content.trim() === TEXT_OPTIONS[0].trim()) {
                  console.log("Discarding empty text item dropped outside canvas.");
                  shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes list
                  grabbedItem = null; // Clear reference
                   // Clear input field and reset placeholder - handled below common actions
             } else {
                  // Text content exists, update item and let it float away
                 grabbedItem.content = content.trim();
                  grabbedItem.fontName = baseFont; // Use base font for manually entered text
                 console.log("Text item content updated:", grabbedItem.content);
                 // Item remains in shapes array
                  // Reset movement speeds to float again
                  grabbedItem.speedX = random(-1.5, 1.5);
                  grabbedItem.speedY = random(-1.5, 1.5);
                  grabbedItem.rotationSpeed = random(-0.003, 0.003);
                  grabbedItem.isPlacing = false; // Cancel landing animation
                   // Do not clear grabbedItem here, happens below
             }
         } else { // Shape dropped outside -> revert to floating shape
             // Check input? Could convert shape to text even when dropped outside, but let's not add that complexity now.
              console.log("Shape dropped outside canvas area.");
              // Item remains in shapes array
              // Reset movement speeds to float again
             grabbedItem.speedX = random(-1.5, 1.5);
             grabbedItem.speedY = random(-1.5, 1.5);
             grabbedItem.rotationSpeed = random(-0.003, 0.003);
             grabbedItem.isPlacing = false; // Cancel landing animation
             // Do not clear grabbedItem here, happens below
         }

         // If grabbedItem still exists (wasn't discarded)
          if(grabbedItem) {
              // Add a little bounce/push when dropped outside
              let pushMagnitude = 10; // Pixels
              grabbedItem.speedX += random(-pushMagnitude, pushMagnitude) * 0.1;
              grabbedItem.speedY += random(-pushMagnitude, pushMagnitude) * 0.1;
              grabbedItem.rotationSpeed += random(-0.001, 0.001);
               grabbedItem = null; // Clear reference now
          }

    } // End dropped outside logic


    // --- Actions common to both drop locations if item wasn't discarded ---
    // These happen AFTER grabbedItem might have been set to null inside the logic blocks
     if (grabbedItem === null) { // Check if it was cleared
        inputElement.value(''); // Clear input field
        inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
     } else {
         // Should not happen if logic is correct, but for safety, clear it
         console.warn("grabbedItem not cleared after mouseReleased?");
         grabbedItem = null;
         inputElement.value('');
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
     }
  } // End if grabbedItem exists
    // Always allow default behavior if no item was grabbed initially, or if handling is complete
    return true;
}


function mouseWheel(event) {
   // Prevent page scroll only if interacting over relevant sketch area
   // Interaction zone: below HEADER_HEIGHT and within sketch bounds.
   let isOverSketchInteractionArea = mouseX >= 0 && mouseX <= width && mouseY >= HEADER_HEIGHT && mouseY <= height;

    if (grabbedItem && isOverSketchInteractionArea) {
        // Rotate proportional to delta, maybe scale by screen density?
        let rotationAmount = event.delta * 0.002; // Default scroll sensitivity
         // Could adjust based on mouse position relative to center of item for twist-like feel? Not implementing now.
        grabbedItem.rotation += rotationAmount;
        return false; // Prevent default browser scroll (important!)
    }
     // Allow default browser scroll otherwise
    return true;
}

function keyPressed() {
    // Allow input field keys always if element has focus
     if (document.activeElement === inputElement.elt) {
         // Special case: Prevent input element's default DELETE/BACKSPACE if an item IS grabbed
         // Otherwise, allow typing into the field normally.
          if ((keyCode === DELETE || keyCode === BACKSPACE) && grabbedItem) {
              // Handle deletion via grabbedItem logic below
          } else {
               // Allow other keys for the input element itself
               return true; // Let the browser handle key input in the field
          }
     }


    // Delete grabbed item with DELETE or BACKSPACE if NOT actively typing in input field
    // The `document.activeElement` check above already covers the "NOT typing" part implicitly.
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        console.log("Deleting grabbed item:", grabbedItem.type);
        // Check if the item was placed or floating
         if (placedItems.includes(grabbedItem)) {
            placedItems = placedItems.filter(s => s !== grabbedItem); // Remove from placed list
         } else if (shapes.includes(grabbedItem)) {
             shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes list
         } else {
             console.warn("Grabbed item not found in shapes or placedItems lists upon deletion attempt.");
         }

        grabbedItem = null; // Ensure no item is grabbed anymore
        inputElement.value(''); // Clear related input field
        inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
        inputElement.elt.focus(); // Keep focus on the input field

        // Prevent the default browser action for these keys (e.g., page backspace)
        return false;
    }

    // Scale grabbed item with + / = or - keys (only when an item is grabbed)
    if (grabbedItem) {
      let scaleAmount = 1.08; // Growth factor
      let maxScale = 6.0;
      let minScale = 0.1;

      if (key === '+' || key === '=') {
         grabbedItem.scaleFactor *= scaleAmount;
         grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, maxScale);
         console.log("Scaled UP. New scale:", grabbedItem.scaleFactor);
      } else if (key === '-') {
         grabbedItem.scaleFactor /= scaleAmount; // Use division for more symmetrical scaling down
         grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, minScale);
         console.log("Scaled DOWN. New scale:", grabbedItem.scaleFactor);
      } else if (key === 's') { // Optional: Snap rotation with 's' key? Or use 'shift'?
          // Currently rotation snapping happens on drop, could add here too
      }

       // Update the calculated currentSize after scaling
      grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor;
       // Re-populate input with updated info if text? (Nah, less is more)

      // Prevent default key action (e.g., zooming browser)
      return false;
    }

    // If no item is grabbed AND the key is not for the input field (covered above),
    // allow default browser behavior or handle other sketch shortcuts here if needed.
    return true;
}


function addNewTextShapeFromInput() {
    let currentText = inputElement.value();
    // Check for truly empty content or just the placeholder text
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
         console.log("Input empty/placeholder, not adding text.");
         inputElement.style("border-color", "red"); // Visual feedback
         setTimeout(() => inputElement.style("border-color", "#ccc"), 500); // Reset color after delay
         // No need to clear value/placeholder or focus, just visual cue and return
         return;
    }

    console.log("Adding new text shape:", currentText.trim());

    let newTextShape = new FloatingShape(); // Create a new shape object
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim(); // Use the text from input
    newTextShape.shapeType = 'none'; // Explicitly not a shape primitive

    // Determine size and font based on the input (default to baseFont)
    // Could attempt to guess appropriate size category based on text length, or use a fixed base size
     let baseTextSize = 100; // Base 'size' value before scaling for text added from input
     newTextShape.size = baseTextSize;
     newTextShape.scaleFactor = 1.0; // Start at 1x scale
     let category = sizeCategories.find(cat => cat.name === 'medium') || { textScaleAdjust: 0.2 }; // Use medium category's text adjust
     newTextShape.textScaleAdjust = category.textScaleAdjust;
     newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;

     // Set the font of the new text shape to the base font (Inter)
     newTextShape.fontName = baseFont; // Text added from input uses base font


     // Ensure text color has enough contrast against a white background for text added via input
      let attempts = 0;
      let pickedColor = color(random(PALETTE)); // Start with a random pick
      let chosenColorBrightness = brightness(pickedColor);
       while (attempts < 10 && (chosenColorBrightness > 85 || (chosenColorBrightness > 60 && saturation(pickedColor) < 20)) ) {
           pickedColor = color(random(PALETTE));
           chosenColorBrightness = brightness(pickedColor);
           attempts++;
       }
      newTextShape.color = pickedColor;


     // Spawn location just below header, slightly randomized horizontally
     newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W * 0.3, CANVAS_AREA_X + CANVAS_AREA_W * 0.7);
     newTextShape.y = HEADER_HEIGHT + 60; // Offset further below header

     // Give it a gentle initial push/movement
     newTextShape.speedX = random(-0.8, 0.8);
     newTextShape.speedY = random(0.5, 1.2); // Move downwards
     newTextShape.rotation = random(-0.03, 0.03);
     newTextShape.rotationSpeed = random(-0.0003, 0.0003);


    shapes.push(newTextShape); // Add the newly created shape to the floating shapes list

    inputElement.value(''); // Clear the input field after adding the shape
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
    inputElement.elt.focus(); // Keep focus on the input field, ready for next entry

     console.log("New text shape created and added to floating:", newTextShape);
}

// Checks if the mouse is within the boundaries of the central canvas artboard area
function isMouseOverCanvasArea() {
    // Bounds check, ensuring min/max includes edges.
    // Added a small tolerance inward so dropping RIGHT on edge doesn't always count.
    let tolerance = 2; // Pixels tolerance for border area exclusion
    return mouseX > CANVAS_AREA_X + tolerance && mouseX < CANVAS_AREA_X + CANVAS_AREA_W - tolerance &&
           mouseY > CANVAS_AREA_Y + tolerance && mouseY < CANVAS_AREA_Y + CANVAS_AREA_H - tolerance;
}

// Snaps a given angle (radians) to the nearest increment
function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0 || !isFinite(angleRadians) || !isFinite(incrementRadians)) return angleRadians; // Return as is if invalid
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI; // Normalize 0 to TWO_PI
    let snapped = round(angleRadians / incrementRadians) * incrementRadians;
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI; // Re-normalize to ensure positive
    // Optional: Snap near 0 or TWO_PI cleanly
    if (abs(snapped) < 1e-6 || abs(snapped - TWO_PI) < 1e-6) snapped = 0;
    return snapped;
}

// Helper to generate timestamp string for filenames
function generateTimestampString() {
    let d = new Date();
     // Pad month/day/hour/minute/second with leading zeros using nf()
    return year() + nf(month() + 1, 2) + nf(day(), 2) + '_' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2); // month() is 0-indexed
}


// SAVE PNG function (standard resolution - saves canvasPG directly as an image file)
// This produces an image file with the same pixel dimensions as the visible artboard buffer.
function saveCanvasAreaAsPNG() {
    console.log("SAVE PNG button pressed (Standard Resolution)");
    if (canvasPG) {
        // Draw border onto a *temporary clone* of the buffer for saving
        // Cloner copies content AND size
        let tempPG_Save = createGraphics(canvasPG.width, canvasPG.height);
        tempPG_Save.image(canvasPG, 0, 0); // Copy content from canvasPG

        // Now draw the border on the temporary buffer
        tempPG_Save.push();
        tempPG_Save.stroke(0); tempPG_Save.strokeWeight(1); tempPG_Save.noFill();
        // Adjust rect bounds slightly inwards to ensure the stroke is fully within the buffer
        let borderOffset = tempPG_Save.strokeWeight() / 2;
        tempPG_Save.rect(borderOffset, borderOffset, tempPG_Save.width - borderOffset*2, tempPG_Save.height - borderOffset*2);
        tempPG_Save.pop(); // Restore graphics state on temp buffer

        // Save the temporary buffer
        saveCanvas(tempPG_Save, 'myArtboard_web_' + generateTimestampString() + '.png');
        console.log("Standard PNG save initiated.");

        // Dispose of the temporary buffer
        if (tempPG_Save && tempPG_Save.elt) {
            tempPG_Save.elt.remove();
            console.log("Temporary PNG save buffer disposed.");
        }

         // canvasPG does NOT have the border drawn on it permanently
         // The next draw cycle will draw the placed items without border from the real canvasPG
         // No explicit redraw/clear of canvasPG is needed here.

    } else {
        console.warn("Cannot save Standard PNG: canvasPG not created.");
        alert("Error: Cannot save PNG. Canvas area buffer is not available.");
    }
}


// SAVE HIGH-RESOLUTION PNG function (New function for print output)
// Draws placed items scaled up onto a much larger temporary graphics buffer.
function saveCanvasAreaAsHighResPNG() {
    console.log("SAVE HIGH-RES PNG button pressed (Targeting B2 @ 300 DPI)");

    const TARGET_DPI = 300; // Standard print resolution
    const B2_WIDTH_MM = 500; // ISO B2 paper dimensions in mm
    const B2_HEIGHT_MM = 707; // Note: This is based on the standard ISO B2 height of ~707.1mm

    const MM_PER_INCH = 25.4;

    // Calculate target pixel dimensions based on B2 and DPI
    // We use these exact target dimensions for the save buffer
    const targetWidthPixels = round((B2_WIDTH_MM / MM_PER_INCH) * TARGET_DPI); // Approx 5905.5 -> 5906
    const targetHeightPixels = round((B2_HEIGHT_MM / MM_PER_INCH) * TARGET_DPI); // Approx 8350.4 -> 8350

    // Let's use precise values for B2 that maintain the sqrt(2) ratio:
    // If Width = 500mm, Height should be 500 * sqrt(2) mm.
    // Or work from the larger dimension to potentially get closer to standard paper cut sizes?
    // The ISO standard is 1:sqrt(2) exactly. If your source is W x W*sqrt(2), and your target is W_B2 x W_B2*sqrt(2) at higher DPI,
    // scaling by width (W_B2/W_source) will maintain the aspect ratio perfectly and scale the height accordingly.
    // Let's use your declared B2 target dimensions, they are close to sqrt(2) ratio anyway.
    const finalTargetWidth = 5906; // Pixels
    const finalTargetHeight = 8350; // Pixels


    // Source dimensions are your displayed artboard dimensions (set by CANVAS_AREA_W/H)
    const sourceWidth = CANVAS_AREA_W;
    const sourceHeight = CANVAS_AREA_H; // This now uses W * sqrt(2) ratio

    // Calculate the overall scaling factor needed. This is based on width match.
    // Because both the source artboard AND the B2 target share (or approximate) the 1:sqrt(2) ratio,
    // scaling based on width will also scale the height proportionally correctly, filling the target area.
    const overallScaleFactor = finalTargetWidth / sourceWidth;

    // Calculate the actual height the source content will take up on the target buffer after scaling
    const scaledSourceHeight = sourceHeight * overallScaleFactor;

    // Calculate vertical offset needed to center the scaled content on the target B2 canvas.
    // With sqrt(2) ratio maintained, this should be very close to zero.
    const verticalOffset = (finalTargetHeight - scaledSourceHeight) / 2;


    console.log(`Source Artboard: ${sourceWidth}x${sourceHeight}`);
    console.log(`Target B2 @ ${TARGET_DPI} DPI: ${finalTargetWidth}x${finalTargetHeight}`);
    console.log(`Overall Scale Factor (Width-based): ${overallScaleFactor.toFixed(4)}`);
    console.log(`Scaled Content Dimensions: ${round(sourceWidth * overallScaleFactor)}x${round(scaledSourceHeight)}`);
     console.log(`Vertical Centering Offset (should be near 0 for sqrt(2) ratio): ${verticalOffset.toFixed(2)}`);


    // Create a new temporary graphics buffer for high-resolution drawing
    let highResPG = null;
     try {
        // Check if target dimensions are valid before creating graphics
         if (finalTargetWidth <= 0 || finalTargetHeight <= 0) {
            console.error("Invalid target high-res dimensions:", finalTargetWidth, finalTargetHeight);
            alert("Error calculating high-res save size.");
            return;
         }

        highResPG = createGraphics(finalTargetWidth, finalTargetHeight);
        highResPG.background(255); // White background

        console.log("Drawing placed items onto high-res buffer...");
        // Draw placed items onto the high-res buffer with overall scaling and relative positioning
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             // Skip drawing items marked as text with no content
             if (item.type === 'text' && (!item.content || item.content.trim() === "")) {
                 continue;
             }
             // Ensure text items have a font name reference for drawing
             let itemFontName = item.type === 'text' && item.fontName ? item.fontName : baseFont;


            highResPG.push(); // Save highResPG's transformation state

             // Calculate the item's center position on the HIGH-RES canvas.
             // Item's original position relative to the *artboard top-left* (CANVAS_AREA_X, CANVAS_AREA_Y) is (item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y).
             // Scale this relative position by `overallScaleFactor` and add the `verticalOffset` (should be negligible if ratios match) to position it on the target high-res buffer.
             let hrItemX = (item.x - CANVAS_AREA_X) * overallScaleFactor;
             let hrItemY = (item.y - CANVAS_AREA_Y) * overallScaleFactor + verticalOffset;

            highResPG.translate(hrItemX, hrItemY); // Move drawing origin to the item's calculated high-res center location

            highResPG.rotate(item.rotation); // Apply item's rotation around its center

            // Apply the combined scale. This includes the item's own scaleFactor AND the overall high-res overallScaleFactor.
             let combinedScale = item.scaleFactor * overallScaleFactor;
            highResPG.scale(combinedScale); // Apply the combined scale to the context

             // Set text font for this item BEFORE drawing if it's text
             if (item.type === 'text') {
                 highResPG.textFont(itemFontName);
             }

            // Set drawing styles for the item using highResPG context
            highResPG.fill(item.color);
            highResPG.noStroke(); // Assume no stroke for main fill


            // Draw the primitive shape or text using the item's *base size*.
            // It will be drawn at (0,0) in the already translated, rotated, and scaled context.
            // drawShapePrimitive arguments: graphics context, position (0,0), base size, shape type, isText, textScaleAdjust, fontName
             item.drawShapePrimitive(highResPG, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust, itemFontName);

            highResPG.pop(); // Restore highResPG's transformation state for the next item


        } // End item drawing loop


         // Draw border on the high-res canvas around the scaled content area (matching original artboard bounds)
         // Needs to match the *scaled size and position* of the original artboard area.
         highResPG.push();
         highResPG.stroke(0); // Black border
         // Scale border weight relative to the overall scaling. An original 1px border becomes overallScaleFactor pixels wide.
         let borderWeight = 1 * overallScaleFactor;
         // Clamp border weight to a reasonable value if scaleFactor is huge, maybe min 1px visual weight?
         // A direct scale maintains fidelity, let's stick to that unless problematic.
         highResPG.strokeWeight(borderWeight);
         highResPG.noFill();
         // The scaled content starts at (0, verticalOffset) on the high-res canvas
         // and has dimensions (sourceWidth * overallScaleFactor) x (sourceHeight * overallScaleFactor).
         // With sqrt(2) ratio, scaled height equals finalTargetHeight and verticalOffset is ~0.
         let borderRectX = 0; // The artboard maps to the full width of the high-res canvas
         let borderRectY = verticalOffset; // Vertical start matches scaled content
         let borderRectW = finalTargetWidth; // Width is full target width
         let borderRectH = scaledSourceHeight; // Height is scaled source height (should be finalTargetHeight if ratios match)

         // Adjust rectangle bounds slightly inward based on stroke weight if drawing on the very edge
         let adjustedBorderX = borderRectX + borderWeight / 2;
         let adjustedBorderY = borderRectY + borderWeight / 2;
         let adjustedBorderW = borderRectW - borderWeight;
         let adjustedBorderH = borderRectH - borderWeight;

         // Draw rectangle outline representing the original artboard bounds scaled up
         highResPG.rect(adjustedBorderX, adjustedBorderY, adjustedBorderW, adjustedBorderH);

        highResPG.pop(); // Restore highResPG state


        console.log("Saving high-res PNG...");
         // Save the high-resolution buffer as a PNG file
        saveCanvas(highResPG, `myArtboard_HIRES_${finalTargetWidth}x${finalTargetHeight}_` + generateTimestampString() + '.png');
         console.log("High-res PNG save initiated.");

     } catch(e) {
        console.error("Error generating high-res PNG:", e);
        alert("Error saving high-resolution PNG. Check browser console.");
     } finally {
        // Always dispose of the temporary graphics buffer element to free up memory
        if (highResPG) {
             highResPG.elt.remove(); // Correct way to remove the DOM element associated with the graphics buffer
             console.log("High-res buffer disposed.");
         }
     }
}


// SAVE PDF function using zenoZeng's p5.pdf library (vector for simple shapes/text)
// Requires the p5.pdf.js library to be included in index.html AFTER p5.js AND sketch.js.
// This records drawing commands *to the main p5 canvas* within a specific coordinate context.
function saveCanvasAreaAsPDF() {
    console.log("SAVE PDF button pressed (using zenoZeng/p5.pdf)");

    // Check if the p5.pdf library's createPDF function is available
     if (typeof window.createPDF !== 'function' || typeof p5 === 'undefined' || typeof p5.Vector === 'undefined' ) {
          console.error("p5.pdf library or p5.js base missing. Check index.html script includes and browser console for errors (CORS?). Order: p5.js, (p5.svg.js if using SVG), sketch.js, p5.pdf.js.");
          alert("Error: PDF library not loaded or available. Check browser console and index.html script order.");
          return;
      }


    let pdf;
     try {
         // Create a p5.PDF instance. Passing 'this' associates it with this sketch instance.
         pdf = window.createPDF(this);

         if (!pdf) {
             console.error("createPDF returned null or undefined.");
             alert("Error creating PDF instance.");
             return;
         }
        console.log("p5.PDF instance created. Starting record.");

        // PDF page dimensions will be set by pdf.save({ width, height }) later, typically matching artboard dimensions.
        // Draw directly ON THE MAIN p5 CANVAS (implicitly `this`) while recording.

        // It's best to start with a blank white background for the recorded area (the PDF page)
        background(255); // Draw white background on the main sketch canvas before recording


        // Begin recording drawing commands on the main canvas context.
        // Drawing happens visually on screen during this phase, but its output is captured by the library.
        pdf.beginRecord();

        // --- Set up transformations on the main canvas for PDF Capture ---
        // The goal is to draw only the artboard content. The PDF page dimensions
        // will be set to match the artboard size (CANVAS_AREA_W x CANVAS_AREA_H).
        // So, we translate the main canvas's coordinate system such that the
        // CANVAS_AREA's top-left corner becomes (0,0) for the drawing commands.

        push(); // Save global transformation state of the main canvas

        // Translate the main canvas: Subtract the artboard's top-left screen coordinates
        // This effectively shifts the origin of the canvas drawing to the artboard's (CANVAS_AREA_X, CANVAS_AREA_Y) point.
        // Anything drawn at (x, y) will now appear at (x - CANVAS_AREA_X, y - CANVAS_AREA_Y) on the screen/in the PDF output.
        // This means when we loop through placed items with coordinates (item.x, item.y) relative to the *original* sketch origin,
        // their drawing command `translate(item.x, item.y)` combined with this initial
        // `translate(-CANVAS_AREA_X, -CANVAS_AREA_Y)` results in drawing relative to
        // `item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y`, which is exactly their position relative to the *artboard origin*.
        translate(-CANVAS_AREA_X, -CANVAS_AREA_Y);

        // Draw placed items using global p5 drawing commands (implicit on `this`, the main canvas).
        // These commands are now captured by `p5.pdf`.
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             // Skip drawing items marked as text with no content in the PDF
              if (item.type === 'text' && (!item.content || item.content.trim() === "")) {
                 continue; // Skip drawing empty text items for PDF
             }
             // Ensure text items have a font name reference for drawing
             let itemFontName = item.type === 'text' && item.fontName ? item.fontName : baseFont;


            push(); // Save current state *before* item transformations (within the overall translation context)

            // Translate drawing origin to the item's center (item.x, item.y)
            // This position is already relative to the screen's original origin (0,0).
            // Due to the previous `translate(-CANVAS_AREA_X, -CANVAS_AREA_Y)`, this now translates
            // the drawing context to (item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y) relative to the PDF origin (which maps to artboard origin).
            translate(item.x, item.y);

            rotate(item.rotation); // Rotate around item center

            // Apply item's internal scale factor. This scales the primitive's drawing based on its base size.
            // Landing pulse scaling is not desired in a static PDF, so use `item.scaleFactor`.
            let currentDisplayScale = item.scaleFactor; // Use just the static scale
            scale(currentDisplayScale);

             // Set text font for this item BEFORE drawing if it's text
             if (item.type === 'text') {
                 textFont(itemFontName); // Apply font to the main canvas context
             }


            // Set drawing styles for the item using global p5 commands
            fill(item.color);
            noStroke(); // Assume no stroke for main fill

            // Draw the primitive shape or text centered at (0,0).
            // The actual drawing methods (rect, ellipse, beginShape, text) called inside drawShapePrimitive
            // will execute on the main canvas context, and p5.pdf will intercept and record them.
            // Arguments: graphics context (implicitly 'this'), position (0,0 in transformed space), base size, shape type, isText, textScaleAdjust, fontName
             item.drawShapePrimitive(this, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust, itemFontName);


            pop(); // Restore state after drawing this item
        } // End item drawing loop


         // Optional: Draw a border around artboard area in PDF.
         // This border is drawn using global commands within the translated context
         // where the artboard fills the area from (0,0) to (CANVAS_AREA_W, CANVAS_AREA_H).
         push();
         stroke(0); strokeWeight(1); noFill(); // Set stroke for border
          // Draw rectangle outline precisely covering the artboard dimensions relative to the new (0,0)
         rect(0, 0, CANVAS_AREA_W, CANVAS_AREA_H);
         pop(); // Restore state after drawing border


        pop(); // Restore main canvas original global transform state
        // --- End Drawing commands for PDF context ---

        console.log("Finished recording drawing commands for PDF.");
        // Finish recording. Captures the sequence of drawing operations since beginRecord.
        pdf.endRecord();

        // Save the captured state as a PDF file.
        // Set the dimensions of the PDF page to match the canvas area's dimensions.
        pdf.save({
            filename: 'myArtboard_vector_' + generateTimestampString(),
            width: CANVAS_AREA_W, // PDF page width matches displayed artboard width
            height: CANVAS_AREA_H, // PDF page height matches displayed artboard height
            margin: {top:0, right:0, bottom:0, left:0} // No margins for exact artboard fit on the page
        });

        console.log("PDF save initiated (might trigger browser print/save dialog).");

         // Note: PDF generation relies heavily on the P5 renderer and the library's
         // interpretation. Complex features or custom shaders may not work as vector.
         // Simple shapes and text *should* be vector.

     } catch(e) {
         console.error("An error occurred during PDF generation:", e);
         alert("Error generating PDF. Check browser console.");
         // Attempt to safely end recording if an error occurred during recording phase
         // This prevents potential infinite loop if the PDF library gets into a bad state.
         if (pdf && pdf.isRecording && typeof pdf.endRecord === 'function') {
              console.warn("Attempting to call pdf.endRecord() after caught error.");
              try { pdf.endRecord(); } catch(endErr) { console.error("Error calling pdf.endRecord() during error handling:", endErr); }
         }
     } finally {
         // PDF objects don't usually need manual disposal like graphics buffers
         pdf = null;
     }
}

// REFRESH button action - Replace all *floating* shapes with new random ones.
function resetRandom() {
    console.log("NEW SHAPES button pressed (Refreshing floating shapes)");

    // Temporarily store the grabbed item if it's a floating one, so it isn't removed
    let tempGrabbedItem = null;
    if (grabbedItem && shapes.includes(grabbedItem)) {
        tempGrabbedItem = grabbedItem;
        // Remove the grabbed item from the shapes list BEFORE clearing it,
        // so it doesn't get cleared from the temporary list.
        shapes = shapes.filter(s => s !== grabbedItem);
        console.log("Temporarily holding grabbed item during refresh.");
     }

    shapes = []; // Clear existing floating shapes array

    // Generate a new set of initial floating shapes
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }

    // Add the temporarily held grabbed item back to the shapes list (if it existed)
    if (tempGrabbedItem) {
        shapes.push(tempGrabbedItem);
         // Re-filter shapes just to ensure the grabbed item is at the end for drawing order
         shapes = shapes.filter(s => s !== tempGrabbedItem);
         shapes.push(tempGrabbedItem);
        console.log("Grabbed item returned to floating shapes list.");
    }

    console.log("Refreshed floating shapes. Total shapes:", shapes.length);
}

// CLEAR button action - Resets everything to the initial state
function restartAll() {
    console.log("CLEAR ALL button pressed. Resetting application state.");
    placedItems = []; // Clear items solidified on the canvas
    shapes = []; // Clear all floating shapes
    grabbedItem = null; // Ensure no item is currently grabbed

    // Clear and reset the input field
    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);

     // Clear the canvasPG buffer visually
     if (canvasPG) {
         canvasPG.clear();
         canvasPG.background(255); // Set back to white background
          console.log("canvasPG buffer cleared.");
     }

    // Generate a brand new set of initial floating shapes
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }

    console.log("State cleared and repopulated with new floating shapes. Total shapes:", shapes.length);
}

// WINDOW RESIZED FUNCTION - Handles responsive layout and canvasPG resizing
function windowResized() {
    console.log("Window resized. Old dimensions:", width, height, "New dimensions:", windowWidth, windowHeight);
    resizeCanvas(windowWidth, windowHeight); // Resize the main p5 canvas to fill the window

     // Recalculate canvas area dimensions and position based on NEW window size
     // Ensure CANVAS_AREA_W is reasonable relative to window width
     const adjustedCanvasW = min(CANVAS_AREA_W, windowWidth * 0.95); // Max width 95% of window or original 500

    // NEW: B Paper format aspect ratio 1 : sqrt(2)
    CANVAS_AREA_H = adjustedCanvasW * Math.sqrt(2); // Height = Adjusted Width * sqrt(2)

    // Center the artboard area horizontally and position below header
    CANVAS_AREA_X = width / 2 - adjustedCanvasW / 2;
    CANVAS_AREA_Y = HEADER_HEIGHT + 20;

    // Ensure calculated position is not negative or too close to edge
    if(CANVAS_AREA_X < 10) CANVAS_AREA_X = 10; // Small left padding
     let maxCanvasX = width - adjustedCanvasW - 10; // Small right padding
    if(CANVAS_AREA_X > maxCanvasX) CANVAS_AREA_X = maxCanvasX;
    if(CANVAS_AREA_Y < HEADER_HEIGHT + 10) CANVAS_AREA_Y = HEADER_HEIGHT + 10; // Min distance below header


    // Recalculate header element vertical positioning relative to updated HEADER_HEIGHT
    let headerCenterY = HEADER_HEIGHT / 2;

    // Input Element Positioning & Sizing - Relative to updated CANVAS_AREA and HEADER_HEIGHT
    if (inputElement) {
         let inputY_offset = 15; // Center vertically by subtracting half estimated input height
         inputElement.position(CANVAS_AREA_X, headerCenterY - inputY_offset);
        inputElement.size(adjustedCanvasW); // Match input width to adjusted artboard width
    }

    // --- Button Positioning for the right-aligned group ---
    // Dynamically calculate required width and position based on window size and number of buttons
    let buttonSpacing = 8; // Pixels between buttons
    let buttonEstHeight = 30; // Rough estimate for vertical alignment
    let buttonPadY_buttons = (HEADER_HEIGHT - buttonEstHeight) / 2; // Vertically center in header space
    let rightMargin = 15; // Margin from right edge of the window


    // Get current widths of all button elements (ensure they exist before asking for size)
    let savePNGBtnW = getButtonWidth(savePNGButton);
    let saveHighResPNGBtnW = getButtonWidth(saveHighResPNGButton); // Width of the new button
    let savePDFBtnW = getButtonWidth(savePDFButton);
    let clearBtnW = getButtonWidth(clearButton);
    let refreshBtnW = getButtonWidth(refreshButton);

    // Sum up the widths of all buttons and the total space needed between them
    let totalButtonWidth = savePNGBtnW + saveHighResPNGBtnW + savePDFBtnW + clearBtnW + refreshBtnW;
    let numButtons = (savePNGButton?1:0) + (saveHighResPNGButton?1:0) + (savePDFButton?1:0) + (clearButton?1:0) + (refreshButton?1:0);
    let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);

    // Calculate the X position for the rightmost edge of the button block
    let buttonBlockEndX = width - rightMargin;
    // Calculate the X position where the leftmost button should start
    let buttonBlockStartX = buttonBlockEndX - (totalButtonWidth + totalSpacing);


     // Optional: Prevent button block from overlapping significantly with the input field
     // Find the rightmost edge of the input element area
     let inputRightEdge = (inputElement && inputElement.elt) ? inputElement.position().x + inputElement.size().width : 0;
     let minButtonStartX = inputRightEdge + 20; // Keep button block at least 20px right of the input field
     // Use the greater of the calculated 'right-aligned' position or the minimum allowed position
     buttonBlockStartX = max(buttonBlockStartX, minButtonStartX);


    // Position buttons sequentially from the calculated start X position
    let currentButtonX = buttonBlockStartX;

    // Positioning order: REFRESH, CLEAR, SAVE PNG (Web), SAVE HI-RES PNG (Print), SAVE PDF (Vector)
    if (refreshButton) { refreshButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += refreshBtnW + buttonSpacing; }
    if (clearButton) { clearButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += clearBtnW + buttonSpacing; }
    if (savePNGButton) { savePNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += savePNGBtnW + buttonSpacing; }
     if (saveHighResPNGButton) { saveHighResPNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += saveHighResPNGBtnW + buttonSpacing; } // Position new button
    if (savePDFButton) { savePDFButton.position(currentButtonX, buttonPadY_buttons); /* Last button, no need to update currentButtonX */ }


     // --- Resize or Recreate canvasPG buffer ---
     // This buffer represents the artboard view and must match the new calculated dimensions
     // Dispose of the old buffer safely before creating a new one if dimensions change.
    if (canvasPG) {
        if (canvasPG.width !== adjustedCanvasW || canvasPG.height !== CANVAS_AREA_H) {
             console.log("Resizing or replacing canvasPG buffer. Old:", canvasPG.width, canvasPG.height, " New:", adjustedCanvasW, CANVAS_AREA_H);
             canvasPG.remove(); // Dispose of the old buffer element
             canvasPG = null; // Dereference
         }
     }

     // If canvasPG is null (either disposed or wasn't created yet) and dimensions are valid, create it.
     if (canvasPG === null && adjustedCanvasW > 0 && CANVAS_AREA_H > 0) {
          console.log("Creating new canvasPG buffer.");
          // Using P2D renderer for consistency might be desirable here too, requires setup.
          canvasPG = createGraphics(adjustedCanvasW, CANVAS_AREA_H);
           canvasPG.background(255); // Initialize with white background
           // Ensure any default styling is applied if needed
            canvasPG.imageMode(CORNER);
            canvasPG.rectMode(CENTER);
            canvasPG.ellipseMode(CENTER);
            canvasPG.angleMode(RADIANS); // Should inherit from sketch, but good practice
     } else if (canvasPG === null) {
          console.warn("canvasPG is null after resize attempt and could not be recreated with valid dimensions:", adjustedCanvasW, CANVAS_AREA_H);
     }


     console.log("Finished windowResized. Canvas area:", CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
}
