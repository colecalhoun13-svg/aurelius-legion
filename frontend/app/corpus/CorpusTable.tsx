type CorpusTableProps = {
  domain: string;
  onSelectEntry: (id: string) => void;
};

export default function CorpusTable({
  domain,
  onSelectEntry,
}: CorpusTableProps) {
  const entries: { id: string; text: string }[] = [
    { id: "1", text: `Sample entry for ${domain}` },
  ];

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Entries for {domain}</h2>

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="cursor-pointer hover:text-aurelius-gold"
            onClick={() => onSelectEntry(entry.id)}
          >
            {entry.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
