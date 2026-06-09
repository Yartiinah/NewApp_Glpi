<template>
  <div v-if="message" class="alert" :class="`alert-${type}`">
    {{ message }}
  </div>
</template>

<script setup>
defineProps({
  message: String,
  type: { type: String, default: 'success' } // 'success' ou 'error'
})
</script>
