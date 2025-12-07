import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Edit2 } from 'lucide-react';

interface Props {
  apiKey: string;
  setApiKey: (key: string) => void;
}

export const ApiKeyConfig: React.FC<Props> = ({ apiKey, setApiKey }) => {
  const [isEditing, setIsEditing] = useState(!apiKey);
  const [inputValue, setInputValue] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setInputValue(savedKey);
      setIsEditing(false);
    }
  }, [setApiKey]);

  const handleSave = () => {
    if (!inputValue.trim()) return;
    localStorage.setItem('gemini_api_key', inputValue);
    setApiKey(inputValue);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-4">
        <div className="flex-1 text-sm text-blue-800">
          <span className="font-semibold">API Key:</span> •••••••••••••••
        </div>
        <button
          onClick={handleEdit}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-100 transition-colors"
        >
          <Edit2 size={14} /> Chỉnh sửa
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm mb-6 animate-in fade-in slide-in-from-top-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Nhập Google Gemini API Key
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!inputValue.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
        >
          <Save size={18} /> Lưu
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        API Key được lưu an toàn trong trình duyệt của bạn.
      </p>
    </div>
  );
};