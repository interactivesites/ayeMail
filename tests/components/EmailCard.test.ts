import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EmailCard from '../../renderer/components/EmailCard.vue'
import type { Email } from '../../shared/types'

describe('EmailCard', () => {
  const createEmail = (overrides?: Partial<Email>): Email => ({
    id: '1',
    accountId: 'account-1',
    folderId: 'inbox',
    uid: 1,
    messageId: 'msg-123',
    subject: 'Test Subject',
    from: [{ name: 'John Doe', address: 'john@example.com' }],
    to: [{ name: 'Jane Smith', address: 'jane@example.com' }],
    date: Date.now(),
    body: 'Test email body',
    attachments: [],
    flags: [],
    isRead: false,
    isStarred: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  })

  it('should render email subject', () => {
    const email = createEmail()
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: false
      }
    })

    expect(wrapper.text()).toContain('Test Subject')
  })

  it('should display sender name', () => {
    const email = createEmail()
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: false
      }
    })

    expect(wrapper.text()).toContain('John Doe')
  })

  it('should show encrypted indicator when email is encrypted', () => {
    const email = createEmail({ encrypted: true })
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: false
      }
    })

    expect(wrapper.text()).toContain('🔒')
  })

  it('should show signed indicator when email is signed', () => {
    const email = createEmail({ signed: true })
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: false
      }
    })

    expect(wrapper.text()).toContain('✓')
  })

  it('should show starred indicator when email is starred', () => {
    const email = createEmail({ isStarred: true })
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: false
      }
    })

    expect(wrapper.text()).toContain('★')
  })

  it('should apply selected class when isSelected is true', () => {
    const email = createEmail()
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: true
      }
    })

    const card = wrapper.find('.email-card')
    expect(card.classes()).toContain('ring-2')
  })

  it('should emit click event when clicked', async () => {
    const email = createEmail()
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: false
      }
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('should display "(No subject)" when subject is empty', () => {
    const email = createEmail({ subject: '' })
    const wrapper = mount(EmailCard, {
      props: {
        email,
        isSelected: false
      }
    })

    expect(wrapper.text()).toContain('(No subject)')
  })
})

