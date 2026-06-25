interface Props {
  title: string;
  description: string;
  icon: React.ReactNode;
}

/** Placeholder panel for mocked sections (calls, stories, linked devices). */
export default function ComingSoon({ title, description, icon }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-bg p-8 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-panel text-signal-blue">
        {icon}
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-xs text-sm text-muted">{description}</p>
      <span className="mt-5 rounded-full bg-panel px-4 py-1.5 text-xs font-medium text-muted">
        Coming soon
      </span>
    </div>
  );
}
