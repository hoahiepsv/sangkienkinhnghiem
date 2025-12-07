
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Download, FileOutput, Loader2, RefreshCw } from 'lucide-react';
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, 
  Footer, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, 
  VerticalAlign, TableOfContents, PageBreak, UnderlineType, PageNumber 
} from 'docx';
import { ChartData, MindmapData, MindmapNode } from '../types';

interface Props {
  content: string;
  pythonCode?: string;
  teacherName: string;
  schoolName: string;
  department: string;
  topicName: string;
  year: string;
}

// --- COLOR PALETTES ---
const PALETTE_VIVID = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#475569', '#db2777'];
const PALETTE_PASTEL = ['#60a5fa', '#f87171', '#4ade80', '#fbbf24', '#c084fc', '#22d3ee', '#94a3b8', '#f472b6'];
const PALETTE_NEON = ['#3b82f6', '#f43f5e', '#10b981', '#f59e0b', '#a855f7', '#06b6d4'];

type ChartStyle = 'standard' | 'flat' | 'dark';
type MindmapTheme = 'colorful' | 'professional' | 'organic';

// --- CHART DRAWING ENGINE ---
const drawChartToCanvas = (canvas: HTMLCanvasElement, chart: ChartData, style: ChartStyle = 'standard') => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Safety check for empty data
  if (!chart.datasets || !chart.datasets[0] || !chart.datasets[0].data || !chart.labels) {
      // Draw placeholder text if no data
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0,0, canvas.width, canvas.height);
      ctx.fillStyle = "#9ca3af";
      ctx.textAlign = "center";
      ctx.fillText("Không có dữ liệu biểu đồ", canvas.width/2, canvas.height/2);
      return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 80, right: 60, bottom: 100, left: 80 }; 
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const data = chart.datasets[0].data;
  
  // Theme Config
  let bg = '#ffffff';
  let textColor = '#000000';
  let gridColor = '#e2e8f0';
  let colors = PALETTE_VIVID;
  let font = 'Times New Roman';

  if (style === 'flat') {
    bg = '#f8fafc';
    colors = PALETTE_PASTEL;
  } else if (style === 'dark') {
    bg = '#1e293b';
    textColor = '#ffffff';
    gridColor = '#334155';
    colors = PALETTE_NEON;
  }

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = style === 'dark' ? '#60a5fa' : '#1e3a8a'; 
  ctx.font = `bold 26px "${font}"`;
  ctx.textAlign = 'center';
  const title = (chart.title || "Biểu đồ số liệu").toUpperCase();
  if (title.length > 55) {
      const mid = Math.floor(title.length / 2);
      ctx.fillText(title.substring(0, mid) + "-", width / 2, 40);
      ctx.fillText(title.substring(mid), width / 2, 70);
  } else {
      ctx.fillText(title, width / 2, 50);
  }

  // --- VERTICAL BAR CHART ---
  if (chart.type === 'bar' || chart.type === 'horizontalBar') { 
    const maxValue = Math.max(...data, 1);
    const yMax = Math.ceil(maxValue * 1.1) || 10; 
    
    // Axes
    ctx.strokeStyle = style === 'dark' ? '#94a3b8' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Grid & Y Labels
    ctx.font = `14px "${font}"`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const yVal = (yMax / steps) * i;
      const yPos = height - padding.bottom - (yVal / yMax) * chartHeight;
      ctx.fillText(Math.round(yVal).toString(), padding.left - 10, yPos + 5);
      
      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(width - padding.right, yPos);
      ctx.stroke();
    }

    // Bars
    const totalBars = data.length;
    const barWidth = Math.min((chartWidth / totalBars) * 0.6, 100);
    const spacing = (chartWidth - (barWidth * totalBars)) / (totalBars + 1);

    data.forEach((value, i) => {
      const barHeight = (value / yMax) * chartHeight;
      const x = padding.left + spacing + i * (barWidth + spacing);
      const y = height - padding.bottom - barHeight;

      const baseColor = colors[i % colors.length];

      if (style === 'standard') {
          // Gradient 3D effect
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, baseColor); 
          gradient.addColorStop(1, '#ffffff'); 
          ctx.fillStyle = 'rgba(0,0,0,0.1)'; // Shadow
          ctx.fillRect(x + 5, y + 5, barWidth, barHeight);
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth, barHeight);
          ctx.strokeStyle = baseColor;
          ctx.strokeRect(x, y, barWidth, barHeight);
      } else {
          // Flat fill
          ctx.fillStyle = baseColor;
          ctx.fillRect(x, y, barWidth, barHeight);
      }

      // Value Label
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.font = `bold 15px "${font}"`;
      ctx.fillText(value.toString(), x + barWidth / 2, y - 8);

      // X Label (Wrap text)
      const label = chart.labels?.[i] || '';
      ctx.font = `14px "${font}"`;
      let lineY = height - padding.bottom + 20;
      const words = label.split(' ');
      let line = '';
      let dy = 0;
      for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > barWidth + 30 && n > 0) {
          ctx.fillText(line, x + barWidth / 2, lineY + dy);
          line = words[n] + ' ';
          dy += 16;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x + barWidth / 2, lineY + dy);
    });

  // --- LINE CHART ---
  } else if (chart.type === 'line') {
      const maxValue = Math.max(...data, 1);
      const yMax = Math.ceil(maxValue * 1.1) || 10;
      
      // Grid
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.stroke();

      // Horizontal Grid lines
      ctx.font = `14px "${font}"`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'right';
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const yVal = (yMax / steps) * i;
        const yPos = height - padding.bottom - (yVal / yMax) * chartHeight;
        ctx.fillText(Math.round(yVal).toString(), padding.left - 10, yPos + 5);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, yPos);
        ctx.lineTo(width - padding.right, yPos);
        ctx.stroke();
      }

      const stepX = chartWidth / (data.length - 1 || 1);
      
      ctx.beginPath();
      data.forEach((value, i) => {
          const x = padding.left + i * stepX;
          const y = height - padding.bottom - (value / yMax) * chartHeight;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = style === 'dark' ? '#60a5fa' : '#2563eb';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Points
      data.forEach((value, i) => {
          const x = padding.left + i * stepX;
          const y = height - padding.bottom - (value / yMax) * chartHeight;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.strokeStyle = style === 'dark' ? '#60a5fa' : '#2563eb';
          ctx.stroke();
          
          const label = chart.labels?.[i] || '';
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.fillText(label, x, height - padding.bottom + 25);
          ctx.font = `bold 12px "${font}"`;
          ctx.fillText(value.toString(), x, y - 15);
      });

  // --- PIE & DOUGHNUT ---
  } else if (chart.type === 'pie' || chart.type === 'doughnut') {
    const total = data.reduce((a, b) => a + b, 0) || 1;
    let startAngle = -0.5 * Math.PI;
    const centerX = padding.left + chartWidth / 2;
    const centerY = height / 2 + 10;
    const radius = Math.min(chartWidth, chartHeight) / 2.2;

    data.forEach((value, i) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      
      const sliceColor = colors[i % colors.length];
      if (style === 'standard') {
          const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
          grad.addColorStop(0, sliceColor);
          grad.addColorStop(1, sliceColor); 
          ctx.fillStyle = grad;
      } else {
          ctx.fillStyle = sliceColor;
      }
      
      ctx.fill();
      ctx.strokeStyle = bg;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (value / total > 0.05) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelRadius = radius * 0.7;
        const lx = centerX + Math.cos(midAngle) * labelRadius;
        const ly = centerY + Math.sin(midAngle) * labelRadius;
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 16px "${font}"`;
        ctx.textAlign = 'center';
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText(((value / total) * 100).toFixed(1) + '%', lx, ly);
        ctx.shadowColor = "transparent";
      }
      startAngle += sliceAngle;
    });

    if (chart.type === 'doughnut') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
    }

    const legendX = width - padding.right + 20;
    let legendY = padding.top + 20;
    if (chart.labels) {
      chart.labels.forEach((label, i) => {
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(legendX, legendY, 20, 20);
          ctx.strokeStyle = textColor;
          ctx.strokeRect(legendX, legendY, 20, 20);
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.font = `14px "${font}"`;
          ctx.fillText(label, legendX + 30, legendY + 15);
          legendY += 30;
      });
    }
  }
};

// --- MINDMAP DRAWING ENGINE ---
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(' ');
  let lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};

// Count total leaf nodes to calculate required height to avoid overlap
const countLeaves = (node: MindmapNode): number => {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.reduce((acc, child) => acc + countLeaves(child), 0);
};

const drawMindmapToCanvas = (canvas: HTMLCanvasElement, data: MindmapData, theme: MindmapTheme = 'colorful') => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  
  const BRANCH_COLORS = theme === 'organic' 
      ? ['#65a30d', '#0891b2', '#d97706', '#be185d', '#7c3aed']
      : ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  
  // Background
  const bg = theme === 'professional' ? '#f1f5f9' : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Layout Constants
  const LEVEL_WIDTH = 250;
  const NODE_PADDING_X = 20;
  const NODE_PADDING_Y = 12;

  const drawNode = (text: string, x: number, y: number, color: string, level: number) => {
    const isRoot = level === 0;
    ctx.font = isRoot ? 'bold 18px "Times New Roman"' : '14px "Times New Roman"';
    
    const maxTextWidth = isRoot ? 160 : 130;
    const lines = wrapText(ctx, text, maxTextWidth);
    
    let maxLineWidth = 0;
    lines.forEach(l => {
       const m = ctx.measureText(l);
       if(m.width > maxLineWidth) maxLineWidth = m.width;
    });
    
    const lineHeight = isRoot ? 24 : 18;
    const boxWidth = maxLineWidth + NODE_PADDING_X * 2;
    const boxHeight = (lines.length * lineHeight) + NODE_PADDING_Y * 2;

    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = theme === 'organic' ? 4 : 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Shape & Fill
    ctx.beginPath();
    
    if (theme === 'professional') {
        // Boxy
        ctx.fillStyle = isRoot ? '#1e3a8a' : '#ffffff';
        ctx.strokeStyle = isRoot ? '#1e3a8a' : color;
        ctx.lineWidth = 2;
        ctx.roundRect(x - boxWidth/2, y - boxHeight/2, boxWidth, boxHeight, 4);
        ctx.fill();
        ctx.stroke();
    } else {
        // Gradient / Rounded
        const grad = ctx.createLinearGradient(x - boxWidth/2, y - boxHeight/2, x + boxWidth/2, y + boxHeight/2);
        if (isRoot) {
           grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#f3f4f6');
        } else {
           if (theme === 'colorful') {
               grad.addColorStop(0, color); grad.addColorStop(1, '#ffffff'); 
           } else {
               grad.addColorStop(0, '#f0fdf4'); grad.addColorStop(1, '#ffffff');
           }
        }
        ctx.fillStyle = isRoot ? grad : (theme === 'colorful' ? color : '#fff');
        // Organic uses more rounded shapes
        ctx.roundRect(x - boxWidth/2, y - boxHeight/2, boxWidth, boxHeight, theme === 'organic' ? 20 : 10);
        ctx.fill();
        if (theme === 'organic') {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    ctx.shadowColor = "transparent";
    
    // Text Color
    if (theme === 'professional') {
        ctx.fillStyle = isRoot ? '#ffffff' : '#1e293b';
    } else if (theme === 'colorful') {
        ctx.fillStyle = isRoot ? '#1e3a8a' : '#ffffff'; // White text on colored nodes
    } else {
        ctx.fillStyle = '#0f172a';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let textY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach(line => {
        ctx.fillText(line, x, textY);
        textY += lineHeight;
    });

    return { w: boxWidth, h: boxHeight };
  };

  const drawConnections = (node: MindmapNode, x: number, y: number, level: number, branchIndex: number, currentLeafCount: {count: number}, totalLeaves: number) => {
    // We traverse purely to draw lines FIRST (so they appear behind nodes)
    if (!node.children || node.children.length === 0) {
        currentLeafCount.count++;
        return;
    }
    
    const isRoot = level === 0;
    const childX = x + LEVEL_WIDTH;
    const verticalSpacePerLeaf = height / totalLeaves;
    
    // Calculate vertical span of this node's children
    const myLeaves = countLeaves(node);
    
    let tempLeafCounter = currentLeafCount.count;

    node.children.forEach((child, idx) => {
        const childLeaves = countLeaves(child);
        const childY = (tempLeafCounter * verticalSpacePerLeaf) + (verticalSpacePerLeaf * childLeaves) / 2;
        
        const branchColor = BRANCH_COLORS[(isRoot ? idx : branchIndex) % BRANCH_COLORS.length];

        ctx.beginPath();
        ctx.moveTo(x + (isRoot ? 80 : 60), y); // Approx center/edge
        
        const cp1x = x + (childX - x) * 0.5;
        const cp1y = y;
        const cp2x = x + (childX - x) * 0.5;
        const cp2y = childY;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, childX, childY);
        
        ctx.strokeStyle = theme === 'professional' ? '#94a3b8' : branchColor;
        ctx.lineWidth = isRoot ? 3 : 2;
        if (theme === 'organic') ctx.setLineDash([5, 5]); // Dashed lines for organic
        else ctx.setLineDash([]);
        
        ctx.stroke();

        drawConnections(child, childX, childY, level + 1, isRoot ? idx : branchIndex, {count: tempLeafCounter}, totalLeaves);
        tempLeafCounter += childLeaves; // Advance local counter
    });
    
    currentLeafCount.count += myLeaves; 
  };
  
  // Recursively Draw Nodes (Second Pass)
  const drawNodesRecursive = (node: MindmapNode, x: number, y: number, level: number, branchIndex: number, currentLeafCount: {count: number}, totalLeaves: number) => {
      const isRoot = level === 0;
      let branchColor = '#3b82f6';
      if (!isRoot) branchColor = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];

      drawNode(node.name, x, y, branchColor, level);

      if (!node.children || node.children.length === 0) {
          currentLeafCount.count++;
          return;
      }

      const verticalSpacePerLeaf = height / totalLeaves;
      const childX = x + LEVEL_WIDTH;
      let tempLeafCounter = currentLeafCount.count;

      node.children.forEach((child, idx) => {
          const childLeaves = countLeaves(child);
          const childY = (tempLeafCounter * verticalSpacePerLeaf) + (verticalSpacePerLeaf * childLeaves) / 2;
          drawNodesRecursive(child, childX, childY, level + 1, isRoot ? idx : branchIndex, {count: tempLeafCounter}, totalLeaves);
          tempLeafCounter += childLeaves;
      });
      currentLeafCount.count += countLeaves(node); // Advance global
  };

  const rootNode: MindmapNode = { name: data.root, children: data.children };
  const totalLeaves = countLeaves(rootNode);
  
  // Pass 1: Lines
  drawConnections(rootNode, 100, height/2, 0, 0, {count: 0}, totalLeaves);
  // Pass 2: Nodes
  drawNodesRecursive(rootNode, 100, height/2, 0, 0, {count: 0}, totalLeaves);

  // Watermark
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  ctx.font = 'bold 60px "Times New Roman"';
  ctx.textAlign = 'center';
  ctx.fillText("MINDMAP", width / 2, height - 50);
};


// --- REACT COMPONENTS ---

const SimpleChart: React.FC<{ data: ChartData }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [styleIndex, setStyleIndex] = useState(0);
  const styles: ChartStyle[] = ['standard', 'flat', 'dark'];
  const styleNames = ["3D Gradient", "Phẳng (Pastel)", "Tối (Neon)"];

  useEffect(() => {
    if (canvasRef.current && data) {
      drawChartToCanvas(canvasRef.current, data, styles[styleIndex]);
    }
  }, [data, styleIndex]);

  return (
    <div className="my-10 flex flex-col items-center break-inside-avoid">
      <div className="relative group bg-white p-2 border border-gray-300 shadow-md rounded-lg">
        <canvas ref={canvasRef} width={800} height={500} className="max-w-full h-auto" />
        <button 
           onClick={() => setStyleIndex((prev) => (prev + 1) % styles.length)}
           className="absolute bottom-2 right-2 bg-white/90 hover:bg-blue-50 text-blue-600 border border-blue-200 p-2 rounded-full shadow-sm transition-all"
           title="Đổi kiểu hiển thị"
        >
           <RefreshCw size={16} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2 font-sans flex items-center gap-2">
         Kiểu: {styleNames[styleIndex]} 
         <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
         Hình: {data.title}
      </p>
    </div>
  );
};

const MindmapChart: React.FC<{ data: MindmapData }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const themes: MindmapTheme[] = ['colorful', 'professional', 'organic'];
  const themeNames = ["Sắc màu (Mặc định)", "Chuyên nghiệp (Hộp)", "Tự nhiên (Organic)"];

  useEffect(() => {
    if (canvasRef.current && data) {
      drawMindmapToCanvas(canvasRef.current, data, themes[themeIndex]);
    }
  }, [data, themeIndex]);

  return (
    <div className="my-10 flex flex-col items-center break-inside-avoid">
      <div className="relative group bg-white p-2 border border-gray-300 shadow-md rounded-lg">
        <canvas ref={canvasRef} width={900} height={700} className="max-w-full h-auto" />
        <button 
           onClick={() => setThemeIndex((prev) => (prev + 1) % themes.length)}
           className="absolute bottom-2 right-2 bg-white/90 hover:bg-blue-50 text-blue-600 border border-blue-200 p-2 rounded-full shadow-sm transition-all"
           title="Đổi mẫu sơ đồ"
        >
           <RefreshCw size={16} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2 font-sans flex items-center gap-2">
         Mẫu: {themeNames[themeIndex]}
         <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
         Sơ đồ: {data.root}
      </p>
    </div>
  );
};

export const Preview: React.FC<Props> = ({ 
  content, pythonCode, teacherName, schoolName, department, topicName, year 
}) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const charts: { [key: string]: ChartData } = {};
  const mindmaps: { [key: string]: MindmapData } = {};
  
  // Pre-process for chart placeholders
  let processedContent = content.replace(/```json:chart([\s\S]*?)```/g, (match, jsonStr) => {
    try {
      const cleanJson = jsonStr.replace(/\/\/.*$/gm, '').trim(); 
      const data = JSON.parse(cleanJson);
      const id = `chart-${Object.keys(charts).length}`;
      charts[id] = data;
      return `\n\n[[CHART_PLACEHOLDER:${id}]]\n\n`;
    } catch (e) {
      return "";
    }
  });

  // Pre-process for mindmap placeholders
  processedContent = processedContent.replace(/```json:mindmap([\s\S]*?)```/g, (match, jsonStr) => {
    try {
      const cleanJson = jsonStr.replace(/\/\/.*$/gm, '').trim(); 
      const data = JSON.parse(cleanJson);
      const id = `mindmap-${Object.keys(mindmaps).length}`;
      mindmaps[id] = data;
      return `\n\n[[MINDMAP_PLACEHOLDER:${id}]]\n\n`;
    } catch (e) {
      return "";
    }
  });

  // Helper to remove invalid XML characters
  const sanitizeText = (text: string) => {
     if (!text) return "";
     // Remove null bytes and control chars that are invalid in XML 1.0
     return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  };

  const handleExportWord = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
        const docChildren = [];
        const FONT_FAMILY = "Times New Roman";
        const FONT_SIZE = 26; // 13pt

        // --- PAGE 1: TOC ---
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: "MỤC LỤC", bold: true, size: 28, font: FONT_FAMILY })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 240 }
        }));

        docChildren.push(new TableOfContents("Nội dung", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }));
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));

        // --- PAGE 2: HEADER ---
        const cleanProvince = department
            .replace(/^Sở GD&ĐT\s*/i, '')
            .replace(/^Phòng GD&ĐT\s*/i, '')
            .replace(/^SỞ GIÁO DỤC VÀ ĐÀO TẠO\s*/i, '')
            .trim();
        const location = sanitizeText(cleanProvince) || ".......";
        const deptTitle = department.toUpperCase().startsWith("SỞ") 
            ? department.toUpperCase() 
            : `SỞ GIÁO DỤC VÀ ĐÀO TẠO ${department.toUpperCase()}`;
        const today = new Date();
        const dateString = `${location}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

        const headerTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 45, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: sanitizeText(deptTitle), size: 24, font: FONT_FAMILY })],
                                    alignment: AlignmentType.CENTER
                                }),
                                new Paragraph({
                                    children: [new TextRun({ text: sanitizeText(schoolName.toUpperCase()), bold: true, size: 24, font: FONT_FAMILY })],
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "Tác giả: ", size: 26, font: FONT_FAMILY }),
                                        new TextRun({ text: sanitizeText(teacherName), bold: true, size: 26, font: FONT_FAMILY })
                                    ],
                                    alignment: AlignmentType.LEFT,
                                    indent: { left: 360 }, 
                                    spacing: { before: 120 }
                                }),
                            ],
                        }),
                        new TableCell({
                            width: { size: 55, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, size: 24, font: FONT_FAMILY })],
                                    alignment: AlignmentType.CENTER
                                }),
                                new Paragraph({
                                    children: [new TextRun({ text: "Độc lập – Tự do – Hạnh phúc", bold: true, size: 26, font: FONT_FAMILY, underline: { type: UnderlineType.SINGLE } })],
                                    alignment: AlignmentType.CENTER,
                                    spacing: { after: 120 }
                                }),
                                new Paragraph({
                                    children: [new TextRun({ text: `Năm học: ${sanitizeText(year)}`, size: 26, font: FONT_FAMILY })],
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        });
        docChildren.push(headerTable);

        docChildren.push(new Paragraph({
            children: [new TextRun({ text: dateString, italics: true, size: 26, font: FONT_FAMILY })],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 120, after: 600 }
        }));

        docChildren.push(new Paragraph({
            children: [new TextRun({ text: sanitizeText(topicName.toUpperCase()), bold: true, size: 36, font: FONT_FAMILY })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 480 }
        }));

        // --- CONTENT PARSING ---
        const getChartImageBlob = async (chartData: ChartData): Promise<Blob | null> => {
          try {
              const canvas = document.createElement('canvas');
              canvas.width = 800; canvas.height = 500;
              drawChartToCanvas(canvas, chartData, 'standard');
              // Ensure drawing happened (context check inside drawChartToCanvas handles empty)
              return new Promise(resolve => canvas.toBlob(resolve));
          } catch(e) { return null; }
        };

        const getMindmapImageBlob = async (data: MindmapData): Promise<Blob | null> => {
           try {
              const canvas = document.createElement('canvas');
              canvas.width = 900; canvas.height = 700;
              // Export using colorful theme for Word
              drawMindmapToCanvas(canvas, data, 'colorful'); 
              return new Promise(resolve => canvas.toBlob(resolve));
           } catch(e) { return null; }
        };

        const lines = content.split('\n');
        let startIndex = 0;
        // Skip header metadata logic (Case Insensitive)
        const metadataKeywords = ['TÁC GIẢ', 'ĐƠN VỊ', 'TỈNH/THÀNH PHỐ', 'NĂM HỌC', 'SÁNG KIẾN KINH NGHIỆM', topicName];
        
        for(let i=0; i<Math.min(lines.length, 25); i++) {
            const line = lines[i].replace(/[*#\-_]/g, '').trim().toUpperCase();
            if (line === '') continue;
            
            const isMatch = metadataKeywords.some(kw => line.includes(kw.toUpperCase()));
            if (isMatch) {
                startIndex = i + 1;
            } else {
                if (!lines[i].trim().startsWith('---')) break;
            }
        }
        const contentLines = lines.slice(startIndex);

        let isInCodeBlock = false;
        let tableBuffer: string[] = [];
        
        const flushTableBuffer = () => {
          if (tableBuffer.length === 0) return;
          const rows: TableRow[] = [];
          
          // Normalize Table: Find max columns
          let maxCols = 0;
          const validLines = tableBuffer.filter(l => l.trim().startsWith('|') && !l.includes('---'));
          validLines.forEach(l => {
              const cols = l.split('|').length;
              if (cols > maxCols) maxCols = cols;
          });

          for (let i = 0; i < tableBuffer.length; i++) {
            const rowLine = tableBuffer[i].trim();
            if (!rowLine.startsWith('|') || rowLine.includes('---')) continue; 
            
            const cells = rowLine.split('|').filter(c => c.trim() !== '').map(c => c.trim());
            // Pad cells if missing
            while(cells.length < maxCols - 2) { cells.push(""); } // -2 because split creates empty start/end

            const isHeader = i === 0;
            const tableCells = cells.map(cellText => new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: sanitizeText(cellText), font: FONT_FAMILY, size: 26, bold: isHeader })], alignment: AlignmentType.CENTER })],
              verticalAlign: VerticalAlign.CENTER,
              borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              shading: isHeader ? { fill: "f0f0f0" } : undefined
            }));
            rows.push(new TableRow({ children: tableCells }));
          }
          if (rows.length > 0) { docChildren.push(new Table({ rows: rows, width: { size: 100, type: WidthType.PERCENTAGE } })); docChildren.push(new Paragraph({ text: "" })); }
          tableBuffer = [];
        };

        for (let i = 0; i < contentLines.length; i++) {
          let line = contentLines[i].trim();
          if (line.startsWith('|')) { tableBuffer.push(line); continue; } else { flushTableBuffer(); }

          if (line.startsWith('```')) {
            isInCodeBlock = !isInCodeBlock;
            if (line.startsWith('```json:chart')) {
                let jsonStr = ""; let j = i + 1;
                while(j < contentLines.length && !contentLines[j].trim().startsWith('```')) { jsonStr += contentLines[j] + "\n"; j++; }
                try {
                    const chartData = JSON.parse(jsonStr.replace(/\/\/.*$/gm, '').trim());
                    const blob = await getChartImageBlob(chartData);
                    if (blob) {
                        const buffer = await blob.arrayBuffer();
                        docChildren.push(new Paragraph({
                            children: [ new ImageRun({ data: buffer, transformation: { width: 500, height: 320 }, type: "png" }), new TextRun({ text: `\nHình: ${sanitizeText(chartData.title)}`, italics: true, font: FONT_FAMILY, size: 24 }) ],
                            alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }
                        }));
                        // Skip duplicate captions (Enhanced Regex)
                        // Matches: *Hình 1: ..., Hình 1: ..., *Hình...
                        if (contentLines[j+1] && contentLines[j+1].match(/^(\*)?Hình\s*\d*.*:/i)) j++;
                    }
                } catch (e) { console.error("Chart error", e); }
                i = j; isInCodeBlock = false; continue;
            }
            if (line.startsWith('```json:mindmap')) {
                let jsonStr = ""; let j = i + 1;
                while(j < contentLines.length && !contentLines[j].trim().startsWith('```')) { jsonStr += contentLines[j] + "\n"; j++; }
                try {
                    const mmData = JSON.parse(jsonStr.replace(/\/\/.*$/gm, '').trim());
                    const blob = await getMindmapImageBlob(mmData);
                    if (blob) {
                        const buffer = await blob.arrayBuffer();
                        docChildren.push(new Paragraph({
                            children: [ new ImageRun({ data: buffer, transformation: { width: 600, height: 400 }, type: "png" }), new TextRun({ text: `\nSơ đồ tư duy: ${sanitizeText(mmData.root)}`, italics: true, font: FONT_FAMILY, size: 24 }) ],
                            alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }
                        }));
                    }
                } catch (e) { console.error("Mindmap error", e); }
                i = j; isInCodeBlock = false; continue;
            }
            continue;
          }
          
          if (isInCodeBlock) continue;
          if (!line) continue;
          // Skip redundant captions found in text body
          if (line.match(/^(\*)?Hình\s*\d*.*:/i)) continue;

          // Markdown Parser
          const parseTextRuns = (text: string): TextRun[] => {
             const parts = text.split(/(\*\*.*?\*\*|_.*?_)/g);
             return parts.map(part => {
                 if (!part) return new TextRun({text: ""});
                 if (part.startsWith('**') && part.endsWith('**')) return new TextRun({ text: sanitizeText(part.slice(2, -2)), bold: true, font: FONT_FAMILY, size: FONT_SIZE });
                 if (part.startsWith('_') && part.endsWith('_')) return new TextRun({ text: sanitizeText(part.slice(1, -1)), italics: true, font: FONT_FAMILY, size: FONT_SIZE });
                 return new TextRun({ text: sanitizeText(part), font: FONT_FAMILY, size: FONT_SIZE });
             }).filter(tr => tr.root[1]?.text !== ""); // Filter empty
          };

          if (line.startsWith('# ')) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: sanitizeText(line.replace('# ', '')), font: FONT_FAMILY, size: 32, bold: true })], heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
          } else if (line.startsWith('## ')) {
             docChildren.push(new Paragraph({ children: [new TextRun({ text: sanitizeText(line.replace('## ', '')), font: FONT_FAMILY, size: 28, bold: true })], heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }));
          } else if (line.startsWith('### ')) {
             docChildren.push(new Paragraph({ children: [new TextRun({ text: sanitizeText(line.replace('### ', '')), font: FONT_FAMILY, size: 26, bold: true, italics: true })], heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 } }));
          } else {
             const runs = parseTextRuns(line);
             if (runs.length > 0) {
                 docChildren.push(new Paragraph({ children: runs, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, before: 120 } }));
             }
          }
        }
        flushTableBuffer();

        const doc = new Document({
          // SET DEFAULT GLOBAL FONT TO TIMES NEW ROMAN
          styles: {
            default: {
                document: {
                    run: {
                        font: FONT_FAMILY,
                        size: FONT_SIZE,
                    },
                    paragraph: {
                        spacing: { line: 360 }, // 1.5 line spacing
                    }
                },
                heading1: {
                    run: { font: FONT_FAMILY, size: 32, bold: true, color: "000000" },
                    paragraph: { spacing: { before: 240, after: 120 } }
                },
                heading2: {
                    run: { font: FONT_FAMILY, size: 28, bold: true, color: "000000" },
                    paragraph: { spacing: { before: 240, after: 120 } }
                },
                heading3: {
                    run: { font: FONT_FAMILY, size: 26, bold: true, italics: true, color: "000000" },
                    paragraph: { spacing: { before: 240, after: 120 } }
                },
            }
          },
          sections: [{ properties: {}, children: docChildren, footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: "Create by Hoà Hiệp AI – 0983.676.470 | Trang ", italics: true, color: "808080", font: FONT_FAMILY, size: 20 }), new TextRun({ children: [PageNumber.CURRENT], italics: true, color: "808080", font: FONT_FAMILY, size: 20 })], alignment: AlignmentType.CENTER })] }) } }]
        });
        const blob = await Packer.toBlob(doc);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SKKN_${teacherName.replace(/\s+/g, '')}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error: any) {
        console.error(error);
        alert("Có lỗi khi tạo file Word: " + error.message);
    } finally { setIsExporting(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 flex flex-col h-full">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileOutput className="text-blue-600" size={20} /> Xem trước & Xuất bản</h3>
        <button onClick={handleExportWord} disabled={isExporting} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium disabled:opacity-50">
          {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />} {isExporting ? "Đang tạo file..." : "Xuất Word (.docx)"}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-8 prose prose-slate max-w-none">
        <div className="border-b-2 border-gray-100 mb-8 pb-4">
            <h1 className="text-2xl font-bold text-center uppercase text-blue-900 mb-2 font-serif">{topicName}</h1>
            <div className="flex justify-between text-sm text-gray-500 italic font-serif px-10"><span>{schoolName}</span><span>{teacherName} - {year}</span></div>
        </div>
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({node, children, ...props}) => {
                const renderVisual = (text: any) => {
                    if (typeof text !== 'string') return null;
                    const chartMatch = text.match(/\[\[CHART_PLACEHOLDER:(.*?)\]\]/);
                    if (chartMatch) return <SimpleChart key={chartMatch[1]} data={charts[chartMatch[1]]} />;
                    const mmMatch = text.match(/\[\[MINDMAP_PLACEHOLDER:(.*?)\]\]/);
                    if (mmMatch) return <MindmapChart key={mmMatch[1]} data={mindmaps[mmMatch[1]]} />;
                    return null;
                };
                if (typeof children === 'string') { const v = renderVisual(children); if (v) return v; }
                if (Array.isArray(children)) { for (const child of children) { if (typeof child === 'string') { const v = renderVisual(child); if (v) return v; } } }
                return <p className="mb-4 text-justify leading-loose font-serif text-lg text-gray-800" {...props}>{children}</p>;
            },
            h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-blue-900 mb-6 mt-8 border-b-2 border-blue-100 pb-2 uppercase text-center font-serif" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-xl font-bold text-blue-800 mb-4 mt-6 font-serif" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-lg font-bold text-blue-700 mb-3 mt-4 italic font-serif" {...props} />,
            table: ({node, ...props}) => <div className="overflow-x-auto my-6 flex justify-center"><table className="border-collapse border border-gray-400 shadow-sm min-w-[80%]" {...props} /></div>,
            th: ({node, ...props}) => <th className="bg-gray-100 px-4 py-3 text-center text-base font-bold text-gray-900 border border-gray-400 font-serif" {...props} />,
            td: ({node, ...props}) => <td className="px-4 py-3 text-base text-gray-800 border border-gray-400 text-center font-serif" {...props} />,
            code: ({node, className, children, ...props}: any) => {
              const match = /language-(\w+)/.exec(className || '')
              if (match && (match[1] === 'python' || match[1] === 'py')) return null;
              return match ? <div className="hidden" /> : <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded font-mono text-sm" {...props}>{children}</code>
            }
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
      <div className="bg-gray-50 p-3 text-center text-xs text-gray-400 border-t font-serif italic">Create by Hoà Hiệp AI – 0983.676.470</div>
    </div>
  );
};
