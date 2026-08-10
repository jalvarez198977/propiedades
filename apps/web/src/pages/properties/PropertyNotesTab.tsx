import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import toast from 'react-hot-toast';
import api from '@/api/axios';
import { PropertyNoteDto, CreatePropertyNoteDto } from '@propiedades/types';
import { formatDate } from '../../utils/dateUtils';
import { useOrganization } from '../../providers/OrganizationProvider';

interface PropertyNotesTabProps {
  propertyId: string;
}

export function PropertyNotesTab({ propertyId }: PropertyNotesTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();
  const { canEdit } = useOrganization();

  const { data: notes, isLoading } = useQuery<PropertyNoteDto[]>({
    queryKey: ['property-notes', propertyId],
    queryFn: async () => {
      const resp = await api.get(`/properties/${propertyId}/notes`);
      return resp.data;
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: CreatePropertyNoteDto) => {
      await api.post(`/properties/${propertyId}/notes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-notes', propertyId] });
      toast.success('Nota creada con éxito');
      setIsAdding(false);
      setContent('');
    },
    onError: () => toast.error('Error al crear la nota'),
  });

  const updateNoteMutation = useMutation({
    mutationFn: async (data: { id: string; content: string }) => {
      await api.patch(`/properties/${propertyId}/notes/${data.id}`, { content: data.content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-notes', propertyId] });
      toast.success('Nota actualizada');
      setEditingNoteId(null);
      setContent('');
    },
    onError: () => toast.error('Error al actualizar la nota'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/properties/${propertyId}/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-notes', propertyId] });
      toast.success('Nota eliminada');
    },
    onError: () => toast.error('Error al eliminar la nota'),
  });

  const handleSave = () => {
    if (!content.trim() || content === '<p><br></p>') {
      toast.error('La nota no puede estar vacía');
      return;
    }
    if (editingNoteId) {
      updateNoteMutation.mutate({ id: editingNoteId, content });
    } else {
      createNoteMutation.mutate({ content });
    }
  };

  const startEdit = (note: PropertyNoteDto) => {
    setEditingNoteId(note.id);
    setContent(note.content);
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingNoteId(null);
    setContent('');
  };

  if (isLoading) return <div>Cargando notas...</div>;

  return (
    <div className="card">
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h3 className="font-heading" style={{ fontSize: '1.5rem' }}>Block de Notas</h3>
        {canEdit && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            + Nueva Nota
          </button>
        )}
      </div>

      {isAdding && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
          <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>{editingNoteId ? 'Editar Nota' : 'Nueva Nota'}</h4>
          <ReactQuill 
            theme="snow" 
            value={content} 
            onChange={setContent} 
            style={{ backgroundColor: 'white', marginBottom: '1rem' }}
          />
          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              onClick={cancelEdit} 
              className="btn btn-outline"
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={handleSave} 
              className="btn btn-primary"
              disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
            >
              Guardar Nota
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {!notes || notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No hay notas registradas en esta propiedad.
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} style={{ padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
              <div className="flex justify-between items-start" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {formatDate(note.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                {canEdit && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEdit(note)}
                      className="btn-text" 
                      style={{ fontSize: '0.75rem', color: 'var(--primary)', padding: '0.2rem 0.5rem' }}
                    >
                      ✏️ Editar
                    </button>
                    <button 
                      onClick={() => {
                        if(window.confirm('¿Eliminar esta nota?')) {
                          deleteNoteMutation.mutate(note.id);
                        }
                      }}
                      className="btn-text" 
                      style={{ fontSize: '0.75rem', color: 'var(--danger)', padding: '0.2rem 0.5rem' }}
                    >
                      🗑 Eliminar
                    </button>
                  </div>
                )}
              </div>
              <div 
                className="rich-text-content" 
                style={{ fontSize: '1rem', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: note.content }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
