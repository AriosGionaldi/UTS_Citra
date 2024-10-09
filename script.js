let inputImage = null;
let processedImage = null;
const inputCanvas = document.getElementById("inputCanvas");
const outputCanvas = document.getElementById("outputCanvas");
const rotationSlider = document.getElementById("rotationSlider");
const rotationValue = document.getElementById("rotationValue");
let filename = "";
let activeFilters = [];

function loadImage(event) {
  const file = event.target.files[0];
  fileName = file.name.split(".").slice(0, -1).join(".");
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      inputImage = img;
      processedImage = img;
      drawImageOnCanvas(img, inputCanvas);
      drawImageOnCanvas(img, outputCanvas);
      resetSlider();
      activeFilters = [];
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function drawImageOnCanvas(img, canvas) {
  const aspectRatio = img.width / img.height;
  const maxWidth = 500;
  const maxHeight = 500;

  let newWidth = img.width;
  let newHeight = img.height;

  if (newWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = newWidth / aspectRatio;
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }

  canvas.width = maxWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    img,
    (maxWidth - newWidth) / 2,
    (maxHeight - newHeight) / 2,
    newWidth,
    newHeight
  );
}

function processImage(operation) {
  if (!processedImage) return;

  const src = cv.imread(outputCanvas);
  let dst = new cv.Mat();

  switch (operation) {
    case "grayscale":
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
      activeFilters = ["grayscale"];
      break;
    case "threshold":
      cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
      cv.threshold(src, dst, 127, 255, cv.THRESH_BINARY);
      activeFilters = ["threshold"];
      break;
    case "brightness":
      src.convertTo(dst, -1, 1, 50);
      activeFilters = ["brightness"];
      break;
    case "flipHorizontal":
      cv.flip(src, dst, 1);
      activeFilters.push("flipHorizontal");
      break;
    case "flipVertical":
      cv.flip(src, dst, 0);
      activeFilters.push("flipVertical");
      break;
    default:
      dst = src.clone();
  }

  cv.imshow(outputCanvas, dst);
  processedImage = outputCanvas;

  src.delete();
  dst.delete();
}

function rotateImage() {
  if (!processedImage) return;

  const angle = parseInt(rotationSlider.value);
  rotationValue.textContent = angle;

  const src = cv.imread(inputCanvas);
  let dst = new cv.Mat();

  // Hitung ukuran baru untuk menampung gambar yang dirotasi
  const cosAngle = Math.abs(Math.cos((angle * Math.PI) / 180));
  const sinAngle = Math.abs(Math.sin((angle * Math.PI) / 180));
  const newWidth = Math.ceil(src.cols * cosAngle + src.rows * sinAngle);
  const newHeight = Math.ceil(src.cols * sinAngle + src.rows * cosAngle);

  // Sesuaikan ukuran canvas output
  outputCanvas.width = newWidth;
  outputCanvas.height = newHeight;

  // Buat matriks rotasi
  let center = new cv.Point(src.cols / 2, src.rows / 2);
  let M = cv.getRotationMatrix2D(center, angle, 1);

  // Sesuaikan matriks rotasi untuk memindahkan pusat gambar ke pusat output
  M.data[2] += newWidth / 2 - center.x;
  M.data[5] += newHeight / 2 - center.y;

  // Terapkan transformasi affine
  let dsize = new cv.Size(newWidth, newHeight);
  cv.warpAffine(
    src,
    dst,
    M,
    dsize,
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar(0, 0, 0, 0)
  );

  // Terapkan kembali filter aktif
  activeFilters.forEach((filter) => {
    let tempDst = new cv.Mat();
    switch (filter) {
      case "grayscale":
        cv.cvtColor(dst, tempDst, cv.COLOR_RGBA2GRAY, 0);
        break;
      case "threshold":
        cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
        cv.threshold(dst, tempDst, 127, 255, cv.THRESH_BINARY);
        break;
      case "brightness":
        dst.convertTo(tempDst, -1, 1, 50);
        break;
      case "flipHorizontal":
        cv.flip(dst, tempDst, 1);
        break;
      case "flipVertical":
        cv.flip(dst, tempDst, 0);
        break;
    }
    if (!tempDst.empty()) {
      dst = tempDst.clone();
    }
    tempDst.delete();
  });

  // Gambar hasil rotasi ke canvas output
  cv.imshow(outputCanvas, dst);

  processedImage = outputCanvas;

  M.delete();
  src.delete();
  dst.delete();
}

function resetImage() {
  if (!inputImage) return;
  processedImage = inputImage;
  drawImageOnCanvas(inputImage, outputCanvas);
  resetSlider();
  activeFilters = [];
}

function resetSlider() {
  rotationSlider.value = 0;
  rotationValue.textContent = 0;
}

function saveImage() {
  if (!processedImage) return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Dapatkan data gambar dari canvas output
  const imageData = outputCanvas
    .getContext("2d")
    .getImageData(0, 0, outputCanvas.width, outputCanvas.height);

  // Temukan bounding box dari piksel non-transparan
  let minX = outputCanvas.width,
    minY = outputCanvas.height,
    maxX = 0,
    maxY = 0;

  for (let y = 0; y < outputCanvas.height; y++) {
    for (let x = 0; x < outputCanvas.width; x++) {
      const alpha = imageData.data[(y * outputCanvas.width + x) * 4 + 3];
      if (alpha !== 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Atur ukuran canvas sesuai dengan bounding box
  canvas.width = maxX - minX + 1;
  canvas.height = maxY - minY + 1;

  // Gambar hanya bagian non-transparan dari gambar
  ctx.drawImage(
    outputCanvas,
    minX,
    minY,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Simpan gambar sebagai PNG dengan latar belakang transparan
  const link = document.createElement("a");
  link.download = `${fileName}-edit.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.getElementById("fileInput").addEventListener("change", loadImage);
rotationSlider.addEventListener("input", rotateImage);

function onOpenCvReady() {
  console.log("OpenCV.js siap");
}
