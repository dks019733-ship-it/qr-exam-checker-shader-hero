import { getOmrBubbleCenter, OMR_GRID, OMR_MARKER_CENTERS, OMR_PAGE_HEIGHT, OMR_PAGE_WIDTH } from "@/lib/omr-layout";

export type OmrIssue = {
  question: number;
  reason: "MULTIPLE_MARKS" | "UNCLEAR_MARK";
  scores: number[];
};

export type OmrReadResult = {
  answers: Record<string, string>;
  issues: OmrIssue[];
  recognizedCount: number;
  questionCount: number;
};

type Point = { x: number; y: number };
type Component = { x: number; y: number; width: number; height: number; area: number };

function grayscale(data: Uint8ClampedArray, index: number) {
  return (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
}

function findMarkerCenters(source: ImageData): Point[] {
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / source.width);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("ไม่สามารถประมวลผลภาพจากกล้องได้");
  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = source.width;
  inputCanvas.height = source.height;
  const inputContext = inputCanvas.getContext("2d");
  if (!inputContext) throw new Error("ไม่สามารถอ่านภาพจากกล้องได้");
  inputContext.putImageData(source, 0, 0);
  context.drawImage(inputCanvas, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const visited = new Uint8Array(width * height);
  const candidates: Component[] = [];
  const queue = new Int32Array(width * height);

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start]) continue;
    const offset = start * 4;
    if (grayscale(pixels, offset) > 72) {
      visited[start] = 1;
      continue;
    }

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;

    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [current - 1, current + 1, current - width, current + width];
      for (const next of neighbors) {
        if (next < 0 || next >= width * height || visited[next]) continue;
        const nx = next % width;
        const ny = Math.floor(next / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        visited[next] = 1;
        if (grayscale(pixels, next * 4) <= 72) queue[tail++] = next;
      }
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const fillRatio = area / (componentWidth * componentHeight);
    const aspect = componentWidth / componentHeight;
    if (area >= 12 && area <= 1800 && componentWidth >= 3 && componentHeight >= 3 &&
        componentWidth <= 28 && componentHeight <= 28 && aspect >= 0.68 && aspect <= 1.46 &&
        fillRatio >= 0.62) {
      candidates.push({
        x: ((minX + maxX) / 2) / scale,
        y: ((minY + maxY) / 2) / scale,
        width: componentWidth / scale,
        height: componentHeight / scale,
        area,
      });
    }
  }

  if (candidates.length < 4) throw new Error("ตรวจไม่พบสี่เหลี่ยมดำครบ 4 มุม กรุณาจัดกระดาษให้เห็นขอบทั้งแผ่นและถ่ายใหม่");

  const choose = (score: (point: Component) => number, direction: "min" | "max") => {
    const sorted = [...candidates].sort((a, b) => direction === "min" ? score(a) - score(b) : score(b) - score(a));
    return sorted[0];
  };
  const selected = [
    choose((p) => p.x + p.y, "min"),
    choose((p) => p.x - p.y, "max"),
    choose((p) => p.x + p.y, "max"),
    choose((p) => p.x - p.y, "min"),
  ];
  const unique = new Set(selected.map((p) => candidates.indexOf(p)));
  if (unique.size !== 4) throw new Error("ตรวจจับจุดอ้างอิงกระดาษไม่ครบ กรุณาถ่ายภาพใหม่โดยไม่ตัดขอบกระดาษ");

  const [tl, tr, br, bl] = selected;
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (cross(tl, tr, br) <= 0 || cross(tr, br, bl) <= 0 || cross(br, bl, tl) <= 0 || cross(bl, tl, tr) <= 0) {
    throw new Error("มุมกระดาษไม่ชัดเจน กรุณาวางกระดาษให้ตรงและถ่ายใหม่");
  }
  const area = Math.abs(cross(tl, tr, br) + cross(tl, br, bl)) / 2;
  if (area < source.width * source.height * 0.08) throw new Error("กระดาษอยู่ไกลเกินไป กรุณาขยับกล้องเข้าใกล้");
  return selected.map(({ x, y }) => ({ x, y }));
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-9) throw new Error("ไม่สามารถปรับมุมภาพกระดาษได้");
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let j = column; j <= size; j += 1) augmented[column][j] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let j = column; j <= size; j += 1) augmented[row][j] -= factor * augmented[column][j];
    }
  }
  return augmented.map((row) => row[size]);
}

function getHomography(sourcePoints: Point[]) {
  const targetPoints = OMR_MARKER_CENTERS;
  const matrix: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = targetPoints[index];
    const { x: u, y: v } = sourcePoints[index];
    matrix.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    values.push(v);
  }
  return solveLinearSystem(matrix, values);
}

function rectify(source: ImageData, sourcePoints: Point[]) {
  const homography = getHomography(sourcePoints);
  const output = new ImageData(OMR_PAGE_WIDTH, OMR_PAGE_HEIGHT);
  for (let y = 0; y < OMR_PAGE_HEIGHT; y += 1) {
    for (let x = 0; x < OMR_PAGE_WIDTH; x += 1) {
      const denominator = homography[6] * x + homography[7] * y + 1;
      if (Math.abs(denominator) < 1e-8) continue;
      const sx = Math.round((homography[0] * x + homography[1] * y + homography[2]) / denominator);
      const sy = Math.round((homography[3] * x + homography[4] * y + homography[5]) / denominator);
      if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) continue;
      const sourceIndex = (sy * source.width + sx) * 4;
      const targetIndex = (y * OMR_PAGE_WIDTH + x) * 4;
      output.data[targetIndex] = source.data[sourceIndex];
      output.data[targetIndex + 1] = source.data[sourceIndex + 1];
      output.data[targetIndex + 2] = source.data[sourceIndex + 2];
      output.data[targetIndex + 3] = 255;
    }
  }
  return output;
}

function readBubble(image: ImageData, center: Point) {
  let total = 0;
  let count = 0;
  const radius = OMR_GRID.bubbleDiameter / 2 - 1.5;
  for (let y = Math.floor(center.y - radius); y <= Math.ceil(center.y + radius); y += 1) {
    for (let x = Math.floor(center.x - radius); x <= Math.ceil(center.x + radius); x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      if ((x - center.x) ** 2 + (y - center.y) ** 2 > radius ** 2) continue;
      total += grayscale(image.data, (y * image.width + x) * 4);
      count += 1;
    }
  }
  return count ? 1 - total / (count * 255) : 0;
}

export async function readOmrImage(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  questionCount: number,
  choiceKeys: string[],
): Promise<OmrReadResult> {
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
    throw new Error("จำนวนข้อสอบไม่อยู่ในช่วงที่รองรับ (1–100 ข้อ)");
  }
  if (choiceKeys.length < 4 || choiceKeys.length > 5) throw new Error("รองรับข้อสอบ 4 หรือ 5 ตัวเลือกเท่านั้น");

  const canvas = document.createElement("canvas");
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) throw new Error("ยังไม่มีภาพจากกล้อง กรุณารอให้กล้องจับภาพได้ก่อน");
  const imageScale = Math.min(1, 1600 / Math.max(width, height));
  const processingWidth = Math.max(1, Math.round(width * imageScale));
  const processingHeight = Math.max(1, Math.round(height * imageScale));
  canvas.width = processingWidth;
  canvas.height = processingHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("เบราว์เซอร์ไม่สามารถประมวลผลภาพได้");
  context.drawImage(source, 0, 0, processingWidth, processingHeight);
  const sourceImage = context.getImageData(0, 0, processingWidth, processingHeight);
  const markerCenters = findMarkerCenters(sourceImage);
  const normalized = rectify(sourceImage, markerCenters);

  const answers: Record<string, string> = {};
  const issues: OmrIssue[] = [];
  let recognizedCount = 0;
  for (let question = 1; question <= questionCount; question += 1) {
    const scores = choiceKeys.map((_, choiceIndex) => readBubble(normalized, getOmrBubbleCenter(question, choiceIndex, choiceKeys.length)));
    const ranked = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
    const first = ranked[0];
    const second = ranked[1];
    if (first.score < 0.16) {
      answers[String(question)] = "";
      continue;
    }
    if (second.score >= 0.16) {
      answers[String(question)] = "";
      issues.push({ question, reason: "MULTIPLE_MARKS", scores });
      continue;
    }
    if (first.score < 0.22 || first.score - second.score < 0.08) {
      answers[String(question)] = "";
      issues.push({ question, reason: "UNCLEAR_MARK", scores });
      continue;
    }
    answers[String(question)] = choiceKeys[first.index];
    recognizedCount += 1;
  }

  return { answers, issues, recognizedCount, questionCount };
}
