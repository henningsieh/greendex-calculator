// ensureStatic = 'navigation': fully static page (#246).
export const ensureStatic = "navigation";

export default function TipsAndTricksPage() {
  return (
    <main className="relative min-h-screen py-28">
      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-semibold lg:text-5xl">
            Tips & Tricks
          </h1>
          <p className="text-muted-foreground">
            Learn how to make the most of Greendex
          </p>
        </div>
      </div>
    </main>
  );
}
