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
  CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // Height is fixed based on width and ratio
  CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2; // Horizontally centered based on window width (responsive)
  // Set CANVAS_AREA_Y to a fixed distance below the header (not vertically centered within total height)
  CANVAS_AREA_Y = HEADER_HEIGHT + 20; // 20px margin below header


  // Setup UI elements (DOM)
  let headerCenterY = HEADER_HEIGHT / 2; // Y position for vertical alignment in header

  // Input Element - Centered and same width as canvas
  inputElement = createInput();
  inputElement.value(TEXT_OPTIONS[0]); // Set to placeholder text initially
  inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Also set placeholder attribute for visual cue

  // POSITION AND STYLE INPUT ELEMENT
  // Use CANVAS_AREA_X for horizontal centering and CANVAS_AREA_W for width
  inputElement.position(CANVAS_AREA_X, headerCenterY - 15); // Position at the start of the canvas area X, centered vertically in header
  inputElement.size(CANVAS_AREA_W); // Make it the same width as the canvas area

  // Apply desired styling
  inputElement.style("padding", "5px 10px"); // Reduced vertical padding
  inputElement.style("border", "1px solid #ccc"); // Subtle light border
  inputElement.style("border-radius", "15px"); // Adjusted border radius
  inputElement.style("outline", "none");
  inputElement.style("background-color", color(255, 255, 255, 200)); // Semi-transparent white/light grey
  inputElement.style("font-size", "14px");
  inputElement.style("color", color(50)); // Darker text

  // Add event listener for Enter key press in the input field
  inputElement.elt.addEventListener('keypress', function(event) {
    // Check if the pressed key is Enter (key code 13)
    if (event.key === 'Enter') {
      addNewTextShapeFromInput();
      // Optional: Prevent default form submission if the input is part of a form
      event.preventDefault();
    }
  });


  // Removed: addTextButton creation and positioning

  // Button placement - align right of canvasAreaX and centered vertically in header
  let buttonSpacing = 10;
  let buttonHeight = 30; // Approximate button height from styling
  let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2; // Vertically center buttons in header


  // --- Right aligned buttons ---
  // Determine the starting position for the group on the right side
  let rightMargin = 20; // Margin from the right edge of the window
  // No more PL elements to account for on the right
  let buttonsBlockEnd = width - rightMargin; // Where the rightmost button ends

  // SAVE button is rightmost of its group
  saveButton = createButton("SAVE");
  // Position based on the calculated end point and the button's width (which is dynamic initially)
  // We'll adjust this more precisely in windowResized using actual button widths
  saveButton.position(buttonsBlockEnd - 100, buttonPadY_buttons); // Use temp value, refined in windowResized
  saveButton.style("padding", "5px 10px"); // Apply matching smaller padding
  saveButton.style("border", "1px solid #888");
  saveButton.style("border-radius", "15px");
  saveButton.style("background-color", color(200));
  saveButton.style("color", color(50));
  saveButton.mousePressed(saveCanvasArea);


  // CLEAR button (was RESTART) is to the left of SAVE
  clearButton = createButton("CLEAR"); // Renamed button
  clearButton.position(saveButton.x - buttonSpacing - 80, buttonPadY_buttons); // Use temp value, refined in windowResized
  clearButton.style("padding", "5px 10px"); // Apply matching smaller padding
  clearButton.style("border", "1px solid #888");
  clearButton.style("border-radius", "15px");
  clearButton.style("background-color", color(200));
  clearButton.style("color", color(50));
  clearButton.mousePressed(restartAll); // Still calls restartAll function


  // REFRESH button (was RANDOM) is to the left of CLEAR
  refreshButton = createButton("REFRESH"); // Renamed button
  refreshButton.position(clearButton.x - buttonSpacing - 80, buttonPadY_buttons); // Use temp value, refined in windowResized
  refreshButton.style("padding", "5px 10px"); // Apply matching smaller padding
  refreshButton.style("border", "1px solid #888");
  refreshButton.style("border-radius", "15px");
  refreshButton.style("background-color", color(200));
  refreshButton.style("color", color(50));
  refreshButton.mousePressed(resetRandom); // Still calls resetRandom function

   // IMPORTANT: Call windowResized once initially to correctly position elements
   // based on their actual calculated widths after creation and styling.
   windowResized();


  // Create initial floating shapes - always off-screen now
  for (let i = 0; i < 30; i++) {
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

  // Draw To(o)L logo (Example left logo area)
  fill(50);
  textSize(20); // Slightly smaller font size for "PLACEHOLDER LOGO" feel
  textAlign(LEFT, CENTER);
  textFont(baseFont);
  // Position left of the input element
  text("PLACEHOLDER\nLOGO", 20, HEADER_HEIGHT / 2); // Example Multi-line text logo


  // Removed: Drawing PL label and circle indicators


  // *** Removed Scale Button Appearance Logic (already done but re-verifying) ***

  // There should be NO drawing commands here that are trying to draw shapes
  // or elements that belonged to the removed scale buttons.
  // If there were any subtle drawing leftovers, they would need to be located
  // and removed from THIS part of the draw loop.
  // Given their removal from setup/vars/handlers, hopefully this is no longer an issue.

  // --- END HEADER DRAWING ---
}

function mousePressed() {
  // Don't grab if mouse is in the header area (where UI elements are). Check mouseY relative to HEADER_HEIGHT.
  // This check remains valid to prevent clicking/dragging background if mouse is in header.
  if (mouseY < HEADER_HEIGHT) {
    // Clicking on DOM elements in header is handled by p5.js automatically.
    // This prevents dragging shapes if the click starts in the header background.
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

           // Update input field if text - IMPORTANT UX
           if (grabbedItem.type === 'text') {
               inputElement.value(grabbedItem.content); // Load text content into input
           } else {
                // Reset input to random if non-text grabbed - Matches previous behavior
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

      // Update input field if text - IMPORTANT UX
      if (grabbedItem.type === 'text') {
          inputElement.value(grabbedItem.content); // Load text content into input
      } else {
           // Reset input to random if non-text grabbed
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

      // If text item, apply current input value before placing
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

      placedItems.push(grabbedItem);
      grabbedItem.isPlacing = true; // Start landing animation
      grabbedItem.landFrame = frameCount; // Record landing frame

      // Ensure item is removed from shapes array as it's now placed
      // Filter is in draw, but explicitly removing is safer during transition
       shapes = shapes.filter(s => s !== grabbedItem);


    } else {
        // Dropped outside canvas area - becomes a regular floating shape again
         if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value(); // Update text content from input
         }
         // Re-enable its floating speed and rotation if dropped outside the canvas area
          grabbedItem.speedX = random(-2, 2);
          grabbedItem.speedY = random(-2, 2);
          grabbedItem.rotationSpeed = random(-0.005, 0.005) * random(1, 4);
          // It remains in the 'shapes' array if it was there when grabbed (if it started floating)
          // If it was grabbed *from* placedItems and dropped outside, it's now in `shapes` array,
          // its state is updated here to float again, and draw loop will continue processing it.

    }

    grabbedItem = null; // Deselect the item
    inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input to random text (not placeholder) - Matches previous behavior
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Re-set placeholder
  }
}

function mouseWheel(event) {
   // Allow rotating grabbed item
   if (grabbedItem) {
       grabbedItem.rotation += event.delta * 0.002; // Slightly faster rotation with wheel
        // Note: Snapping is applied on mouseReleased when placed, not during wheeling.
        return false; // Prevent page scroll while rotating a grabbed item
   }
    // Allow default page scroll behavior if no item is grabbed.
    return true;
}

function keyPressed() {
    // Delete grabbed item (Backspace or Delete keys)
    if (grabbedItem && (keyCode === DELETE || keyCode === BACKSPACE)) {
        shapes = shapes.filter(s => s !== grabbedItem);
        placedItems = placedItems.filter(s => s !== grabbedItem);
        grabbedItem = null; // Deselect
         inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input
         inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Re-set placeholder
         // Prevent default delete/backspace browser actions
        return false;
    }

    // Scale grabbed item using +/- keys
    if (grabbedItem) {
      // Using 'key' property for char match is often more reliable than keyCode for +/-
      if (key === '+' || key === '=') { // Check '+' key or '=' key (shift+)
          grabbedItem.scaleFactor *= 1.1;
          grabbedItem.scaleFactor = min(grabbedItem.scaleFactor, 10.0); // Cap max size
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor; // Update visual size
      }
      if (key === '-') { // Check '-' key
          grabbedItem.scaleFactor *= 0.9;
           grabbedItem.scaleFactor = max(grabbedItem.scaleFactor, 0.1); // Set min size
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor; // Update visual size
      }
       // Prevent default browser actions for +/- keys
        return false; // This is important for +/- keys to not zoom the page
    }

    // Added: Handle Enter key press globally if input is focused? No, added listener to input.
    // Let's keep this check in case the user presses Enter when the input is not focused,
    // but the grabbed item is text. However, the prompt only asks for the input field.
    // The event listener on input.elt is sufficient for the requirement.
    // Returning true allows other global key presses (like F12 developer tools etc.)
    return true; // Return true for other key presses
}


// Function tied to adding text from input (now triggered by Enter key)
function addNewTextShapeFromInput() {
   let currentText = inputElement.value();
    // Use the placeholder text constant for comparison
    if (!currentText || currentText.trim() === "" || currentText.trim() === TEXT_OPTIONS[0]) {
         // Don't add if empty or just the placeholder text
         console.log("Input is empty or placeholder, not adding text.");
         // inputElement.value(random(TEXT_OPTIONS.slice(1))); // Don't reset value if placeholder is present
         inputElement.elt.focus(); // Keep focus on the input field
         return; // Stop here if input is empty/placeholder
    }

    // Create a new FloatingShape object
    let newTextShape = new FloatingShape(); // Creates off-screen initially

    // Customize it for text
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim(); // Use the input text content

    // Assign properties based on a 'medium' size category feel
    let mediumCategory = sizeCategories.find(cat => cat.name === 'medium');
     if (mediumCategory) {
         newTextShape.size = random(mediumCategory.sizeRange[0], mediumCategory.sizeRange[1]); // Pick base size from medium range
         newTextShape.scaleFactor = 1.0; // Start with base scale 1.0
         newTextShape.textScaleAdjust = mediumCategory.textScaleAdjust;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     } else { // Fallback
        newTextShape.size = 150;
        newTextShape.scaleFactor = 1.0;
         newTextShape.textScaleAdjust = 0.2;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     }

    // Spawn slightly offset from a side, directing inwards - keep this spawn logic
     let spawnEdge = floor(random(4));
    let posAlongEdge = random(0.4, 0.6);
    let initialOffset = 50;

     switch (spawnEdge) {
        case 0: newTextShape.x = width * posAlongEdge; newTextShape.y = initialOffset; break;
        case 1: newTextShape.x = width - initialOffset; newTextShape.y = height * posAlongEdge; break;
        case 2: newTextShape.x = width * posAlongEdge; newTextShape.y = height - initialOffset; break;
        case 3: newTextShape.x = initialOffset; newTextShape.y = height * posAlongEdge; break;
     }
     // Give a gentle push towards the center slightly more predictably
      newTextShape.speedX = lerp(random(-1, 1), (width/2 - newTextShape.x)/400, 0.8);
      newTextShape.speedY = lerp(random(-1, 1), (height/2 - newTextShape.y)/400, 0.8);


    // Use a distinct color from palette, avoid very dark
    let pickedColor;
    do {
        pickedColor = color(random(PALETTE));
    } while (brightness(pickedColor) < 50);
     newTextShape.color = pickedColor;


    shapes.push(newTextShape); // Add to the floating shapes array

    // Reset input field to placeholder and clear value AFTER adding text
    inputElement.value(''); // Clear the text value
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Re-set placeholder attribute
    inputElement.elt.focus(); // Keep focus on the input field after adding
}


// Utility to check if mouse is over the central canvas area
function isMouseOverCanvasArea() {
  // mouseX and mouseY are global P5 variables
  return mouseX > CANVAS_AREA_X && mouseX < CANVAS_AREA_X + CANVAS_AREA_W &&
         mouseY > CANVAS_AREA_Y && mouseY < CANVAS_AREA_Y + CANVAS_AREA_H;
}

// Helper function to snap an angle (in radians) to the nearest multiple of a given increment (in radians).
function snapAngle(angleRadians, incrementRadians) {
    if (incrementRadians === 0) return angleRadians; // Avoid division by zero

    // Round the angle to the nearest multiple of the increment
    let snapped = round(angleRadians / incrementRadians) * incrementRadians;
    // Optional: Normalize to be within 0 to TWO_PI (can help with consistency but often not needed with floats)
    // snapped = (snapped % TWO_PI + TWO_PI) % TWO_PI;
    return snapped;
}


// REFRESH button action - clears FLOATING items and adds new random floating shapes
function resetRandom() {
    console.log("REFRESH button pressed");
    // Keep placed items, clear only floating shapes
    shapes = []; // Clear existing floating shapes
    // Add a bunch of new floating shapes
    for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape());
    }
     // Deselect grabbed item if it was floating (now checked by ensuring it's NOT placed)
     // If it was grabbed from `placedItems`, it will be filtered out of `shapes` when it gets re-added to `placedItems` on release.
     // If it was grabbed *from* `shapes`, clearing `shapes` removes it unless we put it back temporarily?
     // Current mousePressed moves floating grabbed item TO END OF shapes. resetRandom CLEARS all shapes.
     // So, if a floating item is grabbed and refresh is hit, it's gone. This seems intended for "refresh floating shapes".
     if (grabbedItem && !placedItems.includes(grabbedItem)) { // If a floating item was grabbed
          grabbedItem = null; // Deselect it
          inputElement.value(''); // Clear input
          inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Re-set placeholder
     }
}

// CLEAR button action - clears everything and resets
function restartAll() { // Keep the function name consistent internally
    console.log("CLEAR button pressed");
    placedItems = []; // Clear placed items
    shapes = []; // Clear existing floating shapes
    grabbedItem = null; // Deselect any grabbed item
    inputElement.value(''); // Clear input
    inputElement.attribute('placeholder', TEXT_OPTIONS[0]); // Re-set placeholder

    // Add initial shapes back
     for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape());
    }
     // Clear graphics buffer for the white canvas explicitly
     if (canvasPG) {
         canvasPG.clear();
         canvasPG.background(255); // Ensure it's explicitly white after clearing
     }
}

// Save function (uses canvasPG for the clipped area)
function saveCanvasArea() {
    console.log("SAVE button pressed");
  if (canvasPG) {
     save(canvasPG, 'myArtboard_' + year() + month() + day() + '_' + hour() + minute() + second() + '.png');
  } else {
    console.warn("Canvas graphics buffer not created yet!");
  }
}


// WINDOW RESIZED FUNCTION (Responsive layout adjustments)
function windowResized() {
    console.log("Window resized to:", windowWidth, windowHeight);
    // Resize the main canvas to the new window dimensions
    resizeCanvas(windowWidth, windowHeight);

    // Recalculate CANVAS_AREA dimensions
    // CANVAS_AREA_W is a const, does not change here.
    CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // Height is fixed based on width and ratio
    // Horizontally center based on the new window width
    CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
    // Keep fixed distance below header
    CANVAS_AREA_Y = HEADER_HEIGHT + 20; // 20px margin below header


    // Recalculate DOM element positions and sizes based on new dimensions
    let headerCenterY = HEADER_HEIGHT / 2;

    // Input Element Positioning & Sizing (Centered and same width as canvas)
    if (inputElement) {
        // Position at the start of the canvas area X, centered vertically in header
        inputElement.position(CANVAS_AREA_X, headerCenterY - 15);
        // Set width to be the same as the canvas area
        inputElement.size(CANVAS_AREA_W);
        inputElement.style("padding", "5px 10px"); // Ensure consistent padding on resize
    }

    // Removed: addTextButton positioning logic

     // Button spacing and positioning for the right-aligned group
     let buttonSpacing = 10;
     let buttonHeight = 30; // Use approximate consistent height for layout calculation
     let buttonPadY_buttons = (HEADER_HEIGHT - buttonHeight) / 2; // Calculate Y to center buttons vertically in header

     // --- Right aligned buttons ---
     // Recalculate from the right edge, ensure button elements exist

    // Calculate total width of buttons + spacing to figure out where the block starts
    let totalButtonWidth = 0;
    // Use button's calculated outerWidth for better accuracy (might be slightly different from element.width())
    // Check if elements exist before accessing properties and calculate widths
     let saveBtnW = saveButton ? saveButton.size().width : 0;
     let clearBtnW = clearButton ? clearButton.size().width : 0;
     let refreshBtnW = refreshButton ? refreshButton.size().width : 0;


     // Sum the widths and spacings IF buttons exist
    if (saveButton) totalButtonWidth += saveBtnW;
    if (clearButton) totalButtonWidth += clearBtnW;
    if (refreshButton) totalButtonWidth += refreshBtnW;

    // Account for spacing *between* buttons (N-1 spaces if N buttons exist)
     let numButtons = (saveButton ? 1 : 0) + (clearButton ? 1 : 0) + (refreshButton ? 1 : 0);
     let totalSpacing = (numButtons > 1 ? (numButtons - 1) * buttonSpacing : 0);

     let rightMargin = 20;

     // Starting X for the button block from the right side calculation
    // The block starts at (total window width) - (right margin) - (total width of buttons + spacing)
    let buttonBlockStartX_calculated = width - rightMargin - (totalButtonWidth + totalSpacing);


    // Position the buttons relative to each other and the calculated starting X
    let currentButtonX = buttonBlockStartX_calculated;


    // Position REFRESH (formerly RANDOM) - Leftmost button
    if (refreshButton) {
         refreshButton.position(currentButtonX, buttonPadY_buttons);
         currentButtonX += refreshBtnW + buttonSpacing; // Move position for the next button
         refreshButton.style("padding", "5px 10px"); // Reapply styles on resize for consistency
     }

    // Position CLEAR (formerly RESTART) - Middle button
    if (clearButton) {
        clearButton.position(currentButtonX, buttonPadY_buttons);
         currentButtonX += clearBtnW + buttonSpacing; // Move position for the next button
        clearButton.style("padding", "5px 10px"); // Reapply styles on resize
     }

    // Position SAVE - Rightmost button
    if (saveButton) {
        saveButton.position(currentButtonX, buttonPadY_buttons);
        saveButton.style("padding", "5px 10px"); // Reapply styles on resize
    }

     // Recreate or resize graphics buffer if canvas area size changes (essential after recalculating CANVAS_AREA_H or CANVAS_AREA_W)
    // It should match the fixed CANVAS_AREA_W and CANVAS_AREA_H
    if (canvasPG) {
      canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H); // Buffer size based on fixed artboard size
    } else {
         // Create buffer if it didn't exist (should happen only in setup, but safer check)
         if(CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) {
             canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
         }
     }
}