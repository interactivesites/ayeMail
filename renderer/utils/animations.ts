import { gsap } from 'gsap'

export function animateCardDrag(element: HTMLElement, x: number, y: number) {
  gsap.to(element, {
    x,
    y,
    duration: 0.2,
    ease: 'power2.out'
  })
}

export function animateCardDrop(element: HTMLElement, targetX: number, targetY: number, onComplete?: () => void) {
  gsap.to(element, {
    x: targetX,
    y: targetY,
    duration: 0.3,
    ease: 'back.out(1.2)',
    onComplete
  })
}

export function animateCardEnter(element: HTMLElement, delay: number = 0) {
  gsap.from(element, {
    opacity: 0,
    y: 20,
    duration: 0.4,
    delay,
    ease: 'power2.out'
  })
}

export function animateColumnTransition(element: HTMLElement, direction: 'left' | 'right') {
  const x = direction === 'left' ? -20 : 20
  gsap.from(element, {
    opacity: 0,
    x,
    duration: 0.3,
    ease: 'power2.out'
  })
}

export function animateSectionExpand(element: HTMLElement) {
  gsap.to(element, {
    height: 'auto',
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out'
  })
}

export function animateSectionCollapse(element: HTMLElement, onComplete?: () => void) {
  gsap.to(element, {
    height: 0,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete
  })
}

export function animateStatusChange(element: HTMLElement) {
  gsap.to(element, {
    scale: 1.05,
    duration: 0.15,
    yoyo: true,
    repeat: 1,
    ease: 'power2.inOut'
  })
}

export function resetTransform(element: HTMLElement) {
  gsap.set(element, { x: 0, y: 0, scale: 1 })
}

