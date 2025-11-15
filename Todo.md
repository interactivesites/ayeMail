
## Functionality
- add del / space / T / S to email lsit (delete, archive, reminder, spam)
- Mail editor / HTML reply
- Attachments
- Instead of selecting account, show all as accordion or like apple mail
- CC/BCC
- Search (nav)
- click on sender mail opens a new composer window
- autoomplete mails / recipients by name
- ADD to Folders: 
-- all accounts inboxes (first section)
-- custom folders of the app: reminders / lists of flagged items (if we have any)

#### MAIL
- does sqlite store folders? Use the cache first, then read inbox, when idle, rebuild folder struct (sync)

## UI
- add loading anims for load / send / refresh
- all checkboexs to toggles
- add unread count badge to folders
- make 3 columns (main) and give each its navigation (see apple mail) 

## Settings
- Signature management (RTE) / auto-add to some inbox
- formatters (date, time, etc.) - try to get from system
- language (i18n)
- Encryption: plan, check, implement.


## Bugs
- html mails with formatting (e.g. font) change the global app fonts - sandbox!


## Feat
- threads?
- ai to summarize, answer?