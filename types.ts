
export enum ModelType {
  FLASH = 'gemini-2.5-flash',
  PRO = 'gemini-3-pro-preview'
}

export interface AppConfig {
  apiKey: string;
  model: ModelType;
}

export interface UserInput {
  topicType: 'THESIS' | 'INITIATIVE';
  topicName: string;
  wordCount: number;
  teacherName: string;
  schoolName: string;
  department: string;
  year: string;
  files: File[];
}

export interface OutlinePoint {
  id: string;
  text: string;
  selected: boolean;
}

export interface OutlineSection {
  id: string;
  title: string;
  points: OutlinePoint[];
  estimatedWords: number;
  selected?: boolean;
}

export interface OutlineData {
  sections: OutlineSection[];
  totalWords: number;
}

export interface ProcessStep {
  id: number;
  label: string;
  status: 'pending' | 'processing' | 'completed';
  detail?: string;
}

export type AppState = 'INPUT' | 'GENERATING_OUTLINE' | 'REVIEW_OUTLINE' | 'GENERATING_CONTENT' | 'COMPLETED';

export const PROVINCES = [
  "Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
  "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
  "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông",
  "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang",
  "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
  "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
  "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
  "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Quảng Bình",
  "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng",
  "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa",
  "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang", "Vĩnh Long",
  "Vĩnh Phúc", "Yên Bái"
];

export interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'doughnut' | 'horizontalBar';
  title: string;
  labels: string[];
  datasets: { label: string; data: number[] }[];
}

export interface MindmapNode {
  name: string;
  children?: MindmapNode[];
}

export interface MindmapData {
  root: string;
  children: MindmapNode[];
}
