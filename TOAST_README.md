# Sistema de Toast Notifications

Este sistema proporciona notificaciones toast elegantes y fáciles de usar para mostrar mensajes de éxito, error, advertencia e información en toda la aplicación.

## Características

- ✅ **Múltiples tipos**: success, error, warning, info
- ⏱️ **Auto-hide**: Se ocultan automáticamente después de un tiempo configurable
- 📊 **Barra de progreso**: Muestra visualmente el tiempo restante
- 🎨 **Animaciones suaves**: Entrada y salida con transiciones
- 🎯 **Posicionamiento inteligente**: Aparecen en la esquina superior derecha
- 🔧 **Fácil de usar**: API simple y intuitiva
- 🎨 **Diseño moderno**: Interfaz limpia y responsive

## Uso Básico

### Importar las utilidades

```typescript
import { toast, toastHelpers } from '$lib/utils/toast.js';
```

### Métodos básicos

```typescript
// Toast de éxito
toast.success('Operación completada exitosamente');

// Toast de error
toast.error('Algo salió mal');

// Toast de advertencia
toast.warning('Tenga cuidado con esto');

// Toast informativo
toast.info('Información importante');

// Con duración personalizada (en milisegundos)
toast.success('Mensaje', 3000); // 3 segundos
```

### Helpers predefinidos

```typescript
// Mensajes de éxito comunes
toastHelpers.emailSent();
toastHelpers.itemCreated('Usuario');
toastHelpers.itemUpdated('Factura');
toastHelpers.itemDeleted('Producto');
toastHelpers.paymentMarked();
toastHelpers.receivedMarked();

// Mensajes de error comunes
toastHelpers.emailError('Error específico del email');
toastHelpers.createError('Usuario', 'Error específico');
toastHelpers.updateError('Factura', 'Error específico');
toastHelpers.deleteError('Producto', 'Error específico');
toastHelpers.networkError();
toastHelpers.validationError('Campo requerido');

// Mensajes de advertencia
toastHelpers.confirmDelete('Usuario');
toastHelpers.unsavedChanges();

// Mensajes informativos
toastHelpers.loading('Cargando datos...');
toastHelpers.saving();
toastHelpers.processing();
```

## Ejemplos de Uso

### En un formulario

```typescript
async function handleSubmit() {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      toastHelpers.itemCreated('Usuario');
      // Reset form, redirect, etc.
    } else {
      const error = await response.json();
      toastHelpers.createError('Usuario', error.message);
    }
  } catch (error) {
    toastHelpers.networkError();
  }
}
```

### En operaciones de eliminación

```typescript
async function deleteItem(id: string) {
  if (confirm('¿Está seguro?')) {
    try {
      const response = await fetch(`/api/items/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toastHelpers.itemDeleted('Item');
        // Refresh list, etc.
      } else {
        toastHelpers.deleteError('Item');
      }
    } catch (error) {
      toastHelpers.networkError();
    }
  }
}
```

### En envío de emails

```typescript
async function sendEmail() {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      body: emailData
    });
    
    if (response.ok) {
      toastHelpers.emailSent();
    } else {
      const error = await response.json();
      toastHelpers.emailError(error.message);
    }
  } catch (error) {
    toastHelpers.networkError();
  }
}
```

## Personalización

### Cambiar duración por defecto

```typescript
// Toast que dura 10 segundos
toast.success('Mensaje largo', 10000);

// Toast que no se auto-oculta
toast.info('Mensaje persistente', 0);
```

### Limpiar todos los toasts

```typescript
import { toastStore } from '$lib/stores/toast.js';

// Limpiar todos los toasts activos
toastStore.clear();
```

## Estructura de Archivos

```
src/lib/
├── components/
│   ├── Toast.svelte          # Componente individual de toast (Svelte 5)
│   └── ToastContainer.svelte # Contenedor de múltiples toasts (Svelte 5)
├── stores/
│   └── toast.ts             # Store para manejar el estado
└── utils/
    └── toast.ts             # Utilidades y helpers
```

## Tecnología

Este sistema está construido con **Svelte 5** y utiliza las nuevas runas:
- `$props()` para las propiedades del componente
- `$state()` para el estado reactivo
- `$effect()` para efectos secundarios
- `$derived()` para valores derivados

## Integración

El sistema ya está integrado en el layout principal (`src/routes/+layout.svelte`) y está disponible en toda la aplicación. No se requiere configuración adicional.

## Estilos

Los toasts usan Tailwind CSS y están diseñados para ser consistentes con el resto de la aplicación. Los colores y estilos se adaptan automáticamente según el tipo de mensaje:

- **Success**: Verde
- **Error**: Rojo  
- **Warning**: Amarillo
- **Info**: Azul

## Accesibilidad

- Los toasts incluyen texto para lectores de pantalla
- Se pueden cerrar con el teclado
- Cumplen con las pautas de accesibilidad WCAG
