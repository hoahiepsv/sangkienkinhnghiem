import React from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export const FileUploader: React.FC<Props> = ({ files, onFilesChange }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      onFilesChange([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer relative group">
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          accept=".doc,.docx,.pdf,.txt,image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
          <p className="text-sm font-medium text-gray-700">
            Kéo thả hoặc nhấn để chọn tập tin
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Hỗ trợ PDF, DOCX, Hình ảnh (Tối đa 10 file)
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {file.type.startsWith('image/') ? (
                  <ImageIcon size={20} className="text-purple-500 flex-shrink-0" />
                ) : (
                  <FileText size={20} className="text-blue-500 flex-shrink-0" />
                )}
                <span className="text-sm truncate text-gray-700">{file.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={() => removeFile(idx)}
                className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};