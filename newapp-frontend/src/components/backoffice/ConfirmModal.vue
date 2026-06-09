<!-- src/components/backoffice/ConfirmModal.vue -->
<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="buttons">
        <button class="cancel" @click="$emit('cancel')">Annuler</button>
        <button class="confirm" @click="$emit('confirm')" :disabled="loading">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: Boolean,
  title: { type: String, default: 'Confirmation' },
  message: { type: String, default: 'Êtes-vous sûr ?' },
  confirmLabel: { type: String, default: 'Confirmer' },
  loading: { type: Boolean, default: false }
})
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  min-width: 300px;
  max-width: 400px;
}
.modal h3 { margin-bottom: 0.5rem; }
.modal p { color: #64748b; margin-bottom: 1rem; }
.buttons { display: flex; gap: 0.5rem; justify-content: flex-end; }
.cancel { padding: 0.5rem 1rem; background: #e2e8f0; border: none; border-radius: 0.3rem; cursor: pointer; }
.confirm { padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 0.3rem; cursor: pointer; }
.confirm:disabled { opacity: 0.5; cursor: not-allowed; }
</style>