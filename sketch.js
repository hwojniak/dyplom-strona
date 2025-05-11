// Interactive canvas website-tool project using p5.js
let shapes = []; // Shapes currently floating or grabbed (Includes temporarily grabbed placed items)
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged
// UI Element References (DOM elements need global vars if you create them this way)
let inputElement;
let savePNGButton; // Existing button for standard PNG save
let saveHighResPNGButton; // NEW button for high-resolution PNG save
// let savePDFButton; // REMOVED: PDF button
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
let usableFonts = []; // Array to hold successfully loaded font objects
// --- END: Variables for ALL Loaded Fonts ---
let logoImage; // Variable to hold the loaded SVG logo
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
    if (objScale === 0 || isNaN(objScale) || objScale === Infinity) {
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
    if (isNaN(px) || isNaN(py) || isNaN(w) || isNaN(h) || w < 0 || h < 0 || isNaN(tolerance) || tolerance < 0) {
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
// These functions match the original vertex calculations used in drawShapePrimitive.
function getTriangleVertices(size) {
    if (isNaN(size) || size <= 0) return [];
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
    let radius = size * 0.7; // Matches original scaling
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
    let radius = size; // Matches original scaling
    let vertices = [];
    for (let i = 0; i < sides; i++) {
        let angle = TWO_PI / sides * i;
        let sx = cos(angle) * radius;
        let sy = sin(angle) * radius;
        vertices.push({ x: sx, y: sy });
    }
    return vertices;
}
// Approximates a circle with vertices (only used for isMouseOver polygon check if needed, not drawing)
function getCircleVertices(size, segments = 60) { // Increased segments for smoother circle check if polygon check were used
    if (isNaN(size) || size <= 0) return [];
    let radius = size; // Matches original scaling (ellipse used diameter, but size * 2 was used, implying size was radius)
    let vertices = [];
    for (let i = 0; i < segments; i++) {
        let angle = TWO_PI / segments * i;
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
             // console.warn("isPointInConvexPolygon: Invalid vertex found.");
             return false; // Invalid vertex
         }
        // Use a small epsilon for floating point comparisons
        cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);

        if (cross_product > 1e-9) has_pos = true;
        if (cross_product < -1e-9) has_neg = true;

        // Point is outside if cross products have different signs (not including collinear)
        if (has_pos && has_neg) return false;
    }

    // Point is inside if no sign change or if all cross products are near zero (collinear case)
    // For a convex polygon, if there's no sign change, the point is inside or on the boundary.
    return true;
}

// Checks if a point is near any edge of a polygon within a tolerance (local coords).
function isPointNearPolygonEdge(px, py, vertices, tolerance) {
    if (isNaN(px) || isNaN(py) || !Array.isArray(vertices) || vertices.length < 2 || isNaN(tolerance) || tolerance < 0) {
        return false;
    }
    for (let i = 0; i < vertices.length; i++) {
        let v1 = vertices[i], v2 = vertices[(i + 1) % vertices.length];
        if (isNaN(v1.x) || isNaN(v1.y) || isNaN(v2.x) || isNaN(v2.y)) continue; // Skip invalid segment
        if (distToSegment(px, py, v1.x, v1.y, v2.x, v2.y) <= tolerance) { return true; }
    }
    return false;
}

// FIX: Calculates text bounding box using a single, persistent graphics buffer.
let textMeasurePG; // Declare the global variable here
function getTextBounds(content, effectiveTextSize, fontRef) {
    if (typeof content !== 'string' || isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
        // Return estimated bounds as a fallback for invalid input
        return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };
    }

    // Ensure the measurement buffer exists and is configured
    if (!textMeasurePG || typeof textMeasurePG.textWidth !== 'function') {
        // If buffer is missing or invalid, return estimated bounds
        // console.warn("textMeasurePG missing or invalid, returning estimated bounds for:", content); // Debugging
         return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };
    }

    try {
        // Apply font properties to the measurement buffer context
        // Use the font reference provided, or a default if none/invalid
        // Check if fontRef is a p5.Font object before trying textFont(object)
        if (fontRef && typeof fontRef === 'object' && typeof fontRef.textWidth === 'function' && typeof textMeasurePG.textFont === 'function') {
            textMeasurePG.textFont(fontRef); // Use the p5.Font object
             // console.log("Measuring with loaded font:", fontRef.fontName || "unknown"); // DEBUG FONT
        } else if (typeof textMeasurePG.textFont === 'function') {
            textMeasurePG.textFont(baseFont); // Fallback to monospace string
             // console.log("Measuring with fallback font:", baseFont); // DEBUG FONT
        } else {
             // textFont method missing on buffer, return estimated bounds
             // console.warn("textMeasurePG.textFont missing for measurement, returning estimated bounds.");
             return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };
        }

        if (typeof textMeasurePG.textSize !== 'function') { /* console.warn("textMeasurePG.textSize missing for measurement"); */ return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 }; }
        textMeasurePG.textSize(effectiveTextSize);

         if (typeof textMeasurePG.textAlign !== 'function') { /* console.warn("textMeasurePG.textAlign missing for measurement"); */ return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 }; }
        textMeasurePG.textAlign(CENTER, CENTER);


        // Perform measurement using the persistent buffer
        let textW = 0, textAsc = 0, textDesc = 0;

        if (typeof textMeasurePG.textWidth === 'function') textW = textMeasurePG.textWidth(content); else return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };
        if (typeof textMeasurePG.textAscent === 'function') textAsc = textMeasurePG.textAscent(); else return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };
        if (typeof textMeasurePG.textDescent === 'function') textDesc = textMeasurePG.textDescent(); else return { w: (content ? content.length : 1) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };

        let textH = textAsc + textDesc; // Total height

        // Basic sanity check for calculated dimensions
        if (isNaN(textW) || isNaN(textH) || textW < 0 || textH < 0) {
            // console.warn("getTextBounds returned invalid dimensions:", textW, textH);
            // Return estimated bounds if measurement results are invalid
            return { w: (content ? content.length : 0.5) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };
        }

        return { w: textW, h: textH };

    } catch (e) {
        // Catch any other errors during measurement, return estimated bounds
         console.error("Error in getTextBounds:", e);
         return { w: (content ? content.length : 0.5) * 0.6 * effectiveTextSize, h: effectiveTextSize * 1.2 };
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
        let posAlong = random(0.15, 0.85); // Slightly inward to avoid corners

        let categoryIndex = floor(random(sizeCategories.length));
        let category = sizeCategories[categoryIndex];
        this.size = random(category.sizeRange[0], category.sizeRange[1]);
        this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]);

        // Estimate max dimension based on type/content/size/scale for off-screen check buffer
        let roughMaxDimension = this.calculateMaxEffectiveDimension();
        let offScreenOffset = max(roughMaxDimension / 2 * this.scaleFactor, 100) + 50; // Add buffer

        let minSpeed = 0.8, maxSpeed = 1.8; // Floating speeds

        switch (edge) {
            case 0: // Top
                this.x = width * posAlong;
                this.y = -offScreenOffset;
                this.speedX = random(-0.8, 0.8);
                this.speedY = random(minSpeed, maxSpeed);
                break;
            case 1: // Right
                this.x = width + offScreenOffset;
                this.y = height * posAlong;
                this.speedX = random(-maxSpeed, -minSpeed);
                this.speedY = random(-0.8, 0.8);
                break;
            case 2: // Bottom
                this.x = width * posAlong;
                this.y = height + offScreenOffset;
                this.speedX = random(-0.8, 0.8);
                this.speedY = random(-maxSpeed, -minSpeed);
                break;
            case 3: // Left
                this.x = -offScreenOffset;
                this.y = height * posAlong;
                this.speedX = random(minSpeed, maxSpeed);
                this.speedY = random(-0.8, 0.8);
                break;
        }

        this.rotation = random(TWO_PI);
        this.rotationSpeed = random(-0.002, 0.002);

        let pickedColor;
        // Bias towards text if fonts loaded, otherwise more shapes
        this.type = (usableFonts.length > 0 && random() < 0.7) ? 'text' : 'shape'; // Increased bias for text if fonts available

        if (this.type === 'text') {
            let attempts = 0;
            do {
                pickedColor = color(random(PALETTE));
                attempts++;
            } while (attempts < 10 && brightness(pickedColor) > 230); // Try to avoid very bright colors for black background

            this.shapeType = 'none';
            // Select random content, ensuring it's not the placeholder or empty after trim
            let initialContent = random(TEXT_OPTIONS.slice(1));
            while (!initialContent || initialContent.trim() === "" || initialContent.trim() === TEXT_OPTIONS[0].trim()) {
                initialContent = random(TEXT_OPTIONS.slice(1));
            }
            this.content = initialContent.trim();
            this.textScaleAdjust = category.textScaleAdjust;

            // --- Assign a random loaded font from the usableFonts array ---
            if (usableFonts.length > 0) {
                this.font = random(usableFonts); // Assign p5.Font object
            } else {
                this.font = baseFont; // Fallback to monospace string
            }
            // --- End font assignment ---

        } else { // type is 'shape'
            this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']); // 'circle' is a shape too
            pickedColor = color(random(PALETTE));
            this.content = null;
            this.textScaleAdjust = 0;
            this.font = null; // Font is null for shapes
        }

        this.color = pickedColor;

        this.isGrabbed = false;
        this.isPlacing = false;
        this.landFrame = -1;
        this.tempScaleEffect = 1; // For landing animation
    }

    calculateMaxEffectiveDimension() {
        let dimension = this.size || 50; // Default fallback size
        if (this.type === 'text' && this.content && this.content.trim() !== "" && this.content.trim() !== TEXT_OPTIONS[0].trim()) {
            let effectiveTextSize = (this.size || 1) * (this.textScaleAdjust || 0.2);
            let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont);
            // Use diagonal as a rough max dimension
            dimension = sqrt(sq(textBounds.w) + sq(textBounds.h));
        } else if (this.type === 'shape' && this.shapeType) {
            // Estimate max dimension for shapes based on size/radius
             switch(this.shapeType) {
                  case 'circle': dimension = this.size * 2; break; // diameter
                  case 'square': dimension = this.size * Math.SQRT2; break; // diagonal
                  case 'triangle': dimension = this.size * 1.6; break; // rough max extent
                  case 'pentagon': dimension = this.size * 0.7 * 2 * 1.05; break; // radius * 2 + buffer
                  case 'hexagon': dimension = this.size * 2; break; // diameter (corner to corner)
                  default: dimension = this.size * 1.5; break; // Generic shape estimate
             }
        }

        // Ensure dimension is a positive number, fallback if calculation failed
        dimension = max(dimension, 1);

        return dimension;
    }

    update() {
        if (!this.isGrabbed && !this.isPlacing) {
            this.x += this.speedX;
            this.y += this.speedY;
            this.rotation += this.rotationSpeed;

            // Wrap rotation
            this.rotation = (this.rotation % TWO_PI + TWO_PI) % TWO_PI;
        }
    }

    isReallyOffScreen() {
        let maxEffectiveDimension = this.calculateMaxEffectiveDimension();
        if (isNaN(maxEffectiveDimension) || maxEffectiveDimension <= 0) {
            // If dimension is bad, assume it's never offscreen to prevent instant removal
            return false;
        }
        // Use effective radius including scale factor
        let effectiveRadius = (maxEffectiveDimension / 2) * this.scaleFactor;
        let windowBuffer = max(width, height) * 0.5; // Buffer relative to window size

        // Check if the item is far outside the window bounds
        return this.x < -windowBuffer - effectiveRadius || this.x > width + windowBuffer + effectiveRadius ||
               this.y < -windowBuffer - effectiveRadius || this.y > height + windowBuffer + effectiveRadius;
    }

    updateLanding() {
        if (this.isPlacing && !this.isGrabbed) {
            let elapsed = frameCount - this.landFrame;
            let duration = 45; // Animation duration in frames
            if (elapsed <= duration) {
                let t = map(elapsed, 0, duration, 0, 1);
                let easedT = 1 - pow(1 - t, 3); // Ease out effect
                let pulseScale = 1 + sin(easedT * PI) * 0.08; // Pulse effect peaking mid-animation
                this.tempScaleEffect = pulseScale;
            } else {
                this.isPlacing = false;
                this.tempScaleEffect = 1; // Reset scale effect
            }
        } else if (!this.isPlacing && this.tempScaleEffect !== 1) {
            // Ensure scale effect is reset if state changes unexpectedly
            this.tempScaleEffect = 1;
        }
    }

    // Displays the shape or text on the provided graphics context.
    // offsetX, offsetY are used to draw relative to a view (e.g., the canvas area buffer).
    display(graphics, showGrabEffect = false, offsetX = 0, offsetY = 0) {
         // Robustness check for graphics context
        if (!graphics || typeof graphics.push !== 'function' || typeof graphics.translate !== 'function') {
            // console.error("Invalid graphics context passed to display"); // Debugging
            return;
        }
        // Don't draw empty text shapes unless they are currently grabbed on the main canvas
        if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim())) {
             if (!this.isGrabbed || graphics !== this) {
                 return;
             }
        }

        graphics.push();
        // Translate to the item's position relative to the graphics context's origin
        graphics.translate(this.x - offsetX, this.y - offsetY);
        graphics.rotate(this.rotation);

        // Apply scale including any temporary effects (like landing animation)
        let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
         if (currentDisplayScale <= 0 || isNaN(currentDisplayScale)) currentDisplayScale = 1e-6; // Ensure scale is positive and not NaN
        graphics.scale(currentDisplayScale);


        // Draw grabbed effect (outline) if requested and on the main canvas
        if (showGrabEffect && graphics === this) {
             graphics.push(); // Save graphics state before drawing outline
             graphics.drawingContext.shadowBlur = 30; // Softer shadow
             graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.7)'; // Semi-transparent white glow
             graphics.stroke(255, 255, 255, 180); // Visible white stroke
             graphics.strokeWeight(4);
             graphics.noFill();
             // Draw the outline using the same primitive drawing logic
             this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
             graphics.drawingContext.shadowBlur = 0; // Reset shadow
             graphics.pop(); // Restore stroke/fill settings
        }

        // Set fill and stroke for the main shape/text drawing
        graphics.fill(this.color);
        graphics.noStroke();

        // Draw the core shape or text primitive
        this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);

        graphics.pop(); // Restore transformations and drawing styles
    }

    // Draws the shape's core geometry or text centered at (px, py), with base size psize.
    // Assumes transformations (translate, rotate, scale) are already applied to the 'graphics' context.
    // This function uses methods provided by the graphics context (e.g., graphics.rect, graphics.text).
    drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        // Robustness checks - ensure necessary drawing functions exist on the graphics context
        if (isText) {
             if (typeof graphics.text !== 'function' || typeof graphics.textFont !== 'function' || typeof graphics.textSize !== 'function' || typeof graphics.textAlign !== 'function') {
                 // console.warn("Graphics context missing text drawing functions."); // Debugging
                 return;
             }
        } else { // Shape
             // Check size sanity for shapes
             if (isNaN(psize) || psize <= 0) {
                  // console.warn("Invalid size for shape primitive:", psize); // Debugging
                  return;
             }
              // Need specific checks for ellipse or beginShape functions
             if (pshapeType === 'circle') {
                  if (typeof graphics.ellipse !== 'function') {
                       // console.warn("Graphics context missing ellipse drawing function for circle."); // Debugging
                       return;
                  }
             } else { // Polygons
                  if (typeof graphics.beginShape !== 'function' || typeof graphics.vertex !== 'function' || typeof graphics.endShape !== 'function') {
                       // console.warn("Graphics context missing polygon drawing functions for shape:", pshapeType); // Debugging
                       return;
                  }
             }
        }


        if (isText) {
            // Apply text properties to the provided graphics context
            let itemFont = this.font;
            // Use the assigned font object if it exists, otherwise fallback to baseFont string
             // Check if itemFont is a valid p5.Font object (truthy) before using textFont(object)
            if (itemFont && typeof itemFont === 'object' && typeof itemFont.textWidth === 'function') {
                graphics.textFont(itemFont); // Use the p5.Font object
                 // console.log("Attempting to draw text with font object:", itemFont.fontName || "unknown"); // DEBUG FONT
            } else {
                graphics.textFont(baseFont); // Fallback string
                 // console.log("Attempting to draw text with fallback font:", baseFont); // DEBUG FONT
            }

            graphics.textAlign(CENTER, CENTER);

            let effectiveTextSize = psize * textScaleAdjust;
            effectiveTextSize = max(effectiveTextSize, 1); // Ensure minimal size
             if (effectiveTextSize === Infinity || isNaN(effectiveTextSize)) effectiveTextSize = 16; // Sanity check size

            graphics.textSize(effectiveTextSize);

            graphics.text(this.content, px, py); // Draw text centered at px, py


        } else { // It's a shape
            // Fill and Stroke are expected to be set in the calling display() method
            switch (pshapeType) {
                case 'circle':
                   // Draw circle using ellipse() directly
                   graphics.ellipse(px, py, psize * 2); // psize is treated as radius, so diameter is psize * 2
                   break;
                case 'square':
                case 'triangle':
                case 'pentagon':
                case 'hexagon':
                     // Get vertices for the specific polygon shape
                    let vertices = [];
                    switch (pshapeType) {
                        case 'square':    vertices = getSquareVertices(psize); break;
                        case 'triangle':  vertices = getTriangleVertices(psize); break;
                        case 'pentagon':  vertices = getPentagonVertices(psize); break;
                        case 'hexagon':   vertices = getHexagonVertices(psize); break;
                    }

                    // Check if we got valid vertices
                    if (!Array.isArray(vertices) || vertices.length < 3) {
                         // console.warn("Not enough vertices for shape:", pshapeType, vertices ? vertices.length : 0); // Debugging
                         return; // Need at least 3 vertices to form a polygon
                    }

                    // Draw the polygon using vertices
                    graphics.beginShape();
                    for (let v of vertices) {
                         if (isNaN(v.x) || isNaN(v.y)) {
                              // console.warn("Skipping NaN vertex in shape:", v); // Debugging
                              continue; // Skip invalid vertices
                         }
                        graphics.vertex(px + v.x, py + v.y); // Draw vertex relative to px, py (which is 0,0 here)
                    }
                    graphics.endShape(CLOSE);
                    break;
                default:
                     // console.warn("Unknown shape type:", pshapeType); // Debugging
                     return; // Don't attempt to draw unknown shapes
            }
        }
    }

    // Checks if a point is over the shape, considering transformations and tolerance.
    isMouseOver(mx, my) {
        // Basic sanity checks
        if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) ||
            isNaN(this.scaleFactor) || isNaN(this.size) || this.scaleFactor <= 0 || this.size <= 0) {
            return false;
        }
        // Empty/placeholder text is only "mouse over" if it's the grabbed item
        if (this.type === 'text' && (!this.content || this.content.trim() === "" || this.content.trim() === TEXT_OPTIONS[0].trim()) && !this.isGrabbed) {
            return false;
        }

        // Calculate effective scale including temporary effects
        let currentDisplayScale = this.scaleFactor * this.tempScaleEffect;
        if (currentDisplayScale <= 0 || isNaN(currentDisplayScale)) return false; // Cannot be over something with invalid scale

        // Transform mouse coordinates to the object's local coordinate system
        let localMouse = transformPointToLocal(mx, my, this.x, this.y, this.rotation, currentDisplayScale);
        let localMx = localMouse.x, localMy = localMouse.y;

        if (isNaN(localMx) || isNaN(localMy)) return false; // Transformation failed

        // Calculate local tolerance based on display scale
        let localTolerance = CLICK_TOLERANCE / currentDisplayScale;
        localTolerance = max(localTolerance, 3); // Minimum tolerance to prevent impossible clicks at high scale

        if (this.type === 'text') {
            let effectiveTextSize = this.size * this.textScaleAdjust;
             if (isNaN(effectiveTextSize) || effectiveTextSize <= 0) {
                  return false; // Cannot be over text with invalid size
              }
            // Get text bounds using the specific font if available
            let textBounds = getTextBounds(this.content, effectiveTextSize, this.font || baseFont);
             if (textBounds.w <= 0 || textBounds.h <= 0 || isNaN(textBounds.w) || isNaN(textBounds.h)) return false; // Cannot be over text with invalid bounds

            // Check if local mouse is inside or near the text bounding box (centered at 0,0)
            return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h, localTolerance);

        } else { // type is 'shape'
            // Collision check based on shape type
             if (isNaN(this.size) || this.size <= 0) {
                 return false; // Cannot check collision for invalid size
             }
            switch (this.shapeType) {
                 // Circle collision is simple distance check from local origin
                case 'circle':
                   return dist(localMx, localMy, 0, 0) <= this.size + localTolerance; // size is radius here
                case 'square':
                   // Square collision uses axis-aligned rect check based on size
                   return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size, localTolerance); // size is side length here
                case 'triangle':
                case 'pentagon':
                case 'hexagon':
                     // For polygon shapes, check inside or near edge using vertices
                    let collisionVertices = [];
                    switch (this.shapeType) {
                        case 'triangle':  collisionVertices = getTriangleVertices(this.size); break; // Use size as scaling factor
                        case 'pentagon':  collisionVertices = getPentagonVertices(this.size); break; // Use size * 0.7 as radius
                        case 'hexagon':   collisionVertices = getHexagonVertices(this.size); break; // Use size as radius
                    }
                    if (!Array.isArray(collisionVertices) || collisionVertices.length < 3) {
                         return false; // Cannot check collision for invalid polygon
                    }
                    // Check strict inside *or* near edge
                    if (isPointInConvexPolygon(localMx, localMy, collisionVertices)) return true;
                    return isPointNearPolygonEdge(localMx, localMy, collisionVertices, localTolerance);
                 default:
                      // Fallback for unknown or shapes without specific collision functions
                      return dist(localMx, localMy, 0, 0) <= this.size * 0.7 + localTolerance; // Rough radius estimate based on size
            }
        }
    }

    solidify() { this.speedX = 0; this.speedY = 0; this.rotationSpeed = 0; }
}

function preload() {
    baseFont = 'monospace'; // Default fallback font string
    // --- START: Load ALL specific fonts and logo ---
    // Providing empty function callbacks to prevent TypeError if load fails
    fontBangersRegular = loadFont('assets/Bangers-Regular.ttf', () => { /* console.log('Bangers loaded'); */ }, (err) => { console.error('Failed to load Bangers:', err); });
    fontBoogalooRegular = loadFont('assets/Boogaloo-Regular.ttf', () => { /* console.log('Boogaloo loaded'); */ }, (err) => { console.error('Failed to load Boogaloo:', err); });
    fontBreeSerifRegular = loadFont('assets/BreeSerif-Regular.ttf', () => { /* console.log('BreeSerif loaded'); */ }, (err) => { console.error('Failed to load BreeSerif:', err); });
    fontCaveatBrushRegular = loadFont('assets/CaveatBrush-Regular.ttf', () => { /* console.log('CaveatBrush loaded'); */ }, (err) => { console.error('Failed to load CaveatBrush:', err); });
    fontCherryBombOneRegular = loadFont('assets/CherryBombOne-Regular.ttf', () => { /* console.log('CherryBombOne loaded'); */ }, (err) => { console.error('Failed to load CherryBombOne:', err); });
    fontCinzelDecorativeBlack = loadFont('assets/CinzelDecorative-Black.ttf', () => { /* console.log('CinzelDecorativeBlack loaded'); */ }, (err) => { console.error('Failed to load CinzelDecorativeBlack:', err); });
    fontCinzelDecorativeBold = loadFont('assets/CinzelDecorative-Bold.ttf', () => { /* console.log('CinzelDecorativeBold loaded'); */ }, (err) => { console.error('Failed to load CinzelDecorativeBold:', err); });
    fontCinzelDecorativeRegular = loadFont('assets/CinzelDecorative-Regular.ttf', () => { /* console.log('CinzelDecorativeRegular loaded'); */ }, (err) => { console.error('Failed to load CinzelDecorativeRegular:', err); });
    fontDynaPuffBold = loadFont('assets/DynaPuff-Bold.ttf', () => { /* console.log('DynaPuffBold loaded'); */ }, (err) => { console.error('Failed to load DynaPuffBold:', err); });
    fontDynaPuffMedium = loadFont('assets/DynaPuff-Medium.ttf', () => { /* console.log('DynaPuffMedium loaded'); */ }, (err) => { console.error('Failed to load DynaPuffMedium:', err); });
    fontDynaPuffRegular = loadFont('assets/DynaPuff-Regular.ttf', () => { /* console.log('DynaPuffRegular loaded'); */ }, (err) => { console.error('Failed to load DynaPuffRegular:', err); });
    fontInterBold = loadFont('assets/Inter-Bold.ttf', () => { /* console.log('InterBold loaded'); */ }, (err) => { console.error('Failed to load InterBold:', err); });
    fontInterRegular = loadFont('assets/Inter-Regular.ttf', () => { /* console.log('InterRegular loaded'); */ }, (err) => { console.error('Failed to load InterRegular:', err); });
    fontPixelifySansRegular = loadFont('assets/PixelifySans-Regular.ttf', () => { /* console.log('PixelifySansRegular loaded'); */ }, (err) => { console.error('Failed to load PixelifySansRegular:', err); });
    fontSenBold = loadFont('assets/Sen-Bold.ttf', () => { /* console.log('SenBold loaded'); */ }, (err) => { console.error('Failed to load SenBold:', err); });
    fontSenMedium = loadFont('assets/Sen-Medium.ttf', () => { /* console.log('SenMedium loaded'); */ }, (err) => { console.error('Failed to load SenMedium:', err); });
    fontSenRegular = loadFont('assets/Sen-Regular.ttf', () => { /* console.log('SenRegular loaded'); */ }, (err) => { console.error('Failed to load SenRegular:', err); });
    fontShareTechMonoRegular = loadFont('assets/ShareTechMono-Regular.ttf', () => { /* console.log('ShareTechMono loaded'); */ }, (err) => { console.error('Failed to load ShareTechMono:', err); });
    fontVT323Regular = loadFont('assets/VT323-Regular.ttf', () => { /* console.log('VT323 loaded'); */ }, (err) => { console.error('Failed to load VT323:', err); });

    logoImage = loadImage('assets/placeholder-logo.svg', () => { /* console.log('Logo loaded'); */ }, (err) => { console.error('Failed to load logo:', err); });
    // --- END: Variables for ALL Loaded Fonts ---
}

let canvasPG; // Graphics buffer for the central canvas area
let initialPositioningDone = false; // Flag to do initial DOM positioning once

function setup() {
    createCanvas(windowWidth, windowHeight);
    if (width <= 0 || height <= 0) {
        console.error("Canvas size is invalid:", width, "x", height);
        return; // Exit setup if canvas is bad
    }

    SNAP_INCREMENT_RADIANS = radians(15); // Snap rotation to 15 degrees

    // --- Filter usable fonts after they are loaded in preload ---
    // This array will be used by both reset() and addNewTextShapeFromInput()
    // Check for truthiness and basic font properties
    usableFonts = [
        fontBangersRegular, fontBoogalooRegular, fontBreeSerifRegular, fontCaveatBrushRegular,
        fontCherryBombOneRegular, fontCinzelDecorativeBlack, fontCinzelDecorativeBold,
        fontCinzelDecorativeRegular, fontDynaPuffBold, fontDynaPuffMedium, fontDynaPuffRegular,
        fontInterBold, fontInterRegular, fontPixelifySansRegular, fontSenBold, fontSenMedium,
        fontSenRegular, fontShareTechMonoRegular, fontVT323Regular
    ].filter(f => f && typeof f === 'object' && typeof f.textWidth === 'function'); // Filter for valid p5.Font objects

    // console.log("Usable fonts after filtering:", usableFonts.length, usableFonts); // Debugging usable fonts array


    // Create the text measurement buffer (small, won't be drawn to main canvas)
    // Ensure it has valid dimensions and font set
    if (!textMeasurePG || typeof textMeasurePG.textWidth !== 'function') {
         try {
              if (textMeasurePG) { textMeasurePG.remove(); } // Clean up previous if exists
              textMeasurePG = createGraphics(10, 10); // Minimal size
              // Re-apply essential text properties after creation
               if (usableFonts.length > 0 && typeof textMeasurePG.textFont === 'function') {
                   textMeasurePG.textFont(usableFonts[0]); // Use the first usable font for measurement if available
               } else if (baseFont && typeof textMeasurePG.textFont === 'function') {
                   textMeasurePG.textFont(baseFont); // Fallback to monospace string
               }
               if (typeof textMeasurePG.textAlign === 'function') textMeasurePG.textAlign(CENTER, CENTER);
               // console.log("textMeasurePG initialized successfully in setup"); // Debugging
         } catch(e) {
              console.error("Failed to initialize textMeasurePG in setup:", e);
              textMeasurePG = null; // Set to null if creation failed
         }
     }


    // Create DOM elements
    inputElement = createInput();
    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    inputElement.style("padding", "5px 10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "15px")
        .style("outline", "none")
        .style("background-color", "rgba(255, 255, 255, 0.8)") // Slightly more transparent header elements
        .style("font-size", "14px")
        .style("color", color(50))
        .style("box-sizing", "border-box"); // Include padding/border in element's total width
    // Add event listener for 'Enter' key to add text
    inputElement.elt.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && document.activeElement === this) {
            addNewTextShapeFromInput();
            event.preventDefault(); // Prevent default form submission behavior
        }
    });

    savePNGButton = createButton("SAVE PNG");
    saveHighResPNGButton = createButton("SAVE HI-RES PNG");
    // savePDFButton = createButton("SAVE PDF"); // REMOVED
    clearButton = createButton("CLEAR");
    refreshButton = createButton("REFRESH");

    const baseButtonStyle = {
        padding: "5px 10px",
        border: "1px solid #888",
        "border-radius": "15px",
        "background-color": "rgba(200, 200, 200, 0.7)", // Slightly more transparent header elements
        color: "rgb(50, 50, 50)",
        outline: "none",
        cursor: "pointer",
        "box-sizing": "border-box", // Include padding/border in element's total width
        "white-space": "nowrap" // Prevent text wrapping in buttons
    };

    // Apply styles and add event listeners to buttons
    [savePNGButton, saveHighResPNGButton, clearButton, refreshButton].forEach(btn => { // REMOVED savePDFButton
        if (btn) {
            Object.keys(baseButtonStyle).forEach(styleKey => {
                btn.style(styleKey, baseButtonStyle[styleKey]);
            });
            // Hover effects
            btn.elt.addEventListener('mouseover', function() { this.style.backgroundColor = 'rgba(220, 220, 220, 0.9)'; });
            btn.elt.addEventListener('mouseout', function() { this.style.backgroundColor = baseButtonStyle["background-color"]; });
        }
    });

    // Assign button actions
    if (savePNGButton) savePNGButton.elt.addEventListener('click', saveCanvasAreaAsPNG);
    if (saveHighResPNGButton) saveHighResPNGButton.elt.addEventListener('click', saveCanvasAreaAsHighResPNG);
    // if(savePDFButton) savePDFButton.elt.addEventListener('click', saveCanvasAreaAsPDF); // REMOVED
    if (clearButton) clearButton.elt.addEventListener('click', restartAll);
    if (refreshButton) refreshButton.elt.addEventListener('click', resetRandom);


    initialPositioningDone = false; // Will be set true in the first draw loop

    // Populate initial floating shapes
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }
     // console.log("Initial shapes created in setup:", shapes.length); // Debugging
}

function draw() {
    // Perform initial DOM and canvasPG positioning once the canvas size is set
    if (!initialPositioningDone) {
        positionDOMElementsAndCanvasPG();
        initialPositioningDone = true;
    }

    background(0); // Black background

    // --- Update shapes ---
    for (let i = shapes.length - 1; i >= 0; i--) {
        let shape = shapes[i];
        if (!shape.isGrabbed && !shape.isPlacing) { shape.update(); } // Update position/rotation if floating
        shape.updateLanding(); // Update landing animation state

        // Remove shapes that have floated far off-screen and are not grabbed or placing
        if (!shape.isGrabbed && !shape.isPlacing && shape.isReallyOffScreen()) {
            shapes.splice(i, 1);
        }
    }
    // Replenish floating shapes if the count drops below a threshold
    while (shapes.length < 20) { shapes.push(new FloatingShape()); }

    // --- Update placed items ---
    for (let item of placedItems) {
        item.updateLanding(); // Update landing animation state
    }

    // --- Draw floating shapes on main canvas (behind artboard) ---
    // Draw shapes that are floating or waiting, but not currently grabbed
    for (let i = 0; i < shapes.length; i++) {
        let shape = shapes[i];
        if (shape !== grabbedItem) {
            shape.display(this, false, 0, 0); // Draw on the main canvas context (this), no offset
        }
    }

    // --- Central White Canvas Area Drawing (Rendered to canvasPG) ---
    // Ensure canvasPG is valid before drawing to or displaying it
    if (canvasPG && canvasPG.width > 0 && canvasPG.height > 0) {
        canvasPG.clear(); // Clear the buffer
        canvasPG.background(255); // White background for the artboard

        // Draw placed items onto canvasPG buffer
        for (let i = 0; i < placedItems.length; i++) {
            let item = placedItems[i];
            // Draw relative to the canvasPG origin (0,0), using CANVAS_AREA_X/Y as offset
            item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
        }

        // Draw the canvasPG buffer onto the main canvas at its position
        image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);
    } else {
        // Display an error or placeholder if canvasPG is not ready
        fill(255, 100, 100, 150); // Semi-transparent red fill
        rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(16);
        text("Error: Canvas area buffer not available or invalid.", CANVAS_AREA_X + CANVAS_AREA_W / 2, CANVAS_AREA_Y + CANVAS_AREA_H / 2);
    }


    // Draw border around canvas area on the main canvas
    stroke(180); // Greyish border
    strokeWeight(1);
    noFill();
    // Draw the rect with a small offset to ensure the stroke is fully visible within the bounds
    rect(CANVAS_AREA_X + 0.5, CANVAS_AREA_Y + 0.5, CANVAS_AREA_W - 1, CANVAS_AREA_H - 1);


    // Draw grabbed item on top of everything else on the main canvas
    if (grabbedItem) {
        // Smoothly move the grabbed item towards the mouse position
        grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.4);
        grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.4);
        grabbedItem.solidify(); // Stop its own movement
        grabbedItem.isPlacing = false; // Cancel any landing animation

        // Update text content from input while grabbed
        if (grabbedItem.type === 'text') {
            grabbedItem.content = inputElement.value();
        }

        // Display the grabbed item on the main canvas (this), with grab effect
        grabbedItem.display(this, true, 0, 0);
    }


    // --- DRAW HEADER / UI OVERLAY ---
    fill(220, 220, 220, 200); // Semi-transparent grey header background
    noStroke();
    rect(0, 0, width, HEADER_HEIGHT);

    // --- START: Draw the Header Logo (SVG or Fallback Text) ---
    let logoX = 20;
    let logoCenterY = HEADER_HEIGHT / 2;
    let logoTargetHeight = HEADER_HEIGHT * 0.7; // Make logo height 70% of header height

    if (logoImage && typeof logoImage.width === 'number' && logoImage.width > 0 && typeof logoImage.height === 'number' && logoImage.height > 0) {
        let logoAspectRatio = logoImage.height / logoImage.width;
        let logoTargetWidth = logoTargetHeight / logoAspectRatio; // Maintain aspect ratio

        let logoDrawX = logoX;
        let logoDrawY = logoCenterY - logoTargetHeight / 2;

        imageMode(CORNER);
        image(logoImage, logoDrawX, logoDrawY, logoTargetWidth, logoTargetHeight);

    } else {
        // Fallback text logo if SVG fails to load
        fill(50);
        textSize(18); // Slightly smaller text for fallback logo
        textAlign(LEFT, CENTER);
        // Use a usable font for the logo text if available
        if (usableFonts.length > 0 && typeof textFont === 'function') {
            textFont(usableFonts[0]);
        } else if (typeof textFont === 'function') {
            textFont(baseFont); // Fallback string font
        } else {
             // textFont not available, draw with default system font
        }
        text("YOUR ARTBOARD\nTOOL", logoX, logoCenterY);
    }
    // --- END: Draw the Header Logo ---
}

// Positions DOM elements and resizes/creates canvasPG based on window size and layout constants
function positionDOMElementsAndCanvasPG() {
    // Calculate canvas area size and position based on window dimensions
    const minCanvasW = 300; // Minimum canvas width
    const maxCanvasW = min(CANVAS_AREA_W_BASE, windowWidth * 0.95); // Maximum based on base and window width

    // Prioritize aspect ratio (4:5) but fit within window bounds
    let targetCANVAS_AREA_W = max(minCanvasW, maxCanvasW);
    let targetCANVAS_AREA_H = targetCANVAS_AREA_W * (5 / 4);

    let padY = 20; // Padding below header and above window bottom
    const availableH = height - HEADER_HEIGHT - padY * 2; // Available vertical space for the canvas area

    // Adjust size if the calculated height exceeds available space
    if (targetCANVAS_AREA_H > availableH && availableH > minCanvasW * (5/4) * 0.8) { // Ensure there's some space left
        targetCANVAS_AREA_H = availableH;
        targetCANVAS_AREA_W = targetCANVAS_AREA_H * (4 / 5); // Recalculate width based on limited height
        targetCANVAS_AREA_W = max(minCanvasW, min(targetCANVAS_AREA_W, windowWidth * 0.95)); // Ensure width is still within limits
    } else if (availableH <= minCanvasW * (5/4) * 0.8) {
         // Handle very small window heights where normal scaling might fail
         targetCANVAS_AREA_H = max(100, availableH); // Use at least 100px or available height
         targetCANVAS_AREA_W = targetCANVAS_AREA_H * (4/5); // Maintain ratio, might be small
         targetCANVAS_AREA_W = max(150, min(targetCANVAS_AREA_W, windowWidth * 0.95)); // Ensure min width
    }


    // Calculate center position
    let minSideMargin = 15; // Minimum margin on sides
    let targetCANVAS_AREA_X = max(minSideMargin, (width / 2 - targetCANVAS_AREA_W / 2));
    let targetCANVAS_AREA_Y = HEADER_HEIGHT + padY;


    // Apply calculated dimensions and position
    CANVAS_AREA_W = targetCANVAS_AREA_W;
    CANVAS_AREA_H = targetCANVAS_AREA_H;
    CANVAS_AREA_X = targetCANVAS_AREA_X;
    CANVAS_AREA_Y = targetCANVAS_AREA_Y;

    // Resize or create canvasPG buffer if needed
    if (canvasPG) {
        if (canvasPG.width !== CANVAS_AREA_W || canvasPG.height !== CANVAS_AREA_H) {
            if (CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
                canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H);
                canvasPG.background(255); // Clear with white background after resize
                 // console.log("Resized canvasPG to:", CANVAS_AREA_W, CANVAS_AREA_H); // Debugging
            } else {
                // If dimensions are invalid, remove the buffer to prevent errors
                 if (canvasPG) { try { canvasPG.remove(); } catch(e) {} }
                 canvasPG = null;
                 console.error("Invalid canvas area dimensions calculated, removing canvasPG.");
            }
        }
    } else {
        // Create canvasPG buffer if it doesn't exist and dimensions are valid
        if (CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
            canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
            canvasPG.background(255); // Clear with white background
             // console.log("Created canvasPG:", CANVAS_AREA_W, CANVAS_AREA_H); // Debugging
        } else {
             console.error("Cannot create canvasPG with invalid dimensions:", CANVAS_AREA_W, CANVAS_AREA_H);
        }
    }

     // Ensure textMeasurePG is initialized or re-initialized defensively
    if (!textMeasurePG || typeof textMeasurePG.textWidth !== 'function') {
         try {
              if (textMeasurePG) { textMeasurePG.remove(); } // Clean up previous if exists
              textMeasurePG = createGraphics(10, 10); // Minimal size
              // Re-apply essential text properties after creation
              if (usableFonts.length > 0 && typeof textMeasurePG.textFont === 'function') {
                   textMeasurePG.textFont(usableFonts[0]); // Use the first usable font for measurement if available
               } else if (baseFont && typeof textMeasurePG.textFont === 'function') {
                   textMeasurePG.textFont(baseFont); // Fallback to monospace string
               }
               if (typeof textMeasurePG.textAlign === 'function') textMeasurePG.textAlign(CENTER, CENTER);
               // console.log("textMeasurePG re-initialized successfully in position function"); // Debugging
         } catch(e) {
              console.error("Failed to re-initialize textMeasurePG:", e);
              textMeasurePG = null; // Set to null if creation failed
         }
     }


    // Position DOM elements
    let headerCenterY = HEADER_HEIGHT / 2;
    const buttonSpacing = 8;
    const rightMargin = 15;

    // Get calculated or default dimensions for elements
    const btnOuterWidth = (btn) => { if (!btn || !btn.elt) return 0; return btn.elt.offsetWidth || 80; }; // Get element's rendered width
    const inputHeight = inputElement ? inputElement.elt.offsetHeight || 30 : 30;

    // Position input element aligned with the left of the canvas area
    if (inputElement) {
        inputElement.position(CANVAS_AREA_X, headerCenterY - inputHeight / 2);
        // Calculate max width for input - up to the start of the buttons
        // Get widths of visible buttons (excluding PDF)
        let visibleButtons = [refreshButton, clearButton, savePNGButton, saveHighResPNGButton].filter(btn => btn !== null);
        let buttonBlockEstimatedWidth = visibleButtons.reduce((sum, btn) => sum + btnOuterWidth(btn), 0) + (visibleButtons.length > 1 ? (visibleButtons.length - 1) * buttonSpacing : 0);

        let maxInputWidth = width - rightMargin - buttonBlockEstimatedWidth - CANVAS_AREA_X - 20; // 20px buffer
        maxInputWidth = max(100, maxInputWidth); // Minimum width for input
        inputElement.size(min(CANVAS_AREA_W, maxInputWidth)); // Input size is min of canvas width or max allowed beside buttons
    }

    // Position buttons right-aligned
    let currentButtonX = width - rightMargin;
    let buttonHeight = (savePNGButton ? savePNGButton.elt.offsetHeight || 30 : HEADER_HEIGHT / 4); // Use one button's height or estimate
    let buttonPadY = headerCenterY - buttonHeight / 2;

    // Position buttons from right to left (Excluding PDF)
    // if (savePDFButton) { currentButtonX -= btnOuterWidth(savePDFButton); savePDFButton.position(currentButtonX, buttonPadY); currentButtonX -= buttonSpacing; } // REMOVED
    if (saveHighResPNGButton) { currentButtonX -= btnOuterWidth(saveHighResPNGButton); saveHighResPNGButton.position(currentButtonX, buttonPadY); currentButtonX -= buttonSpacing; }
    if (savePNGButton) { currentButtonX -= btnOuterWidth(savePNGButton); savePNGButton.position(currentButtonX, buttonPadY); currentButtonX -= buttonSpacing; }
    if (clearButton) { currentButtonX -= btnOuterWidth(clearButton); clearButton.position(currentButtonX, buttonPadY); currentButtonX -= buttonSpacing; }
    if (refreshButton) { currentButtonX -= btnOuterWidth(refreshButton); refreshButton.position(currentButtonX, buttonPadY); /* No spacing after first button */ }
}

function windowResized() {
    // Only resize if the window dimensions have actually changed
    if (windowWidth > 0 && windowHeight > 0 && (windowWidth !== width || windowHeight !== height)) {
        resizeCanvas(windowWidth, windowHeight);
        positionDOMElementsAndCanvasPG(); // Recalculate layout and positions
    } else {
        // console.log("Window resized event fired, but dimensions unchanged or invalid.");
        return; // Avoid unnecessary work if dimensions are the same or invalid
    }
}


function mousePressed() {
    // Ignore clicks in the header area (allows UI elements to be clicked)
    if (mouseY < HEADER_HEIGHT) {
        return true; // Allow default browser behavior (e.g., focusing input)
    }

    // If an item is already grabbed, check if the click is on it again.
    // If so, maybe refocus input, otherwise, ignore click elsewhere.
    if (grabbedItem) {
        if (grabbedItem.isMouseOver(mouseX, mouseY)) {
             if (grabbedItem.type === 'text') inputElement.elt.focus(); // Refocus input
             return false; // Prevent further processing
        } else {
             return false; // Ignore clicks elsewhere while grabbed
        }
    }

    // Check if clicking on a placed item within the canvas area
    if (isMouseOverCanvasArea(mouseX, mouseY)) {
        // Iterate placed items in reverse order (topmost first)
        for (let i = placedItems.length - 1; i >= 0; i--) {
            if (placedItems[i].isMouseOver(mouseX, mouseY)) {
                grabbedItem = placedItems[i];
                grabbedItem.isGrabbed = true;
                grabbedItem.isPlacing = false; // Stop landing animation if active
                grabbedItem.solidify(); // Stop its movement

                // Move the item from placedItems to shapes (shapes includes grabbedItem)
                let temp = placedItems.splice(i, 1)[0];
                shapes.push(temp); // Add to shapes array (at the end)

                // Set input value if it's a text item
                if (grabbedItem.type === 'text') {
                    inputElement.value(grabbedItem.content || '');
                    inputElement.attribute('placeholder', ''); // Clear placeholder when editing
                    inputElement.elt.focus(); // Focus the input
                } else {
                     // Clear input for shape items
                    inputElement.value('');
                    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                     inputElement.elt.blur(); // Remove focus from input
                }
                // console.log("Grabbed placed item:", grabbedItem.type, grabbedItem.shapeType || grabbedItem.content); // Debugging
                return false; // Prevent default browser behavior and further processing
            }
        }
    }

    // If no placed item was clicked, check for floating shapes outside the canvas area
    // Iterate shapes in reverse order (grabbed item is usually last, but check all non-grabbed)
    for (let i = shapes.length - 1; i >= 0; i--) {
        // Only consider shapes that are not currently grabbed
        if (!shapes[i].isGrabbed) {
            if (shapes[i].isMouseOver(mouseX, mouseY)) {
                grabbedItem = shapes[i];
                grabbedItem.isGrabbed = true;
                grabbedItem.isPlacing = false; // Stop any animation
                grabbedItem.solidify(); // Stop its movement

                // Move the grabbed item to the end of the shapes array
                 let temp = shapes.splice(i, 1)[0];
                 shapes.push(temp); // Move to end

                // Set input value if it's a text item
                if (grabbedItem.type === 'text') {
                     inputElement.value(grabbedItem.content || '');
                     inputElement.attribute('placeholder', '');
                     inputElement.elt.focus(); // Focus input
                  } else {
                      inputElement.value('');
                     inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                     inputElement.elt.blur(); // Remove focus
                  }
                  // console.log("Grabbed floating item:", grabbedItem.type, grabbedItem.shapeType || grabbedItem.content); // Debugging
                  return false; // Prevent default behavior
             }
         }
     }

    // If no item was grabbed, allow default behavior (e.g., clicking outside canvas area)
    return true;
}

function mouseReleased() {
    // Only process mouse release if an item was grabbed
    if (grabbedItem) {
        let wasTextItem = grabbedItem.type === 'text';
        grabbedItem.isGrabbed = false; // Ungrab the item

        // Check if the item is released over the central canvas area
        if (isMouseOverCanvasArea(grabbedItem.x, grabbedItem.y)) {
            // Item released over canvas area - Place it
            if (wasTextItem) {
                 // If it's a text item, get the final content from the input field
                 let content = inputElement.value().trim();
                 if (content === "" || content === TEXT_OPTIONS[0].trim()) {
                      // If text is empty or placeholder, remove the item instead of placing
                      shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes
                      grabbedItem = null; // Clear grabbed item
                      inputElement.value(''); // Clear input
                      inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore placeholder
                      inputElement.elt.blur(); // Remove focus
                      // console.log("Discarded empty text item on canvas area release."); // Debugging
                      return; // Exit the function
                 } else {
                    grabbedItem.content = content; // Update content with final text
                 }
            }

            grabbedItem.solidify(); // Ensure movement stops
            // Snap rotation if snap increment is defined and positive
            if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
                grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
            }

            // Move the item from shapes to placedItems
            shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes
            placedItems.push(grabbedItem); // Add to placedItems

            // Start the landing animation
            grabbedItem.isPlacing = true;
            grabbedItem.landFrame = frameCount;
            // console.log("Placed item on canvas area:", grabbedItem.type, grabbedItem.shapeType || grabbedItem.content); // Debugging


        } else {
            // Item released outside canvas area - Let it float away

            if (wasTextItem) {
                 // If text is empty or placeholder when released outside, discard it
                 let content = inputElement.value().trim();
                  if (content === "" || content === TEXT_OPTIONS[0].trim()) {
                      shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes
                       // console.log("Discarded empty text item on outside release."); // Debugging
                       grabbedItem = null; // Clear grabbed item
                       inputElement.value(''); // Clear input
                       inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore placeholder
                       inputElement.elt.blur(); // Remove focus
                       return; // Exit the function
                  } else {
                     grabbedItem.content = content; // Update content with final text
                  }
            }

            // Assign random floating speed and rotation speed
            grabbedItem.speedX = random(-1.5, 1.5);
            grabbedItem.speedY = random(-1.5, 1.5);
            grabbedItem.rotationSpeed = random(-0.003, 0.003);
            grabbedItem.isPlacing = false; // Not placing

             // The item remains in the 'shapes' array where it was moved when grabbed
            // console.log("Released item outside canvas area, letting it float:", grabbedItem.type, grabbedItem.shapeType || grabbedItem.content); // Debugging
        }

        // Clear the grabbed item reference and reset input state
        if (grabbedItem !== null) { // Check if it wasn't discarded
             grabbedItem = null;
             inputElement.value(''); // Clear input
             inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore placeholder
             inputElement.elt.blur(); // Remove focus from input
         }
    }
}

function doubleClicked() {
    // Ignore double clicks in the header area
    if (mouseY < HEADER_HEIGHT) return true;

    // Check if double-clicked on a placed item within the canvas area
    if (isMouseOverCanvasArea(mouseX, mouseY)) {
        // Iterate placed items in reverse order (topmost first)
        for (let i = placedItems.length - 1; i >= 0; i--) {
            let item = placedItems[i];
            if (item.isMouseOver(mouseX, mouseY)) {
                // --- FIX: Move the double-clicked item to the *front* of the array (back layer) ---
                let itemToSendToBack = placedItems.splice(i, 1)[0]; // Remove from current position
                placedItems.unshift(itemToSendToBack); // Add to the beginning
                // --- End FIX ---
                itemToSendToBack.solidify(); // Ensure it remains solid
                // console.log("Sent item to back:", itemToSendToBack.type, itemToSendToBack.shapeType || itemToSendToBack.content); // Debugging
                return false; // Prevent default browser behavior
            }
        }
    }
    // If no placed item was double-clicked, allow default behavior
    return true;
}

function mouseWheel(event) {
    let isOverCanvas = isMouseOverCanvasArea(mouseX, mouseY);

    // Rotate grabbed item or items over the canvas area (placed or floating)
    if (grabbedItem) {
        grabbedItem.rotation += event.delta * 0.002; // Adjust rotation speed based on scroll delta
        return false; // Prevent default page scroll
    } else if (isOverCanvas) {
         // Find item under mouse to rotate (only topmost placed item)
         for (let i = placedItems.length - 1; i >= 0; i--) {
              let item = placedItems[i];
              if (item.isMouseOver(mouseX, mouseY)) {
                  item.rotation += event.delta * 0.002;
                   // item.solidify(); // Might not be needed here
                  return false; // Prevent default page scroll
              }
         }
         // Preventing scroll over empty canvas area feels more intuitive
         return false; // Prevent default page scroll
    }

    // Allow default page scroll otherwise
    return true;
}


function keyPressed() {
    // If input element is focused, allow key presses for typing
    if (document.activeElement === inputElement.elt) {
        // Allow ESC key to blur the input and ungrab item if text
        if (keyCode === ESCAPE && grabbedItem && grabbedItem.type === 'text') {
             inputElement.elt.blur();
             return false; // Prevent default ESC behavior
        }
        return true; // Allow typing in input
    }

    // If focus is on the main p5 canvas (or body if nothing specific is focused)
    if (document.activeElement === document.body || document.activeElement === canvas.elt) {
         // If grabbed item exists, handle scale and delete keys
         if (grabbedItem) {
              const scaleIncrement = 1.08; // Scale up factor
              const scaleDecrement = 1 / scaleIncrement; // Scale down factor
              const minScale = 0.1; // Minimum allowed scale factor
              const maxScale = 5.0; // Maximum allowed scale factor

              // Scale grabbed item with '+'/'=' or '-'
              if (key === '+' || key === '=') {
                  grabbedItem.scaleFactor *= scaleIncrement;
                  grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, maxScale);
                  return false; // Prevent default key behavior
              }
              if (key === '-') {
                  grabbedItem.scaleFactor *= scaleDecrement;
                  grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, minScale);
                   return false; // Prevent default key behavior
              }

              // Delete grabbed item with DELETE or BACKSPACE
              if (keyCode === DELETE || keyCode === BACKSPACE) {
                  shapes = shapes.filter(s => s !== grabbedItem); // Remove from shapes array
                  placedItems = placedItems.filter(s => s !== grabbedItem); // Remove from placedItems array
                   // console.log("Deleted grabbed item."); // Debugging
                  grabbedItem = null; // Clear the grabbed item reference
                  inputElement.value(''); // Clear input
                  inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Restore placeholder
                  inputElement.elt.blur(); // Ensure input is not focused
                  return false; // Prevent default key behavior (e.g., browser back)
              }
               // Allow arrow keys/space etc. to propagate if not handled
              return true;
         }
    }


    // Allow default browser behavior for other keys/focus states
    return true;
}


// Corrected addNewTextShapeFromInput function
function addNewTextShapeFromInput() {
    let currentText = inputElement.value();
    // Check if input is empty, only whitespace, or still the placeholder
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0].trim()) {
        // Provide visual feedback for invalid input
        inputElement.style("border-color", "red");
        setTimeout(() => inputElement.style("border-color", "#ccc"), 500); // Revert color after delay
        inputElement.value('');
        inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
        inputElement.elt.focus(); // Keep focus on input
        return; // Do not create a shape
    }

    let newTextShape = new FloatingShape();

    // reset() is called in constructor, which now assigns a random font from usableFonts and picks shape/text type

    // Explicitly set properties for a text shape from input, overriding reset() if needed
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim();
    newTextShape.shapeType = 'none'; // Text shapes have no underlying geometric shape type

    // Assign a random usable font (reset() already did this, but re-confirm if needed)
     if (usableFonts.length > 0) {
         newTextShape.font = random(usableFonts); // Assign p5.Font object
     } else {
          newTextShape.font = baseFont; // Fallback
     }

    // Set size/scale/textScaleAdjust based on a size category (e.g., medium)
    // Find the medium category or use a fallback definition
    let category = sizeCategories.find(cat => cat.name === 'medium') || { sizeRange: [80, 150], scaleRange: [1.0, 1.5], textScaleAdjust: 0.2 };
    // Use size range as a base for text scaling, scale factor for overall size
    newTextShape.size = random(category.sizeRange[0] * 0.9, category.sizeRange[1] * 1.1); // Base size slightly varied
    newTextShape.scaleFactor = 1.0; // Start with scale 1.0, user can scale later
    newTextShape.textScaleAdjust = category.textScaleAdjust; // Factor to get font size from base size

    // Pick a color, trying to avoid very bright ones for the black background
    let pickedColor;
    let attempts = 0;
    do {
        pickedColor = color(random(PALETTE));
        attempts++;
    } while (attempts < 10 && brightness(pickedColor) > 200); // Avoid bright colors

     // If after attempts it's still bright, force a dark color from a subset
     if (brightness(pickedColor) > 200) {
          pickedColor = color(random(['#0000FE', '#E70012', '#41AD4A', '#000000', '#222222']));
     }
    newTextShape.color = pickedColor;

    // --- Apply Custom SPAWN LOCATION for new text (near artboard sides), OVERRIDING reset() position/speed ---
    // Attempt to spawn new text near the left or right edge of the canvas area
    let spawnMargin = 60; // Distance from canvas area edges to spawn
    let spawnedCustom = false;

    // Check available space on left and right sides of the canvas area
    let leftSpace = CANVAS_AREA_X;
    let rightSpace = width - (CANVAS_AREA_X + CANVAS_AREA_W);

    let spawnSide;
    // Bias spawning towards the side with more space
    if (leftSpace > rightSpace * 1.5) {
        spawnSide = 'left';
    } else if (rightSpace > leftSpace * 1.5) {
        spawnSide = 'right';
    } else {
        // If space is roughly equal, pick randomly
        spawnSide = random() > 0.5 ? 'right' : 'left';
    }

    if (spawnSide === 'left' && leftSpace > spawnMargin * 1.5) {
        // Spawn on the left side if there's enough space
        newTextShape.x = random(spawnMargin, CANVAS_AREA_X - spawnMargin);
        newTextShape.speedX = random(0.5, 1.5); // Float towards the center
        spawnedCustom = true;
    } else if (spawnSide === 'right' && rightSpace > spawnMargin * 1.5) {
        // Spawn on the right side if there's enough space
        newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W + spawnMargin, width - spawnMargin);
        newTextShape.speedX = random(-1.5, -0.5); // Float towards the center
        spawnedCustom = true;
    }

    if (spawnedCustom) {
        // If custom side spawn happened, set Y position and vertical speed
        newTextShape.y = random(CANVAS_AREA_Y - spawnMargin, CANVAS_AREA_Y + CANVAS_AREA_H + spawnMargin);
        // Ensure Y is within screen bounds + margin, considering header
         newTextShape.y = max(newTextShape.y, HEADER_HEIGHT + spawnMargin); // Below header
         newTextShape.y = min(newTextShape.y, height - spawnMargin); // Above bottom edge

        newTextShape.speedY = random(-0.5, 0.5); // Gentle vertical movement
        newTextShape.rotation = random(TWO_PI);
        newTextShape.rotationSpeed = random(-0.001, 0.001); // Slow rotation
         // console.log("Spawned new text shape custom:", newTextShape.x, newTextShape.y); // Debugging

    } else {
         // Fallback: If custom spawn failed (e.g., window too narrow), use the default reset() values
         // console.log("Custom text spawn failed, using default reset() values."); // Debugging
    }
    // --- End Custom SPAWN LOCATION ---


    // Set initial state - not grabbed, not placing
    newTextShape.isGrabbed = false;
    newTextShape.isPlacing = false;

    // Add the new shape to the floating shapes array
    shapes.push(newTextShape);
    // console.log("Added new text shape from input. Total shapes:", shapes.length); // Debugging


    // Clear the input field and reset placeholder/focus
    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    inputElement.elt.focus(); // Keep focus on input ready for next text
}

// Checks if the mouse (or a point) is currently over the central canvas area.
function isMouseOverCanvasArea(pX, pY) {
    const checkX = pX === undefined ? mouseX : pX; // Use mouseX/Y if no point provided
    const checkY = pY === undefined ? mouseY : pY;
    // Check if the point is within the bounds of the canvas area rectangle
    return checkX >= CANVAS_AREA_X && checkX <= CANVAS_AREA_X + CANVAS_AREA_W &&
           checkY >= CANVAS_AREA_Y && checkY <= CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Snaps an angle in radians to the nearest increment.
function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0 || isNaN(incrementRadians)) return angleRadians; // No snap if increment is invalid
    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI; // Normalize angle to 0 to TWO_PI
    let numIncrements = round(angleRadians / incrementRadians); // Find which increment is closest
    let snapped = numIncrements * incrementRadians; // Calculate the snapped angle
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI; // Normalize the snapped angle
    return snapped;
}

// Generates a timestamp string for filenames.
function generateTimestampString() {
    let d = new Date();
    // Format: YYYYMMDD_HHMMSS
    return d.getFullYear() + nf(d.getMonth() + 1, 2) + nf(d.getDate(), 2) + '_' + nf(d.getHours(), 2) + nf(d.getMinutes(), 2) + nf(d.getSeconds(), 2);
}

// Saves the central canvas area buffer as a standard resolution PNG.
function saveCanvasAreaAsPNG() {
    // Check if the buffer is available and valid
    if (!canvasPG || canvasPG.width <= 0 || canvasPG.height <= 0) {
        alert("Error: Cannot save standard PNG. Canvas area buffer is not available or invalid.");
        // console.error("Canvas area buffer is invalid:", canvasPG); // Debugging
        return;
    }

    // Create a temporary graphics buffer to draw the content and border for saving
    let saveBuffer = null;
    try {
        saveBuffer = createGraphics(canvasPG.width, canvasPG.height);
        saveBuffer.image(canvasPG, 0, 0); // Copy the content from the main buffer

        // Draw border on the save buffer
        saveBuffer.push();
        saveBuffer.stroke(0); // Black border
        saveBuffer.strokeWeight(1);
        saveBuffer.noFill();
        // Draw the border slightly inward
        saveBuffer.rect(0.5, 0.5, saveBuffer.width - 1, saveBuffer.height - 1);
        saveBuffer.pop();

        // Save the temporary buffer
        saveCanvas(saveBuffer, 'myArtboard_stdres_' + generateTimestampString() + '.png');
         // console.log("Saved standard PNG."); // Debugging

    } catch (e) {
        console.error("Error during standard PNG save:", e);
        alert("Error saving standard PNG. Check browser console for details.");
    } finally {
         // Clean up the temporary buffer
        if (saveBuffer) { saveBuffer.remove(); }
    }
}

// Saves the central canvas area content as a high-resolution PNG.
function saveCanvasAreaAsHighResPNG() {
    // Check if the base canvas area dimensions are valid
    if (CANVAS_AREA_W_BASE <= 0 || isNaN(CANVAS_AREA_W_BASE)) {
         alert("Error: Cannot save high-resolution PNG. Base canvas width is invalid.");
         // console.error("CANVAS_AREA_W_BASE is invalid:", CANVAS_AREA_W_BASE); // Debugging
         return;
    }

    // Define target resolution and paper size (B2 at 300 DPI as requested)
    const TARGET_DPI = 300;
    const B2_WIDTH_INCHES = 500 / 25.4; // B2 width in mm converted to inches
    const B2_HEIGHT_INCHES = 707 / 25.4; // B2 height in mm converted to inches

    // Calculate target pixel dimensions
    const targetWidthPixels = round(B2_WIDTH_INCHES * TARGET_DPI);
    const targetHeightPixels = round(B2_HEIGHT_INCHES * TARGET_DPI);

     if (targetWidthPixels <= 0 || targetHeightPixels <= 0 || isNaN(targetWidthPixels) || isNaN(targetHeightPixels)) {
          alert("Error calculating high-res save size. Target dimensions invalid.");
         // console.error("Calculated high-res dimensions invalid:", targetWidthPixels, targetHeightPixels); // Debugging
          return;
     }

    // Calculate the scaling factor from our base width to the target pixel width
    const scaleFactor = targetWidthPixels / CANVAS_AREA_W_BASE;
    // Calculate the scaled height of our 4:5 artboard content at this scale
    const scaledSourceHeight = CANVAS_AREA_W_BASE * (5/4) * scaleFactor;

    // Calculate vertical offset needed to center the scaled artboard content on the target paper size height
    const verticalOffset = (targetHeightPixels - scaledSourceHeight) / 2;

    let highResPG = null;
    try {
        // Create a graphics buffer for high-resolution drawing
        highResPG = createGraphics(targetWidthPixels, targetHeightPixels);
        highResPG.background(255); // White background for the output file

        // Iterate through placed items and draw them onto the high-res buffer
        for (let i = 0; i < placedItems.length; i++) {
            let item = placedItems[i];

            // Skip drawing empty text items
            if (item.type === 'text' && (!item.content || item.content.trim() === "" || item.content.trim() === TEXT_OPTIONS[0].trim())) {
                continue;
            }
             // Skip drawing items with invalid size/scale
            if (item.scaleFactor <= 0 || item.size <= 0 || isNaN(item.scaleFactor) || isNaN(item.size)) continue;


            highResPG.push(); // Save the current graphics state

            // Calculate the item's position in the high-res buffer.
            // It's based on its position relative to the *original* canvas area (CANVAS_AREA_X/Y),
            // scaled up, and offset vertically to center on the B2 paper.
            let hrItemX = (item.x - CANVAS_AREA_X) * scaleFactor;
            let hrItemY = (item.y - CANVAS_AREA_Y) * scaleFactor + verticalOffset;

             // Sanity check calculated position
             if (isNaN(hrItemX) || isNaN(hrItemY)) {
                  // console.warn("Calculated NaN position for item during HIRES save:", item.type, hrItemX, hrItemY); // Debugging
                  highResPG.pop(); // Restore state
                  continue; // Skip this item
             }

            highResPG.translate(hrItemX, hrItemY);
            highResPG.rotate(item.rotation);

            // Apply the item's original scale factor AND the overall high-res scale factor
            let combinedScale = item.scaleFactor * scaleFactor;
             if (combinedScale <= 0 || isNaN(combinedScale)) combinedScale = 1e-6; // Ensure scale is positive for drawing
            highResPG.scale(combinedScale);

            // Set fill and stroke properties for the item
            highResPG.fill(item.color);
            highResPG.noStroke();

             // Prepare font and text size for text items
            let itemFont = item.font;
            let itemTextScale = isNaN(item.textScaleAdjust) ? 0.2 : item.textScaleAdjust;
            itemTextScale = max(itemTextScale, 1e-3); // Ensure text scale adjust is positive

             // Set the font on the high-res buffer context
             // Check if itemFont is a valid p5.Font object (truthy) before using it
            if (itemFont && typeof itemFont === 'object' && typeof itemFont.textWidth === 'function' && typeof highResPG.textFont === 'function') {
                highResPG.textFont(itemFont); // Use the p5.Font object
            } else if (typeof highResPG.textFont === 'function') {
                 // Fallback on highResPG if the specific item font is bad
                 if (usableFonts.length > 0 && typeof usableFonts[0].textWidth === 'function') highResPG.textFont(usableFonts[0]); // Use first usable if available
                 else highResPG.textFont(baseFont); // Fallback string
            }
             // textAlign is set inside drawShapePrimitive for text

            // Draw the item's primitive shape or text
            item.drawShapePrimitive(highResPG, 0, 0, item.size, item.shapeType, item.type === 'text', itemTextScale);

            highResPG.pop(); // Restore the previous graphics state
        }

        // Draw border around the scaled artboard area within the high-res buffer
        highResPG.push();
        highResPG.stroke(0); // Black border
        // Scale border weight proportionally
        let borderWeight = 1 * scaleFactor;
        borderWeight = max(borderWeight, 0.5); // Minimum border weight
        highResPG.strokeWeight(borderWeight);
        highResPG.noFill();
        let borderRectX = borderWeight / 2; // Position border considering weight
        let borderRectY = verticalOffset + borderWeight / 2;
        let borderRectW = targetWidthPixels - borderWeight;
        let borderRectH = scaledSourceHeight - borderWeight;
         // Draw border only if dimensions are valid
         if (borderRectW > 0 && borderRectH > 0) {
              highResPG.rect(borderRectX, borderRectY, borderRectW, borderRectH);
         } else {
             // console.warn("High-res border dimensions invalid:", borderRectW, borderRectH); // Debugging
         }
        highResPG.pop();

        // Save the high-res buffer as a PNG file
         if (targetWidthPixels > 0 && targetHeightPixels > 0) {
             saveCanvas(highResPG, `myArtboard_HIRES_${targetWidthPixels}x${targetHeightPixels}_` + generateTimestampString() + '.png');
              // console.log("Saved high-res PNG:", targetWidthPixels, "x", targetHeightPixels); // Debugging
         } else {
              alert("Error: High-resolution save dimensions became invalid during processing.");
         }

    } catch (e) {
        console.error("Error during high-resolution PNG save:", e);
        alert("Error saving high-resolution PNG. Check browser console for technical details.");
        // Attempt to gracefully end recording if it was started (less common for saveCanvas with a buffer)
        if (highResPG && typeof highResPG.isRecording === 'boolean' && highResPG.isRecording && typeof highResPG.endRecord === 'function') {
            try { highResPG.endRecord(); } catch (endErr) { /* ignore */ }
        }
    } finally {
        // Ensure the temporary high-res buffer is removed
        if (highResPG) {
             highResPG.remove();
        }
    }
}

// saveCanvasAreaAsPDF function REMOVED

// Resets the floating shapes to a new random set.
function resetRandom() {
    // Preserve the grabbed item if it's currently floating (not placed)
    let tempGrabbedItem = grabbedItem;
    let wasFloating = tempGrabbedItem && shapes.includes(tempGrabbedItem); // Check if grabbed item was in 'shapes'

    // If the grabbed item was floating, remove it temporarily from the shapes array
    if (wasFloating) {
        shapes = shapes.filter(s => s !== tempGrabbedItem);
    }

    shapes = []; // Clear current floating shapes

    // Populate with a new set of random shapes
    while (shapes.length < 30) {
        let newShape = new FloatingShape();
        shapes.push(newShape);
    }
     // console.log("Reset random shapes. Total shapes:", shapes.length); // Debugging


    // Re-add the grabbed item if it was originally floating
    if (wasFloating && tempGrabbedItem) {
        shapes.push(tempGrabbedItem);
        // Note: Grabbed item's position/state remains unchanged
    }
}

// Clears all placed items and resets floating shapes and grabbed item.
function restartAll() {
    placedItems = []; // Clear all placed items
    shapes = []; // Clear all floating/grabbed shapes
    grabbedItem = null; // Clear grabbed item

    // Reset input element
    inputElement.value('');
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
    inputElement.elt.blur(); // Remove focus

    // Clear the canvas area buffer visual
    if (canvasPG) {
        canvasPG.clear();
         canvasPG.background(255); // Reset to white
    }

    // Populate with a new set of random shapes
    while (shapes.length < 30) { shapes.push(new FloatingShape()); }
    // console.log("Restarted all. Total shapes:", shapes.length); // Debugging
}


let touchGrabbed = false; // Flag to indicate if a touch started a grab
let lastTapTime = 0; // To detect double tap

function touchStarted(event) {
    // Only handle the first touch point
    if (touches.length === 0) return true;
    let touchX = touches[0].x;
    let touchY = touches[0].y;

    // Ignore touches in the header area
    if (touchY < HEADER_HEIGHT) {
         if (event.cancelable) event.preventDefault(); // Prevent default browser behavior
        return true; // Allow UI interaction
    }

    // Check for double tap to send item to back
    let currentTime = millis();
    let tapDelay = currentTime - lastTapTime;
    lastTapTime = currentTime; // Update last tap time

    if (tapDelay < 250 && tapDelay > 50) { // Check for a tap within double-tap time window (50ms to 250ms)
         // Perform double-click logic for the touch coordinates
         let doubleTapHandled = false;
         if (isMouseOverCanvasArea(touchX, touchY)) {
             for (let i = placedItems.length - 1; i >= 0; i--) {
                 let item = placedItems[i];
                 // Use isMouseOver with touch coordinates
                 if (item.isMouseOver(touchX, touchY)) {
                      // --- FIX: Move the double-tapped item to the *front* of the array (back layer) ---
                     let itemToSendToBack = placedItems.splice(i, 1)[0]; // Remove from current position
                     placedItems.unshift(itemToSendToBack); // Add to the beginning
                     // --- End FIX ---
                     itemToSendToBack.solidify(); // Ensure it stays placed
                     doubleTapHandled = true;
                     // console.log("Double tapped placed item."); // Debugging
                     break; // Found and handled double tap, exit loop
                 }
             }
         }
         if (doubleTapHandled) {
              // Prevent default browser action (like zoom) only if a placed item was double-tapped
              if (event.cancelable) event.preventDefault();
              return false; // Double tap handled, stop processing
         }
         // If double tap detected but didn't hit a placed item, still potentially prevent default zoom/scroll on some devices
         // Let's rely on the general preventDefault at the end if needed, or let it fall through.
         // Letting it fall through seems safer to allow other touch interactions.
    }


    // If an item is already grabbed by touch, check if the touch is continuing on it
    if (grabbedItem) {
        if (grabbedItem.isMouseOver(touchX, touchY)) {
             touchGrabbed = true; // Confirm grabbed by this touch
              if (event.cancelable) event.preventDefault(); // Prevent default browser behavior (scroll, zoom)
            return false; // Touch handled
        } else {
             // Touch started elsewhere while an item is grabbed - ignore or potentially drop?
             // Ignoring seems safer for now.
             // Prevent default if the touch is within the canvas area or on a shape
             if (touchY >= HEADER_HEIGHT) { // Below header
                // Check if touch is on *any* shape (even if not grabbed) or within the canvas area
                let isOverAnyShape = shapes.some(s => s.isMouseOver(touchX, touchY)) || placedItems.some(p => p.isMouseOver(touchX, touchY));
                if (isOverAnyShape || isMouseOverCanvasArea(touchX, touchY)) {
                     if (event.cancelable) event.preventDefault();
                }
             }
            return false; // Touch handled (ignored)
        }
    }

    // If no item is grabbed, check if a touch is over a placed item
    if (isMouseOverCanvasArea(touchX, touchY)) {
        for (let i = placedItems.length - 1; i >= 0; i--) {
            if (placedItems[i].isMouseOver(touchX, touchY)) {
                grabbedItem = placedItems[i];
                grabbedItem.isGrabbed = true; // Mark as grabbed
                grabbedItem.isPlacing = false; // Stop landing animation
                grabbedItem.solidify(); // Stop movement

                // Move item from placed to shapes array
                let temp = placedItems.splice(i, 1)[0];
                shapes.push(temp);

                // Set input value if text item
                 if (grabbedItem.type === 'text') {
                     inputElement.value(grabbedItem.content || '');
                     inputElement.attribute('placeholder', '');
                     // Note: inputElement.elt.focus() might not work reliably on touch without a user gesture
                 } else {
                     inputElement.value('');
                     inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                 }


                touchGrabbed = true; // Mark as grabbed by touch
                 if (event.cancelable) event.preventDefault(); // Prevent default behavior
                return false; // Touch handled
            }
        }
    }

    // If no placed item was touched, check for floating shapes
    for (let i = shapes.length - 1; i >= 0; i--) {
         // Only consider shapes that are not currently grabbed (should always be true here)
        if (!shapes[i].isGrabbed) {
            if (shapes[i].isMouseOver(touchX, touchY)) {
                grabbedItem = shapes[i];
                grabbedItem.isGrabbed = true;
                grabbedItem.isPlacing = false;
                grabbedItem.solidify();

                // Move grabbed item to end of shapes array
                 let temp = shapes.splice(i, 1)[0];
                 shapes.push(temp);

                // Set input value if text item
                 if (grabbedItem.type === 'text') {
                     inputElement.value(grabbedItem.content || '');
                     inputElement.attribute('placeholder', '');
                 } else {
                     inputElement.value('');
                     inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
                 }

                touchGrabbed = true; // Mark as grabbed by touch
                 if (event.cancelable) event.preventDefault(); // Prevent default behavior
                return false; // Touch handled
            }
        }
    }

    // If no item was touched, prevent default behavior (e.g., scrolling outside header/canvas)
     // Prevent default if the touch is anywhere below the header.
     if (touchY >= HEADER_HEIGHT) {
         if (event.cancelable) event.preventDefault();
     }
    return true; // Allow other potential handlers to run if needed
}

function touchMoved(event) {
     // Only handle touch move if an item is grabbed by touch
    if (grabbedItem && touchGrabbed) {
        // Only handle the first touch point for dragging
        if (touches.length > 0) {
            let touchX = touches[0].x;
            let touchY = touches[0].y;

            // Smoothly move the grabbed item towards the touch position
            grabbedItem.x = lerp(grabbedItem.x, touchX, 0.4);
            grabbedItem.y = lerp(grabbedItem.y, touchY, 0.4);

             if (event.cancelable) event.preventDefault(); // Prevent default browser behavior (scrolling, zoom)
            return false; // Touch move handled
        }
    } else if (touches.length > 0 && touches[0].y >= HEADER_HEIGHT) {
        // Prevent default scroll/zoom if touch starts below the header, even if no item is grabbed
         if (event.cancelable) event.preventDefault();
          return false; // Indicate touch was within interactive area
    }
    // Allow default browser behavior otherwise
    return true;
}

function touchEnded(event) {
     // Only process touch end if an item was grabbed by touch
    if (grabbedItem && touchGrabbed) {
        // Simulate mouse release logic for dropping the item
        mouseReleased();
        touchGrabbed = false; // Reset touch grabbed flag

         if (event.cancelable) event.preventDefault(); // Prevent default browser behavior (e.g., click after tap)
        return false; // Touch end handled
    }

    // Allow default browser behavior if no item was grabbed by touch
    return true;
}