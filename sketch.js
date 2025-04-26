// Enhanced interactive canvas project using p5.js

let shapes = []; // Shapes currently floating or grabbed
let placedItems = []; // Items placed and solidified on the central canvas
let grabbedItem = null; // The shape currently being dragged

// UI Element References (DOM elements need global vars if you create them this way)
let inputElement;
let saveButton;
let randomButton;
let restartButton;
let addTextButton;
// scaleUpButton and scaleDownButton are removed per user request

// Layout constants matching the reference image
const HEADER_HEIGHT = 80;
const CANVAS_AREA_W = 500; // Fixed width of the artboard
let CANVAS_AREA_H; // Calculated in setup based on ratio (fixed height of artboard)
let CANVAS_AREA_X; // Calculated in setup based on window width
let CANVAS_AREA_Y; // Calculated in setup (fixed distance below header)

// Appearance constants matching the reference image
const PALETTE = [
  '#0000FE', // Blue triangle
  '#FFDD00', // Yellow pentagon
  '#E70012', // Red hexagon
  '#FE4DD3', // Pink square
  '#41AD4A', // Green shape
  // Optionally include other colors like black or grey if shapes can be those
  // '#222222', // Dark Grey - used for some small shapes perhaps?
  // '#FFFFFF'  // White - less likely for floating shapes, maybe for text color?
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


// --- FloatingShape Class --- (Kept the same)
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
      let safePadding = max(width, height) * 0.5;
      let effectiveExtent = this.currentSize / 2 + safePadding;
      return this.x < -effectiveExtent || this.x > width + effectiveExtent ||
             this.y < -effectiveExtent || this.y > height + effectiveExtent;
  }

  updateLanding() {
    if(this.isPlacing) {
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
    }
  }

  display(graphics = this, isGrabbed = false) {
    graphics.push();
    graphics.translate(this.x, this.y);
    graphics.rotate(this.rotation);
    graphics.scale(this.scaleFactor);

     if (isGrabbed) {
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

  drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) {
        if (isText) {
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
               default: break;
             }
         }
   }

  displayOnCanvasPG(pg, canvasOffsetX, canvasOffsetY) {
      pg.push();
      let displayX = this.x - canvasOffsetX;
      let displayY = this.y - canvasOffsetY;
      pg.translate(displayX, displayY);
      pg.rotate(this.rotation);
      let currentDisplayScale = this.scaleFactor * (this.isPlacing ? this.tempScaleEffect : 1);
      pg.scale(currentDisplayScale);
      pg.fill(this.color);
      pg.noStroke();
      this.drawShapePrimitive(pg, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);
      pg.pop();
  }

  isMouseOver(mx, my) {
      let hitRadius;
       if (this.type === 'text') {
           hitRadius = max(60, this.size * this.scaleFactor * 0.5);
       } else {
           hitRadius = this.size * this.scaleFactor / 2;
            hitRadius = max(40, hitRadius);
       }
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my)) {
            console.error("NaN found in isMouseOver for shape:", this, " Mouse:", mx, my);
            return false;
       }
      return dist(mx, my, this.x, this.y) < hitRadius;
  }

  solidify() {
    this.speedX = 0;
    this.speedY = 0;
    this.rotationSpeed = 0;
  }
}
// --- End FloatingShape Class ---


function preload() {
  // Attempt to load a specific font if you have a file, e.g., a pixel font
  // try {
  //   baseFont = loadFont('path/to/your/pixel_font.ttf');
  //   console.log("Custom font loaded successfully.");
  // } catch (e) {
     console.warn("Custom font not loaded, using default:", baseFont);
  // }
}

function setup() {
  // Make canvas responsive to window size
  createCanvas(windowWidth, windowHeight);

  // --- Initialize P5.js dependent variables here ---
  // radians() is available after createCanvas()
  // ASSIGN TO THE GLOBAL LET VARIABLE
  SNAP_INCREMENT_RADIANS = radians(15);
  // ---------------------------------------------

  // Calculate central canvas area dimensions
  // CANVAS_AREA_W is a const, do not re-assign it here.
  CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // Height = Width * 5/4 (Uses the global const CANVAS_AREA_W)
  CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2; // Horizontally centered based on window width (responsive)
  // Set CANVAS_AREA_Y to a fixed distance below the header (not vertically centered within total height)
  CANVAS_AREA_Y = HEADER_HEIGHT + 20; // 20px margin below header
  // Add a check to prevent negative Y if header is huge (not an issue here)
  // CANVAS_AREA_Y = max(HEADER_HEIGHT + 10, CANVAS_AREA_Y); // Keep this just in case, but 20 is fixed margin

  // Setup UI elements (DOM)
  let headerCenterY = HEADER_HEIGHT / 2; // Y position for vertical alignment in header

  inputElement = createInput(random(TEXT_OPTIONS.slice(1))); // Start with random text
  inputElement.position(20, headerCenterY - 15); // Centered vertically in header
  // Size adjusted to make space for 'Add Text' button and align left of canvas area
  // Its width ends before CANVAS_AREA_X minus a margin (40px)
  inputElement.size(CANVAS_AREA_X - 40 - 85); // Adjusting this size relative to the dynamic CANVAS_AREA_X
  inputElement.style("padding", "10px");
  inputElement.style("border", "none");
  inputElement.style("border-radius", "20px");
  inputElement.style("outline", "none");
  inputElement.style("background-color", color(230)); // Light grey
  inputElement.style("font-size", "14px");

  addTextButton = createButton("Add Text"); // Button to add text from input
  // Position relative to inputElement's final position and size
  addTextButton.position(inputElement.x + inputElement.width + 10, headerCenterY - 15);
  addTextButton.style("padding", "10px 15px");
  addTextButton.style("border", "1px solid #888"); // Subtle border
  addTextButton.style("border-radius", "20px");
  addTextButton.style("background-color", color(200));
  addTextButton.style("color", color(50)); // Darker text color
  addTextButton.mousePressed(addNewTextShapeFromInput); // Use a dedicated function


  // Button placement - align right of canvasAreaX and centered vertically in header
  // Starting X position for the group of buttons
  let buttonXStart = CANVAS_AREA_X + CANVAS_AREA_W + 20; // Right of the central canvas + 20px margin
  let buttonSpacing = 10;
  let buttonPadY = 15; // Vertical padding

  randomButton = createButton("RANDOM");
  randomButton.position(buttonXStart, headerCenterY - buttonPadY);
  randomButton.style("padding", "8px 20px");
  randomButton.style("border", "1px solid #888");
  randomButton.style("border-radius", "20px");
  randomButton.style("background-color", color(200));
  randomButton.style("color", color(50));
  randomButton.mousePressed(resetRandom); // Clears floating, keeps placed

  restartButton = createButton("RESTART");
  // Position RESTART relative to the end of RANDOM
  restartButton.position(randomButton.x + randomButton.width + buttonSpacing, headerCenterY - buttonPadY);
  restartButton.style("padding", "8px 20px");
  restartButton.style("border", "1px solid #888");
  restartButton.style("border-radius", "20px");
  restartButton.style("background-color", color(200));
  restartButton.style("color", color(50));
  restartButton.mousePressed(restartAll); // Clears everything

  saveButton = createButton("SAVE");
  // Position SAVE relative to the end of RESTART
  saveButton.position(restartButton.x + restartButton.width + buttonSpacing, headerCenterY - buttonPadY);
  saveButton.style("padding", "8px 20px");
  saveButton.style("border", "1px solid #888");
  saveButton.style("border-radius", "20px");
  saveButton.style("background-color", color(200));
  saveButton.style("color", color(50));
  saveButton.mousePressed(saveCanvasArea);

  // scaleUpButton and scaleDownButton creation removed per user request


  // Create initial floating shapes - always off-screen now
  for (let i = 0; i < 30; i++) {
    // FloatingShape class is defined *before* setup, so this works
    shapes.push(new FloatingShape()); // constructor handles initial off-screen and type
  }

   // Create the canvas graphics buffer once in setup
  canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
}

// Custom graphics buffer for the central canvas area - Initialized in setup
let canvasPG;

function draw() {
  // Use responsive width and height from createCanvas(windowWidth, windowHeight)
  background(0); // Black background fills the whole window

  // Update and draw floating shapes outside the UI bar and canvas area
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing);
  while (shapes.length < 20) {
      shapes.push(new FloatingShape());
  }
  for (let shape of shapes) {
     if (!shape.isGrabbed && !shape.isPlacing) {
       shape.update();
     }
     shape.display(this); // Draw on the main canvas context
  }

  // --- Central White Canvas Area ---
  // Draw the central canvas graphics buffer onto the main canvas
  canvasPG.clear();
  canvasPG.background(255); // White background

  // Draw placed items onto the central canvas graphics buffer (canvasPG)
  // No need to filter bounds here if they can only be dropped within the area
  // (although keeping the filter is defensive coding)
   placedItems = placedItems.filter(item =>
        item.x >= CANVAS_AREA_X && item.x <= CANVAS_AREA_X + CANVAS_AREA_W &&
        item.y >= CANVAS_AREA_Y && item.y <= CANVAS_AREA_Y + CANVAS_AREA_H
   );

  for (let i = placedItems.length - 1; i >= 0; i--) {
      let item = placedItems[i];
       item.updateLanding(); // Update landing animation state
      item.displayOnCanvasPG(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y); // Draw relative to canvasPG
  }

  // Draw the graphics buffer onto the main canvas at its designated position
  image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);

  // Draw a border around the canvas area on the main canvas (drawn AFTER image so it's visible)
  stroke(200); // Grey border
  noFill();
  rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);


  // Draw grabbed item on top of everything else with hover effect
  if (grabbedItem) {
     // Make grabbed item smoothly follow the mouse
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.3);
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.3);
     grabbedItem.display(this, true); // Draw on the main canvas context with effect
  }

  // --- DRAW HEADER / UI OVERLAY LAST ---
  // This ensures header visuals are on top of everything drawn on the main canvas

  // Draw header background
  fill(220); // Light grey
  noStroke();
  rect(0, 0, width, HEADER_HEIGHT);

  // Draw To(o)L logo
  fill(50);
  textSize(24);
  textAlign(LEFT, CENTER);
  textFont(baseFont);
  text("To(o)L", 20, HEADER_HEIGHT / 2);

  // Draw PL label and circle indicators in header area (match image)
  fill(50); // Text color matching To(o)L
  textSize(12);
  textAlign(CENTER, CENTER);
  textFont(baseFont); // Use the chosen font

  // Position PL elements relative to the last button (SAVE) - ensures dynamic positioning with button flow
  let plElementX = saveButton.x + saveButton.width + 25; // Align with button spacing
  let circleDiameter = 20;
  let circleSpacing = 10;

  noStroke();
  fill(180); // A bit darker grey than header
  // Use headerCenterY for vertical alignment
  ellipse(plElementX, HEADER_HEIGHT / 2, circleDiameter);
  ellipse(plElementX + circleDiameter + circleSpacing, HEADER_HEIGHT / 2, circleDiameter);

  fill(50); // Text color
  // Use headerCenterY with a small vertical offset for better centering
  text("PL", plElementX, HEADER_HEIGHT / 2 + 2);

  // --- END HEADER DRAWING ---
}

function mousePressed() {
  // Don't grab if mouse is in the header area (where UI elements are). Check mouseY relative to HEADER_HEIGHT.
  if (mouseY < HEADER_HEIGHT) {
    // We only need to return here to prevent dragging on the main canvas itself when clicked in the header.
    // P5.js buttons automatically capture mouse presses when clicked directly.
    return;
  }

  // Check placed items first for selection/re-grabbing (iterate backwards for z-index)
   for (let i = placedItems.length - 1; i >= 0; i--) {
       // Check if mouse is over the item *within the canvas area bounds*.
       // isMouseOver expects global mouseX, mouseY
       if (placedItems[i].isMouseOver(mouseX, mouseY)) {
           grabbedItem = placedItems[i];
           grabbedItem.isGrabbed = true;
           grabbedItem.isLanding = false; // Stop any potential landing animation
           grabbedItem.solidify(); // Keep properties static while grabbed

           // Move from placedItems array to shapes array for drawing order
           let temp = placedItems.splice(i, 1)[0];
           shapes.push(temp);

           // Update input field if text
           if (grabbedItem.type === 'text') {
               inputElement.value(grabbedItem.content);
           } else {
                // Reset input if non-text
                inputElement.value(random(TEXT_OPTIONS.slice(1)));
           }
           return; // Only grab one item
       }
   }

  // If no placed item grabbed, check floating shapes (iterate backwards for z-index)
  for (let i = shapes.length - 1; i >= 0; i--) {
    // Check only shapes not already being placed or grabbed by other logic
    if (!shapes[i].isPlacing && !shapes[i].isGrabbed && shapes[i].isMouseOver(mouseX, mouseY)) {
      grabbedItem = shapes[i];
      grabbedItem.isGrabbed = true;

      // Bring grabbed item to the top of the shapes array for drawing order
      let temp = shapes.splice(i, 1)[0];
      shapes.push(temp);

      // Update input field if text
      if (grabbedItem.type === 'text') {
          inputElement.value(grabbedItem.content);
      } else {
           // Reset input if non-text
           inputElement.value(random(TEXT_OPTIONS.slice(1)));
      }
      break; // Only grab one item
    }
  }
}

function mouseReleased() {
  if (grabbedItem) {
    grabbedItem.isGrabbed = false;

    // Check if released over the central canvas area
    if (isMouseOverCanvasArea()) {
      grabbedItem.solidify();

      // If text item, apply current input value
      if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value();
      }

      // --- Apply Rotation Snapping Here ---
      if (SNAP_INCREMENT_RADIANS !== undefined) { // Add undefined check just in case, though should be set
        grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      } else {
           console.warn("SNAP_INCREMENT_RADIANS is undefined, skipping snap.");
      }
      // -----------------------------------

      // Update grabbedItem's position to be relative to canvasPG origin before pushing to placedItems
      // This ensures its stored (x,y) coordinates in placedItems are correct for drawing onto canvasPG later.
      // When drawing on canvasPG, the graphics context is translated to CANVAS_AREA_X, CANVAS_AREA_Y.
      // So an item at placedPos (dx, dy) relative to canvasPG needs to have its object.x/y set to (dx + CANVAS_AREA_X, dy + CANVAS_AREA_Y)
      // When releasing, mouseX/Y ARE the correct global coordinates. So we don't need to adjust grabbedItem.x/y here.
      // Its current mouseX/Y coordinates are what we want its solidified global position to be.
      // When displaying on canvasPG, we translate by grabbedItem.x - CANVAS_AREA_X and grabbedItem.y - CANVAS_AREA_Y, which calculates the correct relative position.
      // This looks correct based on existing displayOnCanvasPG logic.

      placedItems.push(grabbedItem);
      grabbedItem.isPlacing = true; // Start landing animation
      grabbedItem.landFrame = frameCount; // Record landing frame

      // Remove from shapes array (handled by filter in draw) -- filter isn't guaranteed atomic removal *immediately*, explicit is safer
      // We already moved it to shapes array in mousePressed, now we need to ensure it's removed from there
       shapes = shapes.filter(s => s !== grabbedItem); // Re-filter shapes array explicitly


    } else {
        // Dropped outside canvas area - becomes a regular floating shape again
         if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value(); // Update text content from input
         }
         // Its state becomes non-grabbed (already done at function start)
         // Its movement properties remain 0 from solidify(). We need to re-enable them.
         // OR call reset() which sets it off-screen?
         // Let's add back speed if dropped outside, so it floats away naturally from where dropped
          grabbedItem.speedX = random(-2, 2);
          grabbedItem.speedY = random(-2, 2);
          grabbedItem.rotationSpeed = random(-0.005, 0.005) * random(1, 4);
          // No need to add back to shapes, it was already there from mousePressed.

    }

    grabbedItem = null; // Deselect
    inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input to random text (not placeholder)
  }
}

function mouseWheel(event) {
   // Allow rotating grabbed item
   if (grabbedItem) {
       grabbedItem.rotation += event.delta * 0.002; // Slightly faster rotation with wheel
        // Note: Snapping is applied on mouseReleased when placed, not during wheeling.
   }
    // Prevent page scroll only if interacting with grabbed item? Or always?
   // For now, allow default scroll behavior if no item is grabbed.
    // return false; // Uncomment to prevent page scroll completely when mouse is over canvas
}

function keyPressed() {
    // Delete grabbed item (Backspace or Delete keys)
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        shapes = shapes.filter(s => s !== grabbedItem);
        placedItems = placedItems.filter(s => s !== grabbedItem);
        grabbedItem = null; // Deselect
         inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input
         // Prevent default delete/backspace browser actions
        return false;
    }

    // Scale grabbed item using +/- keys
    if (grabbedItem) {
      // Use UP/DOWN arrow keys for scaling instead of +/-? Maybe less likely to clash?
      // User requested +/-. Let's stick to that but be aware it can affect browser zoom on some setups.
      // Keycodes for +/= is 187, for - is 189
      // Or check key property? Key = "+" or Key = "-". key === '+' || key === '=' is safer
      if (key === '+' || key === '=') { // Check '+' key or '=' keycode
          grabbedItem.scaleFactor *= 1.1;
          // Add limit to prevent becoming ridiculously large?
          grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, 10.0); // Cap at 10x original size
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor; // Update visual size
           // Optionally reposition slightly to stay centered?
            // grabbedItem.x += (mouseX - pmouseX) * (1 - 1.1/0.9); // Rough center adjustment? Needs testing.
             // Let's rely on lerp in draw to smooth it out towards mouseX/Y
      }
      if (key === '-') { // Check '-' key or keycode
          grabbedItem.scaleFactor *= 0.9;
          // Add limit to prevent becoming invisible?
           grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, 0.1); // Minimum 1/10th original size
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor; // Update visual size
      }
       // Prevent default browser actions for +/- keys
        return false; // This is important for +/- keys to not zoom the page
    }
     // Allow other keys to pass through
     return true; // Return true for other key presses
}


// Function tied to the new 'Add Text' button click
function addNewTextShapeFromInput() {
   let currentText = inputElement.value();
    if (!currentText || currentText.trim() === "") {
        currentText = random(TEXT_OPTIONS.slice(1)); // Default to random text if empty input
    }

    // Create a new FloatingShape object
    let newTextShape = new FloatingShape(); // Creates off-screen initially

    // Customize it for text
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim(); // Trim whitespace

    // Assign properties based on a 'medium' size category feel for manually added text
    let mediumCategory = sizeCategories.find(cat => cat.name === 'medium');
     if (mediumCategory) {
         newTextShape.size = random(mediumCategory.sizeRange[0], mediumCategory.sizeRange[1]);
         newTextShape.scaleFactor = 1.0; // Start with base scale 1 for manually added
         newTextShape.textScaleAdjust = mediumCategory.textScaleAdjust;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     } else { // Fallback if category not found (shouldn't happen with const)
        newTextShape.size = 150;
        newTextShape.scaleFactor = 1.0;
         newTextShape.textScaleAdjust = 0.2;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     }


    // Spawn it maybe slightly offset from a side instead of deep off?
     let spawnEdge = floor(random(4));
    let posAlongEdge = random(0.4, 0.6); // Start closer to the middle of the edge
    let initialOffset = 50; // pixels just inside the edge

     switch (spawnEdge) {
        case 0: newTextShape.x = width * posAlongEdge; newTextShape.y = initialOffset; break; // From Top Edge
        case 1: newTextShape.x = width - initialOffset; newTextShape.y = height * posAlongEdge; break; // From Right Edge
        case 2: newTextShape.x = width * posAlongEdge; newTextShape.y = height - initialOffset; break; // From Bottom Edge
        case 3: newTextShape.x = initialOffset; newTextShape.y = height * posAlongEdge; break; // From Left Edge
     }
     // Give a gentle push towards the center slightly more predictably
     // Set initial speeds that nudge it inwards towards the center half
      newTextShape.speedX = lerp(random(-1, 1), (width/2 - newTextShape.x)/400, 0.8); // More directed nudge towards center X
      newTextShape.speedY = lerp(random(-1, 1), (height/2 - newTextShape.y)/400, 0.8); // More directed nudge towards center Y


    // Use a distinct color
    let pickedColor;
    do {
        pickedColor = color(random(PALETTE));
    } while (brightness(pickedColor) < 50); // Re-pick if very dark
     newTextShape.color = pickedColor;


    shapes.push(newTextShape); // Add to the floating shapes array

    // Clear the input field or reset to placeholder
    inputElement.value(random(TEXT_OPTIONS.slice(1)));
    inputElement.elt.focus(); // Keep focus on the input field after adding
}


// Utility to check if mouse is over the central canvas area
function isMouseOverCanvasArea() {
  return mouseX > CANVAS_AREA_X && mouseX < CANVAS_AREA_X + CANVAS_AREA_W &&
         mouseY > CANVAS_AREA_Y && mouseY < CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Helper function to snap an angle (in radians) to the nearest multiple of a given increment (in radians).
function snapAngle(angleRadians, incrementRadians) {
    // Round the angle to the nearest multiple of the increment
    let snapped = round(angleRadians / incrementRadians) * incrementRadians;
    // Optional: Normalize to be within 0 to TWO_PI, might prevent weird large numbers
    // snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI; // Correct way to keep between 0 and TWO_PI
    return snapped;
}


// Random button action - clears FLOATING items and adds new random floating shapes
function resetRandom() {
    console.log("RANDOM button pressed"); // Debug log
    // Keep placed items, clear only floating shapes
    shapes = []; // Clear existing floating shapes
    // Add a bunch of new floating shapes
    for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape()); // constructor handles positioning and typing
    }
     // Deselect grabbed item if it was floating
     // Check if grabbedItem exists AND if it is *currently* in the shapes array
     // Using !placedItems.includes(grabbedItem) is a safe way to check if it was originally floating
     if(grabbedItem && shapes.includes(grabbedItem)) { // Simpler check if it's *now* in shapes
         console.log("RANDOM: Deselecting grabbed floating item"); // Debug log
        grabbedItem = null;
         inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input
     }
}

// Restart button action - clears everything and resets
function restartAll() {
    console.log("RESTART button pressed"); // Debug log
    placedItems = []; // Clear placed items
    shapes = []; // Clear existing floating shapes
     grabbedItem = null; // Deselect any grabbed item
     inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input

    // Add initial shapes back
     for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape());
    }
     // Reset graphics buffer state if necessary (clear should be enough, but redraws blank canvas)
     if (canvasPG) {
         canvasPG.clear();
         canvasPG.background(255); // Ensure it's explicitly white
     }
}

// Save function (uses canvasPG for the clipped area)
function saveCanvasArea() {
    console.log("SAVE button pressed"); // Debug log
  if (canvasPG) {
    // The canvasPG drawing is handled in draw(). We can just save it.
    // For a save operation, explicitly draw the contents once to a temp buffer
    // to ensure state (like landing) is resolved or specifically handled.
    // Current drawing method onto canvasPG in draw handles landing, so saving canvasPG image is sufficient.

     save(canvasPG, 'myArtboard_' + year() + month() + day() + '_' + hour() + minute() + second() + '.png');

     // If you wanted to be SUPER explicit about drawing only static state for save:
     // let finalPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
     // finalPG.background(255); // White background
     // for (let item of placedItems) {
     //      finalPG.push();
     //      let displayX = item.x - CANVAS_AREA_X;
     //      let displayY = item.y - CANVAS_AREA_Y;
     //      finalPG.translate(displayX, displayY);
     //       finalPG.rotate(item.rotation);
     //       finalPG.scale(item.scaleFactor); // Use main scale, no temp effects
     //       finalPG.fill(item.color);
     //       finalPG.noStroke();
     //       item.drawShapePrimitive(finalPG, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust);
     //      finalPG.pop();
     // }
     // save(finalPG, 'myArtboard_' + year() + month() + day() + '_' + hour() + minute() + second() + '.png');
     // finalPG.remove();

  } else {
    console.warn("Canvas graphics buffer not created yet!");
  }
}


// WINDOW RESIZED FUNCTION (Responsive)
function windowResized() {
    console.log("Window resized to:", windowWidth, windowHeight); // Debug log
    // Resize the main canvas to the new window dimensions
    resizeCanvas(windowWidth, windowHeight);

    // Recalculate CANVAS_AREA dimensions
    // CANVAS_AREA_W is a const, does not change here.
    CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // Height is fixed based on width and ratio
    // Horizontally center based on the new window width
    CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
    // Keep fixed distance below header
    CANVAS_AREA_Y = HEADER_HEIGHT + 20;


    // Reposition UI elements (DOM) based on new dimensions
    let headerCenterY = HEADER_HEIGHT / 2;

    // Add checks here to ensure elements exist before trying to position them
    // This prevents errors if windowResized is called very early before setup finishes creating elements
    if (inputElement) {
        inputElement.position(20, headerCenterY - 15);
        // Recalculate size based on new CANVAS_AREA_X
        // Size adjusted to end before CANVAS_AREA_X minus a margin (40px)
        inputElement.size(CANVAS_AREA_X - 40 - 85);
    }


    // Relies on inputElement existence, check both
    if (inputElement && addTextButton) {
       addTextButton.position(inputElement.x + inputElement.width + 10, headerCenterY - 15);
    }

     // Recalculate button positions based on flow after canvas area
     // buttonXStart must use the *new* CANVAS_AREA_X and CANVAS_AREA_W
     let buttonXStart = CANVAS_AREA_X + CANVAS_AREA_W + 20;
     let buttonSpacing = 10;
     let buttonPadY = 15; // Vertical padding


    // Check button existence before positioning them
    if (randomButton) {
        randomButton.position(buttonXStart, headerCenterY - buttonPadY);
        // Position subsequent buttons relative to the calculated position of the previous one
        if (restartButton) {
            restartButton.position(randomButton.x + randomButton.width + buttonSpacing, headerCenterY - buttonPadY);
            if (saveButton) {
                 saveButton.position(restartButton.x + restartButton.width + buttonSpacing, headerCenterY - buttonPadY);
             }
        }
     }
     // Note: PL text and circles are drawn directly using the button positions in draw,
     // so repositioning the buttons automatically repositions the text/circles reference points.


    // Recreate or resize graphics buffer if canvas area size changes (essential after recalculating CANVAS_AREA_H or CANVAS_AREA_W)
    // It should match the fixed CANVAS_AREA_W and CANVAS_AREA_H
    if (canvasPG) {
      canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H); // Buffer size based on fixed artboard size
      console.log("Resized canvasPG to:", CANVAS_AREA_W, CANVAS_AREA_H); // Debug log
    } else {
         // Create buffer if it didn't exist (should happen only in setup, but safer check)
         if(CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
             canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
             console.log("Created canvasPG:", CANVAS_AREA_W, CANVAS_AREA_H); // Debug log
         }
     }
}