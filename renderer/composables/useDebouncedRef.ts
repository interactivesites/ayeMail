import { ref, watch, type Ref } from 'vue'

export function useDebouncedRef<T>(initial: T, delay = 300): { input: Ref<T>; debounced: Ref<T> } {
  const input = ref<T>(initial) as Ref<T>
  const debounced = ref<T>(initial) as Ref<T>

  let timer: ReturnType<typeof setTimeout> | null = null
  watch(input, (val) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = val as T
    }, delay)
  })

  return { input, debounced }
}

export default useDebouncedRef
