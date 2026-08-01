import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useStore';
import { MessageSquare, Mic, Image as ImageIcon, MapPin, Activity } from 'lucide-react';

const Dashboard = () => {
  const user = useAuthStore((state) => state.user);

  const shortcuts = [
    { title: 'Text Consultation', desc: 'Chat with our AI assistant', icon: MessageSquare, path: '/chat', color: 'bg-blue-500' },
    { title: 'Voice Consultation', desc: 'Speak your symptoms', icon: Mic, path: '/voice', color: 'bg-purple-500' },
    { title: 'Image Analysis', desc: 'Upload a medical image', icon: ImageIcon, path: '/image', color: 'bg-green-500' },
    { title: 'Nearby Hospitals', desc: 'Find healthcare near you', icon: MapPin, path: '/hospitals', color: 'bg-rose-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm border border-slate-100 dark:border-slate-700">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Welcome back, {user?.name || 'User'}! 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          How can MediAssist AI help you today?
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {shortcuts.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
              <item.icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{item.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="text-[#22C55E]" /> Health Tips
          </h2>
          <div className="bg-gradient-to-br from-[#0EA5E9]/10 to-[#22C55E]/10 rounded-2xl p-6 border border-[#0EA5E9]/20">
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-[#0EA5E9]" />
                <p className="text-slate-700 dark:text-slate-300"><strong>Stay Hydrated:</strong> Aim for 8 glasses of water a day to maintain optimal bodily functions.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-[#22C55E]" />
                <p className="text-slate-700 dark:text-slate-300"><strong>Sleep Well:</strong> 7-9 hours of quality sleep helps boost immunity and cognitive performance.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-[#0EA5E9]" />
                <p className="text-slate-700 dark:text-slate-300"><strong>Active Lifestyle:</strong> 30 minutes of moderate exercise daily can significantly reduce the risk of chronic diseases.</p>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0EA5E9] rounded-full blur-3xl opacity-20 -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#22C55E] rounded-full blur-3xl opacity-20 -ml-10 -mb-10" />
          <h3 className="text-xl font-bold mb-2 relative z-10">Disclaimer</h3>
          <p className="text-sm text-slate-300 relative z-10 leading-relaxed">
            MediAssist AI is an informational tool only. It does not provide medical diagnoses or replace professional medical advice. 
            <br/><br/>
            In case of emergency, please call your local emergency services immediately.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
