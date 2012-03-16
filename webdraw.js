//
// Global variables
//

// Wrapper for all WebGL functions and constants. Call initWebGL(canvas) to
// initialise it before using.
var gl;

// The shader we're using to draw the shapes.
var shaderProgram;

// The scene to draw. Just represented as an array of shapes, for now.
var scene = [];


//
// Functions
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


function makeShape(transform, drawType, size, points, colors)
{
  shape = {}
  shape.transform = transform;
  shape.drawType = drawType;
  shape.size = size;
  shape.pointBuffer = makeArrayBuffer(3, size, points);
  shape.colorBuffer = makeArrayBuffer(4, size, colors);
  return shape;
}


function drawShape(shape)
{
  var mvpMatrix = mat4.create();

  mat4.multiply(gl.projectionMatrix, gl.modelviewMatrix, mvpMatrix);
  mat4.multiply(mvpMatrix, shape.transform, mvpMatrix);
  gl.uniformMatrix4fv(shaderProgram.mvpMatrixUniform, false, mvpMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, shape.pointBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPosAttr, shape.pointBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, shape.colorBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexColorAttr, shape.colorBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.drawArrays(shape.drawType, 0, shape.size);
}


function drawScene(theScene)
{
  for (var i = 0; i < theScene.length; i++)
    drawShape(theScene[i]);
}


//
// Setup
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

  shaderProgram = makeShaderProgram(vertexShader, fragmentShader);

  gl.useProgram(shaderProgram);

  shaderProgram.mvpMatrixUniform = gl.getUniformLocation(shaderProgram, "mvpMatrix");

  shaderProgram.vertexPosAttr = gl.getAttribLocation(shaderProgram, "vertexPos");
  shaderProgram.vertexColorAttr = gl.getAttribLocation(shaderProgram, "vertexColor");

  gl.enableVertexAttribArray(shaderProgram.vertexPosAttr);
  gl.enableVertexAttribArray(shaderProgram.vertexColorAttr);
}


function initScene()
{
  var triangleTransform = mat4.create();
  mat4.identity(triangleTransform);
  mat4.translate(triangleTransform, [-1.5, 0.0, -7.0]);
  var triangle = makeShape(triangleTransform, gl.TRIANGLES, 3, [
     0.0,  1.0,  0.0,
    -1.0, -1.0,  0.0,
     1.0, -1.0,  0.0
  ], [
    1.0, 0.0, 0.0, 1.0,
    0.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 1.0
  ]);
  scene.push(triangle);

  var squareTransform = mat4.create();
  mat4.identity(squareTransform);
  mat4.translate(squareTransform, [1.5, 0.0, -7.0]);
  var square = makeShape(squareTransform, gl.TRIANGLE_STRIP, 4, [
     1.0,  1.0,  0.0,
    -1.0,  1.0,  0.0,
     1.0, -1.0,  0.0,
    -1.0, -1.0,  0.0
  ], [
    1.0, 0.0, 0.0, 1.0,
    0.0, 1.0, 0.0, 1.0,
    1.0, 0.0, 1.0, 1.0,
    0.0, 1.0, 1.0, 1.0
  ]);
  scene.push(square);
}


function webGLStart(canvasId)
{
  var canvas = document.getElementById(canvasId);
  initWebGL(canvas);

  initShaders();
  initScene();

  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  drawScene(scene);
}
