import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  PropertyDto, 
  PropertyCategoryLabels, 
  PropertyCategory,
  UtilityDto, 
  UtilityTypeLabels, 
  UtilityType, 
  CreateUtilityDto, 
  PaymentMethod, 
  CreatePaymentDto,
  UpdatePropertyDto,
  AssignTenantDto,
  TenantDto,
  PropertyMeterDto,
  CreatePropertyMeterDto,
  ExpenseFrequency,
  ExpenseFrequencyLabels,
  ExpenseReminderDto,
  CreateExpenseReminderDto,
  OrganizationRole,
  PaginatedResponse,
  ExpenseCategoryDto,
  TerminateTenancyDto,
  ReturnDepositDto
} from '@propiedades/types';
import toast from 'react-hot-toast';
import { useOrganization } from '../../providers/OrganizationProvider';
import api from '@/api/axios';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { formatDate, toLocalDateFormat } from '../../utils/dateUtils';
import { PropertyNotesTab } from './PropertyNotesTab';

// --- Validation Schemas ---
const utilitySchema = z.object({
  type: z.nativeEnum(UtilityType),
  amount: z.number().min(1, 'Monto inválido'),
  isIncludedInRent: z.boolean(),
  billingMonth: z.string().optional(),
  title: z.string().optional(),
});

const paymentSchema = z.object({
  amount: z.number().min(1, 'Monto inválido'),
  paymentDate: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  notes: z.string().optional(),
});

const featureBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  backgroundColor: 'var(--bg-surface)',
  borderRadius: '0.75rem',
  border: '1px solid var(--border-light)',
};

const featureLabelStyle = {
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  letterSpacing: '0.05em',
};

const featureValueStyle = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--text-main)',
};

// --- Main Component ---
export default function PropertyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'detalle' | 'gestion' | 'notas'>(
    searchParams.get('tab') === 'notas' 
      ? 'notas' 
      : searchParams.get('manage') === 'true' 
        ? 'gestion' 
        : 'detalle'
  );
  const [isAddingUtility, setIsAddingUtility] = useState(false);
  const [isEditingProperty, setIsEditingProperty] = useState(false);
  const [isAssigningTenant, setIsAssigningTenant] = useState(false);
  const [isEditDepositOpen, setIsEditDepositOpen] = useState(false);
  const [isEditRentOpen, setIsEditRentOpen] = useState(false);
  const [isChangeTenantOpen, setIsChangeTenantOpen] = useState(false);
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
  const [isEditStartDateOpen, setIsEditStartDateOpen] = useState(false);
  const [returnDepositTenancy, setReturnDepositTenancy] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'notas') {
      setActiveTab('notas');
    } else {
      const manage = searchParams.get('manage') === 'true';
      setActiveTab(manage ? 'gestion' : 'detalle');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'detalle' | 'gestion' | 'notas') => {
    setActiveTab(tab);
    setSearchParams(prev => {
      if (tab === 'gestion') {
        prev.set('manage', 'true');
        prev.delete('tab');
      } else if (tab === 'notas') {
        prev.set('tab', 'notas');
        prev.delete('manage');
      } else {
        prev.delete('manage');
        prev.delete('tab');
      }
      return prev;
    });
  };

  // Roles verification
  const { activeOrganization, canEdit, isAdmin } = useOrganization();

  // Queries
  const { data: property, isLoading: isLoadingProp } = useQuery<PropertyDto>({
    queryKey: ['property', id],
    queryFn: async () => {
      const resp = await api.get(`/properties/${id}`);
      return resp.data;
    },
    placeholderData: keepPreviousData
  });

  const { data: utilities } = useQuery<UtilityDto[]>({
    queryKey: ['utilities', id],
    queryFn: async () => {
      const resp = await api.get(`/utilities/property/${id}`);
      return resp.data;
    },
  });

  const { data: activeTenancy, isLoading: isLoadingTenancy } = useQuery<any>({
    queryKey: ['active-tenancy', id],
    queryFn: async () => {
      const resp = await api.get(`/properties/${id}/active-tenancy`);
      return resp.data || null;
    },
    placeholderData: keepPreviousData
  });

  const ipcStatus = useMemo(() => {
    if (!activeTenancy) return null;
    const intervalMonths = activeTenancy.ipcAdjustmentMonths ?? 6;
    if (intervalMonths <= 0) return null;

    const baseDate = activeTenancy.lastIpcAdjustmentDate 
      ? new Date(activeTenancy.lastIpcAdjustmentDate) 
      : new Date(activeTenancy.startDate);

    let nextDate = new Date(baseDate);
    nextDate.setMonth(nextDate.getMonth() + intervalMonths);
    
    const now = new Date();
    if (!activeTenancy.lastIpcAdjustmentDate) {
      while (nextDate.getTime() + intervalMonths * 30 * 24 * 60 * 60 * 1000 < now.getTime()) {
        nextDate.setMonth(nextDate.getMonth() + intervalMonths);
      }
    }
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetMidnight = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
    const diffDays = Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      nextDate,
      diffDays,
      isDue: diffDays <= 15,
      isOverdue: diffDays < 0,
      baseDate,
    };
  }, [activeTenancy]);

  const queryClient = useQueryClient();

  const deleteUtilityMutation = useMutation({
    mutationFn: async (utilityId: string) => {
      await api.delete(`/utilities/${utilityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilities', id] });
      toast.success('Gasto eliminado');
    },
    onError: () => toast.error('Error al eliminar el gasto'),
  });

  const sendBillingEmailMutation = useMutation({
    mutationFn: async (tenancyId: string) => {
      await api.post(`/organizations/${activeOrganization?.id}/billing/tenancy/${tenancyId}/send`);
    },
    onSuccess: () => {
      toast.success('Correo de cobranza enviado con éxito');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error al enviar el correo';
      toast.error(msg);
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await api.post(`/properties/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast.success('Foto subida con éxito');
    },
    onError: () => toast.error('Error al subir la foto'),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/properties/${id}/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast.success('Foto eliminada');
    },
    onError: () => toast.error('Error al eliminar la foto'),
  });

  const reorderPhotosMutation = useMutation({
    mutationFn: async (photoOrders: Array<{ id: string, order: number }>) => {
      await api.patch(`/properties/${id}/photos/order`, { photoOrders });
    },
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ['property', id] });
      const previousProp = queryClient.getQueryData<PropertyDto>(['property', id]);
      if (previousProp && previousProp.photos) {
        const orderMap = new Map(newOrder.map(no => [no.id, no.order]));
        const newPhotos = [...previousProp.photos].map(p => ({
          ...p,
          order: orderMap.has(p.id) ? orderMap.get(p.id)! : p.order
        })).sort((a, b) => a.order - b.order);
        queryClient.setQueryData(['property', id], { ...previousProp, photos: newPhotos });
      }
      return { previousProp };
    },
    onError: (_err, _newOrder, context) => {
      if (context?.previousProp) {
        queryClient.setQueryData(['property', id], context.previousProp);
      }
      toast.error('Error al ordenar las fotos');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      toast.success(`Subiendo ${files.length} foto(s)...`, { id: 'uploading' });
      
      try {
        for (const file of files) {
          await uploadPhotoMutation.mutateAsync(file);
        }
      } catch (error) {
        console.error("Error al subir algunas fotos", error);
      } finally {
        toast.dismiss('uploading');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleMovePhoto = (index: number, direction: 'left' | 'right') => {
    if (!property?.photos) return;
    const newPhotos = [...property.photos];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPhotos.length) return;

    // Swap items
    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[targetIndex];
    newPhotos[targetIndex] = temp;

    // Build new order array
    const photoOrders = newPhotos.map((p, i) => ({ id: p.id, order: i }));
    reorderPhotosMutation.mutate(photoOrders);
  };

  const uploadContractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await api.post(`/properties/${id}/tenancy/${activeTenancy?.id}/contract/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', id] });
      toast.success('Contrato subido con éxito');
    },
    onError: () => toast.error('Error al subir el contrato'),
  });

  const deleteContractMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/properties/${id}/tenancy/${activeTenancy?.id}/contract`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', id] });
      toast.success('Contrato eliminado');
    },
    onError: () => toast.error('Error al eliminar el contrato'),
  });

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      toast.loading('Subiendo contrato...', { id: 'uploading-contract' });
      try {
        await uploadContractMutation.mutateAsync(file);
      } catch (error) {
        console.error("Error al subir contrato", error);
      } finally {
        toast.dismiss('uploading-contract');
        e.target.value = '';
      }
    }
  };

  const handleDeleteContract = async () => {
    if (window.confirm('¿Eliminar el documento de contrato permanentemente?')) {
      toast.loading('Eliminando contrato...', { id: 'deleting-contract' });
      try {
        await deleteContractMutation.mutateAsync();
      } catch (error) {
        console.error("Error al eliminar contrato", error);
      } finally {
        toast.dismiss('deleting-contract');
      }
    }
  };


  // Only show the hard loading state on initial mount (no data)
  const isInitialLoading = (isLoadingProp && !property) || (isLoadingTenancy && !activeTenancy);

  if (isInitialLoading) {
    return (
      <div className="container" style={{ paddingTop: '8rem', textAlign: 'center' }}>
        <div className="animate-pulse" style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏢</div>
        <p className="text-muted" style={{ fontWeight: 600 }}>Cargando detalles de la propiedad...</p>
      </div>
    );
  }

  if (!property) {
    return <div className="container" style={{ paddingTop: '4rem' }}>Propiedad no encontrada.</div>;
  }

  return (
    <div className="container animate-fade-in" style={{ padding: '1.5rem 0' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/properties" className="text-muted" style={{ textDecoration: 'none', fontSize: '0.875rem' }}>← Volver a propiedades</Link>
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-surface)', padding: '0.4rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => handleTabChange('detalle')}
            style={{ 
              padding: '0.5rem 1.25rem', 
              borderRadius: '0.5rem', 
              border: 'none', 
              fontSize: '0.875rem', 
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'detalle' ? 'white' : 'transparent',
              color: activeTab === 'detalle' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'detalle' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📄 Ficha Técnica
          </button>
          <button 
            onClick={() => handleTabChange('gestion')}
            style={{ 
              padding: '0.5rem 1.25rem', 
              borderRadius: '0.5rem', 
              border: 'none', 
              fontSize: '0.875rem', 
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'gestion' ? 'white' : 'transparent',
              color: activeTab === 'gestion' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'gestion' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🔧 Gestión de Pagos
          </button>
          <button 
            onClick={() => handleTabChange('notas')}
            style={{ 
              padding: '0.5rem 1.25rem', 
              borderRadius: '0.5rem', 
              border: 'none', 
              fontSize: '0.875rem', 
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'notas' ? 'white' : 'transparent',
              color: activeTab === 'notas' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'notas' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📝 Block de Notas
          </button>
        </div>
      </div>

      {activeTab === 'detalle' ? (
        <div className="flex flex-col gap-8 max-w-4xl mx-auto">
          {/* Property Card - Ficha Técnica */}
          <div className="card">
            <div className="flex justify-between items-start" style={{ marginBottom: '2rem' }}>
              <div>
                <div className="flex gap-2" style={{ marginBottom: '0.5rem' }}>
                  <span className="badge badge-success">
                    {property.category === PropertyCategory.OTHER && property.customCategory 
                      ? property.customCategory 
                      : PropertyCategoryLabels[property.category]}
                  </span>
                  <span 
                    className={property.activeTenant ? 'badge badge-success' : 'badge'}
                    style={{ 
                      backgroundColor: property.activeTenant ? 'rgba(46, 204, 113, 0.1)' : 'transparent',
                      color: property.activeTenant ? '#2ecc71' : 'var(--text-muted)',
                      border: property.activeTenant ? '1px solid #2ecc71' : '1px solid var(--border)'
                    }}
                  >
                    {property.activeTenant ? 'ARRENDADA' : 'DISPONIBLE'}
                  </span>
                </div>
                {!isEditingProperty && (
                  <>
                    <h2 className="font-heading" style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>{property.name || property.address}</h2>
                    <p className="text-muted" style={{ fontWeight: 600, fontSize: '1.1rem' }}>{property.address} {property.city ? `• ${property.city}` : ''}</p>
                  </>
                )}
              </div>
              {canEdit && (
                <button 
                  onClick={() => setIsEditingProperty(!isEditingProperty)} 
                  className={isEditingProperty ? 'btn btn-outline' : 'btn btn-primary'}
                >
                  {isEditingProperty ? 'Cancelar' : '✏️ Editar Información'}
                </button>
              )}
            </div>

            {isEditingProperty ? (
              <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                <EditPropertyForm property={property} onDone={() => setIsEditingProperty(false)} />
              </div>
            ) : (
              <>
                {/* Características Principales (Iconos) */}
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div style={featureBoxStyle}>
                    <span style={{ fontSize: '1.5rem' }}>🛏️</span>
                    <div>
                      <div style={featureLabelStyle}>Dormitorios</div>
                      <div style={featureValueStyle}>{property.bedrooms ?? '0'}</div>
                    </div>
                  </div>
                  <div style={featureBoxStyle}>
                    <span style={{ fontSize: '1.5rem' }}>🚿</span>
                    <div>
                      <div style={featureLabelStyle}>Baños</div>
                      <div style={featureValueStyle}>{property.bathrooms ?? '0'}</div>
                    </div>
                  </div>
                  <div style={featureBoxStyle}>
                    <span style={{ fontSize: '1.5rem' }}>📐</span>
                    <div>
                      <div style={featureLabelStyle}>m² Útiles</div>
                      <div style={featureValueStyle}>{property.m2Built ? `${property.m2Built} m²` : 'N/A'}</div>
                    </div>
                  </div>
                  <div style={featureBoxStyle}>
                    <span style={{ fontSize: '1.5rem' }}>🚗</span>
                    <div>
                      <div style={featureLabelStyle}>Estacionamiento</div>
                      <div style={featureValueStyle}>{property.hasParking ? 'Sí' : 'No'}</div>
                    </div>
                  </div>
                  <div style={featureBoxStyle}>
                    <span style={{ fontSize: '1.5rem' }}>📦</span>
                    <div>
                      <div style={featureLabelStyle}>Bodega</div>
                      <div style={featureValueStyle}>{property.hasStorage ? 'Sí' : 'No'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                  <div>
                    <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Día de Pago</h4>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Día {property.paymentDueDay}</p>
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Vencimiento Contrato</h4>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                      {property.contractEndDate ? formatDate(property.contractEndDate) : 'Indefinido'}
                    </p>
                  </div>
                </div>

                {/* ROL y Otros Datos */}
                <div className="flex flex-wrap gap-4" style={{ marginBottom: '2rem' }}>
                  {property.rol && (
                    <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)', borderRadius: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ROL SII</span>
                      <span style={{ fontWeight: 600 }}>{property.rol}</span>
                    </div>
                  )}
                  {property.expectedRent && (
                    <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)', borderRadius: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Precio Esperado</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>${Number(property.expectedRent).toLocaleString('es-CL')}</span>
                    </div>
                  )}
                  {property.m2Total && (
                    <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)', borderRadius: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Superficie Total</span>
                      <span style={{ fontWeight: 600 }}>{property.m2Total} m²</span>
                    </div>
                  )}
                </div>

                {property.notes && (
                  <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '1rem', borderLeft: '4px solid var(--primary)' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary)' }}>Notas y Descripción</h4>
                    <div 
                      style={{ fontSize: '1rem', lineHeight: 1.6 }} 
                      className="text-muted rich-text-content"
                      dangerouslySetInnerHTML={{ __html: property.notes }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : activeTab === 'gestion' ? (
        <div className="flex flex-col lg:grid" style={{ gridTemplateColumns: window.innerWidth < 1024 ? '1fr' : '2fr 1fr', gap: window.innerWidth < 768 ? '1.5rem' : '3rem' }}>
          {/* Left Column: Utilities & Meters */}
          <div className="flex flex-col gap-8">
            {/* Utilities Section */}
            {/* [NEW] Pending Garanties Section */}
            {property.pendingSecurityDeposits && property.pendingSecurityDeposits.length > 0 && (
              <div className="card" style={{ border: '2px solid #f59e0b', backgroundColor: '#fffbeb', marginBottom: '2rem' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                  <h3 className="font-heading" style={{ fontSize: '1.25rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    ⚠️ Garantías por Devolver
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600, backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '0.5rem' }}>
                    Plazo legal: 45 días
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  {property.pendingSecurityDeposits.map(tenancy => {
                    const daysPassed = tenancy.endDate ? Math.max(0, Math.ceil((new Date().getTime() - new Date(tenancy.endDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
                    const daysRemaining = 45 - daysPassed;
                    const isOverdue = daysRemaining < 0;
                    const statusColor = daysRemaining <= 5 ? '#ef4444' : daysRemaining <= 15 ? '#f59e0b' : '#10b981';

                    return (
                      <div key={tenancy.id} style={{ background: 'white', padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${isOverdue ? '#fca5a5' : '#fde68a'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div className="flex justify-between items-start" style={{ marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{tenancy.tenant.name}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>Terminó el {tenancy.endDate ? formatDate(tenancy.endDate, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</span>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border)' }}></span>
                              <span style={{ color: statusColor, fontWeight: 700 }}>
                                {isOverdue ? `${Math.abs(daysRemaining)} días de atraso` : `${daysRemaining} días restantes`}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Monto a Devolver</div>
                            <div style={{ fontWeight: 900, color: '#111827', fontSize: '1.1rem' }}>
                              ${Number(tenancy.securityDeposit).toLocaleString('es-CL')}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ height: '6px', width: '100%', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                            <div style={{ 
                              height: '100%', 
                              width: `${Math.min(100, (daysPassed / 45) * 100)}%`, 
                              backgroundColor: statusColor,
                              transition: 'width 0.5s ease'
                            }}></div>
                          </div>
                          <div className="flex justify-between" style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            <span>Día 1</span>
                            <span>Día 45</span>
                          </div>
                        </div>

                        {canEdit && (
                          <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', padding: '0.6rem', fontSize: '0.75rem', backgroundColor: isOverdue ? '#ef4444' : '#f59e0b', border: 'none', fontWeight: 700 }}
                            onClick={() => setReturnDepositTenancy(tenancy)}
                          >
                            Marcar como DEVUELTA
                          </button>
                        )}
                      </div>
                    );
                  })}
                  
                  {returnDepositTenancy && (
                    <ReturnDepositModal 
                      isOpen={!!returnDepositTenancy}
                      onClose={() => setReturnDepositTenancy(null)}
                      propertyId={property.id}
                      tenancyId={returnDepositTenancy.id}
                      initialDeposit={returnDepositTenancy.securityDeposit ? Number(returnDepositTenancy.securityDeposit) : 0}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Utilities Section */}
            <div className="card">
              <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
                <h3 className="font-heading" style={{ fontSize: '1.5rem' }}>Servicios y Gastos</h3>
                {canEdit && (
                  <button 
                    onClick={() => setIsAddingUtility(!isAddingUtility)} 
                    className={isAddingUtility ? 'btn btn-outline' : 'btn btn-primary'} 
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    {isAddingUtility ? 'Cerrar' : '+ Registrar Gasto'}
                  </button>
                )}
              </div>

              {isAddingUtility && (
                <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                  <AddUtilityForm propertyId={property.id} onDone={() => setIsAddingUtility(false)} />
                </div>
              )}

              {!utilities || utilities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No hay gastos registrados.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {utilities.map((util) => (
                    <div key={util.id} className="flex justify-between items-center" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-surface)', borderRadius: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {util.type === 'OTHER' && util.notes ? util.notes : UtilityTypeLabels[util.type]}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {util.billingMonth ? formatDate(util.billingMonth, { month: 'long', year: 'numeric' }) : 'Recurrente'}
                          {util.createdAt && ` • ${formatDate(util.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={util.isIncludedInRent ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: '0.65rem' }}>
                          {util.isIncludedInRent ? 'En arriendo' : 'Extra'}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                          ${Number(util.amount).toLocaleString('es-CL')}
                        </span>
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              if (window.confirm('¿Eliminar este gasto permanentemente?')) {
                                deleteUtilityMutation.mutate(util.id);
                              }
                            }}
                            className="btn btn-icon"
                            style={{ padding: '0.25rem', color: 'var(--danger)', opacity: 0.6, cursor: 'pointer', background: 'none', border: 'none' }}
                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reminders Card */}
            <RemindersCard propertyId={property.id} />

            {/* Dynamic Meters Card */}
            <MetersCard propertyId={property.id} />
          </div>

          {/* Right Column: Tenant & Photos */}
          <div className="flex flex-col gap-8">
            {/* Active Tenant Section */}
            <div className="card" style={{ 
              border: property.activeTenant ? '1px solid var(--primary-light)' : '1px solid var(--border)', 
              backgroundColor: property.activeTenant ? 'rgba(56, 122, 223, 0.02)' : 'var(--bg-main)' 
            }}>
              <h3 className="font-heading" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                {activeTenancy ? 'Ocupación Actual' : 'Estado de Ocupación'}
              </h3>
              
              {activeTenancy ? (
                <div>
                  <div className="flex items-center gap-4" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '1.25rem', fontWeight: 700 }}>
                      {activeTenancy.tenant.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 600 }}>{activeTenancy.tenant.name}</div>
                        {canEdit && (
                          <button 
                            onClick={() => setIsChangeTenantOpen(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            CAMBIAR
                          </button>
                        )}
                        <ChangeTenantModal 
                          isOpen={isChangeTenantOpen}
                          onClose={() => setIsChangeTenantOpen(false)}
                          propertyId={property.id}
                          tenancyId={activeTenancy.id}
                        />
                        {activeTenancy.tenant.email && canEdit && (
                          <button 
                            onClick={() => {
                              if (window.confirm(`¿Enviar correo de cobranza a ${activeTenancy.tenant.name}?`)) {
                                sendBillingEmailMutation.mutate(activeTenancy.id);
                              }
                            }}
                            disabled={sendBillingEmailMutation.isPending}
                            className="btn-text"
                            style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800, padding: '0.2rem 0.4rem', borderRadius: '0.4rem', backgroundColor: 'rgba(79, 70, 229, 0.05)' }}
                          >
                            {sendBillingEmailMutation.isPending ? 'Enviando...' : '✉️ Enviar Cobro'}
                          </button>
                        )}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{activeTenancy.tenant.email || 'Sin email'}</div>
                    </div>
                    {canEdit && (
                      <div style={{ marginLeft: 'auto' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ fontSize: '0.65rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)', opacity: 0.8 }}
                          onClick={() => setIsTerminateModalOpen(true)}
                        >
                          ⚠️ Terminar Contrato
                        </button>
                        
                        <TerminateTenancyModal 
                          isOpen={isTerminateModalOpen}
                          onClose={() => setIsTerminateModalOpen(false)}
                          propertyId={property.id}
                          tenancyId={activeTenancy.id}
                        />
                      </div>
                    )}
                  </div>

                  {ipcStatus && (
                    <div style={{
                      backgroundColor: ipcStatus.isOverdue 
                        ? 'rgba(239, 68, 68, 0.08)' 
                        : ipcStatus.isDue 
                          ? 'rgba(245, 158, 11, 0.08)' 
                          : 'rgba(99, 102, 241, 0.05)',
                      border: `1.5px solid ${
                        ipcStatus.isOverdue 
                          ? '#ef4444' 
                          : ipcStatus.isDue 
                            ? '#f59e0b' 
                            : 'var(--border)'
                      }`,
                      borderRadius: '0.75rem',
                      padding: '0.85rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      marginBottom: '1rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>📈</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: ipcStatus.isOverdue ? '#dc2626' : ipcStatus.isDue ? '#b45309' : 'var(--text-main)' }}>
                            {ipcStatus.isOverdue 
                              ? '⚠️ Reajuste de IPC Vencido (Semestral)' 
                              : ipcStatus.isDue 
                                ? '🔔 Próximo Reajuste de IPC (Semestral)' 
                                : 'Próximo Reajuste de IPC (Semestral)'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {ipcStatus.isOverdue 
                              ? `Cumplió 6 meses el ${formatDate(ipcStatus.nextDate)} (hace ${Math.abs(ipcStatus.diffDays)} días).` 
                              : ipcStatus.isDue 
                                ? `Corresponde aplicar reajuste el ${formatDate(ipcStatus.nextDate)} (en ${ipcStatus.diffDays} días).`
                                : `Próximo reajuste programado para el ${formatDate(ipcStatus.nextDate)}.`}
                          </div>
                        </div>
                      </div>
                      {canEdit && (
                        <button 
                          onClick={() => setIsEditRentOpen(true)}
                          className={`btn ${ipcStatus.isDue ? 'btn-primary' : 'btn-outline'}`}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                        >
                          {ipcStatus.isDue ? 'Aplicar Reajuste IPC' : 'Modificar Canon'}
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Canon de Arriendo</span>
                        {canEdit && (
                          <button 
                            onClick={() => setIsEditRentOpen(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            EDITAR
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                        ${Number(activeTenancy.monthlyRent).toLocaleString('es-CL')}
                      </div>
                    </div>
                    
                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', position: 'relative' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Mes de Garantía</span>
                        {!activeTenancy.isSecurityDepositReturned && canEdit && (
                          <button 
                            onClick={() => setIsEditDepositOpen(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            {activeTenancy.securityDeposit ? 'EDITAR' : 'REGISTRAR'}
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
                        ${activeTenancy.securityDeposit ? Number(activeTenancy.securityDeposit).toLocaleString('es-CL') : '0'}
                      </div>
                      {activeTenancy.securityDeposit && activeTenancy.isSecurityDepositReturned && (
                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '0.65rem', background: '#10b981', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', fontWeight: 900, boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>DEVUELTO</div>
                      )}
                    </div>

                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Día de Pago
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>
                        Día {property.paymentDueDay}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await api.patch(`/properties/${property.id}`, { notifyTenantOnPaymentDay: !property.notifyTenantOnPaymentDay });
                            queryClient.invalidateQueries({ queryKey: ['property', id] });
                            toast.success(property.notifyTenantOnPaymentDay ? 'Notificación al arrendatario desactivada' : 'Notificación al arrendatario activada');
                          } catch { toast.error('Error al actualizar'); }
                        }}
                        style={{ 
                          marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', 
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.65rem',
                          color: property.notifyTenantOnPaymentDay ? '#10b981' : 'var(--text-muted)'
                        }}
                      >
                        <div style={{ 
                          width: '32px', height: '18px', borderRadius: '9px', position: 'relative',
                          backgroundColor: property.notifyTenantOnPaymentDay ? '#10b981' : '#d1d5db',
                          transition: 'background-color 0.2s'
                        }}>
                          <div style={{ 
                            width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'white',
                            position: 'absolute', top: '2px', 
                            left: property.notifyTenantOnPaymentDay ? '16px' : '2px',
                            transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                          }} />
                        </div>
                        Notificar arrendatario
                      </button>
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: '1.5rem', background: '#fafafa', border: '1px dashed var(--border)' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vigencia Contrato</span>
                      {activeTenancy.endDate && <span className="badge badge-outline" style={{ fontSize: '0.6rem' }}>AÑO CORRIDO</span>}
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>INICIO</span>
                          {canEdit && (
                            <button 
                              onClick={() => setIsEditStartDateOpen(true)}
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                            >
                              EDITAR
                            </button>
                          )}
                        </div>
                        <div style={{ fontWeight: 800 }}>{formatDate(activeTenancy.startDate)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>TÉRMINO</div>
                        <div style={{ fontWeight: 800 }}>{(activeTenancy.endDate || property.contractEndDate) ? formatDate(activeTenancy.endDate || property.contractEndDate) : 'Indefinido'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Documento de Contrato */}
                  <div className="card" style={{ marginBottom: '1.5rem', background: '#fafafa', border: '1px dashed var(--border)' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contrato de Arriendo</span>
                      {activeTenancy.contractUrl && <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>ADJUNTADO</span>}
                    </div>
                    {activeTenancy.contractUrl ? (
                      <div className="flex justify-between items-center" style={{ backgroundColor: 'white', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: '1.25rem' }}>📄</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Contrato Actual</div>
                            <a 
                              href={activeTenancy.contractUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textDecoration: 'underline' }}
                            >
                              Ver / Descargar
                            </a>
                          </div>
                        </div>
                        {canEdit && (
                          <button 
                            onClick={handleDeleteContract}
                            disabled={deleteContractMutation.isPending}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            {deleteContractMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                        <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>No hay un contrato adjunto para este arriendo.</p>
                        {canEdit && (
                          <div>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              style={{ display: 'none' }}
                              id="contract-file-upload"
                              onChange={handleContractUpload}
                              disabled={uploadContractMutation.isPending}
                            />
                            <label 
                              htmlFor="contract-file-upload"
                              className="btn btn-outline"
                              style={{ 
                                display: 'inline-block', 
                                padding: '0.4rem 1rem', 
                                fontSize: '0.75rem', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                textAlign: 'center'
                              }}
                            >
                              {uploadContractMutation.isPending ? 'Subiendo...' : '📎 Adjuntar Contrato (PDF/Word)'}
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex flex-col gap-2">
                      <RegisterPaymentForm tenancyId={activeTenancy.id} />
                    </div>
                  )}
                  
                  <RecentPaymentsCard propertyId={property.id} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>👤</div>
                  <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>Propiedad desocupada.</p>
                  {canEdit && (
                    <>
                      <button 
                        onClick={() => setIsAssigningTenant(!isAssigningTenant)} 
                        className={isAssigningTenant ? 'btn btn-outline' : 'btn btn-primary'} 
                        style={{ width: '100%', padding: '0.75rem' }}
                      >
                        {isAssigningTenant ? 'Cancelar' : 'Asignar Inquilino'}
                      </button>
                      
                      {isAssigningTenant && (
                        <div style={{ marginTop: '1.5rem', textAlign: 'left', padding: '1.25rem', backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                          <AssignTenantForm propertyId={property.id} expectedRent={property.expectedRent} onDone={() => setIsAssigningTenant(false)} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Photos Summary */}
            <div className="card">
              <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>Fotos</h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>{property.photos?.length || 0} fotos</span>
              </div>
              
              <input 
                type="file" 
                accept="image/*" 
                multiple
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileChange}
              />

              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {property.photos?.map((photo, i) => (
                  <div key={i} className="photo-container" style={{ aspectRatio: '1/1', backgroundColor: 'var(--bg-surface)', borderRadius: '0.5rem', overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}>
                    <img src={photo.url} alt={`Propiedad ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    
                    {/* Delete Button */}
                    {canEdit && (
                      <button 
                        onClick={() => {
                          if (window.confirm('¿Eliminar esta foto?')) {
                            deletePhotoMutation.mutate(photo.id);
                          }
                        }}
                        style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', fontSize: '10px' }}
                      >
                        ✕
                      </button>
                    )}

                    {/* Ordering Arrows */}
                    {canEdit && (
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', userSelect: 'none', right: '0', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                        {i > 0 ? (
                          <button 
                            onClick={() => handleMovePhoto(i, 'left')}
                            style={{ width: '24px', height: '24px', borderRadius: '0.25rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ❮
                          </button>
                        ) : <div />}
                        
                        {i < (property.photos?.length || 0) - 1 ? (
                          <button 
                            onClick={() => handleMovePhoto(i, 'right')}
                            style={{ width: '24px', height: '24px', borderRadius: '0.25rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ❯
                          </button>
                        ) : <div />}
                      </div>
                    )}
                  </div>
                ))}
                
                {canEdit && (
                  <div 
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                    style={{ 
                      aspectRatio: '1/1', 
                      backgroundColor: 'var(--bg-surface)', 
                      borderRadius: '0.5rem', 
                      display: 'grid', 
                      placeItems: 'center', 
                      cursor: uploadPhotoMutation.isPending ? 'wait' : 'pointer', 
                      border: '2px dashed var(--border)',
                      opacity: uploadPhotoMutation.isPending ? 0.5 : 1
                    }}
                  >
                    {uploadPhotoMutation.isPending ? (
                      <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%' }}></div>
                    ) : (
                      <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>+</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <PropertyNotesTab propertyId={property.id} />
        </div>
      )}

      {/* Modals - Moved to end for maximum stability */}
      {property && activeTenancy && (
        <>
          <MonthlyRentModal 
            key={`rent-${activeTenancy.id}-${activeTenancy.monthlyRent}`}
            isOpen={isEditRentOpen}
            onClose={() => setIsEditRentOpen(false)}
            initialAmount={Number(activeTenancy.monthlyRent)}
            propertyId={property.id}
            tenancyId={activeTenancy.id}
          />
          <SecurityDepositModal 
            key={`deposit-${activeTenancy.id}-${activeTenancy.securityDeposit}`}
            isOpen={isEditDepositOpen}
            onClose={() => setIsEditDepositOpen(false)}
            initialAmount={activeTenancy.securityDeposit ? Number(activeTenancy.securityDeposit) : 0}
            propertyId={property.id}
            tenancyId={activeTenancy.id}
          />
          <EditStartDateModal 
            key={`startdate-${activeTenancy.id}-${activeTenancy.startDate}`}
            isOpen={isEditStartDateOpen}
            onClose={() => setIsEditStartDateOpen(false)}
            propertyId={property.id}
            tenancyId={activeTenancy.id}
            initialDate={activeTenancy.startDate}
          />
          <ChangeTenantModal 
            key={`change-${activeTenancy.id}`}
            isOpen={isChangeTenantOpen}
            onClose={() => setIsChangeTenantOpen(false)}
            propertyId={property.id}
            tenancyId={activeTenancy.id}
          />
          <TerminateTenancyModal 
            key={`terminate-${activeTenancy.id}`}
            isOpen={isTerminateModalOpen}
            onClose={() => setIsTerminateModalOpen(false)}
            propertyId={property.id}
            tenancyId={activeTenancy.id}
          />
        </>
      )}
    </div>
  );
}

// --- Sub-components (Forms) ---

function AddUtilityForm({ propertyId, onDone }: { propertyId: string, onDone: () => void }) {
  const queryClient = useQueryClient();
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<ExpenseFrequency>(ExpenseFrequency.MONTHLY);
  const [dueDay, setDueDay] = useState(new Date().getDate());
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateUtilityDto & { title?: string }>({
    resolver: zodResolver(utilitySchema),
    defaultValues: {
      type: UtilityType.ELECTRICITY,
      amount: 0,
      isIncludedInRent: false,
      title: '',
    }
  });

  const { data: customCategories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const resp = await api.get('/expense-categories');
      return resp.data as ExpenseCategoryDto[];
    }
  });

  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);


  const { mutate, isPending } = useMutation({
    mutationFn: async (data: any) => {
      // Si es recurrente, SOLO creamos el recordatorio pendiente para la fecha indicada
      if (isRecurring) {
        let startDate: Date;
        if (data.billingMonth) {
          const [year, month] = data.billingMonth.split('-').map(Number);
          startDate = new Date(year, month - 1, dueDay);
        } else {
          startDate = new Date();
          startDate.setDate(dueDay);
        }

        return api.post('/utilities/reminders', {
          propertyId,
          title: data.title || UtilityTypeLabels[data.type as UtilityType],
          amount: data.amount,
          frequency,
          nextDueDate: startDate.toISOString(),
        } as CreateExpenseReminderDto);
      } else {
        // Si NO es recurrente, es un gasto puntual que se registra de inmediato
        return api.post('/utilities', { ...data, propertyId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilities', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['reminders', propertyId] });
      toast.success(isRecurring ? 'Recordatorio configurado' : 'Gasto registrado');
      onDone();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al procesar la solicitud');
    },
  });

  return (
    <>
      <form onSubmit={handleSubmit((data) => mutate(data))} className="flex flex-col gap-4">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="flex flex-col gap-2 relative">
            <div className="flex justify-between items-center">
              <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Tipo de Servicio</label>
              <button type="button" onClick={() => setIsManageCategoriesOpen(true)} style={{ fontSize: '0.65rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Administrar
              </button>
            </div>
            <select 
              value={watch('type') === UtilityType.OTHER && customCategories?.some(c => c.name === watch('title')) ? `CUSTOM_${watch('title')}` : watch('type')}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('CUSTOM_')) {
                  setValue('type', UtilityType.OTHER);
                  setValue('title', val.replace('CUSTOM_', ''));
                } else {
                  setValue('type', val as UtilityType);
                  if (val !== UtilityType.OTHER) {
                    setValue('title', '');
                  }
                }
              }}
              style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
            >
              <optgroup label="Sistema">
                {Object.entries(UtilityTypeLabels)
                  .filter(([val]) => val !== UtilityType.OTHER)
                  .map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </optgroup>
              {customCategories && customCategories.length > 0 && (
                <optgroup label="Tus Categorías">
                  {customCategories.map(c => (
                    <option key={`CUSTOM_${c.name}`} value={`CUSTOM_${c.name}`}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Otro">
                <option value={UtilityType.OTHER}>Otro (Especificar...)</option>
              </optgroup>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Monto Pagado ($)</label>
            <input {...register('amount', { valueAsNumber: true })} type="number" min={0} style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.875rem' }} />
            {errors.amount && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>{errors.amount.message}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
            {watch('type') === UtilityType.OTHER ? 'Nombre del Servicio/Gasto*' : 'Descripción (opcional)'}
          </label>
          <input 
            {...register('title', { required: watch('type') === UtilityType.OTHER ? 'Debes ingresar un nombre' : false })} 
            placeholder={watch('type') === UtilityType.OTHER ? 'Ej: Jardinería, Pintura...' : 'Ej: Contribuciones 1er Trimestre'} 
            style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.875rem' }} 
          />
          {errors.title && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>{errors.title.message}</span>}
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="flex items-center gap-2">
            <input {...register('isIncludedInRent')} type="checkbox" id="included" />
            <label htmlFor="included" style={{ fontSize: '0.75rem' }}>Incluido en arriendo</label>
          </div>
          {!isRecurring && (
            <div className="flex flex-col gap-1">
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mes de pago actual</label>
              <input {...register('billingMonth')} type="month" style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }} />
            </div>
          )}
        </div>

        {/* Recurrence Selector */}
        <div style={{ padding: '1.25rem', backgroundColor: 'rgba(56, 122, 223, 0.05)', borderRadius: '1rem', border: '1px dashed var(--primary-light)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: isRecurring ? '1rem' : 0 }}>
            <input 
              type="checkbox" 
              id="recurring" 
              checked={isRecurring} 
              onChange={(e) => setIsRecurring(e.target.checked)} 
            />
            <label htmlFor="recurring" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>Registrar como Gasto Periódico</label>
          </div>

          {isRecurring && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="flex flex-col gap-1">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Frecuencia</label>
                  <select 
                    value={frequency} 
                    onChange={(e) => setFrequency(e.target.value as ExpenseFrequency)}
                    style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
                  >
                    {Object.entries(ExpenseFrequencyLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Día de Pago</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={31} 
                    value={dueDay} 
                    onChange={(e) => setDueDay(Number(e.target.value))} 
                    style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
                  />
                </div>
              </div>

              {frequency !== ExpenseFrequency.MONTHLY && (
                <div className="flex flex-col gap-1" style={{ padding: '0.75rem', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Mes del primer cobro</label>
                  <input 
                    {...register('billingMonth')} 
                    type="month" 
                    required 
                    style={{ padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.8125rem', width: '100%' }} 
                  />
                  <p style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '0.25rem' }}>
                    * El mes elegido define en qué momento del año se repite el cobro.
                  </p>
                </div>
              )}

              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                💡 {frequency === ExpenseFrequency.MONTHLY 
                  ? 'Se generará un recordatorio todos los meses.' 
                  : `Se cobrará el día ${dueDay} del mes seleccionado y se repetirá según la frecuencia ${(ExpenseFrequencyLabels[frequency as ExpenseFrequency] || '').toLowerCase()}.`}
              </p>
            </div>
          )}
        </div>

        <button disabled={isPending} className="btn btn-primary" style={{ height: '3.5rem', fontSize: '0.9rem', fontWeight: 700 }}>
          {isPending ? 'Procesando...' : 'Confirmar y Guardar'}
        </button>
      </form>

      <ManageCategoriesModal 
        isOpen={isManageCategoriesOpen} 
        onClose={() => setIsManageCategoriesOpen(false)} 
        customCategories={customCategories || []} 
      />
    </>
  );
}

function RegisterPaymentForm({ tenancyId }: { tenancyId: string }) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePaymentDto>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      propertyTenantId: tenancyId,
      paymentDate: toLocalDateFormat(),
      paymentMethod: PaymentMethod.TRANSFER,
      amount: 0,
    }
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: CreatePaymentDto) => {
      const resp = await api.post('/payments', { ...data, propertyTenantId: tenancyId });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['recent-payments', id] });
      toast.success('Pago registrado correctamente');
      reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al registrar el pago');
    }
  });

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <input 
          {...register('amount', { valueAsNumber: true })} 
          type="number" 
          placeholder="Monto Pagado" 
          style={{ padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.9rem', width: '100%' }} 
        />
        {errors.amount && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>{errors.amount.message}</span>}
      </div>
      
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <input 
          {...register('paymentDate')} 
          type="date" 
          style={{ padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.85rem' }} 
        />
        <select 
          {...register('paymentMethod')} 
          style={{ padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.85rem' }}
        >
          <option value={PaymentMethod.TRANSFER}>Transferencia</option>
          <option value={PaymentMethod.CASH}>Efectivo</option>
          <option value={PaymentMethod.DEPOSIT}>Depósito</option>
          <option value={PaymentMethod.CHECK}>Cheque</option>
          <option value={PaymentMethod.OTHER}>Otro</option>
        </select>
      </div>

      <textarea 
        {...register('notes')} 
        placeholder="Comentarios..." 
        rows={2} 
        style={{ padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.9rem', resize: 'none', fontFamily: 'inherit' }}
      />

      <button disabled={isPending} className="btn btn-primary" style={{ height: '2.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
        {isPending ? 'Procesando...' : 'Registrar Pago de Arriendo'}
      </button>
    </form>
  );
}

function ManageCategoriesModal({ isOpen, onClose, customCategories }: { isOpen: boolean; onClose: () => void; customCategories: ExpenseCategoryDto[] }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');

  const { mutate: createCategory, isPending: isCreating } = useMutation({
    mutationFn: async (name: string) => {
      const resp = await api.post('/expense-categories', { name });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      setNewName('');
      toast.success('Categoría agregada');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al agregar categoría');
    }
  });

  const { mutate: toggleCategory, isPending: isToggling } = useMutation({
    mutationFn: async ({ id, isActive }: { id: string, isActive: boolean }) => {
      const resp = await api.patch(`/expense-categories/${id}`, { isActive });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    }
  });

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '400px' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
          <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>Administrar Categorías</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createCategory(newName); }} className="flex gap-2" style={{ marginBottom: '1.5rem' }}>
          <input 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            placeholder="Nueva categoría..." 
            style={{ flex: 1, padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.875rem' }} 
          />
          <button type="submit" disabled={isCreating || !newName.trim()} className="btn btn-primary" style={{ padding: '0.6rem 1rem' }}>
            {isCreating ? '...' : 'Agregar'}
          </button>
        </form>

        <div className="flex flex-col gap-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {customCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No hay categorías personalizadas.
            </div>
          ) : (
            customCategories.map(cat => (
              <div key={cat.id} className="flex justify-between items-center" style={{ padding: '0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: cat.isActive ? 'inherit' : 'var(--text-muted)', textDecoration: cat.isActive ? 'none' : 'line-through' }}>
                  {cat.name}
                </span>
                <button 
                  onClick={() => toggleCategory({ id: cat.id, isActive: !cat.isActive })}
                  disabled={isToggling}
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '0.25rem', 
                    border: 'none', 
                    backgroundColor: cat.isActive ? '#fee2e2' : '#d1fae5', 
                    color: cat.isActive ? '#ef4444' : '#10b981',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {cat.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EditPropertyForm({ property, onDone }: { property: PropertyDto, onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, control } = useForm<UpdatePropertyDto>({
    defaultValues: {
      address: property.address,
      name: property.name || '',
      city: property.city || '',
      category: property.category,
      customCategory: property.customCategory || '',
      bedrooms: property.bedrooms ?? 0,
      bathrooms: property.bathrooms ?? 0,
      m2Total: property.m2Total ?? 0,
      m2Built: property.m2Built ?? 0,
      hasParking: property.hasParking,
      hasStorage: property.hasStorage,
      paymentDueDay: property.paymentDueDay,
      rol: property.rol ?? '',
      notes: property.notes ?? '',
      expectedRent: property.expectedRent ?? undefined,
      contractEndDate: property.contractEndDate ? toLocalDateFormat(new Date(property.contractEndDate)) : '',
    }
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: UpdatePropertyDto) => {
      const resp = await api.patch(`/properties/${property.id}`, data);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', property.id] });
      toast.success('Propiedad actualizada');
      onDone();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al actualizar propiedad');
    }
  });
  
  const navigate = useNavigate();
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/properties/${property.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Propiedad eliminada permanentemente');
      navigate('/properties');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar propiedad');
    }
  });

  const handleDelete = () => {
    if (window.confirm('¿ESTÁS SEGURO? Esta acción es permanente y eliminará todos los gastos y contratos asociados a esta propiedad.')) {
      deleteMutation.mutate();
    }
  };

  const inputStyle = { padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', width: '100%', fontSize: '0.9rem' };

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))} className="flex flex-col gap-6">
      <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '1rem', fontWeight: 700 }}>Editar Propiedad</p>
        <button 
          type="button" 
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="btn"
          style={{ 
            backgroundColor: 'transparent', 
            color: 'var(--danger)', 
            border: '1px solid var(--danger)',
            fontSize: '0.75rem',
            padding: '0.4rem 0.8rem'
          }}
        >
          {deleteMutation.isPending ? 'Eliminando...' : '🗑️ Eliminar Propiedad'}
        </button>
      </div>

      {/* Identificación */}
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Nombre de la Propiedad (Título Público)</label>
        <input {...register('name')} placeholder="Ej: Departamento 404 Plaza" style={inputStyle} />
      </div>

      {/* Ubicacion */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Dirección Exacta (Privada)</label>
          <input {...register('address')} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Ciudad</label>
          <input {...register('city')} style={inputStyle} />
        </div>
      </div>

      {/* Specs tecnicas */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Dormit.</label>
          <input {...register('bedrooms', { valueAsNumber: true })} type="number" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Baños</label>
          <input {...register('bathrooms', { valueAsNumber: true })} type="number" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>m2 Útiles</label>
          <input {...register('m2Built', { valueAsNumber: true })} type="number" step="0.1" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>m2 Totales</label>
          <input {...register('m2Total', { valueAsNumber: true })} type="number" step="0.1" style={inputStyle} />
        </div>
      </div>

      <div className="flex gap-8">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
          <input type="checkbox" {...register('hasParking')} style={{ width: '18px', height: '18px' }} />
          <span>Estacionamiento</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
          <input type="checkbox" {...register('hasStorage')} style={{ width: '18px', height: '18px' }} />
          <span>Bodega</span>
        </label>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Día de Pago</label>
          <input {...register('paymentDueDay', { valueAsNumber: true })} type="number" min="1" max="31" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Vencimiento Contrato</label>
          <input {...register('contractEndDate')} type="date" style={inputStyle} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Categoría</label>
          <select {...register('category')} style={inputStyle}>
            <option value={PropertyCategory.HOUSE}>Casa</option>
            <option value={PropertyCategory.APARTMENT}>Departamento</option>
            <option value={PropertyCategory.OFFICE}>Oficina/Local</option>
            <option value={PropertyCategory.LAND}>Terreno</option>
            <option value={PropertyCategory.OTHER}>Otro</option>
          </select>
        </div>
        {watch('category') === PropertyCategory.OTHER && (
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Tipo Específico</label>
            <input {...register('customCategory')} placeholder="Ej: Bodega, Cabaña" style={inputStyle} />
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>ROL de Avalúo SII</label>
          <input {...register('rol')} placeholder="Ej: 1234-56" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Precio Esperado de Arriendo ($)</label>
          <input {...register('expectedRent', { valueAsNumber: true })} type="number" placeholder="Ej: 450000" style={inputStyle} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Notas de la Propiedad</label>
        <div className="quill-container">
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <ReactQuill 
                theme="snow"
                value={field.value || ''}
                onChange={field.onChange}
                modules={quillModules}
                style={{ height: '200px', marginBottom: '3rem', backgroundColor: 'white' }}
              />
            )}
          />
        </div>
      </div>

      <div className="flex gap-2" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={onDone} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
        <button disabled={isPending} className="btn btn-primary" style={{ flex: 2 }}>{isPending ? 'Guardando...' : 'Guardar Cambios'}</button>
      </div>
    </form>
  );
}

function TerminateTenancyModal({ isOpen, onClose, propertyId, tenancyId }: { isOpen: boolean; onClose: () => void; propertyId: string; tenancyId: string }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TerminateTenancyDto>({
    defaultValues: {
      endDate: toLocalDateFormat()
    }
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: TerminateTenancyDto) => {
      const resp = await api.patch(`/properties/${propertyId}/tenancy/${tenancyId}/terminate`, data);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', propertyId] });
      toast.success('Contrato finalizado con éxito');
      onClose();
      reset();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al finalizar contrato');
    }
  });

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '400px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>×</button>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--danger)' }}>Finalizar Contrato</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          La propiedad volverá a estar desocupada. Si el inquilino dejó garantía, esta pasará a la sección "Garantías por Devolver".
        </p>

        <form onSubmit={handleSubmit((data) => mutate(data))} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Fecha de Término</label>
            <input 
              {...register('endDate')} 
              type="date" 
              required 
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '1rem', width: '100%' }} 
            />
            {errors.endDate && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>{errors.endDate.message}</span>}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: '0.75rem' }}>
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--danger)', border: 'none' }}>
              {isPending ? 'Procesando...' : 'Finalizar Contrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReturnDepositModal({ isOpen, onClose, propertyId, tenancyId, initialDeposit }: { isOpen: boolean; onClose: () => void; propertyId: string; tenancyId: string; initialDeposit: number }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReturnDepositDto>({
    defaultValues: {
      returnAmount: initialDeposit,
      returnDate: toLocalDateFormat()
    }
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ReturnDepositDto) => {
      const resp = await api.patch(`/properties/${propertyId}/tenancy/${tenancyId}/return-deposit`, data);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Garantía marcada como devuelta y egreso registrado');
      onClose();
      reset();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al procesar la devolución');
    }
  });

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '400px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>×</button>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--danger)' }}>Devolver Garantía</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Se creará automáticamente un <strong>Egreso</strong> en esta propiedad por el monto de garantía devuelta.
        </p>

        <form onSubmit={handleSubmit((data) => mutate(data))} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Monto a devolver ($)</label>
            <input 
              {...register('returnAmount', { valueAsNumber: true })} 
              type="number" 
              min="0"
              required 
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '1rem', width: '100%' }} 
            />
            {errors.returnAmount && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>{errors.returnAmount.message}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Fecha de devolución</label>
            <input 
              {...register('returnDate')} 
              type="date" 
              required 
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '1rem', width: '100%' }} 
            />
            {errors.returnDate && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>{errors.returnDate.message}</span>}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: '0.75rem' }}>
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--danger)', border: 'none' }}>
              {isPending ? 'Procesando...' : 'Registrar Devolución'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignTenantForm({ propertyId, expectedRent, onDone }: { propertyId: string, expectedRent?: number | null, onDone: () => void }) {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();

  const { data: tenantsData, isLoading: isLoadingTenants, error: tenantsError } = useQuery<PaginatedResponse<TenantDto>>({
    queryKey: ['tenants', activeOrganization?.id, 'assign-form-list'],
    queryFn: async () => {
      const resp = await api.get('/tenants?limit=100&isActive=true');
      return resp.data;
    },
    enabled: !!activeOrganization,
  });

  const tenants = tenantsData?.data || [];

  const { register, handleSubmit, setValue, watch } = useForm<AssignTenantDto>({
    defaultValues: {
      startDate: '',
      monthlyRent: expectedRent || 350000,
      securityDeposit: expectedRent || 350000,
    }
  });

  const startDate = watch('startDate');

  const setYearLease = () => {
    if (!startDate) return;
    const end = new Date(startDate);
    end.setFullYear(end.getFullYear() + 1);
    setValue('endDate', end.toISOString().split('T')[0]);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: AssignTenantDto) => {
      if (!data.startDate) {
        data.startDate = toLocalDateFormat();
      }
      const resp = await api.post(`/properties/${propertyId}/assign-tenant`, data);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', propertyId] });
      toast.success('Inquilino asignado con éxito');
      onDone();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al asignar inquilino');
    }
  });

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Seleccionar Inquilino</label>
          {isLoadingTenants && <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600 }}>Cargando...</span>}
        </div>
        <select 
          {...register('tenantId')} 
          required 
          disabled={isLoadingTenants || tenants.length === 0}
          style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', width: '100%', fontSize: '0.9rem', backgroundColor: (isLoadingTenants || tenants.length === 0) ? '#f8fafc' : 'white' }}
        >
          {isLoadingTenants ? (
            <option>Cargando arrendatarios...</option>
          ) : tenants.length === 0 ? (
            <option value="">No hay arrendatarios activos</option>
          ) : (
            <>
              <option value="">Seleccione un inquilino...</option>
              {tenants.map((t: TenantDto) => (
                <option key={t.id} value={t.id}>{t.name} ({t.documentId})</option>
              ))}
            </>
          )}
        </select>
        {tenantsError && <p style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>Error al cargar arrendatarios</p>}
        {tenants.length === 0 && !isLoadingTenants && !tenantsError && (
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            Debes tener arrendatarios registrados y activos. 
            <Link to="/tenants" style={{ color: 'var(--primary)', marginLeft: '0.25rem' }}>Ir a Arrendatarios</Link>
          </p>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Monto Arriendo ($)</label>
          <input {...register('monthlyRent', { valueAsNumber: true })} type="number" required min="1" style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', width: '100%', fontSize: '0.9rem' }} />
        </div>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Mes de Garantía ($)</label>
          <input {...register('securityDeposit', { valueAsNumber: true })} type="number" min="0" style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', width: '100%', fontSize: '0.9rem' }} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Fecha de Inicio</label>
          <input {...register('startDate')} type="date" style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', width: '100%', fontSize: '0.9rem' }} />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Opcional (Por defecto hoy)</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Fecha de Término</label>
            <button type="button" onClick={setYearLease} style={{ fontSize: '0.6rem', color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>+ 1 AÑO (AÑO CORRIDO)</button>
          </div>
          <input {...register('endDate')} type="date" style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', width: '100%', fontSize: '0.9rem' }} />
        </div>
      </div>

      <button disabled={isPending || !tenants} className="btn btn-primary" style={{ height: '3rem', fontSize: '0.9rem', fontWeight: 600 }}>
        {isPending ? 'Asignando...' : 'Confirmar Asignación'}
      </button>
    </form>
  );
}


// ── RecentPaymentsCard ──────────────────────────────────────────────────────
function RecentPaymentsCard({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: ['recent-payments', propertyId],
    queryFn: async () => {
      const resp = await api.get(`/payments/property/${propertyId}`);
      return resp.data;
    },
  });

  const { mutate: deletePayment } = useMutation({
    mutationFn: async (paymentId: string) => {
      await api.delete(`/payments/${paymentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-payments', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Pago eliminado');
    },
    onError: () => toast.error('Error al eliminar el pago'),
  });

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este pago?')) {
      deletePayment(id);
    }
  };

  if (isLoading) return null;
  if (payments.length === 0) return null;

  return (
    <div style={{ marginTop: '2rem' }}>
      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Pagos Recientes
      </h4>
      <div className="flex flex-col gap-2">
        {payments.slice(0, 5).map((payment) => (
          <div 
            key={payment.id} 
            className="flex justify-between items-center" 
            style={{ padding: '0.85rem 1rem', backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                ${Number(payment.amount).toLocaleString('es-CL')}
              </div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                {formatDate(payment.paymentDate)} • {payment.paymentMethod}
              </div>
            </div>
            <button 
              onClick={() => handleDelete(payment.id)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem', fontSize: '0.9rem' }}
              title="Eliminar pago"
            >
              🗑
            </button>
          </div>
        ))}
        {payments.length > 5 && (
          <Link to="/payments" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Ver todo el historial →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── RemindersCard ──────────────────────────────────────────────────────────────
function RemindersCard({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const { activeOrganization } = useOrganization();
  const canEdit = activeOrganization?.role !== OrganizationRole.VIEWER;

  const { data: reminders = [], isLoading } = useQuery<ExpenseReminderDto[]>({
    queryKey: ['reminders', propertyId],
    queryFn: async () => {
      const resp = await api.get(`/utilities/reminders/property/${propertyId}`);
      return resp.data;
    },
  });

  const { mutate: payReminder, isPending: isPaying } = useMutation({
    mutationFn: async (id: string) => {
      const resp = await api.post(`/utilities/reminders/${id}/pay`);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['utilities', propertyId] });
      toast.success('Pago registrado y recordatorio actualizado');
    },
    onError: () => toast.error('Error al registrar el pago'),
  });

  const { mutate: deleteReminder } = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/utilities/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', propertyId] });
      toast.success('Recordatorio eliminado');
    },
  });

  if (isLoading) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filtramos los que vencen pronto (7 días) o ya vencieron
  const filteredReminders = reminders.filter(r => {
    if (showAll) return true;
    const dueDate = new Date(r.nextDueDate);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7; // Vencidos (negativo) o próximos (0-7)
  });

  const overdue = filteredReminders.filter(r => new Date(r.nextDueDate) < today);
  const upcoming = filteredReminders.filter(r => new Date(r.nextDueDate) >= today);

  return (
    <div className="card" style={{ border: overdue.length > 0 ? '2px solid var(--danger)' : '1px solid var(--border)' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
        <h3 className="font-heading" style={{ fontSize: '1.5rem' }}>Pagos Pendientes</h3>
        <button 
          onClick={() => setShowAll(!showAll)}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline' }}
        >
          {showAll ? 'Ver solo próximos' : 'Ver todos'}
        </button>
      </div>

      {filteredReminders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>No hay pagos pendientes para los próximos 7 días.</p>
          {!showAll && reminders.length > 0 && (
            <button className="btn btn-outline" onClick={() => setShowAll(true)} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>Ver programados ({reminders.length})</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Overdue Section */}
          {overdue.length > 0 && (
            <div className="flex flex-col gap-2">
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vencidos</span>
              {overdue.map(r => <ReminderItem key={r.id} r={r} onPay={payReminder} onDelete={deleteReminder} isPaying={isPaying} canEdit={canEdit} />)}
            </div>
          )}

          {/* Upcoming Section */}
          {upcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {showAll ? 'Todos los recordatorios' : 'Próximos (7 días)'}
              </span>
              {upcoming.map(r => <ReminderItem key={r.id} r={r} onPay={payReminder} onDelete={deleteReminder} isPaying={isPaying} canEdit={canEdit} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderItem({ r, onPay, onDelete, isPaying, canEdit }: { r: ExpenseReminderDto, onPay: (id: string) => void, onDelete: (id: string) => void, isPaying: boolean, canEdit: boolean }) {
  const dueDate = new Date(r.nextDueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = dueDate < today;

  return (
    <div 
      className="flex flex-col gap-3" 
      style={{ 
        padding: '1.25rem', 
        background: isOverdue ? 'rgba(231, 76, 60, 0.05)' : 'var(--bg-surface)', 
        borderRadius: '1rem',
        border: isOverdue ? '1px solid rgba(231, 76, 60, 0.2)' : '1px solid var(--border-light)'
      }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.25rem' }}>{r.title}</div>
          <div className="flex gap-2 items-center">
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>{ExpenseFrequencyLabels[r.frequency as ExpenseFrequency]}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
              {isOverdue ? '⚠️ Vencido: ' : '📅 Vence: '}
              {formatDate(r.nextDueDate, { day: '2-digit', month: 'long' })}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--primary)' }}>
            ${Number(r.amount).toLocaleString('es-CL')}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2" style={{ marginTop: '0.5rem' }}>
          <button 
            disabled={isPaying}
            onClick={() => onPay(r.id)}
            className="btn btn-primary" 
            style={{ flex: 1, padding: '0.55rem', fontSize: '0.75rem', fontWeight: 700 }}
          >
            Marcar como Pagado
          </button>
          <button 
            onClick={() => { if(window.confirm('¿Eliminar recordatorio?')) onDelete(r.id); }}
            className="btn btn-outline" 
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger)' }}
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}

// ── MetersCard ──────────────────────────────────────────────────────────────
function MetersCard({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [number, setNumber] = useState('');
  const { activeOrganization } = useOrganization();
  const canEdit = activeOrganization?.role !== OrganizationRole.VIEWER;

  const SUGGESTIONS = ['Luz', 'Agua', 'Gas', 'Calefacción', 'Internet', 'Ascensor', 'Otro'];

  const { data: meters = [], isLoading } = useQuery<PropertyMeterDto[]>({
    queryKey: ['meters', propertyId],
    queryFn: async () => {
      const resp = await api.get(`/properties/${propertyId}/meters`);
      return resp.data;
    },
  });

  const { mutate: addMeter, isPending: isAdding_ } = useMutation({
    mutationFn: async (dto: CreatePropertyMeterDto) => {
      const resp = await api.post(`/properties/${propertyId}/meters`, dto);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters', propertyId] });
      setLabel('');
      setNumber('');
      setIsAdding(false);
      toast.success('Medidor agregado');
    },
    onError: () => toast.error('Error al agregar medidor'),
  });

  const { mutate: deleteMeter } = useMutation({
    mutationFn: async (meterId: string) => {
      await api.delete(`/properties/${propertyId}/meters/${meterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters', propertyId] });
      toast.success('Medidor eliminado');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !number.trim()) return;
    addMeter({ label: label.trim(), number: number.trim() });
  };

  const inputStyle = {
    padding: '0.55rem 0.75rem',
    borderRadius: '0.4rem',
    border: '1px solid var(--border)',
    fontSize: '0.875rem',
    width: '100%',
    fontFamily: 'inherit',
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
        <h3 className="font-heading" style={{ fontSize: '1.5rem' }}>Medidores</h3>
        {canEdit && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={isAdding ? 'btn btn-outline' : 'btn btn-primary'}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            {isAdding ? 'Cerrar' : '+ Agregar'}
          </button>
        )}
      </div>

      {/* Add form */}
      {isAdding && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--bg-main)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="flex flex-col gap-1">
              <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Nombre del medidor</label>
              <input
                list="meter-suggestions"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Ej: Luz, Agua, Gas..."
                style={inputStyle}
                required
              />
              <datalist id="meter-suggestions">
                {SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Número de medidor</label>
              <input
                value={number}
                onChange={e => setNumber(e.target.value)}
                placeholder="Ej: 1234567"
                style={inputStyle}
                required
              />
            </div>
          </div>
          <button disabled={isAdding_} className="btn btn-primary" style={{ width: '100%', height: '2.5rem', fontSize: '0.875rem' }}>
            {isAdding_ ? 'Guardando...' : 'Guardar Medidor'}
          </button>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : meters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No hay medidores registrados. Agrega uno con el botón de arriba.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {meters.map((meter) => (
            <div
              key={meter.id}
              className="flex justify-between items-center"
              style={{ padding: '0.9rem 1.1rem', background: 'var(--bg-surface)', borderRadius: '0.75rem' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{meter.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Nro. {meter.number}</div>
              </div>
              {canEdit && (
                <button
                  onClick={() => deleteMeter(meter.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem', padding: '0.25rem 0.5rem', borderRadius: '0.4rem' }}
                  title="Eliminar medidor"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function SecurityDepositModal({ isOpen, onClose, initialAmount, propertyId, tenancyId }: { isOpen: boolean, onClose: () => void, initialAmount: number, propertyId: string, tenancyId: string }) {
  const [amount, setAmount] = useState(initialAmount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) return;
    
    setIsSubmitting(true);
    try {
      await api.patch(`/properties/${propertyId}/tenancy/${tenancyId}/security-deposit`, { amount: numericAmount });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      toast.success('Garantía actualizada');
      onClose();
    } catch (e) {
      toast.error('Error al actualizar garantía');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
          <h2 className="font-heading" style={{ fontSize: '1.75rem', margin: 0 }}>Mes de Garantía</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Actualiza el monto de la garantía del contrato.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Monto Garantía ($)</label>
            <input 
              type="number" 
              required 
              autoFocus
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ padding: '1rem', borderRadius: '1rem', border: '2px solid var(--border)', fontSize: '1.25rem', fontWeight: 700, width: '100%', textAlign: 'center' }}
            />
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: '1rem', borderRadius: '1rem', fontWeight: 700 }}>Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 1, padding: '1rem', borderRadius: '1rem', fontWeight: 700 }}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MonthlyRentModal({ isOpen, onClose, initialAmount, propertyId, tenancyId }: { isOpen: boolean, onClose: () => void, initialAmount: number, propertyId: string, tenancyId: string }) {
  const [amount, setAmount] = useState(initialAmount.toString());
  const [isIpcAdjustment, setIsIpcAdjustment] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) return;
    
    setIsSubmitting(true);
    try {
      await api.patch(`/properties/${propertyId}/tenancy/${tenancyId}/monthly-rent`, { 
        amount: numericAmount,
        isIpcAdjustment 
      });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', propertyId] });
      toast.success('Canon de arriendo actualizado');
      onClose();
    } catch (e) {
      toast.error('Error al actualizar canon de arriendo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
          <h2 className="font-heading" style={{ fontSize: '1.75rem', margin: 0 }}>Canon de Arriendo</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Actualiza el monto mensual del contrato.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Monto Mensual ($)</label>
            <input 
              type="number" 
              required 
              autoFocus
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ padding: '1rem', borderRadius: '1rem', border: '2px solid var(--border)', fontSize: '1.25rem', fontWeight: 700, width: '100%', textAlign: 'center' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-main)', marginTop: '0.25rem' }}>
              <input 
                type="checkbox" 
                checked={isIpcAdjustment} 
                onChange={e => setIsIpcAdjustment(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              <span>📈 Registrar como Reajuste de IPC (próxima alarma en 6 meses)</span>
            </label>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: '1rem', borderRadius: '1rem', fontWeight: 700 }}>Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 1, padding: '1rem', borderRadius: '1rem', fontWeight: 700 }}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeTenantModal({ isOpen, onClose, propertyId, tenancyId }: { isOpen: boolean, onClose: () => void, propertyId: string, tenancyId: string }) {
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();

  const { data: tenantsData } = useQuery<PaginatedResponse<TenantDto>>({
    queryKey: ['tenants', activeOrganization?.id, 'change-modal-list'],
    queryFn: async () => {
      const resp = await api.get('/tenants?limit=100&isActive=true');
      return resp.data;
    },
    enabled: isOpen && !!activeOrganization,
  });

  const tenants = tenantsData?.data || [];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) return;
    
    setIsSubmitting(true);
    try {
      await api.patch(`/properties/${propertyId}/tenancy/${tenancyId}/tenant`, { tenantId: selectedTenantId });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', propertyId] });
      toast.success('Inquilino actualizado');
      onClose();
    } catch (e) {
      toast.error('Error al actualizar inquilino');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', padding: '2rem' }}>
        <h2 className="font-heading" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>👤 Cambiar Inquilino</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Selecciona el inquilino real para asociar a este contrato histórico.
        </p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Seleccionar Arrendatario</label>
            <select 
              value={selectedTenantId}
              onChange={e => setSelectedTenantId(e.target.value)}
              required 
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.9rem', width: '100%' }}
            >
              <option value="">Seleccione un inquilino...</option>
              {tenants.map((t: TenantDto) => (
                <option key={t.id} value={t.id}>{t.name} ({t.documentId})</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={isSubmitting || !selectedTenantId} className="btn btn-primary" style={{ flex: 1 }}>
              {isSubmitting ? 'Actualizando...' : 'Actualizar Inquilino'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStartDateModal({ isOpen, onClose, propertyId, tenancyId, initialDate }: { isOpen: boolean, onClose: () => void, propertyId: string, tenancyId: string, initialDate: string }) {
  const [startDate, setStartDate] = useState(initialDate.split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.patch(`/properties/${propertyId}/tenancy/${tenancyId}/start-date`, { startDate });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['active-tenancy', propertyId] });
      toast.success('Fecha de inicio actualizada');
      onClose();
    } catch (e) {
      toast.error('Error al actualizar fecha de inicio');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗓️</div>
          <h2 className="font-heading" style={{ fontSize: '1.75rem', margin: 0 }}>Vigencia Contrato</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Ajusta la fecha de inicio del arriendo.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Nueva Fecha de Inicio</label>
            <input 
              type="date" 
              required 
              autoFocus
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ padding: '1.25rem', borderRadius: '1.25rem', border: '2px solid var(--border)', fontSize: '1.25rem', fontWeight: 800, width: '100%', textAlign: 'center', backgroundColor: '#f8fafc' }}
            />
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: '1rem', borderRadius: '1rem', fontWeight: 700 }}>Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 1, padding: '1rem', borderRadius: '1rem', fontWeight: 700 }}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
