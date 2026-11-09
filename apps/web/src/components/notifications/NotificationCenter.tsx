import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'EXPIRATION' | 'PAYMENT_DUE' | 'EXPENSE_DUE' | 'IPC_ADJUSTMENT' | 'SYSTEM';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery<{ notifications: Notification[], unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const resp = await api.get('/notifications');
      return resp.data;
    },
    refetchInterval: 60000, // Check every minute
  });

  const { mutate: markAllRead } = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const { mutate: markRead } = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: 'none', 
          border: 'none', 
          fontSize: '1.5rem', 
          cursor: 'pointer', 
          position: 'relative',
          padding: '0.5rem',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span style={{ 
            position: 'absolute', 
            top: '4px', 
            right: '4px', 
            backgroundColor: 'var(--danger)', 
            color: 'white', 
            fontSize: '0.65rem', 
            borderRadius: '50%', 
            width: '18px', 
            height: '18px', 
            display: 'grid', 
            placeItems: 'center',
            fontWeight: 700,
            border: '2px solid white'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass card animate-fade-in" style={{ 
          position: 'absolute', 
          top: '100%', 
          right: 0, 
          width: '350px', 
          maxHeight: '450px', 
          padding: 0, 
          marginTop: '0.5rem',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {/* Header */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Notificaciones</h4>
            {unreadCount > 0 && (
              <button 
                onClick={() => markAllRead()}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.875rem' }}>No tienes notificaciones pendientes.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => !n.isRead && markRead(n.id)}
                  style={{ 
                    padding: '1rem 1.25rem', 
                    borderBottom: '1px solid var(--border-light)', 
                    backgroundColor: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <div className="flex justify-between items-start" style={{ marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem' }}>
                        {n.type === 'EXPIRATION' ? '⌛' : n.type === 'PAYMENT_DUE' ? '💰' : n.type === 'IPC_ADJUSTMENT' ? '📈' : '🔔'}
                      </span>
                      {n.title}
                    </div>
                    {!n.isRead && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></div>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                    {n.message}
                  </p>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '0.75rem', textAlign: 'center', backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
             <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ver todo el historial</span>
          </div>
        </div>
      )}
    </div>
  );
}
