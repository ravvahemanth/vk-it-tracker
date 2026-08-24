import { isSupabaseConfigured } from '../services/supabase';
import { MdWarning } from 'react-icons/md';

export default function ConfigBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <div style={{
      background: '#dc2626',
      color: '#ffffff',
      padding: '12px 16px',
      textAlign: 'center',
      fontSize: '0.88rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
      zIndex: 99999
    }}>
      <MdWarning size={20} />
      <span>
        Vercel Environment Variables Missing! Add <code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code> in Vercel Settings, then click <strong>Redeploy</strong>.
      </span>
    </div>
  );
}
