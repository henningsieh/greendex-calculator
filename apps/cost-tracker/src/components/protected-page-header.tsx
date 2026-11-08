type ProtectedPageHeaderProps = {
  eyebrow: string;
  title: string;
  /** A string or a streamed node (the shell renders it inside one paragraph). */
  description?: React.ReactNode;
  rightButton?: React.ReactNode;
};

export default function ProtectedPageHeader({
  eyebrow,
  title,
  description,
  rightButton,
}: ProtectedPageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-3xl min-w-0">
        <p className="type-ember-eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-lg/8 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {rightButton ? <div className="shrink-0">{rightButton}</div> : null}
    </header>
  );
}
