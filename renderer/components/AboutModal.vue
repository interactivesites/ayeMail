<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden transform transition-all">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-primary-50 to-primary-100 dark:from-gray-800 dark:to-gray-850">
        <div class="flex items-center space-x-4">
          <div class="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">iMail</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">Secure Email Client</p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg"
        >
          <XMarkIcon class="w-6 h-6" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Version Info -->
        <div class="text-center py-4">
          <div class="inline-block px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-full">
            <span class="text-sm font-semibold text-primary-700 dark:text-primary-300">Version {{ version }}</span>
          </div>
        </div>

        <!-- Description -->
        <div class="text-center space-y-3">
          <p class="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
            A modern, secure email client built with Electron. Designed for privacy and productivity.
          </p>
        </div>

        <!-- Features Grid -->
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all group cursor-pointer">
            <div class="flex items-center space-x-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">Secure</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400">End-to-end encryption support</p>
          </div>

          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all group cursor-pointer">
            <div class="flex items-center space-x-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">Fast</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400">Lightning quick sync</p>
          </div>

          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all group cursor-pointer">
            <div class="flex items-center space-x-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">Modern</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400">Beautiful, intuitive UI</p>
          </div>

          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all group cursor-pointer">
            <div class="flex items-center space-x-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">Private</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400">Your data stays local</p>
          </div>
        </div>

        <!-- Buy Me a Coffee Button -->
        <div class="pt-4 pb-2">
          <a
            href="https://buymeacoffee.com/interactivesites"
            target="_blank"
            rel="noopener noreferrer"
            class="group relative flex items-center justify-center w-full px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div class="flex items-center space-x-3">
              <svg class="w-6 h-6 text-white transform group-hover:rotate-12 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.38 0 2.5-1.12 2.5-2.5S19.88 3 18.5 3zm-.5 2v3h-2V5h2zm-2-1h2v1h-2V4zM6 5h8v5.71c0 2.67-1.94 4.94-4.5 5.29-2.56-.35-4.5-2.62-4.5-5.29V5z"/>
                <path d="M5 19h14v2H5z"/>
              </svg>
              <span class="text-white font-semibold text-lg">Buy me a coffee</span>
              <svg class="w-5 h-5 text-white transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div class="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </a>
          <p class="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
            Support the development of iMail
          </p>
        </div>

        <!-- Links -->
        <div class="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href="https://github.com/interactivesites"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group"
          >
            <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
              <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.197 22 16.425 22 12.017c0-5.533-4.477-10-10-10z" clip-rule="evenodd"/>
            </svg>
            <span class="text-sm">GitHub</span>
          </a>
          <a
            href="https://interactivesites.co.nz"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group"
          >
            <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span class="text-sm">Website</span>
          </a>
        </div>

        <!-- Footer -->
        <div class="text-center pt-4">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Made with <span class="text-red-500">♥</span> for better email experience
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
            © {{ currentYear }} iMail. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits<{
  'close': []
}>()

const version = '1.0.0-alpha.1'
const currentYear = computed(() => new Date().getFullYear())
</script>

