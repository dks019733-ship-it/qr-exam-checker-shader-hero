"use client";

import { PDFDocument } from "pdf-lib";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

async function imageToDataUrl(image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  return fetchResourceAsDataUrl(source);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านทรัพยากรสำหรับ PDF ไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

async function fetchResourceAsDataUrl(source: string): Promise<string> {
  if (!source || source.startsWith("data:") || source.startsWith("#")) return source;
  const url = new URL(source, document.baseURI);
  if (url.protocol !== "http:" && url.protocol !== "https:") return source;
  let response: Response;
  try {
    response = await fetch(url.href, {
      credentials: url.origin === window.location.origin ? "same-origin" : "omit",
      mode: "cors",
    });
  } catch {
    throw new Error("ไม่สามารถฝังรูปภาพหรือทรัพยากรจากภายนอกลงใน PDF ได้ กรุณาใช้ไฟล์ที่อยู่บนเว็บไซต์หรืออัปโหลดไฟล์ใหม่");
  }
  if (!response.ok) throw new Error("โหลดรูปภาพหรือทรัพยากรสำหรับ PDF ไม่สำเร็จ");
  return blobToDataUrl(await response.blob());
}

async function inlineCssUrls(value: string): Promise<string> {
  const matches = [...value.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi)];
  let result = value;
  for (const match of matches) {
    const rawUrl = (match[2] ?? match[3] ?? "").trim();
    if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("#") || rawUrl.startsWith("blob:")) continue;
    const dataUrl = await fetchResourceAsDataUrl(rawUrl);
    result = result.replace(match[0], `url("${dataUrl}")`);
  }
  return result;
}

type Html2Canvas = (
  element: HTMLElement,
  options: {
    allowTaint: boolean;
    backgroundColor: string;
    foreignObjectRendering: boolean;
    imageTimeout: number;
    logging: boolean;
    scale: number;
    useCORS: boolean;
    windowHeight: number;
    windowWidth: number;
  },
) => Promise<HTMLCanvasElement>;

declare global {
  interface Window {
    html2canvas?: Html2Canvas;
  }
}

let html2CanvasPromise: Promise<Html2Canvas> | null = null;

function loadHtml2Canvas(): Promise<Html2Canvas> {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!html2CanvasPromise) {
    html2CanvasPromise = new Promise<Html2Canvas>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/html2canvas.min.js";
      script.async = true;
      script.dataset.html2canvas = "true";
      script.onload = () => {
        if (window.html2canvas) resolve(window.html2canvas);
        else reject(new Error("โหลดตัวสร้างภาพ PDF ไม่สำเร็จ"));
      };
      script.onerror = () => reject(new Error("โหลดตัวสร้างภาพ PDF ไม่สำเร็จ"));
      document.head.appendChild(script);
    }).catch((error) => {
      html2CanvasPromise = null;
      throw error;
    });
  }
  return html2CanvasPromise;
}

/**
 * html2canvas 1.4.1 does not implement CSS Grid. Freeze the browser's already
 * calculated flex/grid child geometry as absolute positions in an export-only
 * clone, so the OMR table and header retain their exact on-screen coordinates.
 */
async function prepareCanvasClone(source: Element, target: Element): Promise<void> {
  const computed = window.getComputedStyle(source);
  const targetStyle = (target as HTMLElement | SVGElement).style;

  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    const value = await inlineCssUrls(computed.getPropertyValue(property));
    targetStyle.setProperty(property, value, computed.getPropertyPriority(property));
  }

  if (source instanceof HTMLImageElement && target instanceof HTMLImageElement) {
    target.src = await imageToDataUrl(source);
    target.removeAttribute("srcset");
    target.style.objectFit = computed.objectFit;
    await target.decode();
  }

  if (source instanceof SVGImageElement && target instanceof SVGImageElement) {
    const href = source.href.baseVal || source.getAttribute("href") || "";
    if (href) target.setAttribute("href", await fetchResourceAsDataUrl(href));
    target.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  const isLayoutContainer = ["flex", "inline-flex", "grid", "inline-grid"].includes(computed.display);
  const sourceRect = isLayoutContainer ? source.getBoundingClientRect() : null;
  const childRects = isLayoutContainer
    ? sourceChildren.map((child) => child.getBoundingClientRect())
    : [];

  // Finish copying descendant computed styles first. Otherwise a recursive
  // call would overwrite the absolute coordinates assigned by this parent.
  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index];
    const targetChild = targetChildren[index];
    if (sourceChild && targetChild) await prepareCanvasClone(sourceChild, targetChild);
  }

  if (isLayoutContainer && sourceRect) {
    targetStyle.display = "block";
    targetStyle.position = computed.position === "static" ? "relative" : computed.position;
    targetStyle.width = `${sourceRect.width}px`;
    targetStyle.height = `${sourceRect.height}px`;
    targetStyle.boxSizing = "border-box";

    targetChildren.forEach((child, index) => {
      const rect = childRects[index];
      if (!rect || !(child instanceof HTMLElement)) return;
      child.style.position = "absolute";
      child.style.left = `${rect.left - sourceRect.left - source.clientLeft + source.scrollLeft}px`;
      child.style.top = `${rect.top - sourceRect.top - source.clientTop + source.scrollTop}px`;
      child.style.width = `${rect.width}px`;
      child.style.height = `${rect.height}px`;
      child.style.margin = "0";
      child.style.boxSizing = "border-box";
      child.style.transform = "none";
    });
  }
}

async function renderSheetToPng(element: HTMLElement): Promise<Uint8Array> {
  await document.fonts?.ready;
  const html2canvas = await loadHtml2Canvas();

  const stagingHost = document.createElement("div");
  stagingHost.style.position = "fixed";
  stagingHost.style.left = "0";
  stagingHost.style.top = "0";
  stagingHost.style.width = `${PAGE_WIDTH}px`;
  stagingHost.style.height = `${PAGE_HEIGHT}px`;
  stagingHost.style.overflow = "hidden";
  stagingHost.style.visibility = "hidden";
  stagingHost.style.pointerEvents = "none";
  stagingHost.style.zIndex = "-1";

  const stagingSource = element.cloneNode(true) as HTMLElement;
  stagingSource.style.width = `${PAGE_WIDTH}px`;
  stagingSource.style.height = `${PAGE_HEIGHT}px`;
  stagingSource.style.margin = "0";
  stagingSource.style.transform = "none";
  stagingSource.style.position = "relative";
  stagingSource.style.visibility = "visible";
  stagingSource.style.boxShadow = "none";
  stagingSource.style.outline = "none";
  stagingHost.appendChild(stagingSource);
  document.body.appendChild(stagingHost);

  try {
    const canvasClone = stagingSource.cloneNode(true) as HTMLElement;
    await prepareCanvasClone(stagingSource, canvasClone);
    stagingHost.replaceChild(canvasClone, stagingSource);

    const canvas = await html2canvas(canvasClone, {
      allowTaint: false,
      backgroundColor: "#ffffff",
      foreignObjectRendering: false,
      imageTimeout: 15_000,
      logging: false,
      scale: 3,
      useCORS: true,
      windowHeight: Math.max(window.innerHeight, PAGE_HEIGHT),
      windowWidth: Math.max(window.innerWidth, PAGE_WIDTH),
    });

    try {
      let png: Blob;
      try {
        png = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("สร้างภาพกระดาษคำตอบไม่สำเร็จ")), "image/png");
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "SecurityError") {
          throw new Error("ส่งออก PDF ไม่ได้ เพราะเบราว์เซอร์ปฏิเสธการอ่านภาพจากแหล่งภายนอก กรุณาตรวจสอบรูปภาพในกระดาษคำตอบ");
        }
        throw error;
      }
      return new Uint8Array(await png.arrayBuffer());
    } finally {
      // Release the large 3x backing store before the next page in a class batch.
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    stagingHost.remove();
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
