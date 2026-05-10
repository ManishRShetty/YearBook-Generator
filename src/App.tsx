/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Upload, Download, Image as ImageIcon } from 'lucide-react';

interface LayoutData {
  img: HTMLImageElement;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

export default function App() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [layout, setLayout] = useState<LayoutData[]>([]);
  const [uploadNote, setUploadNote] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate deterministic-ish layout based on images count
  const generateLayout = (loadedImages: HTMLImageElement[]) => {
    const newLayout: LayoutData[] = [];
    if (loadedImages.length === 0) {
      setLayout([]);
      return;
    }
    
    // Fill the poster densely; only duplicate when photo count is too low.
    const minFillCount = 36;
    const targetCount = Math.max(minFillCount, loadedImages.length);

    const canvasW = 800;
    const canvasH = 1000;
    const aspect = canvasW / canvasH;
    const cols = Math.max(6, Math.ceil(Math.sqrt(targetCount * aspect)));
    const rows = Math.ceil(targetCount / cols);
    const actualCount = cols * rows;

    const cellW = canvasW / cols;
    const cellH = canvasH / rows;

    for (let i = 0; i < actualCount; i++) {
      const img = loadedImages[i % loadedImages.length];
      const pseudoRandom = (seed: number) => {
        let x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
      };

      const col = i % cols;
      const row = Math.floor(i / cols);

      // Base position at center of cell
      const baseX = col * cellW + cellW / 2;
      const baseY = row * cellH + cellH / 2;

      // Keep jitter moderate so we don't introduce visual gaps.
      const px = baseX + (pseudoRandom(i + 1) * 0.45 - 0.225) * cellW;
      const py = baseY + (pseudoRandom(i + 2) * 0.45 - 0.225) * cellH;

      // Rotation -16 to 16 degrees for a collage look without opening holes.
      const finalRot = (pseudoRandom(i + 42) * 32 - 16) * (Math.PI / 180);

      // Slightly larger than cell width to ensure overlap and full coverage.
      const baseWidth = cellW * 1.22;
      const width = baseWidth * (0.9 + pseudoRandom(i + 13) * 0.2);
      const height = width * 1.25; // Polaroid ratio

      newLayout.push({ img, x: px, y: py, rotation: finalRot, width, height });
    }

    // Shuffle for random z-order overlapping
    for (let i = newLayout.length - 1; i > 0; i--) {
      const j = Math.floor(Math.abs(Math.sin((i + 1) * 123) * 10000)) % (i + 1);
      [newLayout[i], newLayout[j]] = [newLayout[j], newLayout[i]];
    }

    setLayout(newLayout);
  };

  const renderCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ensure font is ready before drawing text
    await document.fonts.ready;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Background Gradient
    const bgGrad = ctx.createRadialGradient(400, 500, 0, 400, 500, 800);
    bgGrad.addColorStop(0, '#1e1408');
    bgGrad.addColorStop(1, '#0a0804');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Warm Golden light burst from Top Center
    const burstGrad = ctx.createRadialGradient(400, 0, 0, 400, 0, 650);
    burstGrad.addColorStop(0, 'rgba(245, 208, 96, 0.5)'); // opacity increased to 0.5
    burstGrad.addColorStop(0.5, 'rgba(232, 146, 10, 0.2)');
    burstGrad.addColorStop(1, 'rgba(160, 98, 8, 0)');
    ctx.fillStyle = burstGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw polaroids
    layout.forEach(l => {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rotation);

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 15;
      
      // White polaroid border
      ctx.fillStyle = '#fcfaf7';
      ctx.fillRect(-l.width / 2, -l.height / 2, l.width, l.height);

      ctx.shadowColor = 'transparent';

      // Inner Photo
      const margin = l.width * 0.06;
      const bottomMargin = l.width * 0.25;
      const pW = l.width - margin * 2;
      const pH = l.height - margin - bottomMargin;
      const pX = -l.width / 2 + margin;
      const pY = -l.height / 2 + margin;

      ctx.save();
      ctx.beginPath();
      ctx.rect(pX, pY, pW, pH);
      ctx.clip();

      const srcRatio = l.img.width / l.img.height;
      const dstRatio = pW / pH;
      let sx = 0, sy = 0, sw = l.img.width, sh = l.img.height;
      
      if (srcRatio > dstRatio) {
        sw = sh * dstRatio;
        sx = (l.img.width - sw) / 2;
      } else {
        sh = sw / dstRatio;
        sy = (l.img.height - sh) / 2;
      }

      ctx.drawImage(l.img, sx, sy, sw, sh, pX, pY, pW, pH);

      // Warm Sepia Overlay
      ctx.fillStyle = 'rgba(180, 100, 20, 0.12)';
      ctx.fillRect(pX, pY, pW, pH);
      ctx.restore();

      ctx.restore();
    });

    // 3. Vignette
    const vignette = ctx.createRadialGradient(400, 500, 300, 400, 500, 900);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    renderCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const files: File[] = Array.from(e.target.files);
    Promise.all(
      files.map((file) => {
        return new Promise<HTMLImageElement | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = ev.target?.result as string;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      })
    ).then((loadedImages) => {
      const validImages = loadedImages.filter((image): image is HTMLImageElement => image !== null);
      const skippedCount = loadedImages.length - validImages.length;

      if (skippedCount > 0) {
        setUploadNote(`${skippedCount} file${skippedCount === 1 ? '' : 's'} could not be previewed in this browser, so they were skipped.`);
      } else {
        setUploadNote('');
      }

      setImages((currentImages) => {
        const nextImages = [...currentImages, ...validImages];
        generateLayout(nextImages);
        return nextImages;
      });
      e.target.value = '';
    });
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'yearbook-poster.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-neutral-900 text-neutral-200 font-sans">
      <div className="w-full md:w-96 p-8 bg-neutral-950 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-br from-amber-200 to-amber-600 bg-clip-text text-transparent mb-1">
            Yearbook Collage
          </h1>
          <p className="text-sm text-neutral-500">Create a cinematic poster from your photos.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-400">Photos (8-20 recommended)</label>
            <div className="relative">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-800 rounded-lg hover:border-amber-500 transition-colors bg-neutral-900/50">
                <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-sm font-medium text-neutral-300">Choose Files</span>
                <span className="text-xs text-neutral-500 mt-1">{images.length} images selected</span>
              </div>
            </div>
            {uploadNote && <p className="text-xs text-amber-400 mt-1">{uploadNote}</p>}
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="mt-auto flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium rounded-lg transition-all shadow-lg active:scale-[0.98]"
        >
          <Download className="w-5 h-5" />
          Download Poster
        </button>
      </div>

      <div className="flex-1 p-8 flex items-center justify-center bg-neutral-900 overflow-hidden">
        <div className="relative group max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            width={800}
            height={1000}
            className="w-full max-w-full max-h-[85vh] object-contain shadow-2xl shadow-black/80 rounded-sm"
          />
          
          {images.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm rounded-sm">
              <div className="flex flex-col items-center gap-4 text-center p-6">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500/30 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-amber-500/50" />
                </div>
                <p className="text-amber-500/80 font-medium tracking-wide">Upload photos to preview your layout</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
