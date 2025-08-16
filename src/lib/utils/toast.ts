import { toastStore } from '../stores/toast.js';

// Re-export the store methods for easier access
export const toast = {
	success: (message: string, duration?: number) => toastStore.success(message, duration),
	error: (message: string, duration?: number) => toastStore.error(message, duration),
	warning: (message: string, duration?: number) => toastStore.warning(message, duration),
	info: (message: string, duration?: number) => toastStore.info(message, duration),
	clear: () => toastStore.clear()
};

// Helper functions for common scenarios
export const toastHelpers = {
	// Success messages
	emailSent: () => toast.success('Email enviado correctamente'),
	itemCreated: (itemName: string) => toast.success(`${itemName} creado exitosamente`),
	itemUpdated: (itemName: string) => toast.success(`${itemName} actualizado exitosamente`),
	itemDeleted: (itemName: string) => toast.success(`${itemName} eliminado exitosamente`),
	paymentMarked: () => toast.success('Pago marcado como completado'),
	receivedMarked: () => toast.success('Recepción marcada como completada'),
	
	// Error messages
	emailError: (error?: string) => toast.error(error || 'Error al enviar email'),
	createError: (itemName: string, error?: string) => toast.error(error || `Error al crear ${itemName}`),
	updateError: (itemName: string, error?: string) => toast.error(error || `Error al actualizar ${itemName}`),
	deleteError: (itemName: string, error?: string) => toast.error(error || `Error al eliminar ${itemName}`),
	networkError: () => toast.error('Error de conexión. Intente nuevamente'),
	validationError: (message: string) => toast.error(message),
	
	// Warning messages
	confirmDelete: (itemName: string) => toast.warning(`¿Está seguro de eliminar ${itemName}?`),
	unsavedChanges: () => toast.warning('Tiene cambios sin guardar'),
	
	// Info messages
	loading: (message: string) => toast.info(message),
	saving: () => toast.info('Guardando...'),
	processing: () => toast.info('Procesando...')
};
