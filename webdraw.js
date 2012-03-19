/* Requires the following libraries:
 * - glMatrix    http://github.com/toji/gl-matrix
 * - webgl-utils https://cvs.khronos.org/svn/repos/registry/trunk/public/webgl/sdk/demos/common/webgl-utils.js
 */


//
// Global variables
//

// Wrapper for all WebGL functions and constants. Call initWebGL(canvas) to
// initialise it before using.
var gl;

// The last time at which we updated the animation.
var gLastTime = 0;

// Dict of which keys are currently pressed.
var gKeysDown = {}


//
// Construction functions
//

function makeShaderFromElement(id)
{
  var shaderElement = document.getElementById(id);
  if (!shaderElement)
    return null;

  var shaderText = shaderElement.textContent;
  if (!shaderText)
    return null;

  var shader;
  if (shaderElement.type == "x-shader/x-fragment")
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  else if (shaderElement.type == "x-shader/x-vertex")
    shader = gl.createShader(gl.VERTEX_SHADER);
  else
    return null;

  gl.shaderSource(shader, shaderText);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert("Shader compilation failed for " + id + ":\n" + gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}


function makeShaderProgram(vertexShader, fragmentShader)
{
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);

  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Shader linking failed:\n" + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}


function makeArrayBuffer(itemSize, numItems, data)
{
  var buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

  buffer.itemSize = itemSize;
  buffer.numItems = numItems;

  return buffer;
}


function makeTexture(textureURL)
{
  var texture = gl.createTexture();
  texture.isLoaded = false;
  texture.image = new Image();
  texture.image.onload = function() {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
    texture.isLoaded = true;
  }
  texture.image.src = textureURL;
  return texture;
}


function makeShape(drawType, size, points, texCoords, texture)
{
  shape = {}
  shape.drawType = drawType;
  shape.size = size;
  shape.pointBuffer = makeArrayBuffer(3, size, points);
  //shape.colorBuffer = makeArrayBuffer(4, size, colors);
  shape.texCoordBuffer = makeArrayBuffer(2, size, texCoords);
  shape.texture = texture;
  return shape;
}


function makeSceneNode()
{
  var node = {}
  node.transform = null;
  node.shape = null;
  node.animate = null;
  node.children = null
  return node;
}


function makeScene()
{
  var scene = {}
  scene.rootNode = makeSceneNode();
  scene.cameraTransform = mat4.create();

  mat4.identity(scene.cameraTransform);

  return scene;
}


//
// Scenegraph traversal
//

// Does a top-down, depth-first traversal of the scene graph. Calculates the
// current transform matrix as it goes and invokes a visitor function at each
// node.
//
// The visitor function is expected to have this signature:
//
//    visitor(node, transform, extraArgs)
//
// where 'node' is the node we're visiting; 'transform' is the local-to-world
// transformation matrix for the node; and 'extraArgs' is any extra data that
// you want to call the visitor function with.
function walkSceneGraph(node, visitor, visitorExtraArgs, parentTransform)
{
  // Provide a default value for the parentTransform if none is specified.
  if (!parentTransform) {
    parentTransform = mat4.create();
    mat4.identity(parentTransform);
  }

  // Calculate the local transform for this node.
  var localTransform;
  if (node.transform) {
    localTransform = mat4.create();
    mat4.multiply(parentTransform, node.transform, localTransform);
  }
  else {
    localTransform = parentTransform;
  }

  // Invoke the visitor function for this node.
  visitor(node, localTransform, visitorExtraArgs);

  // Now visit the child nodes.
  if (node.children) {
    for (var i = 0; i < node.children.length; i++)
      walkSceneGraph(node.children[i], visitor, visitorExtraArgs, localTransform);
  }
}


//
// Drawing functions
//

function drawShape(node, transform, shaderProgram)
{
  if (!node.shape)
    return;

  var shape = node.shape;
  var mvpMatrix = mat4.create();

  mat4.multiply(gl.projectionMatrix, gl.modelviewMatrix, mvpMatrix);
  mat4.multiply(mvpMatrix, transform, mvpMatrix);
  gl.uniformMatrix4fv(shaderProgram.mvpMatrixUniform, false, mvpMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, shape.pointBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPosAttr, shape.pointBuffer.itemSize, gl.FLOAT, false, 0, 0);

  /*
  gl.bindBuffer(gl.ARRAY_BUFFER, shape.colorBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexColorAttr, shape.colorBuffer.itemSize, gl.FLOAT, false, 0, 0);
  */

  gl.bindBuffer(gl.ARRAY_BUFFER, shape.texCoordBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexTexCoordAttr, shape.texCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, shape.texture);
  gl.uniform1i(shaderProgram.texUniform, 0);

  gl.drawArrays(shape.drawType, 0, shape.size);

  gl.bindTexture(gl.TEXTURE_2D, null);
}


function drawScene(scene, shaderProgram)
{
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(shaderProgram);

  if (scene.cameraTransform) {
    var transform = mat4.create();
    mat4.inverse(scene.cameraTransform, transform);

    walkSceneGraph(scene.rootNode, drawShape, shaderProgram, transform);
  }
  else {
    walkSceneGraph(scene.rootNode, drawShape);
  }
}


//
// Input handling
//

function handleKeyPressed(event)
{
  gKeysDown[event.keyCode] = true;
}


function handleKeyReleased(event)
{
  gKeysDown[event.keyCode] = false;
}


function handleKeys(scene)
{
  var speed = 0.2;
  if (gKeysDown[37]) // left arrow
    mat4.translate(scene.cameraTransform, [-speed, 0, 0]);
  if (gKeysDown[39]) // right arrow
    mat4.translate(scene.cameraTransform, [speed, 0, 0]);
  if (gKeysDown[38]) // up arrow
    mat4.translate(scene.cameraTransform, [0.0, speed, 0]);
  if (gKeysDown[40]) // down arrow
    mat4.translate(scene.cameraTransform, [0.0, -speed, 0]);
}


//
// Setup functions
//

function initWebGL(canvas)
{
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl)
    return;

  gl.viewportWidth = canvas.width;
  gl.viewportHeight = canvas.height;

  // Set up the default camera projection matrix.
  gl.projectionMatrix = mat4.create();
  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, gl.projectionMatrix);

  // Set up the base modelview matrix.
  gl.modelviewMatrix = mat4.create();
  mat4.identity(gl.modelviewMatrix);
}


function initShaders()
{
  var vertexShader = makeShaderFromElement("shader-vs");
  var fragmentShader = makeShaderFromElement("shader-fs");

  var shaderProgram = makeShaderProgram(vertexShader, fragmentShader);

  gl.useProgram(shaderProgram);

  shaderProgram.mvpMatrixUniform = gl.getUniformLocation(shaderProgram, "mvpMatrix");
  shaderProgram.texUniform = gl.getUniformLocation(shaderProgram, "tex");

  shaderProgram.vertexPosAttr = gl.getAttribLocation(shaderProgram, "vertexPos");
  //shaderProgram.vertexColorAttr = gl.getAttribLocation(shaderProgram, "vertexColor");
  shaderProgram.vertexTexCoordAttr = gl.getAttribLocation(shaderProgram, "vertexTexCoord");

  gl.enableVertexAttribArray(shaderProgram.vertexPosAttr);
  //gl.enableVertexAttribArray(shaderProgram.vertexColorAttr);
  gl.enableVertexAttribArray(shaderProgram.vertexTexCoordAttr);

  gl.useProgram(null);

  return shaderProgram;
}


function initScene()
{
  var texture = makeTexture("crate.gif");

  var triangle = makeSceneNode();
  triangle.transform = mat4.create();
  mat4.identity(triangle.transform);
  mat4.translate(triangle.transform, [-1.5, 0.0, -7.0]);
  triangle.shape = makeShape(gl.TRIANGLES, 3, [
     0.0,  1.0,  0.0,
    -1.0, -1.0,  0.0,
     1.0, -1.0,  0.0
  ], [
    1.0, 0.0,// 0.0, 1.0,
    0.0, 1.0,// 0.0, 1.0,
    0.0, 0.0//, 1.0, 1.0
  ], texture);
  triangle.animate = function(animElapsed) {
    mat4.rotate(triangle.transform, radians(90) * animElapsed, [0, 1, 0]);
  };

  var square = makeSceneNode();
  square.transform = mat4.create();
  mat4.identity(square.transform);
  mat4.translate(square.transform, [1.5, 0.0, -7.0]);
  square.shape = makeShape(gl.TRIANGLE_STRIP, 4, [
     1.0,  1.0,  0.0,
    -1.0,  1.0,  0.0,
     1.0, -1.0,  0.0,
    -1.0, -1.0,  0.0
  ], [
    1.0, 1.0,// 0.0, 1.0,
    0.0, 1.0,// 0.0, 1.0,
    1.0, 0.0,// 1.0, 1.0,
    0.0, 0.0//, 1.0, 1.0
  ], texture);
  square.animate = function(animElapsed) {
    mat4.rotate(square.transform, radians(60) * animElapsed, [1, 0, 0]);
  };

  var scene = makeScene();
  scene.rootNode.children = [ triangle, square ];

  mat4.translate(scene.cameraTransform, [0.0, 1.0, 0]);
  mat4.rotate(scene.cameraTransform, radians(5), [1.0, 0.0, 0.0]);

  return scene;
}


//
// Animation functions
//

function animationVisitor(node, transform, elapsed)
{
  if (node.animate)
    node.animate(elapsed);
}


function animate(scene)
{
  var timeNow = new Date().getTime();
  if (gLastTime != 0) {
    var elapsed = (timeNow - gLastTime) / 1000.0;
    walkSceneGraph(scene.rootNode, animationVisitor, elapsed);
  }
  gLastTime = timeNow;
}


//
// Helpers
//

function radians(angleInDegrees)
{
  return angleInDegrees * Math.PI / 180.0;
}


//
// Main
//

function webGLStart(canvasId)
{
  var canvas = document.getElementById(canvasId);
  initWebGL(canvas);

  var gShaderProgram = initShaders();
  var gScene = initScene();

  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  document.onkeydown = handleKeyPressed;
  document.onkeyup = handleKeyReleased;

  tick = function () {
    window.requestAnimFrame(tick);
    handleKeys(gScene);
    drawScene(gScene, gShaderProgram);
    animate(gScene);
  }
  tick();
}

