import { useState, useRef } from 'react';
import api from '../lib/api';
import { UploadCloud, Image as ImageIcon, Loader2, AlertTriangle, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ImageAnalysis = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select a valid image file (PNG, JPG).');
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setError('');
      setAnalysis('');
    }
  };

  const clearSelection = () => {
    setFile(null);
    setPreview(null);
    setAnalysis('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('image_file', file);

    try {
      const response = await api.post('/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAnalysis(response.data.analysis);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to analyze image.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white text-center">Medical Image Analysis</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-center max-w-2xl mx-auto">
          Upload an image of a visible condition (e.g., rash, swelling) for an AI assessment. 
          <br/><strong>Do not upload sensitive or identifying images.</strong>
        </p>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm mb-6 flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            {!preview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-[#0EA5E9] transition-all group"
              >
                <div className="w-16 h-16 bg-[#0EA5E9]/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8 text-[#0EA5E9]" />
                </div>
                <h3 className="font-medium text-slate-700 dark:text-slate-200">Click to upload</h3>
                <p className="text-sm text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg" 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group h-64 bg-slate-100 dark:bg-slate-900">
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                <button 
                  onClick={clearSelection}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="w-full mt-4 bg-[#22C55E] hover:bg-[#16a34a] text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
              {loading ? 'Analyzing...' : 'Analyze Image'}
            </button>
          </div>

          <div>
            <div className={`h-full border border-slate-200 dark:border-slate-700 rounded-2xl p-6 overflow-y-auto max-h-80 ${analysis ? 'bg-[#0EA5E9]/5 border-[#0EA5E9]/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
              {!analysis && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                  <p>Results will appear here</p>
                </div>
              )}
              
              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#0EA5E9]" />
                  <p>AI is analyzing the image...</p>
                </div>
              )}

              {analysis && (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageAnalysis;
