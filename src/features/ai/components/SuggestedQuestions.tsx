export function SuggestedQuestions({ questions, onSelect, disabled }: { questions: string[]; onSelect: (question: string) => void; disabled: boolean }) {
  return <div className="suggested-questions"><span className="suggested-label">SUGGESTED QUESTIONS</span>{questions.map(question => <button key={question} type="button" onClick={() => onSelect(question)} disabled={disabled}>{question}<span aria-hidden="true">↗</span></button>)}</div>;
}
