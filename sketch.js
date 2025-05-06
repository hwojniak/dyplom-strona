// Interactive canvas website-tool project using p5.js

let shapes = []; // Shapes currently floating or grabbed
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged

// UI Element References (DOM elements need global vars if you create them this way)
let inputElement;
let savePNGButton; // Renamed for clarity
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
  '#FFFFFF',  // White
  '#FFA500', // Added Orange
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


// --- Utility functions for precise mouse collision ---

function transformPointToLocal(gx, gy, objX, objY, objRotation, objScale) {
  let tx = gx - objX;
  let ty = gy - objY;
  let cosAngle = cos(-objRotation);
  let sinAngle = sin(-objRotation);
  let rx = tx * cosAngle - ty * sinAngle;
  let ry = tx * sinAngle + ty * cosAngle;
   // Protect against division by zero
  let localX = (objScale === 0) ? 0 : rx / objScale;
  let localY = (objScale === 0) ? 0 : ry / objScale;
  return { x: localX, y: localY };
}

function isPointInAxisAlignedRect(px, py, w, h) {
    let halfW = w / 2;
    let halfH = h / 2;
    return px >= -halfW && px <= halfW && py >= -halfH && py <= halfH;
}

function getTriangleVertices(size) {
    let heightBased = size * 0.8;
    let baseWidthBased = size * 0.8;
    let baseY = size * 0.4;
    return [
        { x: 0, y: -heightBased },
        { x: -baseWidthBased, y: baseY },
        { x: baseWidthBased, y: baseY }
    ];
}

function getSquareVertices(size) {
    let halfSize = size / 2;
    return [
        { x: -halfSize, y: -halfSize },
        { x: halfSize, y: -halfSize },
        { x: halfSize, y: halfSize },
        { x: -halfSize, y: halfSize }
    ];
}

function getPentagonVertices(size) {
    let sides = 5;
    let radius = size * 0.7;
    let vertices = [];
    for (let a = 0; a < TWO_PI; a += TWO_PI / sides) {
      let sx = cos(a - HALF_PI) * radius;
      let sy = sin(a - HALF_PI) * radius;
      vertices.push({ x: sx, y: sy });
    }
    return vertices;
}

function getHexagonVertices(size) {
     let sides = 6;
     let radius = size;
    let vertices = [];
     for (let a = 0; a < TWO_PI; a += TWO_PI / sides) {
       let sx = cos(a) * radius;
       let sy = sin(a) * radius;
       vertices.push({ x: sx, y: sy });
     }
    return vertices;
}

// Checks if a point (px, py) is inside a convex polygon defined by its vertices
function isPointInConvexPolygon(px, py, vertices) {
  let numVertices = vertices.length;
  if (numVertices < 3) return false;

  let has_pos = false;
  let has_neg = false;

  for (let i = 0; i < numVertices; i++) {
    let v1 = vertices[i];
    let v2 = vertices[(i + 1) % numVertices];
    let cross_product = (v2.x - v1.x) * (py - v1.y) - (v2.y - v1.y) * (px - v1.x);
    if (cross_product > 0) has_pos = true;
    if (cross_product < 0) has_neg = true;
    if (has_pos && has_neg) return false;
  }
  return true;
}

// Calculates the bounding box for a text string centered at (0,0) in local space
// Requires temporary graphics context to use textWidth, textAscent/Descent accurately with the font
function getTextBounds(content, effectiveTextSize, baseFontRef) {
    // We need an *actual* graphics context instance to reliably measure text.
    // If we are inside a drawing context (main sketch 'this' or canvasPG), we can potentially use the global text metrics functions,
    // BUT they rely on the currently active context properties.
    // Using a temporary graphics buffer provides an isolated context for accurate measurement.
    // A simple trick in p5.js: the main sketch context itself can often be used if called during draw().
    // Let's try using the current graphics context ('this' inside draw functions or provided 'graphics' param).

     // Attempt 1: Use global p5 functions assuming text properties are set on 'graphics'
     // This works if this function is called from within display(), passing 'graphics'.
     let textW = graphics.textWidth(content); // Access textWidth from the graphics object
     let textH = graphics.textAscent() + graphics.textDescent(); // Access metrics from graphics object

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

    let minSpeed = 1.5;
    let maxSpeed = 4;

    switch (edge) {
      case 0: // Top
        this.x = width * posAlong;
        this.y = -this.currentSize * random(0.5, 1.5);
        this.speedX = random(-2, 2);
        this.speedY = random(minSpeed, maxSpeed);
        break;
      case 1: // Right
        this.x = width + this.currentSize * random(0.5, 1.5);
        this.y = height * posAlong;
        this.speedX = random(-maxSpeed, -minSpeed);
        this.speedY = random(-2, 2);
        break;
      case 2: // Bottom
        this.x = width * posAlong;
        this.y = height + this.currentSize * random(0.5, 1.5);
        this.speedX = random(-2, 2);
        this.speedY = random(-maxSpeed, -minSpeed);
        break;
      case 3: // Left
        this.x = -this.currentSize * random(0.5, 1.5);
        this.y = height * posAlong;
        this.speedX = random(minSpeed, maxSpeed);
        this.speedY = random(-2, 2);
        break;
    }

    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.005, 0.005) * random(1, 4);

    let pickedColor;
    do {
        pickedColor = color(random(PALETTE));
    } while (brightness(pickedColor) < 50);
    this.color = pickedColor;

    this.type = random() < 0.8 ? 'shape' : 'text';

    if (this.type === 'shape') {
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']);
        this.textScaleAdjust = 0; // Not applicable
    } else {
         this.shapeType = 'none';
         this.content = random(TEXT_OPTIONS.slice(1));
         this.textScaleAdjust = category.textScaleAdjust;
    }

    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1;
  }

  update() {
     this.x += this.speedX;
     this.y += this.speedY;
     this.rotation += this.rotationSpeed;
     this.currentSize = this.size * this.scaleFactor;
  }

   isReallyOffScreen() {
      let maxDimension = max(this.size * this.scaleFactor, this.size * this.scaleFactor);
      let safePadding = max(width, height) * 0.3;
      let margin = maxDimension + safePadding;
       return this.x < -margin || this.x > width + margin ||
              this.y < -margin || this.y > height + margin;

  }

  updateLanding() {
    if(this.isPlacing && !this.isGrabbed) { // Only update landing if NOT grabbed
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
         this.tempScaleEffect = 1; // Ensure scale effect is reset if not placing
    }
  }


   // Displays the shape/text onto the provided graphics context (e.g., main canvas 'this', or canvasPG buffer, or PDF context during beginPDF)
   // ctx: the p5 graphics context to draw on.
   // isGrabbed: boolean, applies visual effects on ctx if true (only for drawing on main canvas 'this').
   // originX, originY: offsets the drawing coordinates, typically 0,0 for main canvas or canvas area corner for canvasPG/PDF.
  display(ctx, isGrabbed = false, originX = 0, originY = 0) {
    ctx.push();
    // Translate to position relative to the ctx's origin
    let displayX = this.x - originX;
    let displayY = this.y - originY;
    ctx.translate(displayX, displayY); // Translate first
    ctx.rotate(this.rotation); // Then rotate

    // Apply temporary landing scale effect only when NOT grabbed and IS placing
    let currentDisplayScale = this.scaleFactor * (!this.isGrabbed && this.isPlacing ? this.tempScaleEffect : 1);
    ctx.scale(currentDisplayScale); // Then scale


    // Draw grabbed effect only on the main canvas
    if (isGrabbed && ctx === this) {
         ctx.drawingContext.shadowBlur = 40;
         ctx.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
         ctx.stroke(255, 255, 255, 200);
         ctx.strokeWeight(3);
         ctx.noFill();
          // Need to pass graphics context to drawShapePrimitive for text bounds calculation fallback
         this.drawShapePrimitive(ctx, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust, ctx);
         ctx.drawingContext.shadowBlur = 0;
         ctx.noStroke(); // Ensure main fill has no stroke
    }

    // Draw the main shape/text
    ctx.fill(this.color);
    ctx.noStroke();
     // Pass graphics context to drawShapePrimitive for text bounds calculation fallback
    this.drawShapePrimitive(ctx, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust, ctx);
    ctx.pop();
  }

  // Draws the raw geometric primitive or text centered at (px, py) with base size (psize)
  // Assumes appropriate transformations have been applied.
  // Requires passing the graphics context 'graphics' for getTextBounds measurement within drawShapePrimitive for text.
  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        if (isText) {
             graphics.textFont(baseFont);
             graphics.textAlign(CENTER, CENTER);
             let effectiveTextSize = psize * textScaleAdjust;
             graphics.textSize(effectiveTextSize);
              // Using the provided graphics context to measure textBounds here
             // getTextBounds will use graphics.textWidth, graphics.textAscent/Descent
              // The text() function below will draw onto 'graphics'.
             graphics.text(this.content, px, py);
         } else {
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
                  let sidesP = 5;
                  let radiusP = psize * 0.7;
                  for (let a = 0; a < TWO_PI; a += TWO_PI / sidesP) {
                    let sx = cos(a - HALF_PI) * radiusP;
                    let sy = sin(a - HALF_PI) * radiusP;
                    graphics.vertex(px + sx, py + sy);
                  }
                  graphics.endShape(CLOSE);
                 break;
               case 'hexagon':
                 graphics.beginShape();
                  let sidesH = 6;
                  let radiusH = psize;
                  for (let a = 0; a < TWO_PI; a += TWO_PI / sidesH) {
                    let sx = cos(a) * radiusH;
                    let sy = sin(a) * radiusH;
                    graphics.vertex(px + sx, py + sy);
                  }
                 graphics.endShape(CLOSE);
                 break;
               default:
                   console.warn("Drawing unknown shape type:", pshapeType);
                   graphics.rect(px, py, psize * 0.8, psize * 0.8);
                  break;
             }
         }
   }


   // Checks if the mouse (mx, my in global coordinates) is over the shape.
   // graphics is needed here to get text bounds using the correct font context
  isMouseOver(mx, my, graphics) {
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my) || isNaN(this.rotation) || isNaN(this.scaleFactor)) {
            console.error("NaN found in isMouseOver during calculation:", this, " Mouse:", mx, my);
            return false;
       }
        if (this.scaleFactor <= 0) return false;


       let localMouse = transformPointToLocal(
           mx, my,
           this.x, this.y,
           this.rotation,
           this.scaleFactor
       );
       let localMx = localMouse.x;
       let localMy = localMouse.y;


       if (this.type === 'text') {
           // For text, check if the local mouse point is inside the axis-aligned bounding box
           // Must ensure text properties are set *before* measuring bounds, using the passed graphics context.
           graphics.push(); // Save graphics state
           graphics.textFont(baseFont);
           graphics.textSize(this.size * this.textScaleAdjust);
           graphics.textAlign(CENTER, CENTER); // Match drawing alignment

           let textBounds = getTextBounds(this.content, this.size * this.textScaleAdjust, baseFont, graphics);

           graphics.pop(); // Restore graphics state

           return isPointInAxisAlignedRect(localMx, localMy, textBounds.w, textBounds.h);

       } else { // type is 'shape'
           switch (this.shapeType) {
              case 'circle':
                  return dist(localMx, localMy, 0, 0) < this.size;

              case 'square':
                   return isPointInAxisAlignedRect(localMx, localMy, this.size, this.size);

              case 'triangle':
                  let triVertices = getTriangleVertices(this.size);
                  return isPointInConvexPolygon(localMx, localMy, triVertices);

              case 'pentagon':
                  let pentVertices = getPentagonVertices(this.size);
                  return isPointInConvexPolygon(localMx, localMy, pentVertices);

              case 'hexagon':
                  let hexVertices = getHexagonVertices(this.size);
                  return isPointInConvexPolygon(localMx, localMy, hexVertices);

              default:
                  console.warn("Collision check for unknown shape type:", this.shapeType);
                  return false;
           }
       }
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
  // try { baseFont = loadFont('path/to/your/pixel_font.ttf'); } catch (e) {
     console.warn("Custom font not loaded, using default:", baseFont);
  // }
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  SNAP_INCREMENT_RADIANS = radians(15);

  CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4);
  CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
  CANVAS_AREA_Y = HEADER_HEIGHT + 20;

  let headerCenterY = HEADER_HEIGHT / 2;

  inputElement = createInput();
  inputElement.value(''); // Start empty for placeholder
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]);

  // Position and style input field
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
  inputElement.size(CANVAS_AREA_W);
  inputElement.style("padding", "5px 10px");
  inputElement.style("border", "1px solid #ccc");
  inputElement.style("border-radius", "15px");
  inputElement.style("outline", "none");
  inputElement.style("background-color", color(255, 255, 255, 200));
  inputElement.style("font-size", "14px");
  inputElement.style("color", color(50));


  // Add event listener for Enter keypress on input
  inputElement.elt.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      addNewTextShapeFromInput();
      event.preventDefault();
    }
  });


  // Button setup and styling (positioned relative to the right side)
  let buttonSpacing = 10;
  let buttonHeight = 30; // For vertical centering
  let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2;


  // Buttons for SAVE PNG and SAVE PDF, along with REFRESH and CLEAR
  savePDFButton = createButton("SAVE PDF");
   savePDFButton.style("padding", "5px 10px");
   savePDFButton.style("border", "1px solid #888");
   savePDFButton.style("border-radius", "15px");
   savePDFButton.style("background-color", color(200));
   savePDFButton.style("color", color(50));
   savePDFButton.mousePressed(saveCanvasAreaAsPDF); // New PDF save function

  savePNGButton = createButton("SAVE PNG"); // Renamed from saveButton
   savePNGButton.style("padding", "5px 10px");
   savePNGButton.style("border", "1px solid #888");
   savePNGButton.style("border-radius", "15px");
   savePNGButton.style("background-color", color(200));
   savePNGButton.style("color", color(50));
   savePNGButton.mousePressed(saveCanvasAreaAsPNG); // Updated handler name


  clearButton = createButton("CLEAR");
   clearButton.style("padding", "5px 10px");
   clearButton.style("border", "1px solid #888");
   clearButton.style("border-radius", "15px");
   clearButton.style("background-color", color(200));
   clearButton.style("color", color(50));
   clearButton.mousePressed(restartAll);

  refreshButton = createButton("REFRESH");
   refreshButton.style("padding", "5px 10px");
   refreshButton.style("border", "1px solid #888");
   refreshButton.style("border-radius", "15px");
   refreshButton.style("background-color", color(200));
   refreshButton.style("color", color(50));
   refreshButton.mousePressed(resetRandom);

   // Call windowResized once initially to position DOM elements correctly
   windowResized();


  // Create initial floating shapes
  for (let i = 0; i < 30; i++) {
    shapes.push(new FloatingShape());
  }

   // Create the canvas graphics buffer
  canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
}

let canvasPG; // Global reference to graphics buffer

function draw() {
  background(0);

  // Update and draw floating/grabbed shapes
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing);
  while (shapes.length < 20) {
      shapes.push(new FloatingShape());
  }
  for (let shape of shapes) {
     if (!shape.isGrabbed && !shape.isPlacing) {
       shape.update();
     }
     // Use the display method with 'this' (the main canvas context) and default origin 0,0
     shape.updateLanding(); // Update landing state regardless
     shape.display(this, shape.isGrabbed);
  }

  // --- Central White Canvas Area ---
  canvasPG.clear();
  canvasPG.background(255);

  // Draw placed items onto the central canvas graphics buffer (canvasPG)
  // Placed items filter already done in mouseReleased on drop
  for (let i = placedItems.length - 1; i >= 0; i--) {
      let item = placedItems[i];
       item.updateLanding();
       // Use the display method with canvasPG and the canvas area origin as offset
      item.display(canvasPG, false, CANVAS_AREA_X, CANVAS_AREA_Y);
  }

  // Draw the graphics buffer onto the main canvas
  image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);

  // Draw border around canvas area on the main canvas
  stroke(200);
  noFill();
  rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);


  // Draw grabbed item on top of everything else
  if (grabbedItem) {
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.3);
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.3);
     // Use display method with 'this' (main canvas) and isGrabbed = true
     grabbedItem.display(this, true);
  }

  // --- DRAW HEADER / UI OVERLAY ---
  fill(220);
  noStroke();
  rect(0, 0, width, HEADER_HEIGHT);

  fill(50);
  textSize(20);
  textAlign(LEFT, CENTER);
  textFont(baseFont);
  text("PLACEHOLDER\nLOGO", 20, HEADER_HEIGHT / 2);

  // Removed: PL label and circles

}

function mousePressed() {
  if (mouseY < HEADER_HEIGHT) {
    return; // Ignore clicks in the header area (DOM elements handle their clicks)
  }

  // Check placed items first (iterate backwards for z-index)
   for (let i = placedItems.length - 1; i >= 0; i--) {
       // Pass 'this' (main canvas graphics context) for text bounds check
       if (placedItems[i].isMouseOver(mouseX, mouseY, this)) {
           grabbedItem = placedItems[i];
           grabbedItem.isGrabbed = true;
           grabbedItem.isPlacing = false;
           grabbedItem.solidify();

           let temp = placedItems.splice(i, 1)[0];
           shapes.push(temp); // Move to shapes array temporarily for drawing order

           if (grabbedItem.type === 'text') {
               inputElement.value(grabbedItem.content);
               inputElement.attribute('placeholder', ''); // Clear placeholder
           } else {
                inputElement.value('');
                inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
           }
            inputElement.elt.focus();
           return;
       }
   }

  // Check floating shapes
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (!shapes[i].isPlacing && !shapes[i].isGrabbed) {
       // Pass 'this' (main canvas graphics context) for text bounds check
      if (shapes[i].isMouseOver(mouseX, mouseY, this)) {
        grabbedItem = shapes[i];
        grabbedItem.isGrabbed = true;

        let temp = shapes.splice(i, 1)[0];
        shapes.push(temp); // Bring to front of shapes array

        if (grabbedItem.type === 'text') {
            inputElement.value(grabbedItem.content);
             inputElement.attribute('placeholder', ''); // Clear placeholder
        } else {
             inputElement.value('');
            inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
        }
         inputElement.elt.focus();

        break;
      }
    }
  }
}

function mouseReleased() {
  if (grabbedItem) {
    grabbedItem.isGrabbed = false;

    // Check if released over the central canvas area
    if (isMouseOverCanvasArea()) {
      grabbedItem.solidify();

      if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value() === TEXT_OPTIONS[0] ? "" : inputElement.value();
           grabbedItem.content = grabbedItem.content.trim();
           if(grabbedItem.content === "") { // Don't place empty text
               shapes = shapes.filter(s => s !== grabbedItem); // Discard empty text shape
               grabbedItem = null;
               inputElement.value('');
               inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
               return; // Exit function early
           }
      }

      // Apply Rotation Snapping (15 degrees)
      if (SNAP_INCREMENT_RADIANS !== undefined && SNAP_INCREMENT_RADIANS > 0) {
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      }

      placedItems.push(grabbedItem); // Add to placed items

      // Explicitly remove the item from the shapes array now that it's in placedItems
       shapes = shapes.filter(s => s !== grabbedItem);

      grabbedItem.isPlacing = true; // Start landing animation
      grabbedItem.landFrame = frameCount;

    } else {
        // Dropped outside canvas area - becomes a regular floating shape again
         if (grabbedItem.type === 'text') {
             grabbedItem.content = inputElement.value() === TEXT_OPTIONS[0] ? "" : inputElement.value();
             grabbedItem.content = grabbedItem.content.trim();
              // If text dropped outside and is empty, discard it? Or let it float empty? Let's let it float if text.
         }
         // Re-enable floating properties
          grabbedItem.speedX = random(-2, 2);
          grabbedItem.speedY = random(-2, 2);
          grabbedItem.rotationSpeed = random(-0.005, 0.005) * random(1, 4);
          grabbedItem.isPlacing = false; // Ensure landing animation is off
           // Item remains in shapes array.
    }

    grabbedItem = null; // Deselect
    inputElement.value(''); // Clear input field
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
  }
}

function mouseWheel(event) {
   if (grabbedItem) {
       grabbedItem.rotation += event.delta * 0.002;
        return false;
   }
    return true;
}

function keyPressed() {
    // Delete grabbed item (Backspace or Delete)
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        shapes = shapes.filter(s => s !== grabbedItem);
        placedItems = placedItems.filter(s => s !== grabbedItem);
        grabbedItem = null;
         inputElement.value('');
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
        return false;
    }

    // Scale grabbed item using +/- keys
    if (grabbedItem) {
      if (key === '+' || key === '=') {
          grabbedItem.scaleFactor *= 1.1;
          grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, 10.0);
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor;
      }
      if (key === '-') {
          grabbedItem.scaleFactor *= 0.9;
           grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, 0.1);
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor;
      }
        return false;
    }

    return true;
}


// Function to add text shape from input
function addNewTextShapeFromInput() {
   let currentText = inputElement.value();
     // Use the constant for comparison
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0]) {
         console.log("Input is empty or placeholder, not adding text.");
         inputElement.value(''); // Ensure input is clear if placeholder wasn't strictly matched but content was empty/whitespace
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]);
         inputElement.elt.focus();
         return;
    }

    let newTextShape = new FloatingShape();
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim();
    newTextShape.shapeType = 'none'; // Ensure shapeType is none for text

    let mediumCategory = sizeCategories.find(cat => cat.name === 'medium');
     if (mediumCategory) {
         newTextShape.size = random(mediumCategory.sizeRange[0] * 0.8, mediumCategory.sizeRange[1] * 1.2);
         newTextShape.scaleFactor = 1.0;
         newTextShape.textScaleAdjust = mediumCategory.textScaleAdjust;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     } else { // Fallback defaults
        newTextShape.size = 150;
        newTextShape.scaleFactor = 1.0;
         newTextShape.textScaleAdjust = 0.2;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     }

    // Spawn slightly offset from top, centered horizontally above canvas area
     newTextShape.x = random(CANVAS_AREA_X + CANVAS_AREA_W * 0.25, CANVAS_AREA_X + CANVAS_AREA_W * 0.75);
     newTextShape.y = HEADER_HEIGHT + 40;
     newTextShape.speedX = random(-0.5, 0.5);
     newTextShape.speedY = random(1, 2);
     newTextShape.rotation = random(-0.1, 0.1);
     newTextShape.rotationSpeed = random(-0.001, 0.001);

     // Color is handled by reset() constructor call

    shapes.push(newTextShape);

    inputElement.value(''); // Clear input field
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Reset placeholder
    inputElement.elt.focus();
}


// Utility to check if mouse is over the central canvas area
function isMouseOverCanvasArea() {
  return mouseX > CANVAS_AREA_X && mouseX < CANVAS_AREA_X + CANVAS_AREA_W &&
         mouseY > CANVAS_AREA_Y && mouseY < CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Helper function to snap an angle (in radians)
function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians <= 0) return angleRadians;

    angleRadians = (angleRadians % TWO_PI + TWO_PI) % TWO_PI;
    let snapped = round(angleRadians / incrementRadians) * incrementRadians;
    snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI;

    return snapped;
}

// Helper to generate timestamp string
function generateTimestampString() {
    let d = new Date();
    let timestamp = year() +
                    nf(month(), 2) +
                    nf(day(), 2) +
                    '_' +
                    nf(hour(), 2) +
                    nf(minute(), 2) +
                    nf(second(), 2);
    return timestamp;
}

// SAVE PNG button action (saves the canvasPG buffer)
function saveCanvasAreaAsPNG() {
    console.log("SAVE PNG button pressed");
  if (canvasPG) {
       // Optional: Temporarily draw a border on the PG before saving if desired in the output file
      canvasPG.push();
      canvasPG.stroke(0); // Black border
      canvasPG.strokeWeight(1);
      canvasPG.noFill();
      // Draw border inside the canvas PG bounds (0,0 to width-1, height-1)
      canvasPG.rect(0, 0, canvasPG.width - 1, canvasPG.height - 1);
      canvasPG.pop(); // Restore state (undo stroke/fill/weight)

      save(canvasPG, 'myArtboard_png_' + generateTimestampString() + '.png');

       // No need to manually erase the border drawn above as it was implicitly
       // drawn on the buffer data that was saved. canvasPG remains in its state
       // *before* those temporary save-specific draw calls.
       // If we had drawn directly with canvasPG.rect without push/pop/new ctx, we might need to clear.
  } else {
    console.warn("Canvas graphics buffer not created yet!");
  }
}

// SAVE PDF button action (creates and saves a PDF from placed items)
function saveCanvasAreaAsPDF() {
    console.log("SAVE PDF button pressed");

    // Check if beginPDF/endPDF functions are available (library is loaded)
     if (typeof beginPDF !== 'function' || typeof endPDF !== 'function') {
         console.error("p5.js-pdf library is not loaded. Cannot save as PDF.");
         alert("Error: p5.js-pdf library not loaded. Check your index.html.");
         return;
     }


    // Create a new PDF document sized to the canvas area
     beginPDF(CANVAS_AREA_W, CANVAS_AREA_H, 'myArtboard_pdf_' + generateTimestampString() + '.pdf');

    // Set basic PDF drawing properties (matches default canvasPG style)
    noFill();
    noStroke(); // Ensure commands start clean unless explicitly added
    background(255); // Draw the white background explicitly in the PDF

    // Draw placed items onto the PDF context
    // Iterate backwards for correct drawing order (last placed is on top)
     for (let i = placedItems.length - 1; i >= 0; i--) {
         let item = placedItems[i];
         // Use the shape's display method, targeting the CURRENT graphics context (which is the PDF context)
         // Pass CANVAS_AREA_X and CANVAS_AREA_Y as offsets, because the shape's (x,y) are in the global sketch coords,
         // but we want to draw it in the PDF relative to the PDF's (0,0) as if it's the canvas area corner.
         // The display method already calculates the relative position displayX = item.x - originX;
         // So drawing item with display(this, false, CANVAS_AREA_X, CANVAS_AREA_Y) where 'this' is the PDF context target,
         // results in drawing at (item.x - CANVAS_AREA_X, item.y - CANVAS_AREA_Y) within the PDF, which is correct.
         item.display(this, false, CANVAS_AREA_X, CANVAS_AREA_Y); // Draw item without grab effect onto the PDF context ('this')
     }

    // Optional: Draw a border around the artboard content in the PDF
    stroke(0); // Black border in PDF
    strokeWeight(1);
    noFill();
    rect(0, 0, CANVAS_AREA_W - 1, CANVAS_AREA_H - 1); // Draw border inside the PDF bounds (0,0 to W-1, H-1)


    // Finalize and save the PDF
     endPDF();

     console.log("PDF save initiated."); // Note: Saving might take a moment and download might happen afterwards.
}


// WINDOW RESIZED FUNCTION
function windowResized() {
    console.log("Window resized to:", windowWidth, windowHeight);
    resizeCanvas(windowWidth, windowHeight);

    CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4);
    CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
    CANVAS_AREA_Y = HEADER_HEIGHT + 20;

    let headerCenterY = HEADER_HEIGHT / 2;

    // Input Element Positioning & Sizing
    if (inputElement) {
        inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
        inputElement.size(CANVAS_AREA_W);
    }

    // Button spacing and positioning for the right-aligned group
    let buttonSpacing = 10;
    let buttonHeight = 30; // Use approximate height
    let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2;

    // --- Right aligned buttons ---
    let rightMargin = 20;

    // Calculate total width of ALL buttons + spacing
    let totalButtonWidth = 0;
    // Use dynamically calculated size().width for accuracy
     let savePDFBtnW = savePDFButton ? savePDFButton.size().width : 0;
     let savePNGBtnW = savePNGButton ? savePNGButton.size().width : 0;
     let clearBtnW = clearButton ? clearButton.size().width : 0;
     let refreshBtnW = refreshButton ? refreshButton.size().width : 0;


    if (savePDFButton) totalButtonWidth += savePDFBtnW;
    if (savePNGButton) totalButtonWidth += savePNGBtnW;
    if (clearButton) totalButtonWidth += clearBtnW;
    if (refreshButton) totalButtonWidth += refreshBtnW;


    // There are now 4 buttons. There will be 3 spaces between them.
     let numButtons = (savePDFButton ? 1 : 0) + (savePNGButton ? 1 : 0) + (clearButton ? 1 : 0) + (refreshButton ? 1 : 0);
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);


     // Calculate the X coordinate where the block of buttons should START
     // Example order: REFRESH, CLEAR, SAVE PNG, SAVE PDF (left to right)
    let buttonBlockStartX = width - rightMargin - (totalButtonWidth + totalSpacing);


    // Position the buttons sequentially
    let currentButtonX = buttonBlockStartX;

    // Position REFRESH
    if (refreshButton) {
         refreshButton.position(currentButtonX, buttonPadY_buttons);
         currentButtonX += refreshBtnW + buttonSpacing;
     }

    // Position CLEAR
    if (clearButton) {
        clearButton.position(currentButtonX, buttonPadY_buttons);
         currentButtonX += clearBtnW + buttonSpacing;
     }

    // Position SAVE PNG
    if (savePNGButton) { // Using the new variable name
        savePNGButton.position(currentButtonX, buttonPadY_buttons);
        currentButtonX += savePNGBtnW + buttonSpacing;
    }

     // Position SAVE PDF
    if (savePDFButton) { // Using the new variable name
         savePDFButton.position(currentButtonX, buttonPadY_buttons);
         // currentButtonX += savePDFBtnW + buttonSpacing; // This is the last button in this row
     }


     // Resize the graphics buffer for the canvas area if needed
    if (canvasPG) {
      canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H);
    } else {
         if(CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
             canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
         }
     }
}