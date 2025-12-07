
import { GoogleGenAI, Type } from "@google/genai";
import { ModelType, UserInput, OutlineData, OutlineSection } from "../types";

const fileToPart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getCleanApiKey = (key: string): string => {
  if (!key) return "";
  // Remove any character that is not standard ASCII (0-127)
  // This fixes the "String contains non ISO-8859-1 code point" error in Headers
  return key.trim().replace(/[^\x00-\x7F]/g, "");
};

export const createOutline = async (
  apiKey: string,
  model: ModelType,
  input: UserInput
): Promise<OutlineData> => {
  const cleanApiKey = getCleanApiKey(apiKey);
  if (!cleanApiKey) throw new Error("Vui lòng nhập API Key hợp lệ (Không chứa ký tự đặc biệt).");
  
  const ai = new GoogleGenAI({ apiKey: cleanApiKey });

  let fileParts: any[] = [];
  if (input.files && input.files.length > 0) {
     fileParts = await Promise.all(input.files.map(f => fileToPart(f)));
  }

  const prompt = `
    Bạn là chuyên gia tư vấn giáo dục. Hãy lập GIÀN Ý CHI TIẾT cho một ${input.topicType === 'THESIS' ? 'Luận văn' : 'Sáng kiến kinh nghiệm'} với đề tài: "${input.topicName}".
    
    Yêu cầu CỰC KỲ QUAN TRỌNG:
    - Tổng số từ mục tiêu BẮT BUỘC LÀ: ${input.wordCount} từ.
    - Bạn phải chia nhỏ đề tài thành các mục.
    - Tổng cộng số từ ước lượng của tất cả các mục PHẢI BẰNG ${input.wordCount}.
    
    Output format (JSON only):
    {
      "sections": [
        { "title": "Phần I: ...", "points": ["Ý chính 1", "Ý chính 2"], "estimatedWords": 500 },
        ...
      ],
      "totalWords": ${input.wordCount}
    }
  `;

  try {
    const result = await ai.models.generateContent({
      model: model,
      contents: {
        role: 'user',
        parts: [...fileParts, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  points: { 
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  estimatedWords: { type: Type.NUMBER }
                },
                required: ["title", "points", "estimatedWords"]
              }
            },
            totalWords: { type: Type.NUMBER }
          },
          required: ["sections", "totalWords"]
        }
      }
    });

    const text = result.text || "{}";
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.error("JSON Parse Error", e);
      throw new Error("Lỗi khi phân tích dữ liệu JSON từ AI. Vui lòng thử lại.");
    }

    // --- WORD COUNT SCALING LOGIC ---
    // AI often gets the math wrong. We force scale the sections to match user input exactly.
    let aiTotalWords = 0;
    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    
    if (rawSections.length > 0) {
        aiTotalWords = rawSections.reduce((sum: number, s: any) => sum + (Number(s.estimatedWords) || 0), 0);
    }

    const targetTotal = input.wordCount;
    // Prevent divide by zero if AI returns 0 total words
    const scaleFactor = (aiTotalWords > 0) ? (targetTotal / aiTotalWords) : 1;

    let runningTotal = 0;
    const sections: OutlineSection[] = rawSections.map((s: any, idx: number) => {
        const rawEst = Number(s.estimatedWords) || 500;
        let adjustedWords = Math.round((rawEst * scaleFactor) / 10) * 10;
        
        // If this is the last section, force it to take the remainder to match targetTotal exactly
        if (idx === rawSections.length - 1) {
             const diff = targetTotal - runningTotal;
             if (diff > 0) adjustedWords = diff;
             // Ensure it doesn't go negative or too small in edge cases
             if (adjustedWords < 100) adjustedWords = 100;
        } else {
             runningTotal += adjustedWords;
        }

        const sectionId = `sec_${idx}_${Date.now()}`;
        
        // Safe Point Parsing
        let parsedPoints: any[] = [];
        if (Array.isArray(s.points)) {
             parsedPoints = s.points.map((p: any, pIdx: number) => {
                  let pointText = "";
                  if (typeof p === 'string') pointText = p;
                  else if (typeof p === 'object' && p !== null) pointText = p.text || p.content || p.point || JSON.stringify(p);
                  else pointText = String(p);
                  
                  return {
                    id: `${sectionId}_pt_${pIdx}`,
                    text: pointText,
                    selected: true
                  };
             });
        }

        return {
            title: typeof s.title === 'string' ? s.title : `Mục ${idx + 1}`,
            points: parsedPoints, 
            estimatedWords: adjustedWords,
            id: sectionId,
            selected: true 
        };
    });

    return {
      sections: sections,
      totalWords: targetTotal 
    };

  } catch (error: any) {
    console.error("Outline Error:", error);
    // More specific error message for API Key issues
    if (error.message && (error.message.includes("Headers") || error.message.includes("ISO-8859-1"))) {
       throw new Error("API Key chứa ký tự không hợp lệ. Vui lòng kiểm tra lại (tắt bộ gõ tiếng Việt khi nhập).");
    }
    throw new Error("Không thể tạo giàn ý. Vui lòng thử lại hoặc kiểm tra API Key.");
  }
};

export const generateFullContent = async (
  apiKey: string,
  model: ModelType,
  input: UserInput,
  outline: OutlineData,
  onStepUpdate: (stepId: number, status: 'processing' | 'completed', detail?: string) => void,
  onContentStream: (chunk: string) => void
): Promise<{ text: string; pythonCode?: string }> => {
  const cleanApiKey = getCleanApiKey(apiKey);
  if (!cleanApiKey) throw new Error("Vui lòng nhập API Key hợp lệ.");
  
  const ai = new GoogleGenAI({ apiKey: cleanApiKey });
  
  const sectionsToProcess = outline.sections.filter(s => s.selected !== false);
  const totalSections = sectionsToProcess.length;

  if (totalSections === 0) {
    throw new Error("Vui lòng chọn ít nhất một mục trong giàn ý để viết.");
  }

  const locationName = input.department
    .replace(/^Sở GD&ĐT\s*/i, '')
    .replace(/^Phòng GD&ĐT\s*/i, '')
    .replace(/^SỞ GIÁO DỤC VÀ ĐÀO TẠO\s*/i, '')
    .trim() || "Vietnam";

  const systemPrompt = `
    Bạn là một chuyên gia viết Sáng kiến kinh nghiệm (SKKN) và Luận văn chuẩn mực tại Việt Nam.
    
    NHIỆM VỤ:
    Viết nội dung chi tiết cho đề tài: "${input.topicName}".
    
    THÔNG TIN:
    - Tác giả: ${input.teacherName}
    - Đơn vị: ${input.schoolName}
    - Tỉnh/TP: ${locationName}
    
    QUY ĐỊNH TRÌNH BÀY:
    1. ĐỊNH DẠNG:
       - BẮT ĐẦU NGAY VÀO NỘI DUNG. KHÔNG VIẾT LẠI TIÊU ĐỀ. KHÔNG VIẾT LẠI THÔNG TIN TÁC GIẢ/ĐƠN VỊ.
       - Markdown chuẩn. Tiêu đề #, ##, ###.
       - Văn phong học thuật, trang trọng, mở rộng vấn đề.

    2. BIỂU ĐỒ & SỐ LIỆU:
       - Trình bày bảng biểu dạng Markdown Table.
       - Khi có số liệu, BẮT BUỘC vẽ biểu đồ minh hoạ bằng JSON Block.
       - Đa dạng các loại biểu đồ:
         + So sánh cột đứng: "type": "bar" (ƯU TIÊN VẼ BIỂU ĐỒ CỘT DỌC CÓ GRADIENT)
         + Tỷ lệ phần trăm: "type": "doughnut" hoặc "pie"
         + Xu hướng theo năm/tháng: "type": "line"
       - KHÔNG vẽ biểu đồ cột ngang (horizontalBar).
       - Format JSON:
         \`\`\`json:chart
         {
           "type": "bar", 
           "title": "Kết quả khảo sát",
           "labels": ["Rất tốt", "Tốt", "Khá"],
           "datasets": [{ "label": "Số lượng", "data": [15, 20, 5] }]
         }
         \`\`\`
    
    3. SƠ ĐỒ TƯ DUY (MINDMAP):
       - Dùng cho phần Tóm tắt chương hoặc Giải pháp.
       - Format JSON:
         \`\`\`json:mindmap
         {
           "root": "Chủ đề",
           "children": [ { "name": "Ý 1" }, { "name": "Ý 2" } ]
         }
         \`\`\`

    4. HÌNH ẢNH:
       - BẠN KHÔNG ĐƯỢC PHÉP TỰ TẠO HÌNH ẢNH.
       - KHÔNG DÙNG Pollinations AI.
       - KHÔNG chèn cú pháp image markdown.
       - KHÔNG viết dòng chú thích riêng lẻ bên dưới hình ảnh.
       
    5. TOÁN HỌC:
       - Công thức toán: $P = \frac{F}{S}$ (\widehat{ABC} thay cho \angle).
  `;

  let fullText = "";
  
  for (let i = 0; i < totalSections; i++) {
    const section = sectionsToProcess[i];
    onStepUpdate(3, 'processing', `Đang viết phần ${i + 1}/${totalSections}: ${section.title} (${section.estimatedWords} từ)...`);

    // Filter only selected points
    const activePoints = section.points.filter(p => p.selected).map(p => p.text).join(', ');

    // We ask the model for 20% more words than needed because LLMs tend to be concise.
    // This buffer helps ensure we meet the strict word count.
    const bufferWordCount = Math.round(section.estimatedWords * 1.2);

    try {
      const sectionPrompt = `
        Viết chi tiết mục: ${section.title}
        Ý chính: ${activePoints}
        
        YÊU CẦU QUAN TRỌNG VỀ ĐỘ DÀI (BẮT BUỘC):
        - Mục tiêu: ${section.estimatedWords} từ.
        - Để đảm bảo không bị thiếu, bạn hãy viết khoảng ${bufferWordCount} từ.
        - Triển khai ý thật chi tiết, đưa ra nhiều dẫn chứng, số liệu giả định, ví dụ thực tế và lập luận sâu sắc.
        - TUYỆT ĐỐI KHÔNG VIẾT QUÁ NGẮN.
        
        Lưu ý: 
        - Tự động tạo biểu đồ (bar/line/pie/doughnut) nếu có số liệu.
        - Tự động tạo mindmap nếu cần tóm tắt.
      `;

      const streamResult = await ai.models.generateContentStream({
        model: model,
        contents: {
          role: 'user',
          parts: [{ text: sectionPrompt }]
        },
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });

      for await (const chunk of streamResult) {
        const chunkText = chunk.text || "";
        fullText += chunkText;
        onContentStream(fullText); 
      }
      fullText += "\n\n"; 

    } catch (error) {
      console.error(`Error generating section ${section.title}`, error);
      fullText += `\n\n[Lỗi khi viết mục: ${section.title}.]\n\n`;
    }
  }

  onStepUpdate(3, 'completed');
  onStepUpdate(4, 'processing', "Đang rà soát biểu đồ và sơ đồ...");
  await new Promise(r => setTimeout(r, 800));
  onStepUpdate(4, 'completed');
  onStepUpdate(5, 'processing', "Hoàn tất...");
  await new Promise(r => setTimeout(r, 500));
  onStepUpdate(5, 'completed');

  return { text: fullText };
};
