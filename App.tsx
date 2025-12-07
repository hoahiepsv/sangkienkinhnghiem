
import React, { useState } from 'react';
import { ApiKeyConfig } from './components/ApiKeyConfig';
import { FileUploader } from './components/FileUploader';
import { Preview } from './components/Preview';
import { createOutline, generateFullContent } from './services/geminiService';
import { ModelType, PROVINCES, UserInput, ProcessStep, AppState, OutlineData } from './types';
import { BookOpen, Sparkles, AlertCircle, Loader2, CheckCircle2, Circle, ListChecks, RotateCcw, PenTool, CheckSquare, Square, Download, FileDown } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const INITIAL_STEPS: ProcessStep[] = [
  { id: 1, label: "Đọc dữ liệu & Phân tích", status: 'pending' },
  { id: 2, label: "Lập giàn ý chi tiết", status: 'pending' },
  { id: 3, label: "Viết nội dung (Từng phần)", status: 'pending' },
  { id: 4, label: "Vẽ biểu đồ & Minh chứng", status: 'pending' },
  { id: 5, label: "Hoàn thiện", status: 'pending' },
];

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<ModelType>(ModelType.FLASH);
  const [appState, setAppState] = useState<AppState>('INPUT');
  
  const [userInput, setUserInput] = useState<UserInput>({
    topicType: 'INITIATIVE',
    topicName: '',
    wordCount: 5000,
    teacherName: '',
    schoolName: '',
    department: '',
    year: `${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
    files: []
  });

  const [steps, setSteps] = useState<ProcessStep[]>(INITIAL_STEPS);
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [result, setResult] = useState<{ text: string; pythonCode?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof UserInput, value: any) => {
    setUserInput(prev => ({ ...prev, [field]: value }));
  };

  const updateStep = (id: number, status: 'pending' | 'processing' | 'completed', detail?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail } : s));
  };

  const handleCreateOutline = async () => {
    if (!apiKey) { setError("Vui lòng nhập API Key"); return; }
    if (!userInput.topicName) { setError("Vui lòng nhập tên đề tài"); return; }

    setError(null);
    setAppState('GENERATING_OUTLINE');
    setSteps(INITIAL_STEPS);
    updateStep(1, 'processing', "Đang đọc tài liệu...");

    try {
      updateStep(1, 'completed');
      updateStep(2, 'processing', "Đang lập giàn ý...");
      
      const generatedOutline = await createOutline(apiKey, model, userInput);
      setOutline(generatedOutline);
      
      updateStep(2, 'completed');
      setAppState('REVIEW_OUTLINE');
    } catch (err: any) {
      setError(err.message);
      setAppState('INPUT');
      updateStep(1, 'pending');
      updateStep(2, 'pending');
    }
  };

  const toggleSection = (sectionId: string) => {
    if (!outline) return;
    const newSections = outline.sections.map(s => 
      s.id === sectionId ? { ...s, selected: !s.selected } : s
    );
    setOutline({ ...outline, sections: newSections });
  };

  const togglePoint = (sectionId: string, pointId: string) => {
      if (!outline) return;
      const newSections = outline.sections.map(s => {
          if (s.id === sectionId) {
              const newPoints = s.points.map(p => 
                  p.id === pointId ? { ...p, selected: !p.selected } : p
              );
              // If all points are deselected, maybe deselect section? Optional logic.
              return { ...s, points: newPoints };
          }
          return s;
      });
      setOutline({ ...outline, sections: newSections });
  };

  const handleExportOutline = async () => {
    if (!outline) return;
    try {
        const docChildren = [];
        const FONT_FAMILY = "Times New Roman";
        
        docChildren.push(new Paragraph({
             children: [new TextRun({ text: "GIÀN Ý ĐỀ TÀI", bold: true, size: 32, font: FONT_FAMILY })],
             alignment: AlignmentType.CENTER,
             spacing: { after: 300 }
        }));
        
        docChildren.push(new Paragraph({
             children: [new TextRun({ text: userInput.topicName.toUpperCase(), bold: true, size: 28, font: FONT_FAMILY })],
             alignment: AlignmentType.CENTER,
             spacing: { after: 400 }
        }));

        outline.sections.forEach(section => {
            if (!section.selected) return;
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: section.title, bold: true, size: 26, font: FONT_FAMILY }),
                    new TextRun({ text: ` (~${section.estimatedWords} từ)`, italics: true, size: 24, font: FONT_FAMILY, color: "666666" })
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 120 }
            }));
            
            section.points.forEach(point => {
                if (!point.selected) return;
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: point.text, size: 24, font: FONT_FAMILY })],
                    bullet: { level: 0 },
                    spacing: { after: 80 }
                }));
            });
        });

        const doc = new Document({
            sections: [{ properties: {}, children: docChildren }]
        });

        const blob = await Packer.toBlob(doc);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Gian_Y_${userInput.topicName.replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (e: any) {
        alert("Lỗi khi tải giàn ý: " + e.message);
    }
  };

  const handleWriteContent = async () => {
    if (!outline) return;
    
    // Validate selection
    if (outline.sections.every(s => !s.selected)) {
        setError("Vui lòng chọn ít nhất một mục để viết.");
        return;
    }

    setAppState('GENERATING_CONTENT');
    setError(null);

    try {
      let currentText = "";
      const data = await generateFullContent(
        apiKey,
        model,
        userInput,
        outline,
        updateStep,
        (chunk) => {
           currentText = chunk;
           setResult({ text: currentText });
        }
      );
      setResult(data);
      setAppState('COMPLETED');
    } catch (err: any) {
      setError(err.message);
      // Stay in outline review to try again if needed, or go back
      setAppState('REVIEW_OUTLINE'); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-blue-700 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg shadow-sm">
               <BookOpen className="text-blue-700 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wide">Viết Sáng Kiến Kinh Nghiệm</h1>
              <p className="text-xs text-blue-200 opacity-90">Lê Hoà Hiệp (0983.676.470)</p>
            </div>
          </div>
          <div className="hidden md:block">
             <span className="text-xs bg-blue-600 px-3 py-1.5 rounded-full text-blue-50 border border-blue-400 font-medium">
               Phiên bản AI Pro Education
             </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT PANEL */}
        <div className="lg:w-1/3 w-full space-y-6">
          <ApiKeyConfig apiKey={apiKey} setApiKey={setApiKey} />

          {/* PROCESS MONITOR */}
          {(appState !== 'INPUT') && (
             <div className="bg-white rounded-xl shadow-md border border-blue-100 p-4 animate-in fade-in zoom-in-95">
               <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                 <Loader2 className={`text-blue-600 ${appState !== 'COMPLETED' && appState !== 'REVIEW_OUTLINE' ? 'animate-spin' : ''}`} size={20} /> 
                 Tiến trình
               </h3>
               <div className="space-y-3">
                 {steps.map((step) => (
                   <div key={step.id} className="flex items-start gap-3">
                     <div className="mt-0.5">
                       {step.status === 'completed' && <CheckCircle2 size={18} className="text-green-500" />}
                       {step.status === 'processing' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                       {step.status === 'pending' && <Circle size={18} className="text-gray-300" />}
                     </div>
                     <div className="flex-1">
                       <p className={`text-sm font-medium ${
                         step.status === 'processing' ? 'text-blue-700' : 
                         step.status === 'completed' ? 'text-green-700' : 'text-gray-500'
                       }`}>
                         {step.label}
                       </p>
                       {step.detail && step.status === 'processing' && (
                         <p className="text-xs text-gray-500 mt-0.5 animate-pulse">{step.detail}</p>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {/* INPUT FORM (Only show when not writing content or if in review) */}
          <div className={`bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6 ${appState === 'GENERATING_CONTENT' ? 'opacity-50 pointer-events-none' : ''}`}>
            
            <div className="flex items-center justify-between border-b pb-4">
               <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                 <Sparkles className="text-yellow-500 w-5 h-5" /> Thông tin Đề tài
               </h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mô hình AI</label>
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setModel(ModelType.FLASH)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${model === ModelType.FLASH ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
                >
                  ⚡ Flash (Nhanh)
                </button>
                <button
                  onClick={() => setModel(ModelType.PRO)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${model === ModelType.PRO ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
                >
                  🧠 Pro (Thông minh)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loại đề tài</label>
              <select 
                value={userInput.topicType}
                onChange={(e) => handleInputChange('topicType', e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 text-sm rounded-lg"
              >
                <option value="INITIATIVE">Sáng kiến kinh nghiệm</option>
                <option value="THESIS">Luận văn / Luận án</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Giàn ý / Tài liệu (nếu có)</label>
              <FileUploader files={userInput.files} onFilesChange={(files) => handleInputChange('files', files)} />
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Tên đề tài</label>
               <textarea
                 value={userInput.topicName}
                 onChange={(e) => handleInputChange('topicName', e.target.value)}
                 placeholder="Nhập tên sáng kiến kinh nghiệm..."
                 rows={3}
                 className="w-full p-2.5 bg-gray-50 border border-gray-300 text-sm rounded-lg"
               />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số từ dự kiến</label>
                  <input
                   type="number" min="2000" max="20000" step="500"
                   value={userInput.wordCount}
                   onChange={(e) => handleInputChange('wordCount', parseInt(e.target.value))}
                   className="w-full p-2.5 bg-gray-50 border border-gray-300 text-sm rounded-lg"
                 />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Năm học</label>
                  <input
                   type="text"
                   value={userInput.year}
                   onChange={(e) => handleInputChange('year', e.target.value)}
                   className="w-full p-2.5 bg-gray-50 border border-gray-300 text-sm rounded-lg"
                 />
               </div>
            </div>

             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên giáo viên</label>
                 <input
                  type="text" value={userInput.teacherName}
                  onChange={(e) => handleInputChange('teacherName', e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 text-sm rounded-lg"
                />
              </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị công tác</label>
                 <input
                  type="text" value={userInput.schoolName}
                  onChange={(e) => handleInputChange('schoolName', e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 text-sm rounded-lg"
                />
              </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Sở GD&ĐT</label>
                 <select
                  value={userInput.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 text-sm rounded-lg"
                >
                  <option value="">-- Chọn Sở Giáo Dục --</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex gap-2">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* MAIN ACTION BUTTON */}
            {appState === 'INPUT' && (
              <button
                onClick={handleCreateOutline}
                disabled={appState !== 'INPUT'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <ListChecks size={20} /> LẬP GIÀN Ý
              </button>
            )}

          </div>
        </div>

        {/* RIGHT PANEL: PREVIEW / OUTLINE REVIEW */}
        <div className="lg:w-2/3 w-full h-[800px] lg:h-auto flex flex-col">
          
          {appState === 'INPUT' || appState === 'GENERATING_OUTLINE' ? (
             <div className="bg-white rounded-xl shadow-md border border-gray-100 h-full flex flex-col items-center justify-center text-gray-400 p-8">
               <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-10 h-10 text-blue-300" />
               </div>
               <h3 className="text-xl font-semibold text-gray-500 mb-2">Sẵn sàng khởi tạo</h3>
               <p className="text-center max-w-md">Nhập thông tin bên trái và nhấn "Lập giàn ý" để bắt đầu.</p>
             </div>
          ) : null}

          {appState === 'REVIEW_OUTLINE' && outline && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">
               <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-blue-800 text-lg flex items-center gap-2">
                        <ListChecks size={24}/> Duyệt Giàn Ý Đề Tài
                    </h3>
                    <p className="text-sm text-blue-600 mt-1">
                        Chọn các mục và ý chính bạn muốn viết.
                    </p>
                  </div>
                  <button 
                    onClick={handleExportOutline}
                    className="flex items-center gap-2 text-sm bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-50 transition-colors"
                  >
                     <FileDown size={16}/> Tải Giàn Ý (.docx)
                  </button>
               </div>
               
               <div className="flex-1 overflow-auto p-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm text-yellow-800 flex justify-between items-center">
                     <span><strong>Tổng số từ dự kiến:</strong> ~{outline.totalWords} từ</span>
                     <span className="bg-yellow-200 px-2 py-1 rounded text-xs font-bold">DỰ THẢO</span>
                  </div>

                  <div className="space-y-4">
                    {outline.sections && outline.sections.length > 0 ? (
                      outline.sections.map((section) => (
                        <div 
                            key={section.id} 
                            className={`border rounded-lg p-4 transition-all ${section.selected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 opacity-60'}`}
                        >
                          <div className="flex gap-4">
                              <div className="pt-1 cursor-pointer" onClick={() => toggleSection(section.id)}>
                                  {section.selected ? (
                                      <CheckSquare className="text-blue-600" />
                                  ) : (
                                      <Square className="text-gray-400" />
                                  )}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => toggleSection(section.id)}>
                                    <h4 className={`font-bold text-base ${section.selected ? 'text-gray-800' : 'text-gray-500'}`}>{section.title}</h4>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">~{section.estimatedWords} từ</span>
                                </div>
                                <div className="pl-2 space-y-2 mt-2">
                                    {section.points?.map((p) => (
                                        <div key={p.id} className="flex items-start gap-2 text-sm text-gray-600">
                                            <div 
                                                className="mt-0.5 cursor-pointer" 
                                                onClick={() => togglePoint(section.id, p.id)}
                                            >
                                                {p.selected ? (
                                                     <div className="w-4 h-4 border border-blue-500 rounded bg-blue-500 flex items-center justify-center">
                                                         <CheckSquare size={12} className="text-white" />
                                                     </div>
                                                ) : (
                                                     <div className="w-4 h-4 border border-gray-300 rounded hover:border-blue-400"></div>
                                                )}
                                            </div>
                                            <span 
                                                className={`flex-1 cursor-pointer ${p.selected ? 'text-gray-700' : 'text-gray-400 line-through'}`}
                                                onClick={() => togglePoint(section.id, p.id)}
                                            >
                                                {p.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                              </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 italic p-8">
                        Không thể tạo giàn ý chi tiết. Vui lòng thử lại hoặc kiểm tra file đính kèm.
                      </div>
                    )}
                  </div>
               </div>

               <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-4">
                  <button 
                    onClick={handleCreateOutline}
                    className="flex-1 py-3 border border-gray-300 bg-white text-gray-700 font-bold rounded-xl hover:bg-gray-100 flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18}/> Tạo lại Giàn ý khác
                  </button>
                  <button 
                    onClick={handleWriteContent}
                    className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2"
                  >
                    <PenTool size={18}/> ĐỒNG Ý & VIẾT CHI TIẾT
                  </button>
               </div>
            </div>
          )}

          {(appState === 'GENERATING_CONTENT' || appState === 'COMPLETED') && (
            <Preview 
              content={result?.text || ""} 
              pythonCode={result?.pythonCode} 
              teacherName={userInput.teacherName}
              schoolName={userInput.schoolName}
              department={userInput.department}
              topicName={userInput.topicName}
              year={userInput.year}
            />
          )}

        </div>

      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} <strong>VIẾT SÁNG KIẾN KINH NGHIỆM</strong> - Create by <strong>Hoà Hiệp AI</strong> (0983.676.470)
        </p>
      </footer>
    </div>
  );
};

export default App;
