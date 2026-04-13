"use client";

import { useState } from "react";
import CorpusSidebar from "./CorpusSidebar";
import CorpusTable from "./CorpusTable";

export default function CorpusPage() {
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  const handleSelectDomain = (domain: string) => {
    setSelectedDomain(domain);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value);
  };

  return (
    <div className="flex">
      <CorpusSidebar
        domains={["training", "nutrition", "mindset"]}
        onSelectDomain={handleSelectDomain}
      />

      {selectedDomain && (
        <CorpusTable
          domain={selectedDomain}
          onSelectEntry={(id) => console.log("Selected entry:", id)}
        />
      )}

      <input
        type="text"
        className="ml-4 p-2 bg-aurelius-panel border border-aurelius-border"
        onChange={handleInput}
      />
    </div>
  );
}
