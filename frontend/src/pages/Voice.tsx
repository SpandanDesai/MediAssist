import { useState, useRef } from 'react';
import api from '../lib/api';
import { Mic, Square, Loader2, Play, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Voice = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [userText, setUserText] = useState('');
  const [aiText, setAiText] = useState('');
  const [error, setError] = useState('');
  const [aiAudioBase64, setAiAudioBase64] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleStopRecording;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    setLoading(true);
    setAudioURL(null);
    setAiText('');
    setUserText('');
    setAiAudioBase64(null);

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const url = URL.createObjectURL(audioBlob);
    setAudioURL(url);

    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.wav');

    try {
      const response = await api.post('/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setUserText(response.data.user_text);
      setAiText(response.data.ai_text);
      setAiAudioBase64(response.data.audio_base64);
      
      // Auto-play the AI response
      if (response.data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${response.data.audio_base64}`);
        audio.play().catch(e => console.error("Audio playback failed", e));
      }

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process audio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 text-center">
        <h1 className="text-3xl font-bold mb-4 dark:text-white">Voice Consultation</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-lg mx-auto">
          Tap the microphone to start speaking your symptoms. The AI will listen, analyze, and reply with voice.
        </p>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm mb-6 flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="flex justify-center mb-12 relative">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl relative z-10 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                : 'bg-[#0EA5E9] hover:bg-[#0284c7] text-white'
            } disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="w-12 h-12 animate-spin" />
            ) : isRecording ? (
              <Square className="w-12 h-12 fill-current" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </button>
          
          {isRecording && (
            <div className="absolute inset-0 w-32 h-32 mx-auto bg-red-500 rounded-full animate-ping opacity-20" />
          )}
        </div>

        {(userText || aiText) && (
          <div className="text-left space-y-6">
            {userText && (
              <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-[#0EA5E9] mb-2 uppercase tracking-wider">You said:</h3>
                <p className="text-lg dark:text-white">{userText}</p>
              </div>
            )}

            {aiText && (
              <div className={`p-6 rounded-2xl ${
                aiText.includes('Medical Emergency Detected')
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200'
                  : 'bg-[#0EA5E9]/5 border border-[#0EA5E9]/20'
              }`}>
                <h3 className="text-sm font-bold text-[#0EA5E9] mb-2 uppercase tracking-wider flex items-center gap-2">
                  MediAssist AI 
                  {aiAudioBase64 && (
                    <button 
                      onClick={() => new Audio(`data:audio/mp3;base64,${aiAudioBase64}`).play()}
                      className="p-1 bg-[#0EA5E9] text-white rounded-full hover:scale-110 transition-transform"
                      title="Play Audio"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  )}
                </h3>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiText}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Voice;
