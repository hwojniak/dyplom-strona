// Interactive canvas website-tool project using p5.js

let shapes = []; // Shapes currently floating or grabbed
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged

// UI Element References (DOM elements need global vars if you create them this way)
let inputElement;
let saveButton;
let refreshButton; // Renamed from randomButton
let clearButton; // Renamed from restartButton
// Removed: let addTextButton; // No longer needed, adding text via Enter key

// Layout constants matching the reference image
const HEADER_HEIGHT = 80;
const CANVAS_AREA_W = 500; // Fixed width of the artboard
let CANVAS_AREA_H; // Calculated in setup based on ratio (fixed height of artboard)
let CANVAS_AREA_X; // Calculated in setup based on window width
let CANVAS_AREA_Y; // Calculated in setup (fixed distance below header)

// Appearance constants matching the reference image
const PALETTE = [ // Optionally include other colors like black or grey if shapes can be those
  '#0000FE', // Blue triangle
  '#FFDD00', // Yellow pentagon
  '#E70012', // Red hexagon
  '#FE4DD3', // Pink square
  '#41AD4A', // Green shape
  '#000000', // Black
  '#222222', // Dark Grey - used for some small shapes perhaps?
  '#FFFFFF',  // White - less likely for floating shapes, maybe for text color?
  '#FFA500', // Added Orange as requested
];

const TEXT_OPTIONS = [
  "TYPE SOMETHING...", // Placeholder/default
  "I LOVE MOM",
  "MUZYKA MNIE DOTYKA",
  "SOMETHING something 123",
  "Hi, I'm...", // Add multi-word options
  "TOOL",
  "ART PIECE",
  "WORK WORK WORK"
];

// Base font - defaulting to a monospaced system font for a blocky feel
let baseFont = 'monospace'; // Changed from Courier New as monospace is more common/likely system font

// Rotation snapping increment (e.g., 15 degrees converted to radians)
// Declared as let globally, Initialized in setup() using radians()
let SNAP_INCREMENT_RADIANS;

// Define size categories for shapes to control distribution
const sizeCategories = [
  { name: 'small', sizeRange: [50, 80], scaleRange: [0.8, 1.2], textScaleAdjust: 0.15 },
  { name: 'medium', sizeRange: [80, 150], scaleRange: [1.0, 1.8], textScaleAdjust: 0.2 },
  { name: 'large', sizeRange: [150, 250], scaleRange: [1.2, 2.5], textScaleAdjust: 0.25 } // Adjusted max base size
];

// Small tolerance for click detection near shape edges in screen pixels
const CLICK_TOLERANCE = 5; // Pixels


// --- Utility functions for precise mouse collision ---

// Transforms a point from global canvas coordinates to an object's local coordinates
// Assumes object's origin is at (objX, objY), rotated by objRotation, scaled by objScale
function transformPointToLocal(gx, gy, objX, objY, objRotation, objScale) {
  // Apply inverse transformations: untranslate, unrotate, unscale
  let tx = gx - objX;
  let ty = gy - objY;

  // Inverse rotation (rotate by -objRotation)
  let cosAngle = cos(-objRotation);
  let sinAngle = sin(-objRotation);

  let rx = tx * cosAngle - ty * sinAngle;
  let ry = tx * sinAngle + ty * cosAngle;

  // Inverse scaling (assuming uniform scale)
   // Protect against division by zero
  let localX = (objScale === 0) ? 0 : rx / objScale;
  let localY = (objScale === 0) ? 0 : ry / objScale;


  return { x: localX, y: localY };
}

// Checks if a point (px, py) is inside or near an axis-aligned rectangle centered at (0,0) with size (w, h)
// Includes tolerance for clicking near edges.
function isPointInAxisAlignedRect(px, py, w, h, tolerance = 0) {
    let halfW = w / 2;
    let halfH = h / 2;
    // Check if the point is within the bounds plus tolerance on all sides
    return px >= -halfW - tolerance && px <= halfW + tolerance && py >= -halfH - tolerance && py <= halfH + tolerance;
}

// Calculates the shortest distance from a point (px, py) to a line segment from (x1, y1) to (x2, y2).
// https://martin-thoma.com/distance-point-to-segment/ (Adapted for p5 vector logic if needed, but simple formula is fine)
// This function calculates the distance in the local, unscaled coordinate system.
function distToSegment(px, py, x1, y1, x2, y2) {
  // Distance squared from p1 to p2
  let l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  // If the segment has zero length (p1 equals p2), return distance to point
  if (l2 == 0) return dist(px, py, x1, y1);

  // Parameter 't' of the closest point on the *line* p1-p2 to point p
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;

  // Clamp 't' to the range [0, 1] to find the closest point on the *segment*
  t = max(0, min(1, t));

  // Closest point on the segment
  let closestX = x1 + t * (x2 - x1);
  let closestY = y1 + t * (y2 - y1);

  // Distance from (px, py) to the closest point on the segment
  return dist(px, py, closestX, closestY);
}


// Gets vertices for an unrotated Triangle centered at (0,0) with base size
function getTriangleVertices(size) {
    let heightBased = size * 0.8;
    let baseWidthBased = size * 0.8;
    let baseY = size * 0.4; // y position of the base vertices

    return [
        { x: 0, y: -heightBased },       // Top vertex (y < 0 because origin is center, triangle points up)
        { x: -baseWidthBased, y: baseY }, // Bottom-Left vertex (x < 0, y > 0)
        { x: baseWidthBased, y: baseY }    // Bottom-Right vertex (x > 0, y > 0)
    ];
}

// Gets vertices for an unrotated Square centered at (0,0) with side 'size'
function getSquareVertices(size) {
    let halfSize = size / 2; // Side/2
    return [
        { x: -halfSize, y: -halfSize }, // Top-Left
        { x: halfSize, y: -halfSize },  // Top-Right
        { x: halfSize, y: halfSize },   // Bottom-Right
        { x: -halfSize, y: halfSize }   // Bottom-Left
    ];
}

// Gets vertices for an unrotated Pentagon centered at (0,0) with base size determining radius
function getPentagonVertices(size) {
    let sides = 5;
    let radius = size * 0.7; // Matching drawShapePrimitive calculation
    let vertices = [];
    for (let i = 0; i < sides; i++) {
      let angle = TWO_PI / sides * i;
      let sx = cos(angle - HALF_PI) * radius; // Angle offset -HALF_PI matches draw
      let sy = sin(angle - HALF_PI) * radius; // Angle offset -HALF_PI matches draw
      vertices.push({ x: sx, y: sy });
    }
    return vertices;
}

// Gets vertices for an unrotated Hexagon centered at (0,0) with base size determining radius
function getHexagonVertices(size) {
     let sides = 6;
     let radius = size; // Matching drawShapePrimitive calculation (hexagon radius == size)
    let vertices = [];
     for (let i = 0; i < sides; i++) {
       let angle = TWO_PI / sides * i;
       let sx = cos(angle) * radius; // No angle offset matches draw
       let sy = sin(angle) * radius; // No angle offset matches draw
       vertices.push({ x: sx, y: sy });
     }
    return vertices;
}


// Checks if a point (px, py) is inside a convex polygon defined by its vertices
// Uses the "same side" algorithm - strict inside check.
function isPointInConvexPolygon(px, py, vertices) {
  let numVertices = vertices.length;
  if (numVertices < 3) return false;

  let has_pos = false;
  let has_neg = false;

  // Check that the point is on the same side of every edge (cross product check)
  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i];
    let v2 = vertices[(i + 1) % numVertices]; // Wrap around to the first vertex for the last edge

    // Calculate the z-component of the cross product of vector v1->v2 and vector v1->point
    // Sign tells us which side the point is on relative to the directed edge v1->v2
    let cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);

    // Note: tolerance could be applied here too by checking abs(cross_product) vs tolerance * edgeLength.
    // However, the distance-to-segment check in isPointNearPolygonEdge is more intuitive for tolerance.
    if (cross_product > 0.000001) has_pos = true; // Add tiny tolerance for float comparisons near 0
    if (cross_product < -0.000001) has_neg = true; // Add tiny tolerance for float comparisons near 0

    // If we ever find the point is on different sides for different edges, it's outside (for a convex polygon)
    if (has_pos && has_neg) return false;
  }

  // If we went through all edges and never found mixed signs, the point is inside or on the boundary.
  return true;
}


// Checks if a point (px, py) is within a certain tolerance of any edge of a polygon.
// Distances are checked in the local, unscaled coordinate system.
// tolerance: The distance threshold (should be CLICK_TOLERANCE / scaleFactor in theory).
function isPointNearPolygonEdge(px, py, vertices, tolerance) {
    if (vertices.length < 2) return false;

     for (let i = 0; i < vertices.length; i++) {
         let v1 = vertices[i];
         let v2 = vertices[(i + 1) % vertices.length]; // The next vertex, wrapping around

         // Calculate distance from the point (px, py) to the edge segment v1-v2
         let d = distToSegment(px, py, v1.x, v1.y, v2.x, v2.y);

         // If the distance is within the tolerance, the point is considered near an edge
         if (d <= tolerance) {
             return true;
         }
     }
     // If checked all edges and distance was always greater than tolerance
    return false;
}


// Calculates the bounding box for a text string centered at (0,0) in local space
// Returns {w, h} - width and height
// Assumes baseFont is loaded and ready.
function getTextBounds(content, effectiveTextSize, baseFontRef) {
     // Use a temporary graphics buffer to get accurate text dimensions
     let tempPG = createGraphics(1, 1);
     tempPG.textSize(effectiveTextSize);
     if (baseFontRef) tempPG.textFont(baseFontRef);

     let textW = tempPG.textWidth(content);
     // textAscent + textDescent gives total height from highest ascender to lowest descender
     let textH = tempPG.textAscent() + tempPG.textDescent();

     tempPG.remove(); // Clean up

    // Add a small vertical buffer around the text height to make it easier to click
     textH *= 1.2; // Increase vertical clickable area by 20%

    return {
         w: textW,
         h: textH
    };
}


// --- FloatingShape Class ---
class FloatingShape {
  constructor() {
    this.reset();
    this.isGrabbed = false;
    this.isPlacing = false; // State for landing animation
    this.landFrame = -1; // Frame when landing started
    this.tempScaleEffect = 1; // Scale multiplier for landing animation
  }

  // Reset shape properties for initial state (typically off-screen) or re-spawning
  reset() {
    let edge = floor(random(4)); // Choose a random screen edge (top, right, bottom, left)
    let posAlong = random(-0.5, 1.5); // Position along the chosen edge (allows spawning partly on-screen or further off)

    // Select a size category and pick size/scale within that category's range
    let categoryIndex = floor(random(sizeCategories.length));
    let category = sizeCategories[categoryIndex];
    this.size = random(category.sizeRange[0], category.sizeRange[1]); // Base size for drawing/geometry
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]); // Scale multiplier for display
    this.currentSize = this.size * this.scaleFactor; // Effective display size for basic checks (like off-screen)


    // Set initial position just off the chosen edge and velocity towards the center
    let minSpeed = 1.5;
    let maxSpeed = 4;
     let offScreenOffset = this.currentSize * 1.5; // How far off-screen to start

    switch (edge) {
      case 0: // Top edge
        this.x = width * posAlong;
        this.y = -offScreenOffset;
        this.speedX = random(-2, 2);
        this.speedY = random(minSpeed, maxSpeed); // Move downwards
        break;
      case 1: // Right edge
        this.x = width + offScreenOffset;
        this.y = height * posAlong;
        this.speedX = random(-maxSpeed, -minSpeed); // Move leftwards
        this.speedY = random(-2, 2);
        break;
      case 2: // Bottom edge
        this.x = width * posAlong;
        this.y = height + offScreenOffset;
        this.speedX = random(-2, 2);
        this.speedY = random(-maxSpeed, -minSpeed); // Move upwards
        break;
      case 3: // Left edge
        this.x = -offScreenOffset;
        this.y = height * posAlong;
        this.speedX = random(minSpeed, maxSpeed); // Move rightwards
        this.speedY = random(-2, 2);
        break;
    }

    this.rotation = random(TWO_PI); // Random initial rotation
    this.rotationSpeed = random(-0.005, 0.005) * random(1, 4); // Random slow rotation speed

    let pickedColor;
    do {
        // Pick a color from the palette, ensuring sufficient brightness
        pickedColor = color(random(PALETTE));
    } while (brightness(pickedColor) < 50);
    this.color = pickedColor;

    // Determine if it's a shape or text item (80% shape, 20% text)
    this.type = random() < 0.8 ? 'shape' : 'text';

    if (this.type === 'shape') {
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']);
        this.content = null; // Shapes don't have text content
        this.textScaleAdjust = 0; // Not applicable for shapes
    } else {
         this.shapeType = 'none'; // Text items aren't assigned a geometric shape type here
         this.content = random(TEXT_OPTIONS.slice(1)); // Pick random text content (exclude placeholder)
         this.textScaleAdjust = category.textScaleAdjust; // Text scaling ratio from category
    }

    // Reset interaction flags
    this.isGrabbed = false;
    this.isPlacing = false; // State for landing animation
    this.landFrame = -1;
    this.tempScaleEffect = 1; // Reset animation effect scale
  }

  // Update method to handle physics simulation for floating shapes
  update() {
     // Only update position and rotation based on speed if the shape is truly floating (not grabbed or landing)
     if (!this.isGrabbed && !this.isPlacing) {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
     }
     // The effective size is constantly updated if size or scale changes
     this.currentSize = this.size * this.scaleFactor;
  }

  // Check if the shape is significantly off-screen to warrant removal from the shapes array
  isReallyOffScreen() {
      // Estimate maximum effective dimension (including scale and aspect) for off-screen checking boundary
      let maxEffectiveDimension = 0;
       if (this.type === 'text' && this.content) {
           // Text bounding box dimensions scaled by the scaleFactor
            let effectiveTextSize = this.size * this.textScaleAdjust;
            let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont);
            maxEffectiveDimension = max(textBounds.w, textBounds.h) * this.scaleFactor; // Scale applies to visual bounds
       } else if (this.type === 'shape') {
           // Rough estimation of the longest dimension for different shapes, scaled
            switch(this.shapeType) {
                 case 'circle': maxEffectiveDimension = this.size * 2 * this.scaleFactor; break; // Diameter
                 case 'square': maxEffectiveDimension = this.size * Math.sqrt(2) * this.scaleFactor; break; // Diagonal
                 case 'triangle': maxEffectiveDimension = this.size * 1.6 * this.scaleFactor; break; // Approx longest dimension * scale
                 case 'pentagon': maxEffectiveDimension = this.size * 0.7 * 2 * this.scaleFactor; break; // Scaled diameter from radius calc
                 case 'hexagon': maxEffectiveDimension = this.size * 2 * this.scaleFactor; break; // Scaled diameter from radius calc
                 default: maxEffectiveDimension = this.size * 1.5 * this.scaleFactor; // Default fallback if shapeType unknown
            }
       } else {
           // Fallback if type is not 'text' or 'shape' or content is missing
            maxEffectiveDimension = (this.size || 50) * (this.scaleFactor || 1) * 2; // Ensure some value is calculated
       }

      // Calculate a sufficient padding around the canvas edges
      // An object is "really off-screen" if its center plus its effective radius plus a generous padding
      // is outside the canvas boundary.
      let effectiveRadius = maxEffectiveDimension / 2;
      let safePadding = max(width, height) * 0.3; // Generous padding to ensure it's completely gone
      let checkDistance = effectiveRadius + safePadding; // The distance its center must be from the closest edge

      // Check if the shape's center (this.x, this.y) is beyond the boundary plus checkDistance
      return this.x < -checkDistance || this.x > width + checkDistance ||
             this.y < -checkDistance || this.y > height + checkDistance;
  }

  // Updates the temporary scale effect for the landing animation
  updateLanding() {
    // Animation runs only if currently marked for placing AND is NOT grabbed
    if(this.isPlacing && !this.isGrabbed) {
        let elapsed = frameCount - this.landFrame; // Number of frames since landing started
        let duration = 30; // Duration of the animation in frames

        if (elapsed <= duration) {
            let t = map(elapsed, 0, duration, 0, 1); // Normalized animation progress [0, 1]
            // Use a sine function for a smooth "pop" effect: starts at 1, goes up (e.g., 1.05), then back to 1
            let pulseScale = 1 + sin(t * PI) * 0.05; // Sin wave over 0 to PI -> goes 0 to 1 and back to 0, scaled
            this.tempScaleEffect = pulseScale; // Apply calculated pulse scale
        } else {
            // Animation is finished
            this.isPlacing = false; // Turn off the landing state flag
            this.tempScaleEffect = 1; // Reset the scale effect multiplier to normal
        }
    } else if (!this.isPlacing) {
        // If the item is not in the placing state, ensure the temporary scale effect is reset to 1
         this.tempScaleEffect = 1;
    }
    // If isGrabbed is true, the logic within the first if condition won't run,
    // effectively pausing the landing animation (or preventing it from starting).
    // The display function also handles not applying the tempScaleEffect when grabbed.
  }

  // Displays the shape or text visually on the given graphics context.
  // graphics: The p5 graphics object to draw onto (either 'this' for main canvas or canvasPG).
  // isGrabbed: Boolean flag; if true, adds a special visual effect for the grabbed item (only relevant for main canvas).
  display(graphics, isGrabbed = false) {
    graphics.push(); // Save the current transformation state (translation, rotation, scale)

    // Apply the shape's spatial transformations: translate to position, rotate, then scale
    graphics.translate(this.x, this.y); // Move the drawing origin to the shape's center point
    graphics.rotate(this.rotation); // Apply the shape's rotation around its center

     // Calculate the current scale factor to apply for display.
     // Includes the base scaleFactor and the temporary landing animation effect *only* if the item is placing and NOT grabbed.
    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    graphics.scale(currentDisplayScale); // Apply the calculated scale


     // --- Draw the grabbed visual effect layer (outline/glow) if the item is currently grabbed ---
     // This effect should be drawn *before* the main filled shape/text for the outline to show correctly.
     if (isGrabbed) {
         graphics.drawingContext.shadowBlur = 40; // Set shadow blur amount for glow
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)'; // Set shadow color (white, slightly transparent)
         graphics.stroke(255, 255, 255, 200); // Set white stroke with transparency for the outline
         graphics.strokeWeight(3); // Set stroke thickness
         graphics.noFill(); // Important: Do not fill this layer, only stroke

          // Draw the primitive shape/text form for the outline effect. This will render the stroke and shadow.
          // Draws relative to the current transformed origin (0,0) using the base size.
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);

         graphics.drawingContext.shadowBlur = 0; // Reset shadow blur after drawing the effect
         graphics.noStroke(); // Ensure the next drawing step (the main fill) does not inherit the stroke setting
     }

    // --- Draw the main filled shape or text layer ---
    graphics.fill(this.color); // Set the fill color using the shape's assigned color
    graphics.noStroke(); // Ensure no stroke is applied to the main filled element

     // Draw the basic shape or text primitive.
     // It draws relative to the current (scaled, rotated) origin (0,0), using the shape's base size and text scale adjustment.
    this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);

    graphics.pop(); // Restore the previous graphics state (undo translations, rotations, scaling, styles)
  }


  // Draws the raw geometric primitive (circle, square, polygon) or text.
  // This function defines the *base* un-transformed shape using a base size.
  // It assumes the graphics context has already been set up with appropriate transformations
  // (translate to shape center, rotate, scale). It draws centered at the current (px, py) which is typically (0,0)
  // after translations in display() or displayOnCanvasPG().
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        if (isText) {
             graphics.textFont(baseFont); // Set font
             graphics.textAlign(CENTER, CENTER); // Set alignment for positioning
             // Calculate the effective font size by scaling the base psize by the textScaleAdjust ratio
             let effectiveTextSize = psize * textScaleAdjust;
             graphics.textSize(effectiveTextSize); // Set font size
             graphics.text(this.content, px, py); // Draw the text content centered at (px, py)
         } else {
              // Draw geometric shapes. Ensure rectMode is CENTER for shapes drawn from center.
              graphics.rectMode(CENTER); // Set rectangle drawing mode (affects square)
             switch (pshapeType) {
               case 'circle':
                 graphics.ellipse(px, py, psize * 2); // Draw ellipse. psize is interpreted as radius, so diameter is psize * 2.
                 break;
               case 'square':
                 graphics.rect(px, py, psize, psize); // Draw square. psize is width/height.
                 break;
               case 'triangle':
                 graphics.beginShape(); // Start defining vertices of the triangle
                 // Vertices defined relative to (px, py), scaled by the base psize.
                 graphics.vertex(px + 0, py - psize * 0.8); // Top vertex (relative)
                 graphics.vertex(px - psize * 0.8, py + psize * 0.4); // Bottom-left vertex (relative)
                 graphics.vertex(px + psize * 0.8, py + psize * 0.4); // Bottom-right vertex (relative)
                 graphics.endShape(CLOSE); // Connect last vertex back to first and finalize shape
                 break;
               case 'pentagon':
                  graphics.beginShape(); // Start defining vertices of the pentagon
                  let sidesP = 5;
                  let radiusP = psize * 0.7; // Radius used for vertex calculation, based on psize.
                  for (let i = 0; i < sidesP; i++) {
                    let angle = TWO_PI / sidesP * i;
                    // Calculate vertex coordinates relative to (px,py), adjusted by -HALF_PI angle offset to match visual orientation.
                    let sx = cos(angle - HALF_PI) * radiusP;
                    let sy = sin(angle - HALF_PI) * radiusP;
                    graphics.vertex(px + sx, py + sy); // Add vertex
                  }
                  graphics.endShape(CLOSE); // Close and finalize shape
                 break;
               case 'hexagon':
                 graphics.beginShape(); // Start defining vertices of the hexagon
                  let sidesH = 6;
                  let radiusH = psize; // Radius calculation matches getHexagonVertices.
                  for (let i = 0; i < sidesH; i++) {
                     let angle = TWO_PI / sidesH * i;
                    // Calculate vertex coordinates relative to (px,py), no angle offset needed to match visual orientation.
                    let sx = cos(angle) * radiusH;
                    let sy = sin(angle) * radiusH;
                    graphics.vertex(px + sx, py + sy); // Add vertex
                  }
                 graphics.endShape(CLOSE); // Close and finalize shape
                 break;
               default:
                  // Fallback drawing logic for any unexpected or undefined shapeType
                   console.warn("Drawing unknown shape type:", pshapeType);
                   graphics.rect(px, py, psize * 0.8, psize * 0.8); // Draw a simple small square as a fallback
                  break;
             }
         }
   }


   // Displays the shape or text specifically onto the off-screen graphics buffer (canvasPG).
   // This is used for drawing items that are placed and solidified on the white canvas area.
   // The position (this.x, this.y) is relative to the *main* canvas, so we need to offset
   // it by the canvas area's top-left corner (canvasOffsetX, canvasOffsetY) to draw it
   // correctly onto the canvasPG buffer, whose origin is the top-left of the white area.
   // Grabbed effect is NOT drawn here, as that is handled on the main canvas.
   displayOnCanvasPG(pg, canvasOffsetX, canvasOffsetY) {
      pg.push(); // Save the graphics state of the canvasPG buffer

      // Calculate the position relative to the canvasPG's top-left origin (0,0)
      let displayX = this.x - canvasOffsetX;
      let displayY = this.y - canvasOffsetY;
      pg.translate(displayX, displayY); // Translate the PG context

      pg.rotate(this.rotation); // Apply the shape's rotation to the PG context
       // Apply scale factor, including temporary landing scale if active AND not grabbed.
      let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
      pg.scale(currentDisplayScale); // Apply the scale to the PG context


      // Draw the basic shape/text primitive onto the canvasPG buffer.
      // It draws centered at (0,0) in the current (scaled, rotated, translated) context.
      pg.fill(this.color); // Use the shape's color for fill
      pg.noStroke(); // Ensure no stroke is applied
      this.drawShapePrimitive(pg, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust); // Draw using base size

      pg.pop(); // Restore the previous graphics state of the canvasPG buffer
   }

    // Checks if the mouse point (mx, my in global canvas coordinates) is over this shape.
    // This function performs geometric collision detection after transforming mouse coords.
    // It includes a click tolerance near edges for polygons, squares, and circles.
  isMouseOver(mx, my) {
       // Initial validation check for numeric stability
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) || isNaN(this.scaleFactor)) {
            console.error("NaN detected in isMouseOver coordinates/properties:", this, " Mouse:", mx, my);
            return false;
       }
        // Shapes with zero or negative scale factor are not considered clickable.
        if (this.scaleFactor <= 0 || this.size <= 0) return false;


       // 1. Transform the global mouse coordinates (mx, my) into the shape's local coordinate system.
       //    The local system is centered at (this.x, this.y), is rotated by this.rotation,
       //    and is scaled by this.scaleFactor relative to the base 'this.size' dimensions.
       let localMouse = transformPointToLocal(
           mx, my,
           this.x, this.y,
           this.rotation,
           this.scaleFactor
       );
       let localMx = localMouse.x; // Mouse X coordinate in shape's local space
       let localMy = localMouse.y; // Mouse Y coordinate in shape's local space

        // Calculate the click tolerance value adjusted for the shape's current display scale.
        // This makes the clickable "halo" near edges approximately constant in screen pixels.
        let localTolerance = CLICK_TOLERANCE / this.scaleFactor;
         // Prevent localTolerance from becoming excessively large if scaleFactor is very small, set a minimum.
         localTolerance = max(localTolerance, 2); // Ensure at least 2 local units of tolerance


       // 2. Perform the collision detection based on the shape's type and base dimensions, using the local mouse coordinates and local tolerance.

       if (this.type === 'text') {
           // For text, check if the local mouse point is inside or near the text's axis-aligned bounding box (in local space).
           // The text bounding box is calculated based on the base size and textScaleAdjust.
           let effectiveTextSize = this.size * this.textScaleAdjust; // Base text size for bounds calc
            let textBounds = getTextBounds(this.content, effectiveTextSize, baseFont); // Get local {w, h}
           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance); // Check against the bounding box + tolerance

       } else { // type is 'shape'
           switch (this.shapeType) {
              case 'circle':
                  // For a circle centered at (0,0) with radius 'this.size' in local space:
                  // Check if the local mouse point is within the circle's radius plus the local tolerance.
                  return dist(localMx, localMy, 0, 0) <= this.size + localTolerance; // Use <= to include the boundary

              case 'square':
                   // For a square centered at (0,0) with side length 'this.size' in local space:
                   // Check against its axis-aligned bounding box including tolerance.
                   return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance);


              case 'triangle':
                   // For polygonal shapes (Triangle, Pentagon, Hexagon):
                   // Check if the point is strictly *inside* the polygon OR *near an edge* within the calculated local tolerance.
                  let triVertices = getTriangleVertices(this.size); // Get local vertices for the base shape
                  // First check if the point is inside the polygon (more likely for clicks towards the center)
                  if (isPointInConvexPolygon(localMx, localMy, triVertices)) return true;
                  // If not inside, check if it's near any of the polygon's edges within the tolerance
                  return isPointNearPolygonEdge(localMx, localMy, triVertices, localTolerance);


              case 'pentagon':
                  // Same check as triangle: inside OR near edge with tolerance
                  let pentVertices = getPentagonVertices(this.size);
                  if (isPointInConvexPolygon(localMx, localMy, pentVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, pentVertices, localTolerance);


              case 'hexagon':
                   // Same check as triangle and pentagon: inside OR near edge with tolerance
                  let hexVertices = getHexagonVertices(this.size);
                  if (isPointInConvexPolygon(localMx, localMy, hexVertices)) return true;
                  return isPointNearPolygonEdge(localMx, localMy, hexVertices, localTolerance);


              default:
                   // Fallback collision check for any unknown or unhandled shape type.
                   console.warn("isMouseOver: Fallback check for unknown shape type:", this.shapeType);
                   // Default to checking against a small circle centered at 0,0 with tolerance
                   return dist(localMx, localMy, 0, 0) <= (this.size * 0.5) + localTolerance; // Use half size as a rough estimate radius
           }
       }
        // Should not be reached, but added as a safeguard
        return false;
    }


  solidify() {
    this.speedX = 0;
    this.speedY = 0;
    this.rotationSpeed = 0;
  }
}
// --- End FloatingShape Class ---


function preload() {
  // Place font loading logic here if using a file.
  // The default 'monospace' does not require loading a file.
  // Example commented out:
  // try {
  //   baseFont = loadFont('assets/YourPixelFont.ttf');
  //   console.log("Custom font loaded successfully.");
  // } catch (e) {
     console.warn("Custom font loading skipped or failed, using default system font:", baseFont);
  // }
}

function setup() {
  // Create the main canvas, making it fill the browser window initially
  createCanvas(windowWidth, windowHeight);

  // --- Initialize P5.js dependent variables after canvas is created ---
  // radians() and degrees() become available.
  SNAP_INCREMENT_RADIANS = radians(15); // Convert 15 degrees to radians for snapping
  // --------------------------------------------------------------------

  // Calculate the dimensions and position of the central fixed-size white canvas area.
  // CANVAS_AREA_W is a constant. CANVAS_AREA_H is derived from it.
  CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // Maintain a fixed 4:5 aspect ratio
  // Calculate X position to center the canvas area horizontally within the window
  CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
  // Calculate Y position to place it below the header with a margin
  CANVAS_AREA_Y = HEADER_HEIGHT + 20; // Fixed margin below the header

  // Ensure initial calculated positions/sizes are valid
   if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0; // Prevent negative X
   // Vertical positioning calculation seems safe as header has fixed height.


  // --- Setup UI elements (DOM elements) ---
  // Determine the vertical center of the header area to align UI elements
  let headerCenterY = HEADER_HEIGHT / 2; // Y-coordinate reference line

  // Create the input element for adding text
  inputElement = createInput();
  inputElement.value(''); // Start with an empty value, rely on placeholder for visual cue
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Set the placeholder attribute


  // Position and size the input element. It is horizontally centered with and matches the width of the canvas area.
  // Vertical positioning is within the header area.
  // The vertical alignment calculation `headerCenterY - 15` positions the *top* edge of the input 15px above the header center.
  // This often looks okay depending on default input height, adjust '15' as needed to visually center vertically.
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
  inputElement.size(CANVAS_AREA_W);

  // Apply CSS styling to the input element to match design appearance
  inputElement.style("padding", "5px 10px"); // Vertical and horizontal padding inside the input box
  inputElement.style("border", "1px solid #ccc"); // Subtle light grey border
  inputElement.style("border-radius", "15px"); // Rounded corners for the border
  inputElement.style("outline", "none"); // Remove the default browser focus outline (often a blue or black border)
  inputElement.style("background-color", color(255, 255, 255, 200)); // Semi-transparent white background
  inputElement.style("font-size", "14px"); // Font size for text input
  inputElement.style("color", color(50)); // Dark grey color for input text


  // Add event listener directly to the underlying DOM input element ('elt').
  // This is a more reliable way to capture specific key events like 'Enter'.
  inputElement.elt.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') { // Check if the pressed key is the Enter key
      addNewTextShapeFromInput(); // Call the function to process and add the input text as a shape
      event.preventDefault(); // Prevent the default browser action associated with keypress, e.g., form submission or adding a newline character in some contexts
    }
  });


  // --- Create the right-aligned button UI elements in the header ---
  // Button positioning will be dynamically calculated and set in the windowResized function
  // based on their actual width, but we need to create them and apply styles here first.
  let buttonSpacing = 10; // Standard spacing between buttons horizontally
  let buttonHeight = 30; // Approximate visual height of the buttons (used for vertical alignment calculation)
  let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2; // Y-coordinate offset to vertically center buttons in header


  // Create the SAVE button and apply styles/event handler
  saveButton = createButton("SAVE");
   saveButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   saveButton.mousePressed(saveCanvasArea); // Bind click event to the save function

  // Create the CLEAR button and apply styles/event handler
  clearButton = createButton("CLEAR");
   clearButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   clearButton.mousePressed(restartAll); // Bind click event to the restart (clear) function

  // Create the REFRESH button and apply styles/event handler
  refreshButton = createButton("REFRESH");
   refreshButton.style("padding", "5px 10px").style("border", "1px solid #888").style("border-radius", "15px").style("background-color", color(200)).style("color", color(50));
   refreshButton.mousePressed(resetRandom); // Bind click event to the reset random shapes function


   // Call windowResized once immediately after setting up DOM elements.
   // This ensures they are correctly positioned based on their actual sizes (determined by styling and content)
   // and the initial window size before the first draw frame. It also handles the initial PG buffer setup if needed.
   windowResized();


  // --- Initialize the scene elements ---
  // Create the initial set of floating shapes that drift around the canvas
  for (let i = 0; i < 30; i++) {
    shapes.push(new FloatingShape()); // Each new shape is created off-screen by its constructor
  }

   // Create the off-screen p5 graphics buffer specifically for drawing the contents of the central white canvas area.
  // This buffer has a fixed size corresponding to CANVAS_AREA_W and CANVAS_AREA_H.
  // Drawing to this buffer first allows us to clip the content neatly within the canvas bounds.
  canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
}

// Custom graphics buffer for the central white canvas area. Declared globally, initialized in setup().
let canvasPG;


// The main drawing loop, executed repeatedly (typically 60 times per second)
function draw() {
  // Draw the main canvas background. This clears the previous frame.
  background(0); // Solid black background

  // --- Update and draw floating shapes ---
  // Filter the shapes array: remove shapes that are "really off-screen" and not currently grabbed or landing.
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing);
  // Add new shapes to the scene if the number of active floating shapes falls below a minimum threshold.
  while (shapes.length < 20) {
      shapes.push(new FloatingShape()); // Add new shapes, constructor puts them off-screen
  }
  // Loop through each shape currently in the `shapes` array (includes floating, newly added text, and the grabbed item if it's floating/was floating).
  for (let shape of shapes) {
     // Update physics for floating shapes (position/rotation changes based on speed) only if not grabbed or landing.
     if (!shape.isGrabbed && !shape.isPlacing) {
       shape.update();
     }
     // Update the landing animation state (this check handles if animation should run or stop)
     shape.updateLanding();
     // Draw the shape onto the main canvas context. grabbedItem will be drawn again later on top.
     shape.display(this);
  }

  // --- Render the Central White Canvas Area Content ---
  // This content is drawn onto the canvasPG buffer first, then the buffer is drawn onto the main canvas.
  canvasPG.clear(); // Clear the previous frame's content from the graphics buffer
  canvasPG.background(255); // Draw a white background on the buffer (making it the "white canvas")

  // Draw items that have been placed onto the central white canvas area.
  // Filter placed items is NOT needed here, they are managed on drop/delete/re-grab.
  // Iterate FORWARDS (0 to length-1). This ensures items added LAST (at the end of the array)
  // are drawn LAST onto the buffer, making them appear visually ON TOP.
  for (let i = 0; i < placedItems.length; i++) { // <-- CORRECTED: Draw placed items FORWARDS
      let item = placedItems[i];
       // Update the landing animation state for placed items
       item.updateLanding(); // Check inside updateLanding handles if it runs or stops
       // Draw the item onto the canvasPG buffer, positioned relative to the buffer's origin.
      item.displayOnCanvasPG(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
  }

  // Draw the populated graphics buffer (canvasPG) as an image onto the main canvas.
  // Position the image at the calculated CANVAS_AREA_X, CANVAS_AREA_Y on the main canvas.
  image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);

  // Draw a border visually around the central white canvas area on the main canvas.
  // Draw this *after* the image so the border is visible on top.
  stroke(200); // Grey border color
  noFill(); // Do not fill the border rectangle
  rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H); // Draw the border rectangle


  // --- Draw the grabbed item layer on top of everything else on the main canvas ---
  if (grabbedItem) {
     // Smoothly move the grabbed item's position towards the current mouse position.
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.3); // Interpolate X position
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.3); // Interpolate Y position

     // Explicitly stop any landing animation or physics update for the grabbed item while dragging.
      if (grabbedItem.isPlacing) grabbedItem.isPlacing = false; // Turn off landing animation state
     grabbedItem.solidify(); // Ensure physics properties remain zeroed (speed/rotationSpeed)

      // Draw the grabbed item on the main canvas context.
      // Passing `true` for `isGrabbed` triggers the special grabbed visual effect (outline/glow).
     grabbedItem.display(this, true);
  }


  // --- DRAW HEADER / UI OVERLAY LAST ---
  // This section ensures that the header elements and background are drawn on top of everything else rendered on the main canvas.

  // Draw the header background rectangle.
  fill(220); // Light grey color
  noStroke(); // Do not draw an outline for the rectangle
  rect(0, 0, width, HEADER_HEIGHT); // Draw a rectangle covering the top part of the window

  // Draw the placeholder logo text on the left side of the header.
  fill(50); // Dark grey color for the text
  textSize(20); // Set font size
  textAlign(LEFT, CENTER); // Align text to the left, and vertically centered at the specified Y coordinate
  textFont(baseFont); // Apply the selected font
  // Position the text relative to the top-left of the canvas (0,0), within the header area.
  text("PLACEHOLDER\nLOGO", 20, HEADER_HEIGHT / 2); // Draw multi-line text


  // --- Removed Drawing of the PL label and circles from previous iterations. ---
  // This was located here previously but has been removed based on requirements.


  // --- END HEADER DRAWING ---
}

// Mouse press event handler. Called automatically when the mouse button is pressed.
function mousePressed() {
  // Prevent grabbing if the click starts within the header area. Clicks on actual DOM buttons are handled by the browser/p5 library.
  if (mouseY < HEADER_HEIGHT) {
    return; // If the mouse is inside the header region, stop here.
  }

  // --- Attempt to grab a PLACED item first ---
  // This check iterates backwards through the placedItems array.
  // This is the CORRECT order for selecting the item that is visually ON TOP,
  // because the drawing loop now iterates forwards (0 to length-1), making items at the end the topmost.
   for (let i = placedItems.length - 1; i >= 0; i--) { // <-- Loop backwards (end to beginning) for selecting TOPMOST placed item
       // Check if the mouse click coordinates are within the boundaries of the current placed item's shape.
       if (placedItems[i].isMouseOver(mouseX, mouseY)) {
           grabbedItem = placedItems[i]; // This item is under the mouse, select it.
           grabbedItem.isGrabbed = true; // Mark its state as grabbed (visuals change)
           grabbedItem.isPlacing = false; // Stop any landing animation if it was currently happening
           grabbedItem.solidify(); // Ensure the item stops moving/rotating while held

           // Move the selected item from the placedItems array to the shapes array.
           // This is done so that during dragging, this item is managed (updates position, is drawn with grabbed effect)
           // as part of the shapes list, which gets drawn before the placedItems area.
           // When drawn later on the main canvas with display(this, true), it appears on top of everything.
           let temp = placedItems.splice(i, 1)[0]; // Remove the item at index i from placedItems, returns the removed item
           shapes.push(temp); // Add the item to the end of the shapes array

           // Update the input field based on the type of item grabbed (text or shape).
           if (grabbedItem.type === 'text') {
               inputElement.value(grabbedItem.content); // Load the grabbed text item's content into the input field
               inputElement.attribute('placeholder', ''); // Clear the placeholder while editing content
           } else {
                // If a shape (non-text) is grabbed, clear the input field content and reset the placeholder.
                inputElement.value('');
                inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
           }
           inputElement.elt.focus(); // Set the input field as the active element (focus it).

           return; // Exit the function immediately after grabbing the first item found (which is the topmost)
       }
   }

  // --- If no PLACED item was grabbed, attempt to grab a FLOATING shape ---
  // This loop also iterates backwards through the `shapes` array. This aligns with how
  // shapes are added (newer added to end with push, drawn later). Checking backwards picks
  // the shape added most recently that the mouse is over (topmost floating).
  for (let i = shapes.length - 1; i >= 0; i--) { // <-- Loop backwards (end to beginning) for selecting TOPMOST floating shape
    // Check if the shape is not currently marked as grabbed by another process (safeguard, although grabbedItem check helps)
    if (!shapes[i].isGrabbed) { // Allow grabbing even if isPlacing is true for a brief moment after 'Add Text'
      // Check if the mouse cursor is over the current floating shape's geometric form.
      if (shapes[i].isMouseOver(mouseX, mouseY)) {
        grabbedItem = shapes[i]; // Select this floating shape
        grabbedItem.isGrabbed = true; // Mark its state as grabbed
        grabbedItem.isPlacing = false; // Turn off landing animation state if active on a floating shape
         grabbedItem.solidify(); // Stop its floating physics

        // Move the grabbed item to the very end of the shapes array.
        // This ensures it remains in the shapes list but is drawn last in the floating layer, effectively on top.
        let temp = shapes.splice(i, 1)[0]; // Remove the item from its current position in shapes
        shapes.push(temp); // Add it back to the end of shapes

         // Update the input field if the grabbed item is text.
         if (grabbedItem.type === 'text') {
             inputElement.value(grabbedItem.content); // Load text content
             inputElement.attribute('placeholder', ''); // Clear placeholder
         } else {
             // Clear input and reset placeholder for non-text shapes
              inputElement.value('');
             inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
         }
          inputElement.elt.focus(); // Focus input

        break; // Exit the loop after grabbing the first floating item found (topmost floating)
      }
    }
  }
  // If loops complete without returning, no item was found under the mouse. grabbedItem remains null.
}

// Mouse release event handler. Called automatically when the mouse button is released.
function mouseReleased() {
  // Only perform actions if an item was previously grabbed.
  if (grabbedItem) {
    grabbedItem.isGrabbed = false; // Unmark the item's grabbed state visuals

    // Check if the grabbed item was released over the central white canvas area.
    if (isMouseOverCanvasArea()) {
      // Item was placed onto the canvas area.
      grabbedItem.solidify(); // Ensure physics remain stopped

      // If the item is text, update its content from the input field before finalizing placement.
      if (grabbedItem.type === 'text') {
           let content = inputElement.value().trim(); // Get content from input, trim whitespace
            // Update the grabbed item's text content. If the input is empty or only the placeholder text, set content to empty string.
            grabbedItem.content = content === "" || content === TEXT_OPTIONS[0] ? "" : content;
      }

      // Apply Rotation Snapping to the grabbed item's rotation value if increment is set.
      if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      }

      // --- Move the item from the `shapes` array to the `placedItems` array ---
      // The item is currently in the `shapes` array (it was moved there in mousePressed).
      // Now that it's successfully placed on the canvas, it belongs in `placedItems`.
      // Remove it from shapes and add it to the end of placedItems (which places it on top visually and for picking).
       shapes = shapes.filter(s => s !== grabbedItem); // Filter the item OUT of the shapes array
      placedItems.push(grabbedItem); // Add the item to the END of the placedItems array

      // Start the landing animation sequence for the newly placed item.
      grabbedItem.isPlacing = true; // Set placing flag
      grabbedItem.landFrame = frameCount; // Record the frame number when placing started

    } else {
        // Item was dropped outside the canvas area. It should revert back to a floating shape state.
        // The item is currently in the `shapes` array. Its position update (following mouse) just stopped.
        // Update text content if it was a text item, based on the input field's final value.
         if (grabbedItem.type === 'text') {
             let content = inputElement.value().trim();
             grabbedItem.content = content === "" || content === TEXT_OPTIONS[0] ? "" : content;
         }
         // Re-enable its floating physics simulation.
          grabbedItem.speedX = random(-2, 2); // Assign random horizontal speed
          grabbedItem.speedY = random(-2, 2); // Assign random vertical speed
          grabbedItem.rotationSpeed = random(-0.005, 0.005) * random(1, 4); // Assign random rotation speed
          grabbedItem.isPlacing = false; // Ensure landing animation state is off

          // No need to change arrays; it remained in the `shapes` array, and its properties are now set for floating again.
    }

    grabbedItem = null; // Clear the reference to the grabbed item (deselect)

    // Reset the input field content and placeholder after any item is released.
    inputElement.value(''); // Clear input value
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset the placeholder text
  }
}

// Mouse wheel event handler.
// Allows rotating the currently grabbed item using the mouse wheel.
function mouseWheel(event) {
   // Check if an item is currently grabbed before allowing rotation
   if (grabbedItem) {
       // Adjust the rotation amount based on the mouse wheel delta. Sensitivity can be tuned with the multiplier (0.002).
       grabbedItem.rotation += event.delta * 0.002;
        // Snapping occurs on mouse release when placing, not during continuous wheeling.

        // Return false to prevent the default browser action (which is usually page scrolling when the mouse is over the canvas)
        return false;
   }
    // If no item is grabbed, allow the default browser mouse wheel behavior (page scroll).
    return true;
}

// Key press event handler.
// Used here to implement delete (Backspace/Delete) and scale (+/-) functionality for the grabbed item.
function keyPressed() {
    // Check if an item is grabbed AND if the pressed key is either Delete or Backspace
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        // Remove the grabbed item from both possible arrays it could be in (it will only be in one, but checking both is safe).
        shapes = shapes.filter(s => s !== grabbedItem); // Remove from floating/dragging list
        placedItems = placedItems.filter(s => s !== grabbedItem); // Remove from placed list
        grabbedItem = null; // Deselect the item by clearing the reference

         // Clear the input field and reset the placeholder, as the edited item is gone.
         inputElement.value('');
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]);

        // Return false to prevent the default browser actions associated with Delete and Backspace (like navigating back or deleting text in focused input if not handled by input listener).
        return false;
    }

    // Check if an item is grabbed for scaling using '+'/'=' and '-' keys.
    if (grabbedItem) {
      // Check the specific 'key' property for '+' and '-' characters for reliability.
      if (key === '+' || key === '=') { // Check for the '+' key (Shift and '=' produce '+')
          grabbedItem.scaleFactor *= 1.1; // Increase the scale factor by 10%
          grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, 10.0); // Limit the maximum scale factor (e.g., to 10 times the base size)
      }
      if (key === '-') { // Check for the '-' key
          grabbedItem.scaleFactor *= 0.9; // Decrease the scale factor by 10%
           grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, 0.1); // Limit the minimum scale factor (e.g., to 0.1 times the base size)
      }
       // Update the `currentSize` property after modifying scaleFactor, as it's used for off-screen checks.
      grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor;

      // Return false to prevent the default browser actions for '+' and '-' (which is typically zooming the page).
        return false;
    }

     // For any other key press not handled above, allow the default browser behavior.
     // This is important so the user can type into the input field or use other browser shortcuts.
     return true;
}


// Function to create a new text shape using the content currently in the input field.
// This is triggered by pressing the Enter key when the input field has focus (via the event listener).
function addNewTextShapeFromInput() {
   let currentText = inputElement.value(); // Get the current text content from the input field.

    // Before creating a shape, check if the input content is meaningful.
    // Don't create a shape if it's empty, contains only whitespace, or is still just the initial placeholder text.
     if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0]) {
         console.log("Input content is empty or just the placeholder; skipping creation of text shape.");
          // Keep focus on the input field so the user can type something valid.
         inputElement.elt.focus();
         return; // Stop the function execution.
    }

    // Create a new instance of FloatingShape. By default, its constructor sets up random properties and positions it off-screen.
    let newTextShape = new FloatingShape();

    // Customize the newly created shape to make it a text item with the user's content.
    newTextShape.type = 'text'; // Set the type to 'text'
    newTextShape.content = currentText.trim(); // Set the shape's content to the trimmed text from the input field.
    newTextShape.shapeType = 'none'; // Text items don't correspond to a predefined geometric shape type in this system.
    // The color is assigned randomly in the FloatingShape constructor (with a brightness check), which is suitable.

    // Re-assign size and text scaling properties to give new text shapes a consistent look,
    // based on the 'medium' size category definitions, overriding the default random values from reset().
    let mediumCategory = sizeCategories.find(cat => cat.name === 'medium'); // Find the medium size category definition
     if (mediumCategory) { // If the 'medium' category exists
         // Set the base size for the text shape within a slightly expanded 'medium' range.
         newTextShape.size = random(mediumCategory.sizeRange[0] * 0.8, mediumCategory.sizeRange[1] * 1.2);
         newTextShape.scaleFactor = 1.0; // Start with a scale factor of 1.0 (base size * 1.0 = effective size).
         newTextShape.textScaleAdjust = mediumCategory.textScaleAdjust; // Apply the text scaling adjustment ratio from the category.
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor; // Calculate the effective display size.
     } else { // Fallback to hardcoded default values if the 'medium' category isn't found (unlikely with current code).
        newTextShape.size = 150;
        newTextShape.scaleFactor = 1.0;
         newTextShape.textScaleAdjust = 0.2;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     }

    // Set an initial position and velocity for the new text shape so it enters the scene predictably.
    // Override the purely random off-screen spawn location from the default reset().
     newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W * 0.25, CANVAS_AREA_X + CANVAS_AREA_W * 0.75); // Spawn horizontally above the canvas area
     newTextShape.y = HEADER_HEIGHT + 40; // Spawn vertically just below the header bar
     newTextShape.speedX = random(-0.5, 0.5); // Assign a small random horizontal speed (gentle drift)
     newTextShape.speedY = random(1, 2); // Assign a gentle downward vertical speed

    newTextShape.rotation = random(-0.1, 0.1); // Start with a very small initial rotation
    newTextShape.rotationSpeed = random(-0.001, 0.001); // Give it a very slow initial rotation speed

    // Add the configured new text shape to the main `shapes` array. This makes it part of the floating/active shapes pool.
    shapes.push(newTextShape);

    // Reset the input field and its placeholder after the text content has been used to create a shape.
    inputElement.value(''); // Clear the actual text value
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore the placeholder text
    inputElement.elt.focus(); // Keep focus on the input field, allowing quick subsequent text entries.
}


// Utility function to check if the global mouse cursor position (mouseX, mouseY)
// is currently located within the bounds of the central white canvas area.
function isMouseOverCanvasArea() {
  // Check if mouseX is between the left and right edges of the canvas area AND if mouseY is between the top and bottom edges.
  return mouseX > CANVAS_AREA_X && mouseX < CANVAS_AREA_X + CANVAS_AREA_W &&
         mouseY > CANVAS_AREA_Y && mouseY < CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Helper function to adjust a given angle (in radians) to the nearest discrete step
// defined by the `incrementRadians` (also in radians).
function snapAngle(angleRadians, incrementRadians) {
    // If increment is non-positive, snapping is not possible or meaningful. Return the original angle.
    if (incrementRadians <= 0) return angleRadians;

    // Normalize the current angle to be within the range [0, TWO_PI) for consistent calculations across full circles.
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI; // Handles negative angles and values > TWO_PI

    // Divide the normalized angle by the increment, round to the nearest whole number, then multiply by the increment.
    let snapped = round(angleRadians / incrementRadians) * incrementRadians;

     // Re-normalize the resulting snapped angle to ensure it's also within [0, TWO_PI).
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI;

    return snapped; // Return the final snapped angle in radians.
}


// Function called when the REFRESH button is pressed.
// Clears most of the floating shapes (except potentially the one being grabbed) and generates a new random set.
// Placed items on the central canvas are unaffected.
function resetRandom() {
    console.log("REFRESH button pressed");

    // Check if a shape is currently grabbed AND if that shape is one of the floating ones (is in the 'shapes' array).
    // If so, temporarily hold onto it so it's not discarded when the 'shapes' array is cleared.
    let tempGrabbedFloatingItem = null; // Variable to hold reference if needed
    if (grabbedItem && shapes.includes(grabbedItem)) {
         tempGrabbedFloatingItem = grabbedItem; // Store reference to the grabbed floating item
         shapes = shapes.filter(s => s !== grabbedItem); // Remove this specific item from the shapes array before clearing others.
    }

    // Clear the remaining floating shapes from the `shapes` array.
    shapes = [];

    // Populate the `shapes` array with a fresh set of random floating shapes.
    for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape()); // Adds a new shape instance to the array.
    }

    // If an item was being grabbed from the floating shapes pool when Refresh was hit, add it back to the shapes array.
    // Its state (grabbed, position following mouse) will persist automatically.
    if (tempGrabbedFloatingItem) {
        shapes.push(tempGrabbedFloatingItem); // Add the preserved item back.
        // Input field content relating to this item remains untouched while grabbed.
    }

    // If no item was grabbed and the input field contains non-placeholder text, consider whether to clear it.
    // Decided to leave the input field as is unless an item is grabbed or released, simplifies state.
    // User might have typed text before hitting Refresh without adding it yet.
}

// Function called when the CLEAR button is pressed.
// Resets the entire canvas state: removes all placed items, clears all floating shapes, and deselects any grabbed item.
function restartAll() {
    console.log("CLEAR button pressed");
    placedItems = []; // Clear the array of items placed on the canvas.
    shapes = []; // Clear the array of floating shapes.
    grabbedItem = null; // Deselect any grabbed item by setting the reference to null.

    // Clear and reset the input field content and placeholder to the initial state.
    inputElement.value(''); // Empty the text value.
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore the placeholder text.

    // Add the initial set of floating shapes back to the scene to start anew.
     for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape()); // Create and add new floating shapes.
    }
     // Explicitly clear the contents of the canvasPG graphics buffer and set its background to white.
     // This visually clears the central white canvas area.
     if (canvasPG) {
         canvasPG.clear(); // Clear buffer content
         canvasPG.background(255); // Set white background for the buffer.
     }
}

// Function called when the SAVE button is pressed.
// Saves the current content of the central white canvas area (represented by canvasPG) as a PNG image file.
function saveCanvasArea() {
    console.log("SAVE button pressed");
    // Ensure the graphics buffer object exists before attempting to save it.
    if (canvasPG) {
        // --- Optional: Draw a temporary border on the buffer *before* saving if you want the border in the file ---
        // NOTE: p5's `save(pg, ...)` saves a snapshot/copy of the PG at that moment.
        // If we drew directly to canvasPG here, it would permanently alter the canvasPG buffer itself for the next draw frame.
        // A safer way for temporary save-only visuals would be to draw on a clone or manage state carefully.
        // Given the current border is on the main canvas anyway, saving canvasPG without modification is standard.
        // If you *do* want the border in the file, you would draw it on canvasPG *before* the save() call,
        // and potentially clear/redraw after if the next frame should not show it.
        // Example of adding a border directly to canvasPG just before saving (which WILL affect the live buffer):
         canvasPG.push(); // Save the current state of canvasPG
         canvasPG.stroke(0); // Set border color (black)
         canvasPG.strokeWeight(1); // Set border thickness
         canvasPG.noFill(); // Ensure rectangle is not filled
         // Draw the rectangle just inside the buffer bounds. Adjust by half strokeWeight if needed for crisp edge pixels.
         // drawing rect(0, 0, w, h) usually includes right/bottom edges within bounds.
         canvasPG.rect(0, 0, canvasPG.width -1, canvasPG.height - 1);
         canvasPG.pop(); // Restore the graphics state (stroke/fill/etc.) on canvasPG


         // Generate a unique filename for the saved image based on the current date and time.
         // Use nf() to format numbers with leading zeros for consistent file naming (e.g., 01, 09).
         let filename = 'myArtboard_' + year() + nf(month(), 2) + nf(day(), 2) + '_' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2) + '.png';

        // Use the p5 save() function to download the graphics buffer content as a PNG file.
        save(canvasPG, filename);

        // If you added the border directly to canvasPG for saving, and you don't want it
        // visible in the live canvasPG for the next draw frame, you would need to clear it
        // or redraw the area it covered here. Since our draw loop clears canvasPG every frame,
        // drawing directly is okay *just before* save as the next draw will clean it.
        // Keeping the temp draw logic ensures border is in file, and draw cleans buffer next frame.


    } else {
      // If canvasPG somehow doesn't exist, log a warning message.
      console.warn("Cannot save canvas: graphics buffer (canvasPG) not created yet!");
    }
}


// windowResized event handler function.
// This function is called automatically by p5.js whenever the browser window's size is changed.
// It's used to make the layout responsive, adjusting canvas and UI element positions.
function windowResized() {
    console.log("Window resized to:", windowWidth, windowHeight);
    // Resize the main p5 drawing canvas to match the new window dimensions.
    resizeCanvas(windowWidth, windowHeight);

    // Recalculate the position of the fixed-size central white canvas area.
    // CANVAS_AREA_W remains constant. CANVAS_AREA_H is fixed based on W.
    CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // Height ratio is fixed
    // Re-center the canvas area horizontally based on the new window width.
    CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
    // Keep the canvas area's vertical position fixed below the header.
    CANVAS_AREA_Y = HEADER_HEIGHT + 20;

     // Ensure positions are non-negative if window is extremely small.
    if(CANVAS_AREA_X < 0) CANVAS_AREA_X = 0;
    // Y position calculation is less likely to be negative given fixed HEADER_HEIGHT.


    // Recalculate the position and sometimes size of DOM UI elements.
    let headerCenterY = HEADER_HEIGHT / 2; // Reference Y-coordinate in the header for vertical alignment.

    // Input Element: It is centered horizontally relative to the canvas area and shares its width.
    // Its vertical position is within the header.
    if (inputElement) { // Check if the element exists
        // Set its position based on the canvas area's calculated X and the header's vertical center.
        inputElement.position(CANVAS_AREA_X, headerCenterY - 15); // X from canvas area start, Y in header
        // Set its width to match the fixed width of the canvas area.
        inputElement.size(CANVAS_AREA_W);
        // Padding/border/etc. styling applied in setup usually persists, no need to reapply here.
    }

    // Reposition the right-aligned group of buttons in the header.
    // This requires getting their actual computed widths after potential styling or text changes.
    let buttonSpacing = 10; // Horizontal spacing between buttons.
    let buttonHeight = 30; // Approximate height for vertical alignment (from visual appearance).
    let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2; // Calculated vertical starting Y for buttons.

    // Get the actual current width of each button DOM element. size().width provides this after styling.
     let saveBtnW = saveButton ? saveButton.size().width : 0;
     let clearBtnW = clearButton ? clearButton.size().width : 0;
     let refreshBtnW = refreshButton ? refreshButton.size().width : 0;

     // Calculate the total horizontal width occupied by the buttons when placed side-by-side, plus the gaps between them.
     let totalButtonWidth = 0;
     if (saveButton) totalButtonWidth += saveBtnW; // Add width only if the button element exists
     if (clearButton) totalButtonWidth += clearBtnW;
     if (refreshButton) totalButtonWidth += refreshBtnW;

     let numButtons = (saveButton ? 1 : 0) + (clearButton ? 1 : 0) + (refreshButton ? 1 : 0); // Count how many buttons exist
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0); // Calculate total space needed between buttons (N-1 spaces)

     // Calculate the starting X coordinate for the entire block of buttons.
     // Position the block relative to the right edge of the window with a margin.
     let rightMargin = 20; // Margin from the right edge of the window
     let buttonBlockStartX = width - rightMargin - (totalButtonWidth + totalSpacing);


    // Position each button sequentially, starting from the calculated starting point (`buttonBlockStartX`) and moving rightwards.
    let currentButtonX = buttonBlockStartX; // Starting position for the first button

    // Position the Refresh button (which is the leftmost button in the group)
    if (refreshButton) {
         refreshButton.position(currentButtonX, buttonPadY_buttons); // Set its position using the calculated X and Y
         currentButtonX += refreshBtnW + buttonSpacing; // Advance the starting position for the next button (width + spacing)
     }

    // Position the Clear button (middle button)
    if (clearButton) {
        clearButton.position(currentButtonX, buttonPadY_buttons);
         currentButtonX += clearBtnW + buttonSpacing; // Advance for the next button
     }

    // Position the Save button (rightmost button)
    if (saveButton) {
        saveButton.position(currentButtonX, buttonPadY_buttons); // Set its position
        // No need to advance currentButtonX further as it's the last button positioned rightwards.
    }


     // Handle potential resizing/recreation of the canvasPG graphics buffer.
     // canvasPG has a fixed size based on CANVAS_AREA_W and CANVAS_AREA_H.
     // If windowResized logic ever made these constants change (it doesn't with current code, but for robustness)
     // or if the canvasPG object was nullified or corrupted, this ensures it exists and has the correct size.
     if (canvasPG) {
          // Check if the existing buffer's size matches the required fixed size.
          if (canvasPG.width !== CANVAS_AREA_W || canvasPG.height !== CANVAS_AREA_H) {
             console.log("Recreating canvasPG buffer due to size mismatch or invalid state.");
             // Remove the old buffer (helps with memory in some environments/older p5 versions).
             // If dispose is not available or causes issues, rely on garbage collection and just overwrite `canvasPG`.
             // if (canvasPG.remove) canvasPG.remove(); // Conditional call might fail if canvasPG is not a valid object type but just null/undefined/basic obj
             // Using `remove()` on `createGraphics` results in error in certain p5js contexts if the object wasn't fully initialized or is in a weird state.
             // Let's rely on re-assignment and garbage collection for simpler scenarios unless explicit memory leaks are observed.
             // Safer simply to re-assign:
             canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H); // Create a new graphics buffer with the correct fixed size.
             // Immediately clear the new buffer and set its background color.
              canvasPG.clear();
              canvasPG.background(255); // Set the background of the new buffer to white.
             // Placed items will be redrawn onto this new buffer automatically in the subsequent draw calls.
         }
     } else {
          // If canvasPG does not exist at all (e.g., if windowResized somehow called before setup finishes), create it.
          if(CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) { // Check for valid dimensions before creating
             console.log("Creating canvasPG buffer for the first time in windowResized.");
             canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
              canvasPG.background(255);
          } else {
               console.warn("Cannot create canvasPG buffer with zero dimensions!");
          }
     }
}