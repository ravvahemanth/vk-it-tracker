import { useEffect, useState } from 'react';
import { MdWifiOff } from 'react-icons/md';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-banner" role="alert">
      <MdWifiOff style={{ verticalAlign: 'middle', marginRight: '6px' }} />
      You are offline. Session changes cannot be saved until connection is restored.
    </div>
  );
}
