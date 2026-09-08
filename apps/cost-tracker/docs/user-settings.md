# User settings

The protected `/user-settings` route owns personal Cost Tracker preferences and current-user account details. Settings-local tabs keep Appearance and Account details as separate views; only the selected concern is rendered.

## Appearance

- The light/dark choice uses the application `next-themes` provider and is saved in the current browser.
- Pressing `d` outside an input, textarea, select, or editable element switches between the resolved light and dark themes from every route.
- The settings page makes this global shortcut visible next to the theme control.

## Account name

The edit-name form validates on the client with React Hook Form, `zodResolver`, and `EditNameSchema`. The feature schema starts with `createUpdateSchema(user)` from the shared Drizzle auth table, then selects and refines the user-editable `name` field. `EditNameValues` is inferred from that schema.

The signed-in user updates their own name through Better Auth's `authClient.updateUser`. A successful update refreshes the route so the server-rendered navigation receives the current session name. Email is shown for identity context but is not editable in this feature.

## Ownership

```text
src/features/user-settings/
├── components/
│   ├── edit-name-form.tsx
│   ├── theme-settings.tsx
│   └── user-settings-tabs.tsx
├── types.ts
└── validation-schemas.ts
```

The route passes server-loaded session data into the feature-owned tab composition; shared navigation and theme-provider mechanics remain in `src/components/`. Feature-local tests cover tab separation, persisted-name schema boundaries, form validation, pending state, Better Auth success and failure, and session UI refresh.
