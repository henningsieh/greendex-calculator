type ProtectedPageHeaderProps = {
  eyebrow: string;
  title: string;
  rightButton?: React.ReactNode;
} & (
  | { description?: string; bottomLink?: never }
  | { description?: never; bottomLink: React.ReactNode }
);

export default function ProtectedPageHeader({
  eyebrow,
  title,
  description,
  bottomLink,
  rightButton,
}: ProtectedPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-lg/8 text-muted-foreground">{description}</p>
        ) : (
          bottomLink
        )}
      </div>
      {rightButton ? <div className="shrink-0">{rightButton}</div> : null}
    </header>
  );
}
