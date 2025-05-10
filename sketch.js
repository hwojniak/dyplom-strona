// FIX: Efficiency issues significantly improved with canvasPG and textMeasurePG
// This version addresses user-specific bugs and preferences for Step 1.

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
const CANVAS_AREA_W = 500; // Fixed width of the artboard (Source for high-res scaling)
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

let baseFont = 'monospace'; // Default font, can be loaded

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
      // Cannot transform relative to an object with zero scale
       console.warn("transformPointToLocal: Object scale is 0.");
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
    // Add check for invalid dimensions
     if (isNaN(px) || isNaN(py) || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
        // console.warn("isPointInAxisAlignedRect: Invalid point or rectangle dimensions.");
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
         // console.warn("distToSegment: Invalid input coordinates.");
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
// Base ref points for triangle (size * 0.8 for height) need conversion to actual vertices.
function getTriangleVertices(size) {
     if (isNaN(size) || size <= 0) return []; // Invalid size
    let h = size * 0.8; // This should correspond to the total vertical extent or some scale factor in drawing
    // Vertices relative to (0,0) to match your drawShapePrimitive implementation:
    // Top: (0, -h/2) or perhaps match your existing draw logic's vertical placement
    // Looking at drawShapePrimitive: top is py - psize * 0.8, bottom points are py + psize * 0.4
    // This suggests a total vertical span of psize * 1.2, centered slightly below 0,0?
    // Let's derive vertices that are roughly centered around (0,0) given your points:
    // Your points: (0, -S*0.8), (-S*0.8, S*0.4), (S*0.8, S*0.4)
    // Centroid Y: (-S*0.8 + S*0.4 + S*0.4) / 3 = 0
    // X for bottom: (-S*0.8 + S*0.8)/2 = 0
    // OK, these points *are* effectively centered at (0,0). The psize just acts as a scaling factor.
    // So, using psize as the size reference in getVertices functions.
    return [{ x: 0, y: -size * 0.8 }, { x: -size * 0.8, y: size * 0.4 }, { x: size * 0.8, y: size * 0.4 }];
}

function getSquareVertices(size) { // size acts as side length
     if (isNaN(size) || size <= 0) return []; // Invalid size
    let halfSize = size / 2;
    return [{ x: -halfSize, y: -halfSize }, { x: halfSize, y: -halfSize }, { x: halfSize, y: halfSize }, { x: -halfSize, y: halfSize }];
}

function getPentagonVertices(size) { // size acts as radius ref * 0.7, centered for polygon drawing
     if (isNaN(size) || size <= 0) return []; // Invalid size
    let sides = 5;
    let radius = size * 0.7;
    let vertices = [];
    for (let i = 0; i < sides; i++) {
        // Added the - HALF_PI adjustment to orient the pentagon vertex upwards
        let angle = TWO_PI / sides * i;
        let sx = cos(angle - HALF_PI) * radius;
        let sy = sin(angle - HALF_PI) * radius;
        vertices.push({ x: sx, y: sy });
    }
    return vertices;
}

function getHexagonVertices(size) { // size acts as radius, centered for polygon drawing
     if (isNaN(size) || size <= 0) return []; // Invalid size
     let sides = 6;
     let radius = size; // As used in your drawing code
     let vertices = [];
     for (let i = 0; i < sides; i++) {
         // Angle as in getHexagonVertices (vertex initially rightwards)
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
  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i], v2 = vertices[(i + 1) % numVertices];
     if (isNaN(v1.x) || isNaN(v1.y) || isNaN(v2.x) || isNaN(v2.y)) {
         // console.warn("isPointInConvexPolygon: Invalid vertex coordinates.");
         return false;
     }
    // Cross product check (point on one side of edge vector)
    let cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);
    // Use a small epsilon for floating point comparisons
    if (cross_product > 1e-6) has_pos = true;
    if (cross_product < -1e-6) has_neg = true;
    if (has_pos && has_neg) return false; // Point is not strictly inside if it's on both sides of different edges
  }
   // If not straddling the polygon (always on one side or on an edge), it's inside or on boundary
   // We need to be careful: if *all* cross products are zero, the point is collinear with vertices on a line/segment.
   // For a closed polygon, if point is collinear with one edge AND not outside bounds of the vertices projections,
   // it might be on the edge. If only positive or only negative flags were set, it means point was on one side or boundary.
   // If any vertex has NaN/Infinity coordinates, cross product will be NaN. Need to check cross_product results.
   if (isNaN(cross_product)) return false; // Check for invalid calculations

   // Simplified: If not found to be on both sides of the polygon edges, it's inside or on the boundary.
   return !(has_pos && has_neg); // If point wasn't strictly separated by edges
}


// Checks if a point is near any edge of a polygon within a tolerance (local coords).
function isPointNearPolygonEdge(px, py, vertices, tolerance) {
     if (isNaN(px) || isNaN(py) || !Array.isArray(vertices) || vertices.length < 2 || isNaN(tolerance) || tolerance < 0) {
          // console.warn("isPointNearPolygonEdge: Invalid input or vertices.");
          return false;
     }
     for (let i = 0; i < vertices.length; i++) {
         let v1 = vertices[i], v2 = vertices[(i + 1) % vertices.length];
         // Ensure vertex coords are valid before checking distance to segment
         if (isNaN(v1.x) || isNaN(v1.y) || isNaN(v2.x) || isNaN(v2.y)) continue;

         if (distToSegment(px, py, v1.x, v1.y, v2.x, v2.y) <= tolerance) { return true; }
     }
    return false;
}

// FIX: Calculates text bounding box using a *single, persistent* graphics buffer.
let textMeasurePG; // Declare the global variable here

function getTextBounds(content, effectiveTextSize, baseFontRef) {
    // console.log("getTextBounds called with:", content, effectiveTextSize, baseFontRef); // Debugging line
     if (typeof content !== 'string' || isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
          // console.warn("getTextBounds: Invalid input (content, size).");
          return { w: 0, h: 0 }; // Return zero bounds for invalid input
     }


    // Ensure the measurement buffer exists and is configured
    if (!textMeasurePG) {
        console.error("textMeasurePG is not initialized!");
        // Fallback to a default safe size if buffer is missing (rough estimate)
        return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
    }

    try {
        // Apply font properties to the measurement buffer context
        // Use the font reference provided, or a default if none/invalid
        if (baseFontRef && textMeasurePG.textFont) { // Check if textFont method exists
             textMeasurePG.textFont(baseFontRef);
        } else if (textMeasurePG.textFont){
             // Fallback to a default font if baseFontRef is not provided or invalid
             textMeasurePG.textFont('monospace'); // Or another safe default
        } else {
             // textMeasurePG is potentially an older version or corrupted graphics object without text methods
             console.error("textMeasurePG has no textFont method.");
              return { w: effectiveTextSize * (content ? content.length : 1) * 0.6, h: effectiveTextSize * 1.2 };
        }

        if (textMeasurePG.textSize) textMeasurePG.textSize(effectiveTextSize); else console.error("textMeasurePG has no textSize method.");
        if (textMeasurePG.textAlign) textMeasurePG.textAlign(CENTER, CENTER); else console.error("textMeasurePG has no textAlign method.");


        // Perform measurement using the persistent buffer
        let textW = 0, textAsc = 0, textDesc = 0;

        if (textMeasurePG.textWidth) textW = textMeasurePG.textWidth(content); else console.error("textMeasurePG has no textWidth method.");
         // Use fallback calculation if needed? Maybe stick to returning default safe size on major error.

        // Asc/Desc might be 0 if font hasn't loaded or context is bad, add checks
         if (textMeasurePG.textAscent) textAsc = textMeasurePG.textAscent(); else console.error("textMeasurePG has no textAscent method.");
         if (textMeasurePG.textDescent) textDesc = textMeasurePG.textDescent(); else console.error("textMeasurePG has no textDescent method.");

        let textH = textAsc + textDesc; // Total height

        // Basic sanity check for calculated dimensions
         if (isNaN(textW) || isNaN(textH) || textW < 0 || textH < 0) {
             console.warn("getTextBounds: Calculated bounds are invalid. Content:", content, "Size:", effectiveTextSize, "Bounds:", { w: textW, h: textH });
              // Provide a reasonable default fallback if calculated values are bad
              textW = effectiveTextSize * (content ? content.length : 0.5) * 0.6;
              textH = effectiveTextSize * 1.2;
         }

        return { w: textW, h: textH };

    } catch (e) {
        console.error("Error in getTextBounds using textMeasurePG:", e);
         // Return a default safe size in case of error
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
    let posAlong = random(0.1, 0.9); // Using 0.1-0.9 ensures slightly away from corners initially

    let categoryIndex = floor(random(sizeCategories.length));
    let category = sizeCategories[categoryIndex];
    this.size = random(category.sizeRange[0], category.sizeRange[1]);
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]);

     // calculateMaxEffectiveDimension needs size and scaleFactor set first
     let roughMaxDimension = this.calculateMaxEffectiveDimension();
     // Determine offScreenOffset based on object size plus buffer
      let offScreenOffset = max(roughMaxDimension / 2 * this.scaleFactor, 100) + 50; // Half dimension (radius-like), scaled, plus buffer


    let minSpeed = 1, maxSpeed = 2; // Slightly reduced speed range compared to old version

    switch (edge) {
      case 0: // Top
        this.x = width * posAlong;
        this.y = -offScreenOffset; // Spawn fully above the window
        this.speedX = random(-1, 1) * maxSpeed * 0.5; // Gentler side movement
        this.speedY = random(minSpeed, maxSpeed); // Downwards
        break;
      case 1: // Right
        this.x = width + offScreenOffset; // Spawn fully right of the window
        this.y = height * posAlong;
        this.speedX = random(-maxSpeed, -minSpeed); // Leftwards
        this.speedY = random(-1, 1) * maxSpeed * 0.5; // Gentler side movement
        break;
      case 2: // Bottom
        this.x = width * posAlong;
        this.y = height + offScreenOffset; // Spawn fully below the window
        this.speedX = random(-1, 1) * maxSpeed * 0.5; // Gentler side movement
        this.speedY = random(-maxSpeed, -minSpeed); // Upwards
        break;
      case 3: // Left
        this.x = -offScreenOffset; // Spawn fully left of the window
        this.y = height * posAlong;
        this.speedX = random(minSpeed, maxSpeed); // Rightwards
        this.speedY = random(-1, 1) * maxSpeed * 0.5; // Gentler side movement
        break;
    }

    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.002, 0.002); // Gentler rotation speed

    // Color logic from constructor - improved to avoid bright colors on white background for text
    let pickedColor;
    this.type = random() < 0.7 ? 'shape' : 'text'; // Slightly favor shapes

    if (this.type === 'text') {
         // Ensure initial color has enough contrast against a white background *if it ends up placed*
         // This color applies even when floating, which might be on black. A color that works on both is ideal,
         // but prioritising placed (white background) contrast is pragmatic.
         let attempts = 0;
          do {
             pickedColor = color(random(PALETTE));
             attempts++;
         } while (attempts < 10 && brightness(pickedColor) > 230); // Try to avoid very bright colors close to white (255)

         this.shapeType = 'none';
          // Pick initial text, retry if it's empty or placeholder-like
         let initialContent = random(TEXT_OPTIONS.slice(1));
         while(!initialContent || initialContent.trim() === "" || initialContent.trim() === TEXT_OPTIONS[0].trim()){
            initialContent = random(TEXT_OPTIONS.slice(1)); // Keep picking from actual options
         }
         this.content = initialContent.trim(); // Use trimmed content
         this.textScaleAdjust = category.textScaleAdjust;
         // Font property placeholder (will be set by future font selection logic)
         this.font = baseFont; // Default to baseFont initially


    } else { // type is 'shape'
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']);
        pickedColor = color(random(PALETTE)); // Any color is fine for shapes against black/white
        this.content = null;
        this.textScaleAdjust = 0;
        this.font = null; // No font needed for shapes
    }

    this.color = pickedColor;


    this.isGrabbed = false; // Managed externally by grabbedItem === this
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;

    // Cache for efficiency if needed (optional in this iteration)
    // this._cachedBounds = null;
    // this._cachedEffectiveSize = null;
    // this._cachedMaxDimension = null;
  }

   // Helper to estimate max dimension (radius equivalent) for off-screen check
   // Add null checks for content/shapeType defensively
   calculateMaxEffectiveDimension() {
         // Consider cached values here later if needed: if(this._cachedMaxDimension !== null) return this._cachedMaxDimension;

        let dimension = this.size || 50; // Default basic size
        if (this.type === 'text' && this.content && this.content.trim() !== "" && this.content.trim() !== TEXT_OPTIONS[0].trim()) {
             let effectiveTextSize = (this.size || 1) * (this.textScaleAdjust || 0.2); // Use default textScale if NaN
              // Use getTextBounds which now uses the persistent buffer
              let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont); // Use item's font or baseFont
             // Treat diagonal as effective dimension for rotation
              dimension = sqrt(sq(textBounds.w) + sq(textBounds.h)); // Diagonal of text bounding box

        } else if (this.type === 'shape' && this.shapeType) { // Check shapeType exists
             switch(this.shapeType) {
                  case 'circle': dimension = this.size * 2; break; // size is radius, need diameter
                  case 'square': dimension = this.size * Math.SQRT2; break; // Diagonal
                  case 'triangle': dimension = this.size * 1.2; break; // Approx max extent based on points
                  case 'pentagon': dimension = this.size * 0.7 * 2; break; // radius used in drawing * 2 = diameter
                  case 'hexagon': dimension = this.size * 2; break; // radius * 2 = diameter
                  default: dimension = this.size; break; // Fallback uses base size directly
             }
             // For shapes, let's be safer and just use 1.5 * size, or actual max dimension calc if shapes become non-uniform
             dimension = max(dimension, this.size * 1.5); // Ensure a minimum sensible dimension if calculations are small
        } else {
            dimension = this.size || 100; // Default safety size if type is invalid or not set
        }

        // Ensure dimension is a positive number
        dimension = max(dimension, 1); // Ensure non-zero dimension


         // Optional: this._cachedMaxDimension = dimension; return dimension;
        return dimension;
  }


  update() {
     if (!this.isGrabbed && !this.isPlacing) {
         // Basic bounds checking for very large speeds/positions (defensive)
         this.x += this.speedX;
         this.y += this.speedY;

         this.rotation += this.rotationSpeed;

         // Normalize rotation to keep numbers manageable (optional but good practice)
         this.rotation = (this.rotation % TWO_PI + TWO_PI) % TWO_PI;
     }
     // this.currentSize = this.size * this.scaleFactor; // Removed, calculate on demand or use calculateMaxEffectiveDimension
  }

   // Checks if the object is significantly off-screen
   isReallyOffScreen() {
        // Use the calculated max dimension * scale factor for the check
        // Using half the dimension (radius equivalent) + a safety buffer
        let maxEffectiveDimension = this.calculateMaxEffectiveDimension();
        if (isNaN(maxEffectiveDimension) || maxEffectiveDimension <= 0) {
            // Cannot determine if off-screen for invalid object, treat as not off-screen to prevent erroneous removal
            // console.warn("isReallyOffScreen: Cannot determine dimension for item, skipping removal check.", this);
             return false;
        }
      let effectiveRadius = maxEffectiveDimension / 2 * this.scaleFactor;

      // Add a buffer based on window size to make sure we don't remove items too early
      // A fixed buffer based on the artboard max dimension might also be good.
      let windowBuffer = max(width, height) * 0.5; // Increased window buffer percentage

       // Check bounds against the main canvas size plus the buffer
      return this.x < -windowBuffer - effectiveRadius || this.x > width + windowBuffer + effectiveRadius ||
             this.y < -windowBuffer - effectiveRadius || this.y > height + windowBuffer + effectiveRadius;
  }


  // Updates the scaling effect for the landing animation
  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame;
        let duration = 45; // Landing animation duration (frames)
        if (elapsed <= duration) {
            let t = map(elapsed, 0, duration, 0, 1);
            // Ease-in/out type pulsing effect
            // t^2 * (3-2t) or similar for smoother effect than sin wave peak at 0.5
            let easedT = t * t * (3 - 2 * t); // Cubic ease-in-out
            let pulseScale = 1 + easedT * 0.07; // More prominent pulse up to 7% larger
            this.tempScaleEffect = pulseScale;
        } else {
            this.isPlacing = false;
            this.tempScaleEffect = 1; // Ensure scale effect resets fully
        }
    } else if (!this.isPlacing && this.tempScaleEffect !== 1) {
         this.tempScaleEffect = 1; // Reset scale effect if somehow left non-1 (defensive)
    }
  }

   // General display function used for drawing on main canvas or other contexts (PG)
   // graphics: The p5 graphics object target (e.g., 'this' for main, 'canvasPG' for PG buffer)
   // showGrabEffect: Apply grabbed visual style? (Only applies if graphics === main canvas 'this')
   // offsetX, offsetY: Optional offset to translate the shape by before drawing relative to graphics origin.
   //                  This is used when drawing ONTO a PG buffer which starts at 0,0
  display(graphics, showGrabEffect = false, offsetX = 0, offsetY = 0) {
    // Check if graphics context is valid before drawing
     if (!graphics || typeof graphics.push !== 'function' || typeof graphics.translate !== 'function' || typeof graphics.rotate !== 'function' || typeof graphics.scale !== 'function') {
        // console.warn("Invalid graphics context passed to display for item:", this);
        return; // Skip drawing if context is invalid
    }

    // Skip drawing empty text items unless grabbed (to allow editing, only happens on main canvas)
    if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim())) {
         // Only return false if NOT grabbed AND graphics context is the main canvas where it might appear
         // When drawing for SAVE (canvasPG or highResPG), we ALWAYS skip empty text
         if (!this.isGrabbed || graphics !== this) {
             return;
         }
    }


    graphics.push();
    // Translate to position relative to the graphics context's origin and passed offset
    // Item's origin (this.x, this.y) is in MAIN canvas coordinates.
    // If drawing on main canvas, offset is 0,0, effectively graphics.translate(this.x, this.y)
    // If drawing on canvasPG, offset is CANVAS_AREA_X, CANVAS_AREA_Y. We need to draw
    // at a position relative to canvasPG's origin that corresponds to the item's location *relative to the artboard origin*.
    // Artboard origin in main space is (CANVAS_AREA_X, CANVAS_AREA_Y). Item pos is (this.x, this.y).
    // Item's pos relative to artboard origin is (this.x - CANVAS_AREA_X, this.y - CANVAS_AREA_Y).
    // When drawing onto canvasPG (whose origin is (CANVAS_AREA_X, CANVAS_AREA_Y) relative to main sketch window),
    // we translate to the item's position in the main sketch's coordinates minus the graphics origin offset.
    // This correctly places the item at (this.x, this.y) on the main canvas, or
    // at (this.x - CANVAS_AREA_X, this.y - CANVAS_AREA_Y) within the canvasPG buffer.
    graphics.translate(this.x - offsetX, this.y - offsetY);

    graphics.rotate(this.rotation);

     // Apply landing scale if active and NOT grabbed. Use the value saved in tempScaleEffect.
    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale);

     // Only draw grabbed effect on main canvas ('this') and if explicitly requested
     if (showGrabEffect && graphics === this) {
         graphics.drawingContext.shadowBlur = 40;
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)'; // Adjust color for visibility
         graphics.stroke(255, 255, 255, 200); // White/transparent stroke
         graphics.strokeWeight(3);
         graphics.noFill();
         // Draw a simplified outline for the grab effect, or the primitive shape itself
         // drawingContext applies effects before drawing, so draw the shape's base primitive.
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
         graphics.drawingContext.shadowBlur = 0; // Reset shadow blur immediately
    }

    graphics.fill(this.color);
    graphics.noStroke(); // No stroke for the main fill/text unless grab effect applied before it

    // Draw the core geometry or text centered at (0,0) in the object's local space.
    // graphics: The target context (canvasPG, main canvas, highResPG).
    // px, py: Always 0, 0 because we've already translated to the item's location (relative to graphics origin).
    // psize: The item's base size ('this.size'). Scaling applied externally via graphics.scale().
     // Ensure content is passed and textScaleAdjust/font are used for text items
    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
    graphics.pop();
  }

  // Draws the shape's core geometry or text centered at (px, py), with base size psize.
  // Assumes transformations (translate, rotate, scale) are already applied to the 'graphics' context.
  // This function uses methods provided by the graphics context (e.g., graphics.rect, graphics.text).
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        // Check if graphics context is valid before attempting to draw primitives
        if (!graphics || typeof graphics.rectMode !== 'function' || typeof graphics.text !== 'function') {
             // console.warn("Invalid graphics context in drawShapePrimitive for item:", this);
             return; // Skip drawing if context is invalid
         }

         if (isNaN(px) || isNaN(py) || isNaN(psize) || psize <= 0) {
             // console.warn("drawShapePrimitive: Invalid px, py, or psize.", {px, py, psize, item: this});
             if(!isText) return; // Shapes need valid size, text can sometimes draw placeholder? But draw empty skipped.
         }

        if (isText) {
             // This check was done in display(), but redundant safety doesn't hurt if drawPrimitive were called directly.
             // However, display() already checks and skips for empty/placeholder text.
             // We allow drawing grab effect for empty text when grabbed on main canvas,
             // but the actual text content will be invisible if empty.
             // if (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) {
             //    // Don't draw the text glyphs if empty/placeholder
             //     return;
             // }

             // Apply text properties to the provided graphics context
             graphics.textFont(this.font || baseFont); // Use the item's font or fallback
             graphics.textAlign(CENTER, CENTER); // Set alignment
             let effectiveTextSize = psize * textScaleAdjust; // Calculate effective size relative to base psize
             // Clamp text size to avoid errors with extremely small or large values
             effectiveTextSize = max(effectiveTextSize, 1); // Minimum size 1px
              if (effectiveTextSize === Infinity || isNaN(effectiveTextSize)) effectiveTextSize = 16; // Fallback safety

             graphics.textSize(effectiveTextSize); // Set text size

             graphics.text(this.content, px, py); // Draw text centered at px, py

         } else { // It's a shape
              // Check if psize is valid before drawing shape primitives that depend on it
              if (isNaN(psize) || psize <= 0) {
                   // console.warn("drawShapePrimitive: Invalid psize for shape.", {psize, item: this});
                   return; // Cannot draw shape without valid size
               }
              graphics.rectMode(CENTER); // Set rect drawing mode on this context

             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break; // p5 ellipse uses width/height (diameter)
               case 'square': graphics.rect(px, py, psize, psize); break; // p5 rect in center mode uses width/height (side)
               case 'triangle':
                 graphics.beginShape();
                 // Note: these points match your original code proportions relative to psize, centered roughly at 0,0
                 graphics.vertex(px, py - psize * 0.8);
                 graphics.vertex(px - psize * 0.8, py + psize * 0.4);
                 graphics.vertex(px + psize * 0.8, py + psize * 0.4);
                 graphics.endShape(CLOSE);
                 break;
               case 'pentagon':
                  graphics.beginShape();
                  let sidesP = 5; let radiusP = psize * 0.7; // Adjusted radius as per original drawing
                  if (isNaN(radiusP) || radiusP <= 0) { console.warn("Invalid radiusP for pentagon", radiusP); break; }
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
                 let sidesH = 6; let radiusH = psize; // Radius used as per original drawing
                 if (isNaN(radiusH) || radiusH <= 0) { console.warn("Invalid radiusH for hexagon", radiusH); break; }
                 for (let i = 0; i < sidesH; i++) {
                    let angle = TWO_PI / sidesH * i;
                    let sx = cos(angle) * radiusH;
                    let sy = sin(angle) * radiusH;
                    graphics.vertex(px + sx, py + sy);
                 }
                 graphics.endShape(CLOSE);
                 break;
               default:
                   // Should not happen if shapeType is correctly picked, but defensive.
                  // console.warn("drawShapePrimitive: Unknown shape type:", pshapeType);
                 break; // Draw nothing for unknown types
             }
         }
   }

  // Checks if mouse coordinates (mx, my) are over this shape or text item.
   // This check happens in global sketch coordinates (mx, my).
  isMouseOver(mx, my) {
        // Perform basic sanity checks on item properties needed for transformation/collision
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) ||
           isNaN(this.scaleFactor) || isNaN(this.size) || this.scaleFactor <= 0 || this.size <= 0) {
             // console.warn("isMouseOver: Invalid object state or zero size/scale:", this);
            return false; // Cannot click on an invalid or zero-sized item
       }

        // Cannot click on empty text items unless it's the grabbed item (which allows text input).
        // If text is grabbed, input populates, and content might become temp empty before drop/discard.
        // We rely on isGrabbed check and input state managed in mouseReleased.
        // For non-grabbed items, skip if text is empty or placeholder.
        if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) && !this.isGrabbed) {
            return false;
        }


       // Convert mouse coordinates from global (sketch window) to object's local space.
       // Uses the item's current display scale (which might include the landing pulse).
       let currentDisplayScale = this.scaleFactor * this.tempScaleEffect;
        // Add a defensive check against zero scale before transform
       if (currentDisplayScale <= 0) return false;

       let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, currentDisplayScale); // Use display scale here
       let localMx = localMouse.x, localMy = localMouse.y;

        // Check if localMouse result is valid (was transformPointToLocal successful?)
       if (isNaN(localMx) || isNaN(localMy)) return false;


        // Calculate tolerance in local object pixels. Clamped to a minimum to remain clickable at small scales.
        let localTolerance = CLICK_TOLERANCE / currentDisplayScale;
         localTolerance = max(localTolerance, 3); // Ensure a few pixel tolerance in local space

       if (this.type === 'text') {
            // Already checked for empty text above unless it's grabbed.
           let effectiveTextSize = this.size * this.textScaleAdjust;
            // Get text bounds (width/height) in local coordinate space (centered at 0,0)
           // Ensure valid effective text size before getting bounds
           if (isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
               // console.warn("isMouseOver: Invalid effective text size.", {effectiveTextSize, item: this});
                return false;
            }
            // Use item's font for bounds check consistency
           let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont);
            // Check if bounds calculation was successful (non-zero dimensions assuming content exists)
           if (textBounds.w <= 0 || textBounds.h <= 0) return false;

           // Check if local mouse point is within or near the text bounding box.
           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);

       } else { // type is 'shape'
            // Size property refers to the base size used before scaleFactor
             // Ensure base size is valid for shape checks
             if (isNaN(this.size) || this.size <= 0) {
                  // console.warn("isMouseOver: Invalid base size for shape.", {size: this.size, item: this});
                   return false;
             }
           switch (this.shapeType) {
              case 'circle':
                 // psize in drawPrimitive is diameter. The circle is drawn with ellipse(0,0, psize*2).
                 // But the item.size *itself* was likely conceived as a radius or similar base unit before scaling.
                 // Let's use the original size as the *radius reference* for the click detection, which is more intuitive
                 // relative to dist(localMx, localMy, 0, 0). The drawing scales it later.
                 return dist(localMx, localMy, 0, 0) <= this.size + localTolerance;
              case 'square':
                 // drawPrimitive uses size as the side length for rect(0,0, size, size). Collision uses size as side length.
                 return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);
              case 'triangle':
                  // getTriangleVertices uses size as the base scale factor reference
                  let triVertices = getTriangleVertices(this.size);
                   if (!Array.isArray(triVertices) || triVertices.length < 3) { console.warn("Invalid triangle vertices."); return false; }
                  if (isPointInConvexPolygon(localMx, localMy, triVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, triVertices, localTolerance);
              case 'pentagon':
                   // getPentagonVertices uses size * 0.7 as the radius. Collision should use that size reference.
                  let pentVertices = getPentagonVertices(this.size);
                  if (!Array.isArray(pentVertices) || pentVertices.length < 5) { console.warn("Invalid pentagon vertices."); return false; }
                  if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance);
              case 'hexagon':
                  // getHexagonVertices uses size as the radius. Collision should use that size reference.
                   let hexVertices = getHexagonVertices(this.size);
                   if (!Array.isArray(hexVertices) || hexVertices.length < 6) { console.warn("Invalid hexagon vertices."); return false; }
                  if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance);
              default:
                   // Fallback circular check for safety, uses calculated rough dimension scaled back by factor
                   // Need to re-think default... let's use a size-based radius * half sqrt 2?
                  //console.warn("isMouseOver: Fallback check for unknown shape type:", this.shapeType);
                   // Using item.size directly as a radius estimate
                   return dist(localMx, localMy, 0, 0) <= this.size * 0.7 + localTolerance; // Approx radius fallback

           }
       }
    }

  // Sets the shape's speeds/rotation speed to zero
  solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}


function preload() {
  // Custom font loading example - Load actual p5.Font objects here
  // Example (assuming the files exist):
  // try {
  //    baseFont = loadFont('assets/your_primary_font.otf'); // Or TTF, WOFF, WOFF2
  //    console.log("Loaded baseFont:", baseFont);
  //    // You could load multiple fonts here:
  //    // anotherFont = loadFont('assets/another_font.ttf');
  //    // exoticFont = loadFont('assets/exotic_font.woff2');
  // } catch (e) {
  //    console.warn("Failed to load custom baseFont. Using default monospace.", e);
  //    baseFont = 'monospace'; // Fallback to CSS font name
  // }
   // IMPORTANT: If loadFont fails, baseFont remains undefined until it errors or load.
   // Better: Initialize baseFont as CSS string, try loading, update if success.
   baseFont = 'monospace'; // Initialize as a safe CSS font string first
   // Optional: async loading try-catch block or check font.readyState in setup
   // Let's keep it simple for now and rely on P5's font loading if loadFont is called.
   // For the provided code using 'monospace' string initially and only trying to set if baseFont is truthy:
   // baseFont string should work universally.

}

function setup() {
  // Use standard canvas for live rendering (PNG, browser view)
  // CANVAS MUST BE CREATED BEFORE ANY UI ELEMENTS OR PGRAPHICS BUFFERS
  createCanvas(windowWidth, windowHeight);
    // Ensure window size is not zero/negative which can happen rarely on some mobile reloads?
    if (width <= 0 || height <= 0) {
        console.error("Canvas size invalid, restarting setup.");
         // Attempt a recursive call or defer might lead to loop, maybe just return and hope browser fixes it
         // For production, add a more robust handling or overlay message.
         return; // Exit setup if canvas fails to create with valid dimensions
     }


  SNAP_INCREMENT_RADIANS = radians(15);

  // Calculate initial canvas area dimensions and position
   // Ensure CANVAS_AREA_W is reasonable if windowWidth is very small
  const adjustedCanvasW = min(CANVAS_AREA_W, windowWidth * 0.95); // Give slightly more side room if window narrow

  CANVAS_AREA_H = adjustedCanvasW * (5 / 4); // Maintain 5:4 aspect ratio
  CANVAS_AREA_X = width / 2 - adjustedCanvasW / 2; // Center horizontally
  CANVAS_AREA_Y = HEADER_HEIGHT + 20; // Position below header + some padding
  if(CANVAS_AREA_X < 10) CANVAS_AREA_X = 10; // Ensure min left margin
  if(CANVAS_AREA_Y < HEADER_HEIGHT + 10) CANVAS_AREA_Y = HEADER_HEIGHT + 10; // Ensure min top margin below header


  // Create/Recreate canvas graphics buffer for the visible artboard area
  // Check if buffer needs recreation or just size update in windowResized
  // Better to handle this only in windowResized where resizeCanvas exists
    canvasPG = createGraphics(adjustedCanvasW, CANVAS_AREA_H);
    canvasPG.background(255); // Initial white background


    // --- FIX: Create the persistent graphics buffer for text measurement ---
     // It can be small, just needs a context to measure text.
     // Use 1x1 buffer minimum, not 0 size.
     textMeasurePG = createGraphics(1, 1); // Smallest possible size, but > 0
     // Ensure the font is set on this buffer's context immediately
     if (baseFont && typeof textMeasurePG.textFont === 'function') {
         textMeasurePG.textFont(baseFont);
     } else if (typeof textMeasurePG.textFont === 'function') {
          // Fallback if baseFont isn't loaded yet or is null
         textMeasurePG.textFont('monospace');
     }
     if (typeof textMeasurePG.textAlign === 'function') textMeasurePG.textAlign(CENTER, CENTER);


  let headerCenterY = HEADER_HEIGHT / 2;

  // Input element setup - Create and position initially
  inputElement = createInput();
  inputElement.value('');
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
   // Position relative to the calculated CANVAS_AREA_X/Y in header space
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15); // Position vertically centered in header zone, maybe adjusted slightly
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
      event.preventDefault(); // Prevent default browser action (like form submission)
    }
  });

  // --- Button setup (positioned in windowResized) ---
  // Create buttons as global variables, positioning handled in windowResized
  savePNGButton = createButton("SAVE PNG");
  saveHighResPNGButton = createButton("SAVE HI-RES PNG"); // New button
  savePDFButton = createButton("SAVE PDF");
  clearButton = createButton("CLEAR");
  refreshButton = createButton("REFRESH");

  // Basic Button Styling (More specific styles applied in windowResized)
   const baseButtonStyle = {
       padding: "5px 10px",
       border: "1px solid #888",
       "border-radius": "15px",
       "background-color": "rgba(200, 200, 200, 0.7)", // Slightly transparent buttons
       color: "rgb(50, 50, 50)",
       outline: "none",
       cursor: "pointer"
   };

   [savePNGButton, saveHighResPNGButton, savePDFButton, clearButton, refreshButton].forEach(btn => {
       if (btn) { // Check button exists
           Object.keys(baseButtonStyle).forEach(styleKey => {
                btn.style(styleKey, baseButtonStyle[styleKey]);
           });
            // Add basic hover effect - doesn't need to be complex for this v1 update
            btn.elt.onmouseover = function() { this.style.backgroundColor = 'rgba(220, 220, 220, 0.9)'; }
            btn.elt.onmouseout = function() { this.style.backgroundColor = baseButtonStyle["background-color"]; }

       }
   });


  // Bind mouse events - Moved binding from within mousePressed/Released to setup
   savePNGButton.mousePressed(saveCanvasAreaAsPNG); // Binds to original PNG save
   saveHighResPNGButton.mousePressed(saveCanvasAreaAsHighResPNG); // Binds to NEW high-res PNG save
   savePDFButton.mousePressed(saveCanvasAreaAsPDF);
   clearButton.mousePressed(restartAll);
   refreshButton.mousePressed(resetRandom);


   // Initial positioning of DOM elements after creation/styling
   // Call windowResized initially to place elements and resize canvasPG
   windowResized(); // Calls once initially

  // Create initial floating shapes
  while (shapes.length < 30) { shapes.push(new FloatingShape()); }

}

let canvasPG; // Global reference to the graphics buffer for the central canvas area

function draw() {
  // Set background for the main sketch window (black background as per request)
  background(0);

  // --- Update shapes ---
  // Use a reverse loop with splice for better performance than filter
  for (let i = shapes.length - 1; i >= 0; i--) {
      let shape = shapes[i];
     // Update if free-floating (not grabbed and not placing)
     if (!shape.isGrabbed && !shape.isPlacing) { shape.update(); }
     // Update landing animation state (runs only if isPlacing is true and not grabbed)
     shape.updateLanding();

      // Check if item should be removed (is really off-screen AND not grabbed AND not placing)
     if (!shape.isGrabbed && !shape.isPlacing && shape.isReallyOffScreen()) {
          shapes.splice(i, 1); // Remove item
         // console.log("Removed off-screen shape. Total shapes:", shapes.length); // Optional debug
      }
  }

  // Add new shapes to maintain population if needed, after removing off-screen ones
  while (shapes.length < 20) { shapes.push(new FloatingShape()); } // Maintain min floating shapes


  // --- Update placed items ---
  // Update landing state for placed items as well
  for (let item of placedItems) {
      item.updateLanding();
  }


  // --- Central White Canvas Area Drawing (Rendered to canvasPG) ---
  // This PG buffer represents the artboard content that gets saved/displayed
  if(canvasPG){
     canvasPG.clear(); // Clear buffer (makes it transparent initially)
     canvasPG.background(255); // Draw white background on buffer

    // Draw placed items onto canvasPG (fixed on the artboard)
    // Iterate FORWARDS to ensure correct drawing order (last added on top)
    for (let i = 0; i < placedItems.length; i++) {
        let item = placedItems[i];
         // Ensure item is not empty text when drawing for save
         // Display method handles skipping drawing for empty text unless it's the grabbed item (main canvas only).
         // Here we are drawing on PG for display/save, so empty text should be skipped regardless of grab state.
         // The item.display method has this check now.
        item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y); // Draw on buffer, no grab effect, apply offset
    }

    // Draw the canvasPG buffer onto the main canvas at the calculated position
    image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
  } else {
      // Handle case where canvasPG might be null (e.g., setup error, extreme resize)
      // console.warn("canvasPG is null, cannot draw central canvas area.");
      // Optionally draw a visual indicator of the error
       fill(255, 100, 100, 100); // Semi-transparent red box
       rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
       fill(0); textAlign(CENTER, CENTER); text("Error: Canvas area buffer missing.", CANVAS_AREA_X + CANVAS_AREA_W/2, CANVAS_AREA_Y + CANVAS_AREA_H/2);
  }


  // Draw border around canvas area on main canvas (on top of the canvasPG image)
  stroke(200); // Grey border
  strokeWeight(1);
  noFill();
  // Adjust rect slightly inward by half the stroke weight to keep border within nominal area
  // rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H); // Original, stroke straddles edge
   rect(CANVAS_AREA_X + 0.5, CANVAS_AREA_Y + 0.5, CANVAS_AREA_W - 1, CANVAS_AREA_H - 1); // Border inside


  // Draw grabbed item on top of everything else on the main canvas
  if (grabbedItem) {
      // Smoothly interpolate grabbed item position towards mouse
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.4); // lerpFactor
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.4);

      // Ensure grabbed item is solidified and its placing animation stops
      grabbedItem.solidify(); // Always solidifies movement while grabbed
      grabbedItem.isPlacing = false; // Always stops landing animation while grabbed

      // Update content of grabbed text item from the input field live
      if (grabbedItem.type === 'text') {
          // No need to check empty/placeholder here, as drawPrimitive handles skipping drawing if needed
           grabbedItem.content = inputElement.value(); // Get current input text directly
           // Maybe add logic to update cached bounds if content changes drastically? For V1, keep simple.
           // grabbedItem.calculateTextProperties(); // Would recalculate bounds if method existed/called.
      }


     // Draw the grabbed item on the main canvas with the grabbed visual effect
     // Pass 'this' for main canvas context, true for grab effect, no offset needed for drawing on main canvas.
     grabbedItem.display(this, true, 0, 0);
  }


  // --- DRAW HEADER / UI OVERLAY ---
  // Draw grey header background first
  fill(220);
  noStroke(); // No stroke for the header background rect
  rect(0, 0, width, HEADER_HEIGHT); // Fills from (0,0) to windowWidth, HEADER_HEIGHT

  // Draw the placeholder logo text on top of the header background
  fill(50); // Dark grey color for text
  textSize(20);
  textAlign(LEFT, CENTER);
  // Use baseFont for UI text if it's loaded or falls back to CSS string
   // Check if baseFont is a p5.Font object or just a string before setting.
  if (typeof baseFont === 'object' && baseFont !== null && typeof baseFont.text === 'function') {
      textFont(baseFont); // Set P5 font object
  } else {
      textFont('monospace'); // Fallback to CSS font name
  }
  text("PLACEHOLDER\nLOGO", 20, HEADER_HEIGHT / 2); // Position left, vertically centered in header
}

function mousePressed() {
  // Prevent default behavior that might interfere with grabbing or input focus
   // return false; // Careful with this, might break other interactions

   // Check if mouse is over the header or UI elements, ignore *grabbing* logic in header
   // (Specific button/input interactions handled by their own p5 DOM events/listeners)
   if (mouseY < HEADER_HEIGHT) {
       // Clicking in header might trigger focus changes etc., let those happen naturally
       return true; // Allow default behavior if in header, prevents interference with DOM elements
    }


  // If something is already grabbed, ignore subsequent attempts to grab *other* items
  // However, allow clicking on the already grabbed item to maintain focus/interact with input if it's text
   if (grabbedItem && grabbedItem.isMouseOver(mouseX, mouseY)) {
       // Allow interaction/dragging to continue with the item already grabbed
       // Ensure input has focus if it's a text item already grabbed (it should, but defensive)
        if (grabbedItem.type === 'text') inputElement.elt.focus();
        return false; // Indicate we've handled interaction with the grabbed item
   } else if (grabbedItem) {
        // If something is grabbed but the click is *not* on it, we might want to drop it.
        // mouseReleased handles the drop logic. Let's just prevent trying to grab another item.
        return false; // Click did not hit grabbed item, do nothing else here (don't try to grab something else)
   }


  // --- Logic to Grab an item ---
  // Attempt to grab items. Check PLACED items first (higher z-order visually).
  // **FIX FOR ISSUE 2: Only allow grabbing PLACED items if click is inside CANVAS_AREA**
   if (isMouseOverCanvasArea()) { // Check if click is within the central canvas artboard area
       // Iterate backwards through placedItems for correct z-order selection (last drawn on top)
       for (let i = placedItems.length - 1; i >= 0; i--) {
           // Item's own isMouseOver checks if click is *on the item*, relative to its position/scale/rotation
            if (placedItems[i].isMouseOver(mouseX, mouseY)) {
                grabbedItem = placedItems[i];
                grabbedItem.isGrabbed = true; // Mark as grabbed
                grabbedItem.isPlacing = false; // Stop any landing animation
                grabbedItem.solidify(); // Stop any residual movement

                // Move from placedItems array to shapes array (temporarily while grabbed)
                // This allows the item to be drawn last on the main canvas.
                let temp = placedItems.splice(i, 1)[0]; // Remove from placedItems
                shapes.push(temp); // Add to end of shapes (drawn on top of other shapes, below grabbed render loop)

                // Populate input field if text, and focus
                if (grabbedItem.type === 'text') {
                    inputElement.value(grabbedItem.content || ''); // Use item content or empty string
                    inputElement.attribute('placeholder', ''); // Remove placeholder
                    inputElement.elt.focus(); // Focus the input element
                 } else { // Not a text item
                    inputElement.value(''); // Clear input field
                    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore placeholder
                    inputElement.elt.blur(); // Ensure input loses focus if text was edited previously
                 }

                console.log("Grabbed a placed item.");
                return false; // Found and grabbed a placed item, stop checking
           }
       }
   }

  // If no placed item was grabbed OR the click was outside the canvas area, check for grabbing a FLOATING shape.
  // This check happens *regardless* of isMouseOverCanvasArea() status (as floating items are grabbable anywhere)
  // Iterate backwards through shapes for correct z-order selection (newer added are at end, potentially drawn later/on top)
  for (let i = shapes.length - 1; i >= 0; i--) {
      // Ensure the shape is not the current grabbed item (redundant as handled by `if (grabbedItem)` above, but harmless)
      if (!shapes[i].isGrabbed) { // Explicitly check grabbed state
          if (shapes[i].isMouseOver(mouseX, mouseY)) {
              grabbedItem = shapes[i];
              grabbedItem.isGrabbed = true; // Mark as grabbed
              grabbedItem.isPlacing = false; // Stop any landing animation
              grabbedItem.solidify(); // Stop floating movement

               // Item is already in shapes list. Reorder to end to ensure it's drawn last (on top).
              let temp = shapes.splice(i, 1)[0]; // Remove from its current position
              shapes.push(temp); // Add back to the end

              // Populate input field if text, and focus
              if (grabbedItem.type === 'text') {
                 inputElement.value(grabbedItem.content || ''); // Use item content or empty string
                 inputElement.attribute('placeholder', ''); // Remove placeholder
                 inputElement.elt.focus(); // Focus the input element
              } else { // Not a text item
                 inputElement.value(''); // Clear input field
                 inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore placeholder
                  inputElement.elt.blur(); // Ensure input loses focus
              }

              console.log("Grabbed a floating shape.");
              return false; // Found and grabbed a floating item, stop checking
          }
      }
  }

  // If the code reaches here, nothing grabbable was clicked outside the header/UI zone.
   // Clicking outside the canvas area on black space or missing objects shouldn't do anything except maybe blur the input
   // Let browser handle blur if clicked outside an input/button.

  // By default, P5 prevents right click context menu. Let's restore it UNLESS we successfully grabbed something.
  // We returned `false` when something was grabbed. If we didn't grab, return true.
  // This implicitly handles it because if nothing was grabbed, the code flow falls through to here.
   return true; // Allow default mouse action (like right-click menu) if no item was grabbed

}

function mouseReleased() {
  if (grabbedItem) {
    let wasTextItem = grabbedItem.type === 'text'; // Capture before state changes
    grabbedItem.isGrabbed = false; // Unmark as grabbed state ends


    if (isMouseOverCanvasArea()) { // Dropped over canvas area
      // Dropped on artboard -> solidify and place

      // If it's a text item, update content from input *on drop*
      if (wasTextItem) {
           let content = inputElement.value().trim();
           // If input is empty or placeholder after trim, discard the text item *if it was newly created or became empty*
           // If an existing text item's content becomes empty/placeholder while editing and is dropped on canvas, also discard.
           if(content === "" || content === TEXT_OPTIONS[0].trim()) {
               console.log("Discarding empty text item dropped on canvas.");
               // The item is currently in the 'shapes' array (moved there when grabbed). Filter it out.
               shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes
               grabbedItem = null; // Clear grabbed item reference
               // Input handling happens below regardless
               return; // Exit early, item is discarded
           } else {
              grabbedItem.content = content; // Update content from input
           }
      }


      grabbedItem.solidify(); // Ensure no movement

      // Apply rotation snapping if dropped on canvas (only rotation, scale handled by key)
      if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      }

      // Move item from shapes list (where it was temporarily during drag) to placedItems list
      shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes array
      placedItems.push(grabbedItem); // Add to placed items (at the end for visual z-order)

      // Start landing animation only AFTER it's placed and properties are finalized
      grabbedItem.isPlacing = true;
      grabbedItem.landFrame = frameCount; // Record frame for animation timing


      console.log("Item placed on canvas area.");

    } else { // Dropped outside canvas area -> Reverts to floating or discards
         // If text, update content from input field regardless on drop
         if (wasTextItem) {
             let content = inputElement.value().trim();
              // If content is empty/placeholder, discard the item completely *if dropped outside*.
              // This provides a clear way to delete items by dragging them off-canvas and releasing.
             if (content === "" || content === TEXT_OPTIONS[0].trim()) {
                  console.log("Discarding empty text item dropped outside canvas.");
                  // The item is currently in the 'shapes' array. Filter it out.
                  shapes = shapes.filter(s => s !== grabbedItem);
                  grabbedItem = null; // Clear grabbed item reference
                  // Input handling happens below regardless
                 return; // Exit early, item is discarded
             } else {
                  grabbedItem.content = content; // Update content from input
                  // Re-add updated item to shapes for continued floating
                   // (It's already in shapes from mousePressed if grabbed).
                  // Ensure its speed properties are reset below to start floating.
             }
         }


          // Item was dropped outside or was a shape dropped outside.
          // It is still in the 'shapes' array (moved there on grab).
          // Reset its movement speeds to float again
          // Use slightly higher speeds/rotation for typical floating
          grabbedItem.speedX = random(-1.5, 1.5);
          grabbedItem.speedY = random(-1.5, 1.5);
          grabbedItem.rotationSpeed = random(-0.003, 0.003);
          grabbedItem.isPlacing = false; // Cancel landing animation if it was mid-landing when grabbed
          // Item remains in shapes array, its properties are just updated for floating

          console.log("Item dropped outside canvas area, returned to floating.");
    }

    // Actions common to both drop locations (unless item was discarded and returned early)
    // Clear grabbed item reference and reset input field state
    // This section is only reached if grabbedItem was NOT discarded.
    if (grabbedItem !== null) { // Ensure grabbedItem is still valid before nulling/clearing input
         grabbedItem = null; // Clear grabbed item reference
         inputElement.value(''); // Clear input field
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
         inputElement.elt.blur(); // Ensure input field loses focus when drag ends

     }
  }
}

// NEW FUNCTION: Handle double-clicking for z-ordering placed items
function doubleClicked() {
    // Prevent default browser double-click behavior like selecting text
     // return false; // Careful, might affect input field

     // Only process double-clicks over the central canvas area
    if (!isMouseOverCanvasArea()) return true; // Allow default behavior if outside canvas area

     // Iterate through placed items backwards to find the topmost item double-clicked
    for (let i = placedItems.length - 1; i >= 0; i--) {
        let item = placedItems[i];
        // Use the item's mouse over check (which correctly checks against scaled bounds etc.)
        if (item.isMouseOver(mouseX, mouseY)) {
            // Found the double-clicked item among placed items
            console.log("Double-clicked a placed item, sending to back.");

             // Move the item to the start of the placedItems array
            // splice(index, howmany) removes element at index, returns array of removed elements
            let itemToSendToBack = placedItems.splice(i, 1)[0];
            placedItems.unshift(itemToSendToBack); // Add to the beginning of the array

            // Item should solidify if it wasn't already (double clicking confirms placement intention)
            itemToSendToBack.solidify(); // Ensure solid movement

            // No need for animation state change on layer change
            // grabbedItem check ensures this doesn't interfere if somehow doubleClicked happened *during* a drag (unlikely)

            return false; // Prevent default behavior since we handled the interaction
        }
    }

    // If the code reaches here, nothing grabbable on the canvas area was double-clicked.
     return true; // Allow default behavior
}

function mouseWheel(event) {
   // Prevent page scroll when interacting over relevant sketch area (anything below header)
   let isOverInteractiveArea = mouseY >= HEADER_HEIGHT; // More forgiving: any sketch area below header


    if (grabbedItem && isOverInteractiveArea) {
        // Rotate grabbed item by scrolling wheel
        grabbedItem.rotation += event.delta * 0.002; // Smaller increment
        return false; // Prevent default browser scroll
    }
    // Allow scrolling outside the main interactive area or if nothing is grabbed
    // Clicking on buttons/input then scrolling is expected to scroll the page if content exists
    return true; // Allow default browser scroll elsewhere
}

function keyPressed() {
    // Check if the input field or any other HTML element has focus
    // This prevents key presses (like DELETE or + / -) from affecting sketch items
    // when the user is actively typing in the input field.
    if (document.activeElement !== document.body && document.activeElement !== canvas.elt) {
        // console.log("Key pressed while input or other element is focused. Ignoring sketch shortcut.");
        // Check specifically if it's the input element, if so, always allow typing
        if (document.activeElement === inputElement.elt) return true;
        // If another element (button?), maybe allow defaults? Depends on needs.
        return true; // Allow default action if a specific non-canvas element is focused
    }


    // Delete grabbed item with DELETE or BACKSPACE IF nothing in sketch is focused other than canvas
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        console.log("Deleting grabbed item.");
        // Remove from wherever it might be (should only be in shapes or placedItems, but defensive)
        shapes = shapes.filter(s => s !== grabbedItem);
        placedItems = placedItems.filter(s => s !== grabbedItem);
        grabbedItem = null; // Clear the grabbed item reference

        // Reset input field state when deleted, focus it
        inputElement.value('');
        inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
        inputElement.elt.focus(); // Set focus to input field after deleting

        return false; // Prevent default key action (like browser navigation/history back for backspace)
    }

    // Scale grabbed item with + / = or - IF nothing in sketch is focused other than canvas
     if (grabbedItem) { // Checked focused state above already
          // Limit scaling to prevent shapes from becoming infinitely large/small
          const scaleIncrement = 1.08; // Scale up by 8%
          const scaleDecrement = 1 / scaleIncrement; // Scale down by reciprocal for consistency
          const minScale = 0.05; // Minimum scale factor
          const maxScale = 10.0; // Maximum scale factor (can make items huge!)

         if (key === '+' || key === '=') {
             grabbedItem.scaleFactor *= scaleIncrement;
             grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, maxScale); // Clamp max
              // Update cached properties that depend on scale? Yes, but keep V1 simple.
         }
         if (key === '-') {
             grabbedItem.scaleFactor *= scaleDecrement;
             grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, minScale); // Clamp min
              // Update cached properties that depend on scale?
         }

         // Optionally, give visual feedback the item scaled (e.g. pulse animation trigger)
         // grabbedItem.triggerScaleAnimation(); // If you had a scaling animation property

        return false; // Prevent default key action (like zooming page)
    }

    // Allow other keys to function normally if not handled above (e.g., browser shortcuts, copy/paste IF we added it)
    // If the activeElement was checked above and was the input field, this will be true, allowing typing.
    return true;
}


function addNewTextShapeFromInput() {
    let currentText = inputElement.value();
    // Only add text if input has content and it's not just the placeholder
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
         console.log("Input empty/placeholder, not adding text.");
         // Add a temporary visual cue to the input field
         inputElement.style("border-color", "red"); // Change border to red
         setTimeout(() => inputElement.style("border-color", "#ccc"), 500); // Revert after 500ms
         inputElement.value(''); // Ensure input is cleared if it was just placeholder+space
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
         inputElement.elt.focus(); // Keep focus on input
         return; // Exit function early
    }

    console.log("Adding new text shape:", currentText.trim());

    let newTextShape = new FloatingShape();
    newTextShape.reset(); // Start with default floating properties
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim(); // Use the trimmed text from the input
    newTextShape.shapeType = 'none'; // Text items have no shape primitive (aside from text itself)

    // Assign properties from a size category. Use 'medium' category as base.
    let category = sizeCategories.find(cat => cat.name === 'medium') || { sizeRange: [100, 200], scaleRange: [1.0, 1.5], textScaleAdjust: 0.2 }; // Default if medium not found
    newTextShape.size = random(category.sizeRange[0] * 0.8, category.sizeRange[1] * 1.2); // Assign a random size around the category's base
    newTextShape.scaleFactor = 1.0; // Start with default scale (scale can be changed by user later)
    newTextShape.textScaleAdjust = category.textScaleAdjust; // Get text scale multiplier from category
    newTextShape.font = baseFont; // Assign the base font

    // Recalculate internal text properties (like effective size and bounds cache) immediately after setting content/size/font
    // If we had a caching mechanism, call it here: newTextShape.calculateTextProperties();

     // Ensure text color has enough contrast against a white background (artboard default)
     // and also preferably visible against black (floating background)
     let pickedColor;
     let attempts = 0;
     do {
         pickedColor = color(random(PALETTE));
         // Check brightness against white (aim for dark) and black (aim for light) - slightly complex
         // Simpler: just aim for medium to dark colors initially, avoiding very bright white-ish or very dark black-ish for visibility on both.
         let b = brightness(pickedColor);
         // Accept colors if brightness is not too close to pure white (255) or pure black (0)
          // Use threshold based on 255 scale. brightness > 200 is maybe too close to white. brightness < 50 maybe too close to black.
         if (b < 50 && attempts < 5) continue; // If very dark, try a few times
         if (b > 200 && attempts < 5) continue; // If very bright, try a few times

         break; // Exit loop if a reasonably contrasting color found
     } while (attempts < 10); // Stop after 10 attempts

     // If after attempts the color is still very bright (likely used white from palette), try forcing a dark one.
      if (brightness(pickedColor) > 200) {
           pickedColor = color(random(['#0000FE', '#E70012', '#41AD4A', '#000000', '#222222'])); // Pick a known dark color
      }

     newTextShape.color = pickedColor;


     // --- FIXED SPAWN LOCATION (ISSUE 1) ---
     // Spawn location: Randomly to the left or right of the artboard within visible window bounds
     let spawnSide = random() > 0.5 ? 'right' : 'left'; // Choose left or right randomly
     let spawnMargin = 40; // Minimum distance from window or artboard edges

     if (spawnSide === 'left') {
         // Spawn left of canvas area, X between spawnMargin and CANVAS_AREA_X - spawnMargin
         newTextShape.x = random(spawnMargin, CANVAS_AREA_X - spawnMargin);
         newTextShape.speedX = random(0.5, 1.5); // Float towards the right (away from edge)
     } else { // right
         // Spawn right of canvas area, X between CANVAS_AREA_X + CANVAS_AREA_W + spawnMargin and width - spawnMargin
         newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W + spawnMargin, width - spawnMargin);
         newTextShape.speedX = random(-1.5, -0.5); // Float towards the left (away from edge)
     }
     // Y position: Randomly within the vertical bounds of the canvas area + margins
     newTextShape.y = random(CANVAS_AREA_Y - spawnMargin, CANVAS_AREA_Y + CANVAS_AREA_H + spawnMargin);
      // Ensure initial Y is not in the header
     newTextShape.y = max(newTextShape.y, HEADER_HEIGHT + spawnMargin);


     // Assign other floating properties - keep them gentle
     newTextShape.speedY = random(-0.5, 0.5); // Allow slight up/down movement
     newTextShape.rotation = random(TWO_PI); // Initial random rotation
     newTextShape.rotationSpeed = random(-0.001, 0.001); // Very slow random rotation

     // Ensure item state starts as floating
     newTextShape.isGrabbed = false;
     newTextShape.isPlacing = false;


    shapes.push(newTextShape); // Add to floating shapes array

    inputElement.value(''); // Clear input field after adding text
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
    inputElement.elt.focus(); // Keep focus for quick entry of next text
}

// Checks if the mouse is within the boundaries of the central canvas artboard area
function isMouseOverCanvasArea() {
     // Check bounds inclusive of edges for a slight tolerance effect or exact edge hit
    return mouseX >= CANVAS_AREA_X && mouseX <= CANVAS_AREA_X + CANVAS_AREA_W &&
           mouseY >= CANVAS_AREA_Y && mouseY <= CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Snaps a given angle (radians) to the nearest increment
function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0 || isNaN(incrementRadians)) return angleRadians; // Avoid errors
    // Normalize angle to be between 0 and TWO_PI
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI;
    // Calculate number of increments to snap to
    let numIncrements = round(angleRadians / incrementRadians);
    // Calculate the snapped angle
    let snapped = numIncrements * incrementRadians;
     // Re-normalize snapped angle (should already be in range if increments are sensible, but defensive)
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI;

    return snapped;
}

// Helper to generate timestamp string for filenames
function generateTimestampString() {
    let d = new Date();
    return d.getFullYear() + nf(d.getMonth() + 1, 2) + nf(d.getDate(), 2) + '_' + nf(d.getHours(), 2) + nf(d.getMinutes(), 2) + nf(d.getSeconds(), 2);
}


// SAVE PNG function (standard resolution - saves canvasPG directly)
function saveCanvasAreaAsPNG() {
    console.log("SAVE PNG button pressed (Standard Resolution)");
    if (!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) {
        console.warn("Cannot save Standard PNG: canvasPG not created or has zero dimensions.");
        alert("Error: Cannot save standard PNG. Canvas area buffer is not available or invalid.");
        return;
    }

    // Create a temporary buffer just for the final save image, copy canvasPG to it
     // This avoids drawing border directly onto canvasPG which needs to be redrawn
    let saveBuffer = createGraphics(canvasPG.width, canvasPG.height);
    saveBuffer.image(canvasPG, 0, 0); // Copy current artboard content


    // Draw border onto this temporary save buffer
    saveBuffer.push();
    saveBuffer.stroke(0); // Black border
    saveBuffer.strokeWeight(1);
    saveBuffer.noFill();
    // Draw rectangle outline just inside the edge
    saveBuffer.rect(0.5, 0.5, saveBuffer.width - 1, saveBuffer.height - 1); // Adjust by 0.5px inward
    saveBuffer.pop(); // Restore saveBuffer state

    console.log("Saving Standard PNG...");
    // Save the temporary buffer
    saveCanvas(saveBuffer, 'myArtboard_stdres_' + generateTimestampString() + '.png');
     console.log("Standard PNG save initiated.");

     // Dispose of the temporary buffer
    if (saveBuffer) { saveBuffer.remove(); } // Dispose the p5.Graphics element
}


// SAVE HIGH-RESOLUTION PNG function (New function for print output)
// Currently targets B2 @ 300 DPI. Will be updated later to be relative to CANVAS_AREA_W/H * 10 scale.
function saveCanvasAreaAsHighResPNG() {
    console.log("SAVE HIGH-RES PNG button pressed (B2 @ 300 DPI target or Scaled)");

     if (!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) {
        console.warn("Cannot generate high-res PNG: canvasPG not created or has zero dimensions.");
        alert("Error: Cannot save high-resolution PNG. Canvas area buffer is not available or invalid.");
        return;
     }

    // === Current High-Res Logic (Targets fixed B2 size scaled) ===
    // Source dimensions are your displayed artboard dimensions (canvasPG size)
    const sourceWidth = canvasPG.width;
    const sourceHeight = canvasPG.height;

    // Desired high-res output dimensions
     // OPTION 1 (Current): Fixed print target (like B2) at 300 DPI. Your current implementation does this relative to B2 aspect ratio.
     // This doesn't *strictly* save the canvas content, but renders the *items* positioned/scaled for B2 output.
    const TARGET_DPI = 300; // Standard print resolution
    const B2_WIDTH_MM = 500; // B2 paper dimensions in mm
    const B2_HEIGHT_MM = 707;
    const MM_PER_INCH = 25.4;
     const actualTargetWidth = round((B2_WIDTH_MM / MM_PER_INCH) * TARGET_DPI); // approx 5906
    const actualTargetHeight = round((B2_HEIGHT_MM / MM_PER_INCH) * TARGET_DPI); // approx 8350 or 8351

    // OPTION 2 (Future request): Scale relative to current artboard size, e.g., 10x
    // const actualTargetWidth = round(sourceWidth * 10);
    // const actualTargetHeight = round(sourceHeight * 10);
     // If choosing Option 2, the verticalOffset below is zero if centering isn't desired within a larger format


    // For saving purposes, use the exact target sizes derived from the B2 calculation (or future 10x)
    let targetWidthPixels = 5906; // B2 W at 300dpi rounded
    let targetHeightPixels = 8350; // B2 H at 300dpi rounded

     // Calculate scale factor based on scaling source width to target width
     const scaleFactor = targetWidthPixels / sourceWidth;

     // Calculate the height of the source content when scaled to target width
     const scaledSourceHeight = sourceHeight * scaleFactor;

     // Calculate vertical offset to center the scaled source content within the target canvas height
     // This only applies if the target height aspect ratio doesn't match the source height aspect ratio after scaling the width.
     // Your 5:4 artboard (source) doesn't match B2 aspect ratio (approx 1:1.414). So need centering.
     const verticalOffset = (targetHeightPixels - scaledSourceHeight) / 2;


    // Create a new temporary graphics buffer for high-resolution drawing
    let highResPG = null;
     try {
         if (targetWidthPixels <= 0 || targetHeightPixels <= 0 || isNaN(targetWidthPixels) || isNaN(targetHeightPixels)) {
             console.error("Invalid target high-res dimensions calculated:", targetWidthPixels, targetHeightPixels);
             alert("Error calculating high-res save size.");
             return;
         }

        highResPG = createGraphics(targetWidthPixels, targetHeightPixels);
        highResPG.background(255); // White background


        // Draw placed items onto the high-res buffer with scaling
        // The items' coordinates (item.x, item.y) are relative to the *main sketch window*.
        // The artboard is located at (CANVAS_AREA_X, CANVAS_AREA_Y) in the main sketch.
        // An item at (item.x, item.y) is located at (item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y) *relative to the artboard's top-left corner*.
        // To draw it correctly on the high-res buffer (whose origin is its own top-left, analogous to artboard's origin):
        // 1. Start at the drawing origin (0,0) of highResPG.
        // 2. Translate to where the scaled item center should be. This is (item.x - CANVAS_AREA_X) scaled by scaleFactor horizontally,
        //    and (item.y - CANVAS_AREA_Y) scaled by scaleFactor vertically, PLUS the vertical offset for centering.
        // 3. Apply item's rotation.
        // 4. Apply the combined scale: item's scaleFactor * overall high-res scaleFactor.
        // 5. Draw the primitive shape at (0,0) in this scaled context.

        console.log(`Drawing ${placedItems.length} placed items onto high-res buffer...`);
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             // Skip empty text items during high-res save
             if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                 continue; // Skip drawing empty text items
             }
             // Skip shapes/items with invalid properties
             if (item.scaleFactor <= 0 || item.size <= 0) continue; // Skip invalidly scaled/sized items

            highResPG.push(); // Save highResPG's transformation state before drawing item

             // Calculate the item's center position relative to the HIGH-RES buffer's origin.
             // Start from item's position relative to *artboard origin*, scale it up, add vertical offset.
             let hrItemX = (item.x - CANVAS_AREA_X) * scaleFactor;
             let hrItemY = (item.y - CANVAS_AREA_Y) * scaleFactor + verticalOffset;

            // Ensure hrItemX/Y are finite numbers before translating
             if (isNaN(hrItemX) || isNaN(hrItemY)) {
                 console.warn(`Calculated NaN position for item ${i}. Skipping draw.`, item);
                 highResPG.pop(); continue;
             }
            highResPG.translate(hrItemX, hrItemY); // Move drawing origin to the item's calculated center on highResPG


            highResPG.rotate(item.rotation); // Apply item's rotation around its center (which is now highResPG's origin)

            // Apply the total scale: item's intrinsic scaleFactor AND the overall scaling to high-res size.
             let combinedScale = item.scaleFactor * scaleFactor;
              // Clamp combinedScale to prevent potential render errors with huge/tiny values
              combinedScale = max(combinedScale, 1e-6); // Prevent near zero/negative scale

            highResPG.scale(combinedScale); // Apply the combined scale


            // Set drawing styles for the item using highResPG context
            highResPG.fill(item.color);
            highResPG.noStroke(); // Assume no stroke for main fill


            // Draw the primitive shape or text using the item's *base size* relative to its scaled origin (0,0).
            // drawShapePrimitive will correctly scale this base size by the applied `combinedScale` on the context.
            // Pass null/default font if item font is missing, and clamp text scale adjust
             let itemFont = (item.font && typeof item.font.text === 'function') ? item.font : baseFont;
             let itemTextScale = isNaN(item.textScaleAdjust) ? 0.2 : item.textScaleAdjust;
              itemTextScale = max(itemTextScale, 1e-3); // Ensure minimum text scale adjust

             item.drawShapePrimitive(highResPG, 0, 0, item.size, item.shapeType, item.type === 'text', itemTextScale);

            highResPG.pop(); // Restore highResPG's transformation state for the next item


        } // End item drawing loop


         // Draw a border on the high-res canvas around the *scaled content area*
        highResPG.push();
         highResPG.stroke(0); // Black border color
         // Scale border weight relative to the overall scale factor
         let borderWeight = 1 * scaleFactor; // Scale 1px border thickness
         borderWeight = max(borderWeight, 0.5); // Ensure minimum visible border
         highResPG.strokeWeight(borderWeight);
         highResPG.noFill();
         // The border rect encompasses the area the scaled content takes up.
         // Top-left of scaled content area is at (0, verticalOffset) on the high-res canvas.
         // Size is (targetWidthPixels, scaledSourceHeight).
          // Adjust position/size slightly inward to keep border fully within the visual area boundary
         let borderRectX = 0; // Starts at the left edge
         let borderRectY = verticalOffset; // Starts at the top of the centered content area
         let borderRectW = targetWidthPixels; // Width spans the full target width
         let borderRectH = scaledSourceHeight; // Height spans the scaled source height

          // To ensure border is inside the rectangle boundaries, shift position and reduce size by strokeWeight
          // Center of the border line is drawn *on* the path by default in most graphics APIs (and p5 rect stroke)
         highResPG.rect(borderRectX + borderWeight / 2, borderRectY + borderWeight / 2,
                        borderRectW - borderWeight, borderRectH - borderWeight);

        highResPG.pop(); // Restore highResPG state


        console.log(`Saving high-res PNG (${targetWidthPixels}x${targetHeightPixels})...`);
         // Save the high-resolution buffer as a PNG file
         // Add a check for valid dimensions before saving
        if (targetWidthPixels > 0 && targetHeightPixels > 0) {
             saveCanvas(highResPG, `myArtboard_HIRES_${targetWidthPixels}x${targetHeightPixels}_` + generateTimestampString() + '.png');
             console.log("High-res PNG save initiated.");
         } else {
              console.warn("Cannot save high-res PNG: Target dimensions are invalid after calculation.");
             alert("Error: High-resolution dimensions are invalid.");
         }


     } catch(e) {
        console.error("An unexpected error occurred during high-res PNG generation:", e);
        alert("Error saving high-resolution PNG. Check browser console.");
     } finally {
        // Always dispose of the temporary graphics buffer element to free up memory
        if (highResPG) {
             highResPG.remove(); // Correct way to remove the graphics element created with createGraphics
             console.log("High-res buffer disposed.");
         }
     }
}


// SAVE PDF function using zenoZeng's p5.pdf library (vector for simple shapes/text)
// Captures drawing commands specifically targeting the area where the artboard is displayed.
function saveCanvasAreaAsPDF() {
    console.log("SAVE PDF button pressed (using zenoZeng's p5.pdf)");

    // Check if the p5.pdf library and its methods are available
    if (typeof p5 === 'undefined' || !p5.prototype.createPDF || typeof p5.prototype.createPDF !== 'function') {
         console.error("p5.pdf library not loaded or not providing createPDF method. Check index.html script includes and load order.");
         alert("Error: PDF library not loaded or initialized correctly.");
         return;
     }

    let pdf = null; // Declare pdf variable before try block

     try {
         // Create a p5.PDF instance linked to the current sketch instance 'this'.
         // Ensure it's called on the p5.prototype for reliable access depending on P5 mode.
         pdf = p5.prototype.createPDF(this); // Passing 'this' (the sketch instance)

        if (!pdf || typeof pdf.beginRecord !== 'function' || typeof pdf.endRecord !== 'function' || typeof pdf.save !== 'function') {
            console.error("p5.PDF instance created, but key methods (beginRecord, etc.) are missing. Check p5.pdf.js integrity.");
             // Dispose potential partial object
             if (pdf && typeof pdf.remove === 'function') { try { pdf.remove(); } catch(e) {} }
             pdf = null; // Ensure pdf is null to avoid finally block errors
             alert("Error creating PDF instance.");
            return;
        }
        console.log("p5.PDF instance created. Starting record.");

        // Begin recording drawing commands on the main canvas context.
        // The p5.pdf library intercepts subsequent drawing calls made using global p5 functions (fill, rect, text etc.)
        pdf.beginRecord();

        // --- Drawing the Artboard Content for PDF Capture ---
        // This content will be mapped to a PDF page sized to CANVAS_AREA_W x CANVAS_AREA_H.
        // The drawing happens using standard p5 functions which get captured.

        // We need to set the 'background' of the PDF page (which is based on the canvas area)
        // by explicitly drawing a background rectangle or calling background().
        // Let's draw a white background rect filling the artboard area *within* the recorded context.

        // Temporarily set up coordinate space for drawing *relative to the artboard origin (top-left)*
        // All item coordinates are currently relative to the MAIN sketch origin.
        // We translate the canvas's coordinate system such that (CANVAS_AREA_X, CANVAS_AREA_Y) becomes the new (0,0) for PDF drawing.
        push(); // Save main canvas transform state BEFORE applying PDF specific transforms
        translate(-CANVAS_AREA_X, -CANVAS_AREA_Y); // Shift origin for PDF recording


         // Set the background *within the translated PDF area*
         fill(255); // White fill color
         noStroke(); // No stroke for the background rectangle
         // Draw the white rectangle covering the entire artboard area relative to the new (0,0)
         rect(0, 0, CANVAS_AREA_W, CANVAS_AREA_H);


        // Draw placed items using global drawing commands.
        // Because we translated the coordinate system above, item coordinates (item.x, item.y),
        // which are in the original sketch coordinate system, will now be rendered
        // relative to the new origin. An item at (CANVAS_AREA_X + dx, CANVAS_AREA_Y + dy) in sketch space
        // will be drawn at ((CANVAS_AREA_X + dx) - CANVAS_AREA_X, (CANVAS_AREA_Y + dy) - CANVAS_AREA_Y) = (dx, dy)
        // in the translated space, which is correct (position relative to artboard origin).

        // Iterate FORWARDS through placedItems to ensure correct z-order in PDF
        console.log(`Drawing ${placedItems.length} placed items for PDF...`);
        for (let i = 0; i < placedItems.length; i++) {
             let item = placedItems[i];

             // Skip empty text items in PDF output
              if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                 continue; // Skip drawing empty text items for PDF
             }
             // Skip shapes/items with invalid properties during PDF save
             if (item.scaleFactor <= 0 || item.size <= 0) continue;


            push(); // Save state BEFORE item transformations
            translate(item.x, item.y); // Translate drawing origin to the item's center location (in ORIGINAL sketch coords)
            rotate(item.rotation); // Apply item's rotation around its center

            // Apply item's scale factor to the coordinate system.
            // The combination with the base size (item.size) in drawShapePrimitive provides final size.
             // The landing pulse (tempScaleEffect) should *not* be included in static save outputs (PNG, PDF)
            scale(item.scaleFactor); // Apply just the item's base scaleFactor


            // Set drawing styles for the item using global p5 functions
            fill(item.color); // Apply fill color
            noStroke(); // Assume no stroke for main fill (consistent with display logic)


            // Draw the primitive shape or text using the item's *base size*.
            // This calls global p5 primitive methods like rect(), ellipse(), text(), vertex(), etc.
            // which are recorded by p5.pdf.
             // Pass null/default font if item font is missing, and clamp text scale adjust
             let itemFont = (item.font && typeof item.font.text === 'function') ? item.font : baseFont;
             let itemTextScale = isNaN(item.textScaleAdjust) ? 0.2 : item.textScaleAdjust;
             itemTextScale = max(itemTextScale, 1e-3); // Ensure minimum text scale adjust


            item.drawShapePrimitive(this, 0, 0, item.size, item.shapeType, item.type === 'text', itemTextScale);
             // NOTE: drawShapePrimitive calls methods like graphics.rect(). When called with 'this', it calls global p5 functions.
             // P5.pdf.js records THESE global calls.

            pop(); // Restore state after item transformations
        }

        // Optional: Draw border around artboard area in PDF using global commands
        // Needs to be drawn in the translated context where artboard starts at (0,0)
         push(); // Save translated state
         stroke(0); // Black border color
         strokeWeight(1); // 1 pixel border thickness
         noFill();
         // Draw rectangle outline matching the artboard size at the new (0,0) origin.
         rect(0, 0, CANVAS_AREA_W, CANVAS_AREA_H);
         pop(); // Restore translated state


        // Restore main canvas transform state to what it was before translate(-CANVAS_AREA_X, -CANVAS_AREA_Y)
        pop();


        // --- End Drawing commands for PDF context ---

        console.log("Finished recording. Saving PDF.");
        // Finish recording. This captures all drawing commands made since beginRecord().
        pdf.endRecord();

        // Save the captured state as a PDF.
        // The 'width' and 'height' options here set the actual dimensions of the PDF *page*.
        // We set it to the size of our artboard area (CANVAS_AREA_W x CANVAS_AREA_H).
        // Drawing commands outside this rectangle will effectively be clipped.
        pdf.save({
            filename: 'myArtboard_pdf_' + generateTimestampString(),
            width: CANVAS_AREA_W, // PDF page width matches display artboard width
            height: CANVAS_AREA_H, // PDF page height matches display artboard height
            // Setting margins to 0 ensures the artboard content fills the page precisely (assuming 0,0 start of recording area)
            margin: {top:0, right:0, bottom:0, left:0}
             // quality, compressed, pageSize options might also be available depending on library fork
             // PDF/vector rendering depends on the browser's built-in print capabilities once the save dialogue appears, and the specific p5.pdf.js implementation.
             // Basic shapes (rect, ellipse, polygon from vertices) and standard fonts *should* be vector.
        });

        console.log("PDF save initiated.");

     } catch(e) {
         console.error("An error occurred during PDF generation:", e);
         alert("Error generating PDF. Check browser console.");
         // Attempt to safely end recording and dispose of PDF object if possible after an error
         if (pdf && typeof pdf.isRecording === 'boolean' && pdf.isRecording && typeof pdf.endRecord === 'function') {
             console.warn("Attempting to call pdf.endRecord() after caught error.");
             try{ pdf.endRecord(); } catch(endErr) { console.error("Error calling pdf.endRecord() during error handling:", endErr); }
         }
         if (pdf && typeof pdf.remove === 'function') { try { pdf.remove(); } catch(remErr) { console.error("Error calling pdf.remove() during error handling:", remErr); } }
     }
}

// REFRESH button action - Replace floating shapes
function resetRandom() {
    console.log("REFRESH button pressed");
    // Temporarily store the grabbed item if it's floating, so it's not lost
    let tempGrabbedItem = grabbedItem;
    let wasFloating = tempGrabbedItem && shapes.includes(tempGrabbedItem);

    if (wasFloating) {
        // If the grabbed item was floating (or newly created text before drop),
        // temporarily remove it from 'shapes' so it's not cleared.
        shapes = shapes.filter(s => s !== tempGrabbedItem);
         console.log("Keeping grabbed item during refresh.");
    }


    shapes = []; // Clear existing floating shapes

    // Add new random floating shapes
    while (shapes.length < 30) { // Aim for slightly more shapes initially than min maintenance
        let newShape = new FloatingShape();
        // Optionally, you could modify speeds slightly here so they don't all stream from one corner if resetRandom is hit quickly
        shapes.push(newShape);
    }

    // Add the temporarily stored grabbed item back to the shapes array if it was floating
    if (wasFloating && tempGrabbedItem) {
        shapes.push(tempGrabbedItem); // Add it back to the end (will be drawn on top of other shapes)
        // Ensure it remains grabbed state - not strictly necessary as 'grabbedItem' variable holds reference
    }
    // If a placed item was grabbed, it remains in the 'shapes' array currently, which is fine.
    // When released outside, it stays in shapes. When released inside, it moves back to placedItems.
    // No special handling needed here for grabbed placed items, as they weren't in 'shapes' list until grabbed anyway.


    console.log(`Refreshed floating shapes. Total shapes: ${shapes.length}`);
}

// CLEAR button action - Resets everything
function restartAll() {
    console.log("CLEAR button pressed. Restarting state.");
    placedItems = []; // Clear items placed on canvas
    shapes = []; // Clear all floating shapes (this also removes grabbedItem if it was in shapes)
    grabbedItem = null; // Ensure no item is referenced as grabbed

    inputElement.value(''); // Clear input field content
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
    inputElement.elt.blur(); // Remove focus from input field


     // Clear canvasPG buffer visually (background(255) redraws on next draw call)
     if (canvasPG) {
         canvasPG.clear(); // Or canvasPG.background(255) is enough
         // canvasPG is automatically redrawn with white background and empty placedItems list in the next draw loop
          console.log("canvasPG buffer cleared.");
     }

    // Generate a new set of initial floating shapes
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }

    console.log(`State cleared and repopulated with new floating shapes. Total shapes: ${shapes.length}`);
}

// WINDOW RESIZED FUNCTION - Handles responsive layout and canvasPG resizing
function windowResized() {
    console.log(`Window resized to: ${windowWidth}x${windowHeight}`);
     // Only resize if dimensions are positive and different to prevent infinite loops or errors
     if (windowWidth > 0 && windowHeight > 0 && (windowWidth !== width || windowHeight !== height)) {
        resizeCanvas(windowWidth, windowHeight); // Resize the main p5 canvas
     } else {
          // console.log("Window resize reported with same or invalid dimensions, skipping canvas resize.");
         return; // Skip the rest if canvas wasn't resized or dimensions are bad
     }


     // Recalculate canvas area dimensions and position
     // Ensure CANVAS_AREA_W is reasonable relative to window width
     // Make it at least 300px, or 95% of window width, capped at original CANVAS_AREA_W
     const minCanvasW = 300;
     const adjustedCanvasW = min(CANVAS_AREA_W, max(minCanvasW, windowWidth * 0.95));


    CANVAS_AREA_H = adjustedCanvasW * (5 / 4); // Maintain 5:4 aspect ratio

    // Calculate X position, centering within available space. Leave margins.
    let minSideMargin = 15; // Min margin on left/right of the canvas area
    CANVAS_AREA_X = max(minSideMargin, (width / 2 - adjustedCanvasW / 2));

    // Calculate Y position below the header. Leave padding below header.
    let padY = 20;
    CANVAS_AREA_Y = HEADER_HEIGHT + padY;

     // Ensure canvas area fits vertically below header and has some bottom room if needed
     let minBottomMargin = 15;
      if (CANVAS_AREA_Y + CANVAS_AREA_H + minBottomMargin > height) {
           // If canvas area exceeds window height (including margins), clamp its size or position
           // Prioritize showing the top part if space is very constrained
           CANVAS_AREA_H = height - CANVAS_AREA_Y - minBottomMargin; // Reduce height to fit
            if (CANVAS_AREA_H < adjustedCanvasW * (0.5)) { // If it's gotten extremely squashed, cap min aspect ratio?
                // This might break the 5:4 aspect ratio. Alternative: Make CANVAS_AREA_Y dynamic?
                // For simplicity V1, let the height calculation based on width win, but maybe warn if too large.
                if (CANVAS_AREA_H < 100) console.warn(`Calculated CANVAS_AREA_H is very small (${CANVAS_AREA_H}). Window is too short.`);
             }
          CANVAS_AREA_W = CANVAS_AREA_H * (4/5); // Adjust width based on squashed height to keep 5:4 (This part conflicts with width lock, need a choice!)
          // Let's revert: Maintain width and calculated height. Let bottom content be off-screen if needed, focus on layout relative to top header.
          CANVAS_AREA_W = adjustedCanvasW; // Stick to the calculated width first
           // CANVAS_AREA_H will be the target calculated from width * 5/4
           // If (CANVAS_AREA_Y + CANVAS_AREA_H + minBottomMargin) is still > height, then some of the artboard will be below the fold.
           // This is often acceptable; the user can scroll the page if enabled, or live with it in this simple tool.
           // If we want *the entire artboard* to always be visible, we need to scale down the artboard size calculation itself based on vertical constraints.
           // For V1: Maintain aspect ratio, center horizontally, place below header vertically. Allow clipping at bottom if window very short.
            // Re-calculating based on *fitting* the height if height becomes the limiting factor:
             const maxAllowableHeight = height - HEADER_HEIGHT - padY - minBottomMargin;
             if (CANVAS_AREA_H > maxAllowableHeight && maxAllowableHeight > 100) { // Only adjust if constraint active and space is positive
                CANVAS_AREA_H = maxAllowableHeight; // Cap height
                CANVAS_AREA_W = CANVAS_AREA_H * (4/5); // Recalculate width to maintain 5:4 ratio based on capped height
                 CANVAS_AREA_W = max(minCanvasW, min(CANVAS_AREA_W, windowWidth * 0.95)); // Also clamp width just in case?
                 // This iterative adjustment can be complex. A single calculation choosing based on minimum scale is cleaner:
                  // Let effective max W = windowWidth * 0.95, effective max H = height - HEADER_HEIGHT - padY - minBottomMargin.
                  // Required W for ratio = currentH * 4/5, Required H for ratio = currentW * 5/4.
                  // Scale = min(effectiveMaxW / OriginalFixedCanvasW, effectiveMaxH / (OriginalFixedCanvasW * 5/4)). Apply this scale to original 500x625.
                  // V1 Simpler:
                   const idealH_forW = adjustedCanvasW * (5/4);
                   const availableH = height - HEADER_HEIGHT - padY - minBottomMargin;
                   if (idealH_forW > availableH && availableH > 100) { // If portrait constraint is tighter
                        CANVAS_AREA_H = availableH;
                         CANVAS_AREA_W = CANVAS_AREA_H * (4/5); // Let height define width if necessary to fit
                         CANVAS_AREA_W = max(minCanvasW, min(CANVAS_AREA_W, windowWidth * 0.95)); // Re-clamp width bounds
                          CANVAS_AREA_X = max(minSideMargin, (width / 2 - CANVAS_AREA_W / 2)); // Recalculate X based on new W
                   } else {
                        CANVAS_AREA_H = idealH_forW; // Stick to width-based H
                         // CANVAS_AREA_W was already set as adjustedCanvasW
                          CANVAS_AREA_X = max(minSideMargin, (width / 2 - CANVAS_AREA_W / 2)); // Keep original X calc
                   }
              } // End refined CANVAS_AREA calculations

    let headerCenterY = HEADER_HEIGHT / 2; // Vertical center for header elements

    // Input Element Positioning & Sizing - Relative to updated CANVAS_AREA_X and width
    if (inputElement) {
        inputElement.position(CANVAS_AREA_X, headerCenterY - inputElement.height/2 - 2); // Vertically align
        // Use total width of canvas area + left margin as available input width? No, just match artboard width is cleaner.
        inputElement.size(CANVAS_AREA_W); // Keep input width aligned with artboard width
         // Add margin/padding calculation explicitly
         inputElement.style("padding", "5px 10px");
         inputElement.style("box-sizing", "border-box");
         // Recalculate height including padding: offset - (element height / 2) - slight correction
         // Let's just position using Y calculated, height determined by padding+font size via CSS
         inputElement.position(CANVAS_AREA_X, headerCenterY - inputElement.elt.offsetHeight / 2); // Position vertically in header area centered
    }


    // Helper function to get button outer width safely (including margin/padding/border by asking clientWidth)
     const btnOuterWidth = (btn) => { if (!btn || !btn.elt) return 0; return btn.elt.offsetWidth; };

    // Button positioning for the right-aligned group in header
    let buttonSpacing = 8; // Gap between buttons
    let rightMargin = 15; // Margin from right edge of the window

    // Get widths of all buttons - now use clientWidth/offsetWidth
    let savePNGBtnW = btnOuterWidth(savePNGButton);
    let saveHighResPNGBtnW = btnOuterWidth(saveHighResPNGButton);
    let savePDFBtnW = btnOuterWidth(savePDFButton);
    let clearBtnW = btnOuterWidth(clearButton);
    let refreshBtnW = btnOuterWidth(refreshButton);

    // Calculate total width required by buttons + spacing
     let allButtons = [refreshButton, clearButton, savePNGButton, saveHighResPNGButton, savePDFButton].filter(btn => btn !== null);
    let totalButtonWidths = allButtons.reduce((sum, btn) => sum + btnOuterWidth(btn), 0);
    let numButtons = allButtons.length;
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);

     // Calculate the starting X position for the block of buttons to be right-aligned
     let buttonBlockStartX = width - rightMargin - (totalButtonWidths + totalSpacing);

    // Add a constraint: ensure buttons don't overlap too much with the input element on a narrow screen
     // Use inputElement's *right edge* plus some buffer as the minimum start X for buttons
     let inputRightEdge = inputElement ? inputElement.position().x + inputElement.size().width : 0; // If no input, assumes start at 0
     let minButtonStartX = inputRightEdge + 30; // Minimum 30px buffer between input right edge and button start

     // Use the maximum of calculated position or the minimum allowed position
     buttonBlockStartX = max(buttonBlockStartX, minButtonStartX);

     // Vertical position for buttons (center vertically in the header)
     let buttonPadY_buttons = headerCenterY - (savePNGButton ? savePNGButton.elt.offsetHeight / 2 : HEADER_HEIGHT / 4); // Use height of a button to center


    let currentButtonX = buttonBlockStartX;

    // Position buttons in desired order (adjusting currentButtonX after each): REFRESH, CLEAR, SAVE PNG, SAVE HI-RES PNG, SAVE PDF
     // Check if button object exists before positioning
    if (refreshButton) { refreshButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += refreshBtnW + buttonSpacing; }
    if (clearButton) { clearButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += clearBtnW + buttonSpacing; }
    if (savePNGButton) { savePNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += savePNGBtnW + buttonSpacing; }
    if (saveHighResPNGButton) { saveHighResPNGButton.position(currentButtonX, buttonPadY_buttons); currentButtonX += saveHighResPNGBtnW + buttonSpacing; }
    if (savePDFButton) { savePDFButton.position(currentButtonX, buttonPadY_buttons); /* Last button */ }


     // --- Resize canvasPG buffer ---
     // The canvasPG buffer must match the *final calculated* CANVAS_AREA_W and CANVAS_AREA_H.
     // Check if its current size is different from the required size before resizing to avoid unnecessary operations.
    if (canvasPG && (canvasPG.width !== CANVAS_AREA_W || canvasPG.height !== CANVAS_AREA_H)) {
         console.log(`Resizing canvasPG buffer to new calculated size: ${CANVAS_AREA_W}x${CANVAS_AREA_H}`);
         // resizeCanvas method on graphics buffer clears the buffer. It will be redrawn by the next draw() cycle.
         if (CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
              canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H);
               canvasPG.background(255); // Ensure it has a background after resize
         } else {
              console.error("Attempted to resize canvasPG to invalid dimensions, disposing buffer.");
               if (canvasPG) canvasPG.remove(); canvasPG = null;
         }
     } else if (!canvasPG && CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
          // If buffer doesn't exist but dimensions are valid, create it. Should ideally happen in setup.
          console.log("Creating canvasPG buffer in windowResized as it was null.");
          canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
          canvasPG.background(255);
     } else {
         // console.log("canvasPG exists and size matches, or dimensions are invalid. No resize needed for canvasPG.");
          if ((!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) && (CANVAS_AREA_W <= 0 || CANVAS_AREA_H <= 0)) {
             console.warn("Both canvasPG buffer and target dimensions are invalid after resize. Rendering might be affected.");
             // Attempt to clean up if an invalid buffer exists
              if (canvasPG) { try { canvasPG.remove(); } catch(e) {} canvasPG = null; }
          }
     }


     // --- Ensure textMeasurePG is initialized or re-initialized defensively ---
     // This small buffer typically doesn't need resizing based on window size, just existence and context config.
     if (!textMeasurePG || typeof textMeasurePG.textWidth !== 'function') { // Check existence and basic functionality
          console.log("Recreating textMeasurePG buffer in windowResized as it was null or invalid.");
          if (textMeasurePG) { try { textMeasurePG.remove(); } catch(e) {} } // Attempt to clean up if something was there
          try {
               textMeasurePG = createGraphics(10, 10); // Small valid size
               // Re-apply essential text properties
                if (baseFont && typeof textMeasurePG.textFont === 'function') textMeasurePG.textFont(baseFont);
                if (typeof textMeasurePG.textAlign === 'function') textMeasurePG.textAlign(CENTER, CENTER);
          } catch(e) {
               console.error("Failed to recreate textMeasurePG in windowResized:", e);
               textMeasurePG = null; // Ensure it's explicitly null on failure
          }
     }

     console.log(`Finished windowResized. CANVAS_AREA: ${CANVAS_AREA_X}, ${CANVAS_AREA_Y}, ${CANVAS_AREA_W}, ${CANVAS_AREA_H}`);
}


// Add touch event handlers to mirror mouse behavior
// NOTE: Mouse events like mousePressed and touchStarted might fire for the *same interaction* depending on browser/device.
// You often need flags to prevent double processing, or handle one set only (e.g., only touch if isTouchDevice is true).
// For this v1 update, let's just add the basic touch mirroring for single touch. Multi-touch (like pinch zoom, two-finger rotate) is more complex.

let touchGrabbed = false; // Flag to distinguish touch drag from page scroll etc.

function touchStarted(event) {
    // Prevent default behaviors that interfere with touch interaction (e.g., zooming, scrolling)
     // event.preventDefault(); // This is strong and might break needed scrolling. Let's apply selectively.

    // Get the position of the first touch point
    let touchX = touches[0].x;
    let touchY = touches[0].y;

     // Similar logic to mousePressed, but use touch coords.
    // Ignore touch in header area, and prevent default to block scroll/zoom there
    if (touchY < HEADER_HEIGHT) {
         if (event.cancelable) event.preventDefault(); // Prevent page scrolling/zooming on buttons/input if browser allows
         return true; // Allow default behavior in header elements (button/input clicks are handled by DOM)
    }

    // Check if anything is currently grabbed (either by mouse or touch)
     if (grabbedItem) {
         // If touching the already grabbed item, allow it (will be handled by touchMoved).
          if (grabbedItem.isMouseOver(touchX, touchY)) { // Use isMouseOver check with touch coords
              touchGrabbed = true; // Indicate grab started by touch
               if (event.cancelable) event.preventDefault(); // Prevent interference while dragging existing item
             return false; // Interaction with grabbed item handled
          } else {
               // If a touch starts *not* on the grabbed item, assume it's intended for something else (e.g., page scroll)
               // But if mousePressed blocked other grabs, touch should too. Don't allow grabbing a *new* item if one is already held.
              return false; // Don't try to grab a new item if one is already grabbed
          }
     }


    // If nothing is grabbed, attempt to grab.
    // Check PLACED items first (within canvas area ONLY for grabbing).
     if (isMouseOverCanvasArea(touchX, touchY)) { // Pass touch coords to area check
         for (let i = placedItems.length - 1; i >= 0; i--) {
             if (placedItems[i].isMouseOver(touchX, touchY)) {
                  grabbedItem = placedItems[i];
                  grabbedItem.isGrabbed = true;
                  grabbedItem.isPlacing = false;
                  grabbedItem.solidify();
                  let temp = placedItems.splice(i, 1)[0]; shapes.push(temp); // Move to shapes

                 // Update input field state and focus for text items
                 if (grabbedItem.type === 'text') {
                     inputElement.value(grabbedItem.content || '');
                     inputElement.attribute('placeholder', '');
                      // Cannot directly focus HTML input reliably from touch event due to OS restrictions
                      // Maybe show a keyboard or instruction? For V1, rely on manual tap+grab+tap input.
                      // inputElement.elt.focus(); // Might not work on mobile touch
                  } else {
                      inputElement.value('');
                     inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                  }

                 touchGrabbed = true; // Mark as touch grabbed
                  if (event.cancelable) event.preventDefault(); // Prevent scrolling if we grabbed something
                 console.log("Touch grabbed a placed item.");
                 return false; // Found and grabbed
             }
         }
     }

    // If no placed item grabbed, try FLOATING shapes (anywhere below header).
    // This part runs regardless of isMouseOverCanvasArea(touchX, touchY) status
     for (let i = shapes.length - 1; i >= 0; i--) {
        if (!shapes[i].isGrabbed) {
          if (shapes[i].isMouseOver(touchX, touchY)) { // Use touch coords
            grabbedItem = shapes[i];
            grabbedItem.isGrabbed = true;
            grabbedItem.isPlacing = false;
            grabbedItem.solidify();
            let temp = shapes.splice(i, 1)[0]; shapes.push(temp); // Move to end of shapes

             // Update input field state for text items
             if (grabbedItem.type === 'text') {
                 inputElement.value(grabbedItem.content || '');
                 inputElement.attribute('placeholder', '');
              } else {
                  inputElement.value('');
                 inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
              }

            touchGrabbed = true; // Mark as touch grabbed
             if (event.cancelable) event.preventDefault(); // Prevent scrolling if we grabbed something
            console.log("Touch grabbed a floating shape.");
            return false; // Found and grabbed
          }
        }
      }

    // If nothing grabbable was touched, allow default behavior (likely page scroll)
     return true; // Allow default behavior
}

function touchMoved(event) {
    // Get touch position (only first touch for single-finger drag)
    let touchX = touches[0].x;
    let touchY = touches[0].y;

    // Prevent default page scroll ONLY if we have successfully started a touch drag session for an item
     if (grabbedItem && touchGrabbed) {
         // Prevent default behavior during drag (essential for stopping scroll)
          if (event.cancelable) event.preventDefault(); // preventDefault might cause issues on some devices if not cancelable

        // Smoothly update grabbed item position towards touch location
        grabbedItem.x = lerp(grabbedItem.x, touchX, 0.4);
        grabbedItem.y = lerp(grabbedItem.y, touchY, 0.4);

         // --- Add simple single-touch rotation (EXPERIMENTAL / requires gesture recognition) ---
         // This is hard with only touchMoved. Pinch for scale/rotate is typical but multi-touch.
         // Single touch rotation is unnatural without a dedicated UI control (like a rotate handle).
         // Skipping single touch rotation for V1 simplicity. Mouse wheel is the only rotate method for now.

         return false; // Indicate handled interaction
    }
     // Allow default page scroll if not actively dragging an item with touch
    return true;
}


function touchEnded(event) {
    // Prevent default behavior (less critical than touchStarted/touchMoved, but can prevent things like click emulation after touch drag)
     // event.preventDefault();

    // The core release logic is the same whether mouse or touch was used.
    // MouseReleased contains all the necessary logic for dropping the grabbedItem.
    // Call mouseReleased if we were in a touch-grabbed state.
     if (grabbedItem && touchGrabbed) {
         // Note: mouseX/mouseY might be needed by mouseReleased logic.
         // mouseReleased should ideally use grabbedItem's *final* position (set in touchMoved)
         // and check *that* position against canvas bounds, rather than relying on mouseX/mouseY.
         // The current mouseReleased already uses grabbedItem.x/y in the drop area check! Perfect.

         mouseReleased(); // Call the common logic for handling the drop

         // Reset touch-specific grab state
         touchGrabbed = false;

         if (event.cancelable) event.preventDefault(); // Prevent things like a 'click' event firing after the touch sequence
         return false; // Indicate interaction was handled

     }
     // Allow default behavior if no item was touch-grabbed (e.g., a simple tap, which might become a click)
    return true;
}

// Function to check if touch is within canvas area (utility for touch events)
// pX, pY are touch coordinates
function isMouseOverCanvasArea(pX = mouseX, pY = mouseY) {
    // Use coordinates passed, default to mouseX/Y if none provided
    return pX >= CANVAS_AREA_X && pX <= CANVAS_AREA_X + CANVAS_AREA_W &&
           pY >= CANVAS_AREA_Y && pY <= CANVAS_AREA_Y + CANVAS_AREA_H;
}
}