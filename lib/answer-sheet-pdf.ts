"use client";

import { PDFDocument } from "pdf-lib";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

async function imageToDataUrl(image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  if (!source || source.startsWith("data:")) return source;

  const response = await fetch(source, { credentials: "same-origin" });
  if (!response.ok) throw new Error("โหลดรูปภาพบนกระดาษคำตอบไม่สำเร็จ");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านรูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

async function inlineComputedStyles(source: Element, target: Element): Promise<void> {
  const computed = window.getComputedStyle(source);
  const style = (target as HTMLElement | SVGElement).style;
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }

  if (source instanceof HTMLImageElement && target instanceof HTMLImageElement) {
    target.src = await imageToDataUrl(source);
    target.removeAttribute("srcset");
    target.style.objectFit = computed.objectFit;
    await target.decode();
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index];
    const targetChild = targetChildren[index];
    if (sourceChild && targetChild) await inlineComputedStyles(sourceChild, targetChild);
  }
}

async function renderSheetToPng(element: HTMLElement): Promise<Uint8Array> {
  await document.fonts?.ready;
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (image.complete) {
      if (image.naturalWidth === 0) throw new Error("โหลด QR Code หรือโลโก้ไม่สำเร็จ");
      return;
    }
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("โหลด QR Code หรือโลโก้ไม่สำเร็จ")), { once: true });
    });
  }));

  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clone.style.width = `${PAGE_WIDTH}px`;
  clone.style.height = `${PAGE_HEIGHT}px`;
  clone.style.margin = "0";
  clone.style.transform = "none";
  await inlineComputedStyles(element, clone);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = new Image();
    image.decoding = "sync";
    image.src = svgUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    const scale = 3;
    canvas.width = PAGE_WIDTH * scale;
    canvas.height = PAGE_HEIGHT * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์ไม่รองรับการสร้าง PDF");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("สร้างภาพกระดาษคำตอบไม่สำเร็จ")), "image/png");
    });
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function downloadAnswerSheetsPdf(elements: HTMLElement[], filename: string) {
  if (elements.length === 0) throw new Error("ไม่พบกระดาษคำตอบสำหรับสร้าง PDF");

  const pdf = await PDFDocument.create();
  for (const element of elements) {
    const pngBytes = await renderSheetToPng(element);
    const image = await pdf.embedPng(pngBytes);
    const page = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    page.drawImage(image, { x: 0, y: 0, width: A4_WIDTH_PT, height: A4_HEIGHT_PT });
  }

  const bytes = await pdf.save();
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
