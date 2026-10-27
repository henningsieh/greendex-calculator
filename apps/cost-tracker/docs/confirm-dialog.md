# Confirm an action

Use `useConfirmDialog` from `@/components/confirm-dialog` for actions that need confirmation.
Render the returned `dialog` beside the trigger. Await `confirm` before starting the mutation.

```tsx
const { confirm, dialog } = useConfirmDialog();

async function remove() {
  if (
    await confirm({
      title: t("remove.title"),
      description: t("remove.description"),
      confirmText: t("remove.execute"),
      isDestructive: true,
    })
  ) {
    mutation.mutate(id);
  }
}
```

Omit `confirmText`, `cancelText`, and `closeText` to use translated Confirm, Cancel, and Close labels.
Keep an explicit `confirmText` when the action requires specific wording.
Dismissal and unmount resolve `false`. A concurrent request resolves `false` without replacing the open dialog.
Keep mutation pending state in the caller and disable its trigger until that request settles.
