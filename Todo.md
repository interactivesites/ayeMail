
## Functionality
- add del / space / T / S to email lsit (delete, archive, reminder, spam)

- Search (nav)

- Instead of selecting account, show all as accordion or like apple mail



#### MAIL
- set mails as read after 3 sec
- Add Folder list section (first section): Inboxes and make sections a tree (first level)
- MULTI Account handling /ADD to Folders: 
-- all accounts inboxes (first section)
-- custom folders of the app: reminders / lists of flagged items (if we have any)
- SPAM Logic?
-- Select ALL in a folder (EmailList) and make deletion possible? OR: junk/spam -> add clear button (autoclean)
- Move mails into folders

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
- EmailList.vue:65 Error archiving email: Error: Error invoking remote method 'emails:archive': SqliteError: UNIQUE constraint failed: emails.account_id, emails.folder_id, emails.uid

## Feat
- threads?
- ai to summarize, answer?
- Folder management: rename, order, delete, create?



## NEW UX
- make the grid a new view. 
- check: https://www.mailpilot.app/ 
- 
