import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useStore';
import { HeartPulse, MessageSquare, Mic, Image as ImageIcon, MapPin, User, LogOut } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: HeartPulse },
    { name: 'Chat', path: '/chat', icon: MessageSquare },
    { name: 'Voice', path: '/voice', icon: Mic },
    { name: 'Image Analysis', path: '/image', icon: ImageIcon },
    { name: 'Hospitals', path: '/hospitals', icon: MapPin },
  ];

  return (
    <nav className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2 text-[#0EA5E9] font-bold text-xl">
            <HeartPulse className="w-8 h-8" />
            <span>MediAssist AI</span>
          </Link>
          
          <div className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] dark:bg-[#0EA5E9]/20' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <Link to="/profile" className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 hover:text-[#0EA5E9] transition-colors">
              <User className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">{user?.name}</span>
            </Link>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
