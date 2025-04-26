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
const CANVAS_AREA_W = 500;
let CANVAS_AREA_H; // Calculated in setup based on ratio
let CANVAS_AREA_X; // Calculated in setup
let CANVAS_AREA_Y; // Calculated in setup

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
// >> THIS LINE MUST BE 'let', NOT 'const' <<
let SNAP_INCREMENT_RADIANS; // Declared globally, Initialized in setup() using radians()

// Define size categories for shapes to control distribution
const sizeCategories = [
  { name: 'small', sizeRange: [50, 80], scaleRange: [0.8, 1.2], textScaleAdjust: 0.15 },
  { name: 'medium', sizeRange: [80, 150], scaleRange: [1.0, 1.8], textScaleAdjust: 0.2 },
  { name: 'large', sizeRange: [150, 250], scaleRange: [1.2, 2.5], textScaleAdjust: 0.25 } // Adjusted max base size
];


// --- FloatingShape Class (Moved up before setup/preload) ---
// Shape Class (Unified for floating and placed items)
class FloatingShape {
  constructor() {
    this.reset(); // All shapes start by resetting to an off-screen floating state

     this.isGrabbed = false;
     this.isPlacing = false; // State for landing animation
     this.landFrame = -1; // To track when placed for landing animation

     // Properties for animation/state
     this.tempScaleEffect = 1; // For landing pulse
     // this.tempOffsetY = 0; // For landing bounce
  }

  // Reset/initialize the shape state, now always spawning off-screen
  reset() {
    // Pick an edge (0:top, 1:right, 2:bottom, 3:left)
    let edge = floor(random(4));
    // Position along the chosen edge, allowing spawning slightly outside the edge dimension itself
    let posAlong = random(-0.5, 1.5);

     // --- Size distribution based on categories ---
    let categoryIndex = floor(random(sizeCategories.length));
    let category = sizeCategories[categoryIndex];

    this.size = random(category.sizeRange[0], category.sizeRange[1]); // Base size
    this.scaleFactor = random(category.scaleRange[0], category.scaleRange[1]); // Scale factor
    this.currentSize = this.size * this.scaleFactor; // Visual size for checks
    // -------------------------------------------

     let minSpeed = 1.5; // Minimum drive-by speed
     let maxSpeed = 4; // Maximum drive-by speed

    // Determine spawn position and initial speed direction towards the canvas area
    switch (edge) {
      case 0: // Top
        this.x = width * posAlong;
        this.y = -this.currentSize * random(0.5, 1.5); // Start just outside to further off
        this.speedX = random(-2, 2); // Slower side speed
        this.speedY = random(minSpeed, maxSpeed); // Faster main speed downwards
        break;
      case 1: // Right
        this.x = width + this.currentSize * random(0.5, 1.5); // Start just outside to further off
        this.y = height * posAlong;
        this.speedX = random(-maxSpeed, -minSpeed); // Faster main speed left
        this.speedY = random(-2, 2);
        break;
      case 2: // Bottom
        this.x = width * posAlong;
        this.y = height + this.currentSize * random(0.5, 1.5); // Start just outside to further off
        this.speedX = random(-2, 2);
        this.speedY = random(-maxSpeed, -minSpeed); // Faster main speed up
        break;
      case 3: // Left
        this.x = -this.currentSize * random(0.5, 1.5); // Start just outside to further off
        this.y = height * posAlong;
        this.speedX = random(minSpeed, maxSpeed); // Faster main speed right
        this.speedY = random(-2, 2);
        break;
    }

    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.005, 0.005) * random(1, 4); // Varied rotation speed, sometimes faster

    // Pick a color from the defined palette, avoid very dark colors if on black background
    let pickedColor;
    do {
        pickedColor = color(random(PALETTE));
        // Re-pick if the color is very dark on black background (brightness < 50)
    } while (brightness(pickedColor) < 50);


    this.color = pickedColor;

    // Shape or text type - bias towards shapes
    this.type = random() < 0.8 ? 'shape' : 'text';

    // Define specific shape types or set text content
    if (this.type === 'shape') {
        this.shapeType = random(['triangle', 'square', 'pentagon', 'hexagon', 'circle']); // Include more shapes
    } else {
         this.shapeType = 'none'; // Text doesn't have a distinct geometric shape type property
         this.content = random(TEXT_OPTIONS.slice(1)); // Pick random text excluding placeholder
          // Store text scale adjustment based on category
         this.textScaleAdjust = category.textScaleAdjust;
    }

    // Reset state flags
    this.isGrabbed = false;
    this.isPlacing = false;
    this.landFrame = -1;
    this.tempScaleEffect = 1; // Reset animation effect
    // this.tempOffsetY = 0; // Reset bounce

    // >> ENSURE NO const DECLARATION FOR SNAP_INCREMENT_RADIANS IS HERE <<
  }

  // Update movement for floating shapes
  update() {
     this.x += this.speedX;
     this.y += this.speedY;
     this.rotation += this.rotationSpeed;
     this.currentSize = this.size * this.scaleFactor; // Keep current size updated
  }

  // Check if the shape is well off-screen
  isReallyOffScreen() {
      // Define boundaries well beyond the canvas edges
      let safePadding = max(width, height) * 0.5; // Significant padding
      let effectiveExtent = this.currentSize / 2 + safePadding; // Consider size + padding

      return this.x < -effectiveExtent || this.x > width + effectiveExtent ||
             this.y < -effectiveExtent || this.y > height + effectiveExtent;
  }

    // Update landing animation state (call from draw for placed items)
   updateLanding() {
        if(this.isPlacing) {
            let elapsed = frameCount - this.landFrame;
            let duration = 30; // Animation duration in frames (~0.5 seconds)

            if (elapsed <= duration) {
                 // Simple scale pulse effect
                let t = map(elapsed, 0, duration, 0, 1); // Normalized time
                let pulseScale = 1 + sin(t * PI) * 0.05; // Scale slightly up and back (5% pulse)
                 this.tempScaleEffect = pulseScale;

                 // You could add a temporary Y offset bounce effect too
                 // let bounceY = easeOutBounce(t) * -this.currentSize * 0.1; // Bounce up 10% of height
                 // this.tempOffsetY = bounceY;
                 // You'd need an easing function like easeOutBounce

            } else {
                this.isPlacing = false; // Animation finished
                 this.tempScaleEffect = 1; // Reset temporary scale effect
                 // this.tempOffsetY = 0; // Reset temporary Y offset
            }
        }
   }


  // Display the shape/text on a graphics context (main canvas or buffer)
  display(graphics = this, isGrabbed = false) {
    graphics.push();
    graphics.translate(this.x, this.y);
    graphics.rotate(this.rotation);
    // Apply main scale factor (landing animation scale applied in displayOnCanvasPG)
    graphics.scale(this.scaleFactor);

     if (isGrabbed) {
        // Apply hover/glow effect when grabbed (on the main canvas only)
         graphics.drawingContext.shadowBlur = 40; // Increased blur
         graphics.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)'; // More opaque white glow
         graphics.stroke(255, 255, 255, 200); // Visible white outline
         graphics.strokeWeight(3); // Thicker outline
         graphics.noFill();

         // Draw outline using the primitive helper
         this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);

         graphics.drawingContext.shadowBlur = 0; // Reset shadowblur immediately
     }

    // Always draw the solid fill (it will be drawn *under* the outline if grabbed, which is fine)
    graphics.fill(this.color);
    graphics.noStroke(); // Shapes/Text on black background are solid fills

    // Draw the actual shape/text fill
     this.drawShapePrimitive(graphics, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);

    graphics.pop(); // End translate/rotate/scale for the item
  }


    // Helper function to draw the shape primitive or text string
    // Called from display and displayOnCanvasPG. Draws at px, py with psize
    // textScaleAdjust is used only if isText is true
   drawShapePrimitive(graphics, px, py, psize, pshapeType, isText = false, textScaleAdjust = 0.2) { // Default added for safety
        if (isText) {
             graphics.textFont(baseFont); // Use the base font
             graphics.textAlign(CENTER, CENTER);
             // Text size calculation needs careful thought. Should scale with overall object scale.
             // psize here is the *base* size passed to the helper.
             // The graphics context already has scale(this.scaleFactor) (or scaleFactor * tempScaleEffect) applied before this helper is called.
             // So the text size should be proportional to psize, using the textScaleAdjust multiplier.
             let effectiveTextSize = psize * textScaleAdjust; // Use stored factor
             graphics.textSize(effectiveTextSize);

             // To simulate clipping / pixel font look if desired
             // graphics.text(this.content, px, py, psize * this.scaleFactor, psize * this.scaleFactor); // Use bounds? P5 text bounds tricky
             graphics.text(this.content, px, py);

         } else {
              graphics.rectMode(CENTER); // Ensure rect is centered for 'square'

             switch (pshapeType) {
               case 'circle': graphics.ellipse(px, py, psize * 2); break; // ellipse takes diameter
               case 'square': graphics.rect(px, py, psize, psize); break;
               case 'triangle':
                 graphics.beginShape();
                 // Vertices relative to px, py center
                 graphics.vertex(px, py - psize * 0.8); // Top point
                 graphics.vertex(px - psize * 0.8, py + psize * 0.4); // Bottom left
                 graphics.vertex(px + psize * 0.8, py + psize * 0.4); // Bottom right
                 graphics.endShape(CLOSE);
                 break;
               case 'pentagon': // 5 sides
                  graphics.beginShape();
                  let sidesP = 5;
                   let radiusP = psize * 0.7; // Adjust radius for shape consistency vs size
                  for (let a = 0; a < TWO_PI; a += TWO_PI / sidesP) {
                    let sx = cos(a - HALF_PI) * radiusP;
                    let sy = sin(a - HALF_PI) * radiusP;
                    graphics.vertex(px + sx, py + sy);
                  }
                  graphics.endShape(CLOSE);
                 break;
               case 'hexagon': // 6 sides
                 graphics.beginShape();
                  let sidesH = 6;
                   let radiusH = psize; // Use base size as radius
                  for (let a = 0; a < TWO_PI; a += TWO_PI / sidesH) {
                    let sx = cos(a) * radiusH;
                    let sy = sin(a) * radiusH;
                    graphics.vertex(px + sx, py + sy);
                  }
                 graphics.endShape(CLOSE);
                 break;
               default:
                    // Draw nothing or a fallback? Let's do nothing.
                   break;
             }
         }
   }


  // Display the item onto the central canvas graphics buffer (canvasPG)
  displayOnCanvasPG(pg, canvasOffsetX, canvasOffsetY) {
      pg.push();
      // Translate to the item's position relative to the canvasPG's origin (top-left)
      let displayX = this.x - canvasOffsetX;
      let displayY = this.y - canvasOffsetY;
      pg.translate(displayX, displayY);

       // Apply transformations (rotation, main scale factor, PLUS temporary landing scale effect)
       pg.rotate(this.rotation);
       // Apply the temporary landing scale effect only if currently placing
       let currentDisplayScale = this.scaleFactor * (this.isPlacing ? this.tempScaleEffect : 1);
      pg.scale(currentDisplayScale);

      // Apply a temporary Y offset for bounce animation if implemented
      // if(this.isPlacing && this.tempOffsetY) {
      //     pg.translate(0, this.tempOffsetY);
      // }


       pg.fill(this.color);
      pg.noStroke(); // Items on the white canvas are solid with no outline (as per red hexagon)

      // Draw the actual shape or text onto the canvasPG
       // Pass the correct arguments including textScaleAdjust if it's text
       this.drawShapePrimitive(pg, 0, 0, this.size, this.shapeType, this.type === 'text', this.textScaleAdjust);

      pg.pop(); // End transformations for this item
  }


  // Check if the mouse is over this shape at its current position (mx, my are mouse coords)
  isMouseOver(mx, my) {
       // Use dist from center to the passed mouse coordinates.
       // Calculate a visual radius based on the item's size and scale factor.
       // Adjust this based on whether it's text or a shape for better hit area.
      let hitRadius;
       if (this.type === 'text') {
           // Approximating hit area for text based on size and scale
           // Use max of a base size or scaled size portion
           // Increased the base hit radius for text significantly
           hitRadius = max(60, this.size * this.scaleFactor * 0.5); // Adjust multiplier as needed

       } else { // It's a shape
           // For shapes, radius is size/2 * scaleFactor
           hitRadius = this.size * this.scaleFactor / 2;
            // Increased the minimum hit area for small shapes
            hitRadius = max(40, hitRadius); // Ensure minimum hit area for small shapes
       }


      // Adding a safety check against NaN in position just in case (shouldn't be needed with fixes)
       if (isNaN(this.x) || isNaN(this.y) || isNaN(mx) || isNaN(my)) {
            console.error("NaN found in isMouseOver for shape:", this, " Mouse:", mx, my);
            return false; // Cannot check distance with NaN
       }

      // Perform the distance check using the calculated radius
      return dist(mx, my, this.x, this.y) < hitRadius;
  }

  solidify() {
    this.speedX = 0;
    this.speedY = 0;
    this.rotationSpeed = 0;
  }
}
// --- End FloatingShape Class ---


function preload() { // Likely starts around line 369 based on previous error
  // Attempt to load a specific font if you have a file, e.g., a pixel font
  // try {
  //   baseFont = loadFont('path/to/your/pixel_font.ttf');
  //   console.log("Custom font loaded successfully.");
  // } catch (e) {
     console.warn("Custom font not loaded, using default:", baseFont); // <-- This is line 375 according to error
  // }
}

function setup() { // Likely starts around line 383 based on previous error
  // Match the target resolution better
  createCanvas(1000, 1400);

  // --- Initialize P5.js dependent variables here ---
  // Now radians() is available after createCanvas()
  // >> ASSIGN TO THE GLOBAL LET VARIABLE <<
  // >> THIS IS LINE 390 ACCORDING TO YOUR ERROR <<
  SNAP_INCREMENT_RADIANS = radians(15); // This should now assign correctly to the global LET variable
  // ---------------------------------------------

  // Calculate central canvas area dimensions based on fixed width and 4:5 ratio (W:H)
  CANVAS_AREA_W = 500; // Keep width fixed
  CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // Height = Width * 5/4
  CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
  // Calculate CANVAS_AREA_Y to center the white canvas vertically within the space below the header
  // Total usable vertical space = height - HEADER_HEIGHT
  // Space needed for canvas area = CANVAS_AREA_H
  // Remaining vertical space = (height - HEADER_HEIGHT) - CANVAS_AREA_H
  // Top margin = Remaining vertical space / 2
  CANVAS_AREA_Y = HEADER_HEIGHT + ((height - HEADER_HEIGHT) - CANVAS_AREA_H) / 2;
  // Ensure it's not placed too high if canvas is small
  CANVAS_AREA_Y = max(HEADER_HEIGHT + 10, CANVAS_AREA_Y); // Minimum 10px below header


  // Setup UI elements (adjust positions)
  inputElement = createInput(random(TEXT_OPTIONS.slice(1))); // Start with random text
  inputElement.position(20, HEADER_HEIGHT / 2 - 15); // Centered vertically in header
  // Size adjusted to make space for 'Add Text' button and align left of canvas area
  inputElement.size(CANVAS_AREA_X - 40 - 85);
  inputElement.style("padding", "10px");
  inputElement.style("border", "none");
  inputElement.style("border-radius", "20px");
  inputElement.style("outline", "none");
  inputElement.style("background-color", color(230)); // Light grey
  inputElement.style("font-size", "14px");

  addTextButton = createButton("Add Text"); // Button to add text from input
  addTextButton.position(inputElement.x + inputElement.width + 10, HEADER_HEIGHT / 2 - 15);
  addTextButton.style("padding", "10px 15px");
  addTextButton.style("border", "1px solid #888"); // Subtle border
  addTextButton.style("border-radius", "20px");
  addTextButton.style("background-color", color(200));
  addTextButton.style("color", color(50)); // Darker text color
  addTextButton.mousePressed(addNewTextShapeFromInput); // Use a dedicated function


  // Button placement - align right of canvasAreaX and centered vertically in header
  let buttonXStart = CANVAS_AREA_X + CANVAS_AREA_W + 20; // Right of the central canvas
  let buttonSpacing = 10;
  let buttonPadY = 15; // Vertical padding

  randomButton = createButton("RANDOM");
  randomButton.position(buttonXStart, HEADER_HEIGHT / 2 - buttonPadY);
  randomButton.style("padding", "8px 20px");
  randomButton.style("border", "1px solid #888");
  randomButton.style("border-radius", "20px");
  randomButton.style("background-color", color(200));
  randomButton.style("color", color(50));
  // RANDOM button should reset floating shapes, leave placed items
  randomButton.mousePressed(resetRandom);

  restartButton = createButton("RESTART");
  // Position RESTART relative to RANDOM
  restartButton.position(randomButton.x + randomButton.width + buttonSpacing, HEADER_HEIGHT / 2 - buttonPadY);
  restartButton.style("padding", "8px 20px");
  restartButton.style("border", "1px solid #888");
  restartButton.style("border-radius", "20px");
  restartButton.style("background-color", color(200));
  restartButton.style("color", color(50));
  // RESTART button should reset everything
  restartButton.mousePressed(restartAll);

  saveButton = createButton("SAVE");
  // Position SAVE relative to RESTART
  saveButton.position(restartButton.x + restartButton.width + buttonSpacing, HEADER_HEIGHT / 2 - buttonPadY);
  saveButton.style("padding", "8px 20px");
  saveButton.style("border", "1px solid #888");
  saveButton.style("border-radius", "20px");
  saveButton.style("background-color", color(200));
  saveButton.style("color", color(50));
  saveButton.mousePressed(saveCanvasArea);

  // scaleUpButton and scaleDownButton creation removed per user request


  // Create initial floating shapes - always off-screen now
  for (let i = 0; i < 30; i++) {
    // FloatingShape class is now defined *before* setup, so this works
    shapes.push(new FloatingShape()); // constructor now handles initial off-screen
  }

   // Create the canvas graphics buffer once in setup
  canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
}

// Custom graphics buffer for the central canvas area - Initialized in setup
let canvasPG;

function draw() {
  background(0); // Black background

  // Update and draw floating shapes (shapes array)
  // Filter out shapes that are well off-screen and not grabbed/placing
  shapes = shapes.filter(shape => !shape.isReallyOffScreen() || shape.isGrabbed || shape.isPlacing);
   // Add new shapes if the count drops below a threshold to maintain flow
  while (shapes.length < 20) {
      shapes.push(new FloatingShape());
  }

  for (let shape of shapes) {
     // If the shape is not grabbed or landing animation, update its position
     if (!shape.isGrabbed && !shape.isPlacing) {
       shape.update();
     }
     // Always display shapes unless they are too far off-screen (handled by filter above)
     shape.display(this); // Use 'this' for the main graphics context
  }

  // --- Central White Canvas Area ---
  // Draw the central canvas graphics buffer onto the main canvas
  // First, clear and redraw the buffer
  canvasPG.clear();
  canvasPG.background(255); // White background

  // Draw a border around the canvas area on the main canvas
  stroke(200); // Grey border
  noFill();
  rect(CANVAS_AREA_X, CANVAS_AREA_Y, CANVAS_AREA_W, CANVAS_AREA_H);


  // Draw placed items onto the central canvas graphics buffer (canvasPG)
  // Filter out items that somehow ended up outside the expected bounds (shouldn't happen with correct logic)
   placedItems = placedItems.filter(item =>
        item.x >= CANVAS_AREA_X && item.x <= CANVAS_AREA_X + CANVAS_AREA_W &&
        item.y >= CANVAS_AREA_Y && item.y <= CANVAS_AREA_Y + CANVAS_AREA_H
   );

  for (let i = placedItems.length - 1; i >= 0; i--) {
      let item = placedItems[i];
       item.updateLanding(); // Update landing animation state
      item.displayOnCanvasPG(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y); // Draw relative to canvasPG
  }

  // Draw the graphics buffer containing the placed items onto the main canvas
  image(canvasPG, CANVAS_AREA_X, CANVAS_AREA_Y);

  // Draw vertical separation lines - REMOVED per user request


  // Draw grabbed item on top of everything else with hover effect
  if (grabbedItem) {
    // Make grabbed item smoothly follow the mouse
     grabbedItem.x = lerp(grabbedItem.x, mouseX, 0.3); // Smoother follow
     grabbedItem.y = lerp(grabbedItem.y, mouseY, 0.3);

    // Ensure grabbed item stays in shapes array for drawing (already handled by mousePressed/Released)
    grabbedItem.display(this, true); // Pass 'this' and 'true' for grabbed effect
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

  // Position PL elements relative to the last button (SAVE)
  let plElementX = saveButton.x + saveButton.width + 25; // Align with button spacing
  let circleDiameter = 20;
  let circleSpacing = 10;

  noStroke();
  fill(180); // A bit darker grey than header
  ellipse(plElementX, HEADER_HEIGHT / 2, circleDiameter);
  ellipse(plElementX + circleDiameter + circleSpacing, HEADER_HEIGHT / 2, circleDiameter);

  fill(50); // Text color
  text("PL", plElementX, HEADER_HEIGHT / 2 + 2); // +2 offset for better centering maybe

  // Scale button appearance update removed as buttons are removed
  // --- END HEADER DRAWING ---
}

function mousePressed() {
  // Don't grab if mouse is in the header area (where UI elements are)
   // Let p5.js handle button clicks, but prevent canvas drag interactions if over header
  if (mouseY < HEADER_HEIGHT) return; // Allow interaction below header

  // Check placed items first for selection/re-grabbing
   // Iterate backwards to grab top item if overlapping
   for (let i = placedItems.length - 1; i >= 0; i--) {
       // Pass mouseX, mouseY to isMouseOver
       if (placedItems[i].isMouseOver(mouseX, mouseY)) {
           grabbedItem = placedItems[i];
           grabbedItem.isGrabbed = true;
           grabbedItem.isLanding = false; // Stop any potential landing animation
           grabbedItem.solidify(); // Keep properties static while grabbed

           // Remove from placedItems array and add to shapes array
           // (so it draws on top in 'shapes' loop and can be dropped elsewhere)
           let temp = placedItems.splice(i, 1)[0];
           shapes.push(temp);

           // Update input field if the grabbed item is text
           if (grabbedItem.type === 'text') {
               inputElement.value(grabbedItem.content);
           } else {
               // Optionally clear/reset input if a non-text item is grabbed
                inputElement.value(random(TEXT_OPTIONS.slice(1))); // Set to a random non-placeholder text
           }

           return; // Only grab one item
       }
   }

  // If no placed item grabbed, check floating shapes
   // Iterate backwards to grab the most recently added (drawn last, visually on top)
  for (let i = shapes.length - 1; i >= 0; i--) {
    // Check only shapes not currently being placed or grabbed by other logic
    if (!shapes[i].isPlacing && !shapes[i].isGrabbed && shapes[i].isMouseOver(mouseX, mouseY)) {
      grabbedItem = shapes[i];
      grabbedItem.isGrabbed = true;

      // Bring grabbed item to the top of the shapes array for drawing order
      let temp = shapes.splice(i, 1)[0];
      shapes.push(temp);

      // Update input field if the grabbed item is text
      if (grabbedItem.type === 'text') {
          inputElement.value(grabbedItem.content);
      } else {
           // Optionally clear/reset input if a non-text item is grabbed
           inputElement.value(random(TEXT_OPTIONS.slice(1))); // Set to a random non-placeholder text
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

      // If it's a text item, apply the current input field value
      if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value();
      }

      // --- Apply Rotation Snapping Here ---
      // SNAP_INCREMENT_RADIANS is initialized in setup()
      grabbedItem.rotation = snapAngle(grabbedItem.rotation, SNAP_INCREMENT_RADIANS);
      // -----------------------------------

      placedItems.push(grabbedItem);
      grabbedItem.isPlacing = true; // Start landing animation
      grabbedItem.landFrame = frameCount; // Record landing frame

      // Remove from shapes array (handled by filter in draw now?) Let's ensure it's removed explicitly
      shapes = shapes.filter(s => s !== grabbedItem); // Re-filter shapes array


    } else {
        // Dropped outside canvas area
        // If it's a text item, update its content from the input
        if (grabbedItem.type === 'text') {
           grabbedItem.content = inputElement.value();
        }

        // Dropped outside = it becomes a regular floating shape again
        // No snapping applied when dropped outside
        // grabbedItem.reset(); // Reset to float again (includes placing off-screen)
        // If reset() forces it off-screen, it will be handled by the filter in draw.
        // If we don't call reset(), it will continue floating from its drop position.
        // Let's keep the current behavior where it continues floating from its drop position if not reset().
        // If it was grabbed from placedItems, it was added to shapes, and will stay there until it floats off.
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

    // Scale grabbed item using +/- keys (Reinstated)
    if (grabbedItem) {
      if (key === '+' || key === '=') { // '+' or '=' for scale up
          grabbedItem.scaleFactor *= 1.1;
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor; // Update visual size
      }
      if (key === '-') { // '-' for scale down
          grabbedItem.scaleFactor *= 0.9;
          grabbedItem.currentSize = grabbedItem.size * grabbedItem.scaleFactor; // Update visual size
      }
       // Prevent default browser actions for +/- keys
        return false;
    }
     // Allow other keys to pass through
     return true;
}

// Handler for Scale Up button - REMOVED
// function scaleUpItem() { /* ... */ }

// Handler for Scale Down button - REMOVED
// function scaleDownItem() { /* ... */ }


// Function tied to the new 'Add Text' button click
function addNewTextShapeFromInput() {
   let currentText = inputElement.value();
    if (!currentText || currentText.trim() === "") {
        currentText = random(TEXT_OPTIONS.slice(1)); // Default to random text if empty input
    }

    let newTextShape = new FloatingShape(); // Creates off-screen initially
    newTextShape.type = 'text';
    newTextShape.content = currentText.trim(); // Trim whitespace

    // Assign properties based on a 'medium' size category feel for manually added text
    // Access sizeCategories (defined globally)
    let mediumCategory = sizeCategories.find(cat => cat.name === 'medium');
     if (mediumCategory) {
         newTextShape.size = random(mediumCategory.sizeRange[0], mediumCategory.sizeRange[1]);
         newTextShape.scaleFactor = 1.0; // Start with base scale 1
         newTextShape.textScaleAdjust = mediumCategory.textScaleAdjust;
         newTextShape.currentSize = newTextShape.size * newTextShape.scaleFactor;
     } else { // Fallback if category not found (shouldn't happen with const)
        newTextShape.size = 150; // Default text base size
        newTextShape.scaleFactor = 1.0;
         newTextShape.textScaleAdjust = 0.2; // Default adjustment
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

    // Give it some movement initially
    newTextShape.speedX = random(-2, 2);
    newTextShape.speedY = random(-2, 2);
     // Give a gentle push towards the center maybe? Depends on aesthetic
      // newTextShape.speedX = lerp(newTextShape.speedX, (width/2 - newTextShape.x)/200, 0.5); // Subtle push towards center X
      // newTextShape.speedY = lerp(newTextShape.speedY, (height/2 - newTextShape.y)/200, 0.5); // Subtle push towards center Y


    // Use a distinct color, not matching background
    let pickedColor;
    do {
        pickedColor = color(random(PALETTE));
        // Re-pick if the color is very dark on black background (brightness < 50)
    } while (brightness(pickedColor) < 50);
     newTextShape.color = pickedColor;


    shapes.push(newTextShape); // Add to the floating shapes array

    // Clear the input field or reset to placeholder
    inputElement.value(random(TEXT_OPTIONS.slice(1)));
    inputElement.elt.focus(); // Keep focus on the input field
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
    // Optionally normalize the angle to be within [0, TWO_PI)
    // snapped = snapped % TWO_PI;
    // if (snapped < 0) snapped += TWO_PI;
    return snapped;
}


// Random button action - clears FLOATING items and adds new random floating shapes
function resetRandom() {
    // Keep placed items, clear only floating shapes
    shapes = []; // Clear existing floating shapes
    // Add a bunch of new floating shapes
    for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape()); // constructor handles positioning and typing
    }
     // Deselect grabbed item if it was floating
     if(grabbedItem && shapes.includes(grabbedItem)) {
        grabbedItem = null;
         inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input
     }
}

// Restart button action - clears everything and resets
function restartAll() {
    placedItems = []; // Clear placed items
    shapes = []; // Clear existing floating shapes
     grabbedItem = null;
     inputElement.value(random(TEXT_OPTIONS.slice(1))); // Reset input

    // Add initial shapes back
     for (let i = 0; i < 30; i++) {
      shapes.push(new FloatingShape());
    }
     // Reset graphics buffer state if necessary (clear should be enough)
     if (canvasPG) {
         canvasPG.clear();
     }
}

// Save function (uses canvasPG for the clipped area)
function saveCanvasArea() {
  if (canvasPG) {
    // The canvasPG is already drawn correctly in draw, reflecting the placed items
    // Ensure no transient states like landing are captured in the save render,
    // though they should be handled in the draw loop for canvasPG already.
    // Redrawing it explicitly here is a safer way for a save operation
    let finalPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
     finalPG.background(255); // White background

     for (let item of placedItems) {
          finalPG.push();
          // Translate to the item's position relative to finalPG's origin (top-left of canvas area)
          let displayX = item.x - CANVAS_AREA_X;
          let displayY = item.y - CANVAS_AREA_Y;
          finalPG.translate(displayX, displayY);

           // Apply transformations (rotation, main scale factor)
           finalPG.rotate(item.rotation);
           finalPG.scale(item.scaleFactor);

           finalPG.fill(item.color);
           // Draw without stroke on placed items for solid look like in reference
          finalPG.noStroke();

           // Use the helper to draw the actual shape or text onto the finalPG
           // Pass the correct arguments including textScaleAdjust if it's text
           item.drawShapePrimitive(finalPG, 0, 0, item.size, item.shapeType, item.type === 'text', item.textScaleAdjust);

          finalPG.pop();
     }

    save(finalPG, 'myArtboard_' + year() + month() + day() + '_' + hour() + minute() + second() + '.png');
     // Dispose the temporary buffer
     finalPG.remove();

  } else {
    console.warn("Canvas graphics buffer not created yet!");
  }
}


// WINDOW RESIZED FUNCTION
function windowResized() {
    // Keep the target canvas size, recalculate positions relative to it
    // Note: For true responsiveness, you might resize the main canvas here too
    resizeCanvas(1000, 1400);

    // Recalculate CANVAS_AREA dimensions based on the fixed W and ratio
    // CANVAS_AREA_W = 500; // Keep width fixed
    CANVAS_AREA_H = CANVAS_AREA_W * (5 / 4); // 4:5 ratio H = W * 5/4
    CANVAS_AREA_X = width / 2 - CANVAS_AREA_W / 2;
    // Calculate CANVAS_AREA_Y to center the white canvas vertically within the space below the header
    CANVAS_AREA_Y = HEADER_HEIGHT + ((height - HEADER_HEIGHT) - CANVAS_AREA_H) / 2;
     // Ensure it's not placed too high if canvas is small
    CANVAS_AREA_Y = max(HEADER_HEIGHT + 10, CANVAS_AREA_Y); // Minimum 10px below header


    // Reposition UI elements (DOM) - essential for usability
    // Add checks here to ensure elements exist before trying to position them
    // This prevents errors if windowResized is called before setup finishes creating elements
    if (inputElement) inputElement.position(20, HEADER_HEIGHT / 2 - 15);
    // Recalculate size based on new CANVAS_AREA_X
    if (inputElement) inputElement.size(CANVAS_AREA_X - 40 - 85);

    // Relies on inputElement existence, check both
    if (inputElement && addTextButton) addTextButton.position(inputElement.x + inputElement.width + 10, HEADER_HEIGHT / 2 - 15);

     // Recalculate button positions based on flow after canvas area
     let buttonXStart = CANVAS_AREA_X + CANVAS_AREA_W + 20; // Right of the central canvas
     let buttonSpacing = 10;
     let buttonPadY = 15; // Vertical padding

    // Check button existence before positioning them
    if (randomButton) randomButton.position(buttonXStart, HEADER_HEIGHT / 2 - buttonPadY);
    // Position RESTART relative to RANDOM - ensure both exist
    if (randomButton && restartButton) restartButton.position(randomButton.x + randomButton.width + buttonSpacing, HEADER_HEIGHT / 2 - buttonPadY);
    // Position SAVE relative to RESTART - ensure both exist
    if (restartButton && saveButton) saveButton.position(restartButton.x + restartButton.width + buttonSpacing, HEADER_HEIGHT / 2 - buttonPadY);


    // Recreate graphics buffer if canvas area size changes (essential after recalculating CANVAS_AREA_H)
    if (canvasPG) {
      canvasPG.resizeCanvas(CANVAS_AREA_W, CANVAS_AREA_H); // Resize the buffer
    } else {
         // Should ideally only create in setup, but resizeCanvas might fail if not previously created
         // if this is called very early before setup completes. Adding a check.
         if(CANVAS_AREA_W > 0 && CANVAS_AREA_H > 0) { // Ensure dimensions are valid
             canvasPG = createGraphics(CANVAS_AREA_W, CANVAS_AREA_H);
         }
     }
}