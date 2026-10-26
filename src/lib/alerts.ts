import Swal from 'sweetalert2';
const ACCENT = '#087e70',
  DANGER = '#a5293e';
export async function confirmAction(text: string, confirmText = 'Supprimer') {
  const r = await Swal.fire({
    icon: 'warning',
    title: 'Confirmation',
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Annuler',
    confirmButtonColor: DANGER,
    cancelButtonColor: '#657789',
    reverseButtons: true,
    focusCancel: true,
  });
  return r.isConfirmed;
}
export function toast(title: string, icon: 'success' | 'error' = 'success') {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    iconColor: icon === 'success' ? ACCENT : DANGER,
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  });
}
