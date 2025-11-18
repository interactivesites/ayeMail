declare module 'node-mac-contacts' {
  export function requestAccess(): Promise<boolean>
  export function getAllContacts(): Promise<Array<{
    firstName?: string
    lastName?: string
    emailAddresses?: string[]
    phoneNumbers?: string[]
  }>>
}

